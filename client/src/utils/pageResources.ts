import { pageDataCache } from './pageDataCache';

const endpoint = (base: string, path: string) => `${base.replace(/\/+$/, '')}${path}`;
export const categoriesUrl = (base: string) => endpoint(base, '/categories');
export const leaderboardUrl = (base: string) => endpoint(base, '/social/leaderboard');
export const friendsUrl = (base: string, owner: string) => endpoint(base, `/social/friends/${encodeURIComponent(owner)}`);
export const eventsUrl = (base: string, owner: string) => endpoint(base, `/social/events?userId=${encodeURIComponent(owner)}`);
export const profileUrl = (base: string, player: string) => endpoint(base, `/social/profile/${encodeURIComponent(player)}`);
export const inboxUrl = (base: string, owner: string) => endpoint(base, `/social/notifications/${encodeURIComponent(owner)}`);
export const referralUrl = (base: string) => endpoint(base, '/referrals/me');

export type FriendsPayload<Row = { id: string }> = {
  friends: Row[];
  friendCode?: string;
  sentRequests?: any[];
  incomingRequests?: any[];
};

export function friendsChanged(base: string, owner: string, removedId?: string) {
  const prefix = endpoint(base, '/social/profile/');
  pageDataCache.discardWhere((url, scope) => scope === owner && url.startsWith(prefix) && url !== profileUrl(base, owner), true);
  pageDataCache.invalidate<FriendsPayload>(friendsUrl(base, owner), owner, data =>
    removedId ? { ...data, friends: data.friends.filter(friend => friend.id !== removedId) } : data);
}

export function leaderboardRows<T>(data: T[] | { topPlayers?: T[]; leaders?: T[] } | undefined): T[] {
  const rows = Array.isArray(data) ? data : data?.topPlayers ?? data?.leaders;
  return Array.isArray(rows) ? rows : [];
}
