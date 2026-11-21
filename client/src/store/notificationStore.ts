import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { NotificationItem } from '@trivia/shared';
import { useGameStore } from './gameStore';
import { PAGE_TTL, PageDataError, fetchPageJson, pageDataCache } from '../utils/pageDataCache';
import { inboxUrl } from '../utils/pageResources';

const STORAGE_PREFIX = 'tavriko_notification_reads_v1:';
const SAMPLE_PREFIXES = ['notif_fr_sample', 'notif_duel_sample', 'notif_rew_sample'];
// Eski sürümlerin sahte varsayılan bildirimleri (tam eşleşme).
const MOCK_IDS = ['notif_welcome', 'notif_duel_1', 'notif_season'];

export function cleanNotifications(items: NotificationItem[]): NotificationItem[] {
  const unique = new Map<string, NotificationItem>();
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || SAMPLE_PREFIXES.some(p => item.id.startsWith(p)) || MOCK_IDS.includes(item.id)) continue;
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

function parseIds(raw: string | null | undefined): string[] {
  try {
    const value = JSON.parse(raw || '[]');
    return Array.isArray(value) ? value.filter(id => typeof id === 'string') : [];
  } catch { return []; }
}

/**
 * Okundu bilgisi kalıcıdır — hem web'de hem mobil uygulamada.
 * Web: localStorage (önceki davranışla aynı).
 * Mobil: expo-secure-store. Okuma asenkron olduğu için açılışta bellek
 * önbelleği doldurulur ve gelince mağazaya uygulanır; böylece uygulama
 * kapatılıp açıldığında görülmüş bildirimler YENİ sayılmaz (rozet 0 kalır).
 */
const nativeReceiptCache = new Map<string, string[]>();

function readReceipts(userId: string): string[] {
  if (Platform.OS === 'web') {
    try {
      return parseIds(localStorage.getItem(STORAGE_PREFIX + userId));
    } catch { return []; }
  }
  return nativeReceiptCache.get(userId) ?? [];
}

function saveReceipts(userId: string | null, ids: string[]) {
  if (!userId) return;
  if (Platform.OS === 'web') {
    try { localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(ids)); } catch {}
    return;
  }
  nativeReceiptCache.set(userId, ids);
  void SecureStore.setItemAsync(STORAGE_PREFIX + userId, JSON.stringify(ids)).catch(() => {});
}

/** Mobilde güvenli depodan okundu bilgilerini yükleyip mağazaya uygular. */
async function hydrateReceipts(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const stored = parseIds(await SecureStore.getItemAsync(STORAGE_PREFIX + userId));
    if (!stored.length) return;
    const merged = Array.from(new Set([...(nativeReceiptCache.get(userId) ?? []), ...stored]));
    nativeReceiptCache.set(userId, merged);
    const state = useNotificationStore.getState();
    if (state.userId !== userId) return;
    const readIds = Array.from(new Set([...state.readIds, ...merged])).slice(-1000);
    useNotificationStore.setState({
      readIds,
      toast: state.toast && readIds.includes(state.toast.id) ? null : state.toast,
    });
  } catch {}
}

interface NotificationState {
  userId: string | null;
  items: NotificationItem[];
  readIds: string[];
  loading: boolean;
  hydrated: boolean;
  error: string | null;
  toast: NotificationItem | null;
  activate: (userId: string | null, initial?: NotificationItem[]) => void;
  receive: (item: NotificationItem) => boolean;
  mergeSnapshot: (items: NotificationItem[]) => void;
  patch: (id: string, update: Partial<NotificationItem>) => void;
  markRead: (ids: string[]) => void;
  markAllSeen: () => void;
  dismissToast: () => void;
  refresh: (base: string, force?: boolean) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => {
  let epoch = 0;
  let pending: Promise<void> | undefined;
  return {
  userId: null, items: [], readIds: [], loading: false, hydrated: false, error: null, toast: null,
  activate: (userId, initial = []) => {
    epoch++;
    pending = undefined;
    set({
      userId, items: userId ? cleanNotifications(initial) : [],
      readIds: userId ? readReceipts(userId) : [],
      loading: false, hydrated: false, error: null, toast: null,
    });
    // Mobilde kalıcı okundu bilgileri asenkron yüklenir ve gelince uygulanır.
    if (userId) void hydrateReceipts(userId);
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
  markAllSeen: () => {
    const state = get();
    const ids = state.items.filter(item => isUnread(item, state.readIds)).map(item => item.id);
    if (ids.length) get().markRead(ids);
  },
  refresh: (base, force) => {
    const owner = get().userId;
    if (!owner) return Promise.resolve();
    const session = useGameStore.getState();
    if (session.user?.id !== owner) return Promise.resolve();
    if (pending) return pending;
    const url = inboxUrl(base, owner);
    const stamp = pageDataCache.snapshot(url, owner).updatedAt;
    if (!force && get().hydrated && stamp !== undefined && Date.now() - stamp < PAGE_TTL.inbox) return Promise.resolve();
    const requestEpoch = epoch;
    const isCurrent = () => epoch === requestEpoch && get().userId === owner
      && useGameStore.getState().user?.id === owner && useGameStore.getState().token === session.token;
    // Avoid flashing the refresh icon when an automatic poll already has a snapshot.
    set({ loading: Boolean(force || !get().hydrated), error: null });
    pending = pageDataCache.load(url, PAGE_TTL.inbox, {
      scope: owner, token: session.token, force,
      fetcher: async signal => {
        const { notifications } = await fetchPageJson<{ notifications: NotificationItem[] }>(url, signal, session.token);
        if (!Array.isArray(notifications)) throw new Error('Bildirimler alınamadı.');
        return notifications;
      },
    }).then(items => {
      if (!isCurrent()) return;
      get().mergeSnapshot(items);
      set({ hydrated: true, error: null });
    }).catch(error => {
      if (!isCurrent()) return;
      if (error instanceof PageDataError && [401, 403, 404].includes(error.status)) set({ items: [], toast: null });
      set({ error: 'Bağlantı kurulamadı. Bildirimlerini yeniden yükleyebilirsin.' });
    }).finally(() => {
      if (epoch === requestEpoch) pending = undefined;
      if (isCurrent()) set({ loading: false });
    });
    return pending;
  },
  };
});

export function useUnreadCount() {
  return useNotificationStore(state => unreadCount(state.items, state.readIds));
}
