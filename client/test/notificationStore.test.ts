import type { NotificationItem } from '@trivia/shared';
import { cleanNotifications, isUnread, unreadCount, useNotificationStore } from '../src/store/notificationStore';

const makeNotification = (id: string, extra: Partial<NotificationItem> = {}): NotificationItem => ({
  id, type: 'system', title: 'Yeni haber', sub: 'Birlikte oyna.', timeText: 'Şimdi', ...extra,
});
const inbox = () => useNotificationStore.getState();

describe('Shared notification inbox and exact unread count', () => {
  const memory = new Map<string, string>();
  beforeEach(() => {
    memory.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: (key: string) => memory.get(key) || null, setItem: (key: string, value: string) => memory.set(key, value) },
    });
    inbox().activate('player-a');
  });

  it('increments 0 → 1 → 2 and deduplicates both socket paths', () => {
    expect(unreadCount(inbox().items, inbox().readIds)).toBe(0);
    expect(inbox().receive(makeNotification('one'))).toBe(true);
    expect(unreadCount(inbox().items, inbox().readIds)).toBe(1);
    expect(inbox().receive(makeNotification('two'))).toBe(true);
    expect(unreadCount(inbox().items, inbox().readIds)).toBe(2);
    expect(inbox().receive(makeNotification('two'))).toBe(false);
    expect(unreadCount(inbox().items, inbox().readIds)).toBe(2);
    expect(inbox().items).toHaveLength(2);
  });

  it('marks one and then all read without accepting any invite', () => {
    inbox().receive(makeNotification('one', { type: 'friend_request' }));
    inbox().receive(makeNotification('two'));
    inbox().markRead(['one']);
    expect(unreadCount(inbox().items, inbox().readIds)).toBe(1);
    expect(inbox().items.find(n => n.id === 'one')?.handled).toBeUndefined();
    inbox().markRead(['one', 'two']);
    expect(unreadCount(inbox().items, inbox().readIds)).toBe(0);
  });

  it('persists read receipts across reloads on the same account', () => {
    inbox().receive(makeNotification('one'));
    inbox().markRead(['one']);
    inbox().activate('player-a', [makeNotification('one'), makeNotification('two')]);
    expect(unreadCount(inbox().items, inbox().readIds)).toBe(1);
    expect(inbox().receive(makeNotification('one'))).toBe(false);
  });

  it('isolates account receipts and clears banners on logout', () => {
    inbox().receive(makeNotification('one'));
    inbox().markRead(['one']);
    inbox().activate('player-b', [makeNotification('one')]);
    expect(unreadCount(inbox().items, inbox().readIds)).toBe(1);
    inbox().activate(null);
    expect(inbox().items).toEqual([]);
    expect(inbox().toast).toBeNull();
    expect(inbox().receive(makeNotification('two'))).toBe(false);
  });

  it('does not lose socket arrivals when an older HTTP snapshot completes', () => {
    inbox().receive(makeNotification('late'));
    inbox().mergeSnapshot([makeNotification('earlier')]);
    expect(inbox().items.map(n => n.id)).toEqual(['late', 'earlier']);
    expect(unreadCount(inbox().items, inbox().readIds)).toBe(2);
  });

  it('does not revert handled invites on stale HTTP or socket delivery', () => {
    const invite = makeNotification('invite', { type: 'duel' });
    inbox().receive(invite);
    inbox().patch('invite', { handled: 'accepted', sub: 'Kabul edildi.' });
    inbox().mergeSnapshot([invite]);
    inbox().receive(invite);
    expect(inbox().items[0].handled).toBe('accepted');
    expect(inbox().items[0].sub).toBe('Kabul edildi.');
    expect(unreadCount(inbox().items, inbox().readIds)).toBe(0);
  });

  it('counts an incoming system acceptance message even if marked handled', () => {
    expect(isUnread(makeNotification('accept', { type: 'system', handled: 'accepted' }), [])).toBe(true);
    expect(isUnread(makeNotification('decline', { type: 'friend_request', handled: 'declined' }), [])).toBe(false);
  });

  it('filters only legacy samples and merges duplicates', () => {
    expect(cleanNotifications([
      makeNotification('notif_fr_sample_1'), makeNotification('notif_duel_sample_2'),
      makeNotification('notif_rew_sample_3'), makeNotification('real'), makeNotification('real', { sub: 'Güncel' }),
    ])).toEqual([makeNotification('real', { sub: 'Güncel' })]);
  });

  it('stays functional when browser storage is blocked', () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('SecurityError'); } });
    expect(() => inbox().activate('private-browser')).not.toThrow();
    inbox().receive(makeNotification('one'));
    expect(() => inbox().markRead(['one'])).not.toThrow();
    expect(unreadCount(inbox().items, inbox().readIds)).toBe(0);
  });

  it('ignores an HTTP response after changing accounts', async () => {
    let resolve!: (value: unknown) => void;
    globalThis.fetch = jest.fn(() => new Promise(done => { resolve = done; })) as any;
    const request = inbox().refresh('/api');
    inbox().activate('player-b');
    resolve({ ok: true, json: async () => ({ notifications: [makeNotification('private-a')] }) });
    await request;
    expect(inbox().userId).toBe('player-b');
    expect(inbox().items).toEqual([]);
  });

  it('shows a retryable error without losing existing messages', async () => {
    inbox().receive(makeNotification('one'));
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await inbox().refresh('/api');
    expect(inbox().error).toContain('yeniden');
    expect(inbox().items).toHaveLength(1);
    expect(inbox().loading).toBe(false);
  });
});
