import type { GameplayRewardStatus } from '@trivia/shared';
import { fetchPageJson, PAGE_TTL, pageDataCache } from './pageDataCache';

const endpoint = (base: string, path: string) => `${base.replace(/\/+$/, '')}${path}`;
export const categoriesUrl = (base: string) => endpoint(base, '/categories');
export const leaderboardUrl = (base: string) => endpoint(base, '/social/leaderboard');
export const friendsUrl = (base: string, owner: string) => endpoint(base, `/social/friends/${encodeURIComponent(owner)}`);
export const eventsUrl = (base: string, owner: string) => endpoint(base, `/social/events?userId=${encodeURIComponent(owner)}`);
export const profileUrl = (base: string, player: string) => endpoint(base, `/social/profile/${encodeURIComponent(player)}`);
export const inboxUrl = (base: string, owner: string) => endpoint(base, `/social/notifications/${encodeURIComponent(owner)}`);
export const referralUrl = (base: string) => endpoint(base, '/referrals/me');
export const gameplayRewardsUrl = (base: string) => endpoint(base, '/social/rewards');

export type GameplayRewardsPayload = { rewards: GameplayRewardStatus[] };

export function isGameplayRewardsPayload(value: unknown): value is GameplayRewardsPayload {
  const rewards = (value as GameplayRewardsPayload | null)?.rewards;
  return Array.isArray(rewards) && rewards.every(row => row && typeof row.id === 'string' &&
    Number.isFinite(row.current) && row.current >= 0 && typeof row.claimed === 'boolean');
}

export async function fetchGameplayRewards(url: string, token: string, signal: AbortSignal): Promise<GameplayRewardsPayload> {
  const data = await fetchPageJson<unknown>(url, signal, token);
  if (!isGameplayRewardsPayload(data)) throw new Error('Ödül ilerlemesi okunamadı.');
  return data;
}

export function prefetchGameplayRewards(base: string, owner: string, token: string) {
  const url = gameplayRewardsUrl(base);
  return pageDataCache.load(url, PAGE_TTL.gameplayRewards, {
    scope: owner, token, fetcher: signal => fetchGameplayRewards(url, token, signal),
  });
}

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
  pageDataCache.invalidate(gameplayRewardsUrl(base), owner);
}

export function leaderboardRows<T>(data: T[] | { topPlayers?: T[]; leaders?: T[] } | undefined): T[] {
  const rows = Array.isArray(data) ? data : data?.topPlayers ?? data?.leaders;
  return Array.isArray(rows) ? rows : [];
}
