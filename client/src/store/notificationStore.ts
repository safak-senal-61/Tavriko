import { create } from 'zustand';
import type { NotificationItem } from '@trivia/shared';

const STORAGE_PREFIX = 'tavriko_notification_reads_v1:';
const SAMPLE_PREFIXES = ['notif_fr_sample', 'notif_duel_sample', 'notif_rew_sample'];

export function cleanNotifications(items: NotificationItem[]): NotificationItem[] {
  const unique = new Map<string, NotificationItem>();
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || SAMPLE_PREFIXES.some(p => item.id.startsWith(p))) continue;
    unique.set(item.id, { ...unique.get(item.id), ...item });
  }
  return Array.from(unique.values());
}

export const isInvitation = (item: NotificationItem) =>
  ['friend', 'friend_request', 'duel', 'match_invite'].includes(item.type);

export const isUnread = (item: NotificationItem, readIds: string[]) =>
  !readIds.includes(item.id) && !(isInvitation(item) && item.handled);

export const unreadCount = (items: NotificationItem[], readIds: string[]) =>
  cleanNotifications(items).filter(item => isUnread(item, readIds)).length;

function readReceipts(userId: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_PREFIX + userId) || '[]');
    return Array.isArray(value) ? value.filter(id => typeof id === 'string') : [];
  } catch { return []; }
}

function saveReceipts(userId: string | null, ids: string[]) {
  if (!userId) return;
  try { localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(ids)); } catch {}
}

interface NotificationState {
  userId: string | null;
  items: NotificationItem[];
  readIds: string[];
  loading: boolean;
  error: string | null;
  toast: NotificationItem | null;
  activate: (userId: string | null, initial?: NotificationItem[]) => void;
  receive: (item: NotificationItem) => boolean;
  mergeSnapshot: (items: NotificationItem[]) => void;
  patch: (id: string, update: Partial<NotificationItem>) => void;
  markRead: (ids: string[]) => void;
  dismissToast: () => void;
  refresh: (base: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  userId: null, items: [], readIds: [], loading: false, error: null, toast: null,
  activate: (userId, initial = []) => {
    set({
      userId, items: userId ? cleanNotifications(initial) : [],
      readIds: userId ? readReceipts(userId) : [],
      loading: false, error: null, toast: null,
    });
  },
  receive: item => {
    const clean = cleanNotifications([item])[0];
    if (!get().userId || !clean) return false;
    const existing = get().items.find(n => n.id === clean.id);
    const incoming = existing?.handled && isInvitation(existing)
      ? { ...clean, handled: existing.handled, sub: existing.sub } : clean;
    set(state => ({
      items: cleanNotifications([incoming, ...state.items.filter(n => n.id !== clean.id)]),
      toast: existing || state.readIds.includes(clean.id) ? state.toast : clean,
    }));
    return !existing && !get().readIds.includes(clean.id);
  },
  mergeSnapshot: fresh => {
    set(state => ({
      // Keep socket-only arrivals even if an older HTTP request finishes later.
      // A stale unhandled snapshot must not undo an accepted/declined invitation.
      items: cleanNotifications([
        ...state.items.filter(item => !fresh.some(n => n.id === item.id)),
        ...fresh.map(item => {
          const current = state.items.find(n => n.id === item.id);
          return current?.handled && isInvitation(current)
            ? { ...item, handled: current.handled, sub: current.sub } : item;
        }),
      ]),
    }));
  },
  patch: (id, update) => set(state => ({
    items: state.items.map(item => item.id === id ? { ...item, ...update } : item),
  })),
  markRead: ids => {
    const state = get();
    const available = new Set(state.items.map(item => item.id));
    const readIds = Array.from(new Set([...state.readIds, ...ids.filter(id => available.has(id))])).slice(-1000);
    saveReceipts(state.userId, readIds);
    set({ readIds, toast: state.toast && readIds.includes(state.toast.id) ? null : state.toast });
  },
  dismissToast: () => set({ toast: null }),
  refresh: async base => {
    const owner = get().userId;
    if (!owner) return;
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${base}/social/notifications/${encodeURIComponent(owner)}`);
      if (!response.ok) throw new Error('Bildirimler alınamadı.');
      const data = await response.json();
      if (!Array.isArray(data.notifications)) throw new Error('Bildirimler alınamadı.');
      if (get().userId === owner) {
        get().mergeSnapshot(data.notifications);
        set({ error: null });
      }
    } catch {
      if (get().userId === owner) set({ error: 'Bağlantı kurulamadı. Bildirimlerini yeniden yükleyebilirsin.' });
    } finally {
      if (get().userId === owner) set({ loading: false });
    }
  },
}));

export function useUnreadCount() {
  return useNotificationStore(state => unreadCount(state.items, state.readIds));
}
