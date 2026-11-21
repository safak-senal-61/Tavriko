import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageDataCache } from '../src/utils/pageDataCache';
import { categoriesUrl, friendsUrl, leaderboardRows, leaderboardUrl } from '../src/utils/pageResources';

const first = '/api/example';
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const pending = new Promise<T>(ok => { resolve = ok; });
  return { pending, resolve };
};

describe('shared page reads', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('normalizes common cache keys and leaderboard payloads', () => {
    expect(categoriesUrl('/api/')).toBe(categoriesUrl('/api'));
    expect(leaderboardUrl('/api/')).toBe(leaderboardUrl('/api'));
    expect(friendsUrl('/api', 'a/b')).toBe('/api/social/friends/a%2Fb');
    expect(leaderboardRows({ topPlayers: ['alice'] })).toEqual(['alice']);
    expect(leaderboardRows({ leaders: ['bob'] })).toEqual(['bob']);
  });

  it('deduplicates simultaneous reads, caches empty results and retains a warm snapshot during expiration', async () => {
    const cache = new PageDataCache();
    const fetcher = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(['new']);
    const one = cache.load(first, 1_000, { fetcher });
    expect(cache.load(first, 1_000, { fetcher })).toBe(one);
    await expect(one).resolves.toEqual([]);
    const warm = cache.snapshot(first);
    await expect(cache.load(first, 1_000, { fetcher })).resolves.toEqual([]);
    expect(cache.snapshot(first)).toBe(warm);
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 1_001);
    const next = cache.load(first, 1_000, { fetcher });
    expect(cache.snapshot(first)).toBe(warm);
    await expect(next).resolves.toEqual(['new']);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('backs off automatic retries, keeps old content on network failure and lets manual retry bypass backoff', async () => {
    const cache = new PageDataCache();
    const fetcher = vi.fn().mockResolvedValueOnce(['old']).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(['updated']);
    await cache.load(first, 1000, { fetcher });
    vi.setSystemTime(Date.now() + 2000);
    await expect(cache.load(first, 1000, { fetcher })).rejects.toThrow('offline');
    expect(cache.snapshot(first).data).toEqual(['old']);
    await expect(cache.load(first, 1000, { fetcher })).rejects.toThrow('offline');
    expect(fetcher).toHaveBeenCalledTimes(2);
    await expect(cache.load(first, 1000, { fetcher, force: true })).resolves.toEqual(['updated']);
    expect(cache.snapshot(first).error).toBeUndefined();
  });

  it.each([401, 403, 404])('does not keep an unavailable or revoked snapshot after HTTP %s', async status => {
    const cache = new PageDataCache();
    const fetcher = vi.fn().mockResolvedValueOnce(response(['private'])).mockResolvedValueOnce(response({}, status));
    vi.stubGlobal('fetch', fetcher);
    await cache.load(first, 1000, { scope: 'alice', token: 'example' });
    await expect(cache.load(first, 1000, { scope: 'alice', token: 'example', force: true })).rejects.toThrow(`HTTP ${status}`);
    expect(cache.snapshot(first, 'alice').data).toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith(first, expect.objectContaining({ cache: 'no-store', headers: { Authorization: 'Bearer example' } }));
  });

  it('patches confirmed changes and rejects a previous read superseded by that change', async () => {
    const cache = new PageDataCache();
    const previous = deferred<string[]>();
    const listener = vi.fn();
    cache.subscribe(first, 'alice', listener);
    await cache.load(first, 1000, { scope: 'alice', fetcher: async () => ['friend', 'remove'] });
    const old = cache.load(first, 1000, { scope: 'alice', force: true, fetcher: () => previous.pending });
    const rejection = expect(old).rejects.toThrow();
    await Promise.resolve();
    cache.invalidate<string[]>(first, 'alice', friends => friends.filter(f => f !== 'remove'));
    expect(cache.snapshot(first, 'alice')).toEqual({ data: ['friend'], invalidated: true });
    await cache.load(first, 1000, { scope: 'alice', fetcher: async () => ['friend', 'new'] });
    previous.resolve(['friend', 'remove']);
    await rejection;
    expect(cache.snapshot(first, 'alice').data).toEqual(['friend', 'new']);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('prefers a socket snapshot, including a valid empty list, over a late HTTP read', async () => {
    const cache = new PageDataCache();
    const old = deferred<string[]>();
    const pending = cache.load(first, 1000, { fetcher: () => old.pending });
    const rejection = expect(pending).rejects.toThrow();
    await Promise.resolve();
    cache.seed(first, []);
    old.resolve(['closed-room']);
    await rejection;
    expect(cache.snapshot(first).data).toEqual([]);
  });

  it('drops old profile access, lets an active subscriber revalidate and clears private reads on session change', async () => {
    const cache = new PageDataCache();
    await cache.load(first, 1000, { fetcher: async () => 'public' });
    await cache.load(first, 1000, { scope: 'alice', fetcher: async () => 'private-alice' });
    await cache.load(first, 1000, { scope: 'bob', fetcher: async () => 'private-bob' });
    const listener = vi.fn();
    cache.subscribe(first, 'alice', listener);
    cache.discardWhere((_, owner) => owner === 'alice', true);
    expect(cache.snapshot(first, 'alice')).toEqual({ invalidated: true });
    expect(listener).toHaveBeenCalledOnce();
    const previous = deferred<string>();
    const oldSession = cache.load(first, 1000, { scope: 'alice', fetcher: () => previous.pending });
    const rejection = expect(oldSession).rejects.toThrow();
    await Promise.resolve();
    cache.clearPrivate();
    expect(cache.snapshot(first, 'alice').data).toBeUndefined();
    expect(cache.snapshot(first, 'bob').data).toBeUndefined();
    expect(cache.snapshot(first).data).toBe('public');
    await cache.load(first, 1000, { scope: 'alice', fetcher: async () => 'new-session' });
    previous.resolve('old-session');
    await rejection;
    expect(cache.snapshot(first, 'alice').data).toBe('new-session');
    await expect(cache.load(first, 1000, { token: 'unsafe' })).rejects.toThrow('account scope');
  });

  it('ends a hung request after its timeout and retries without requiring a page reload', async () => {
    const cache = new PageDataCache(50);
    let signal: AbortSignal | undefined;
    const failed = cache.load(first, 1000, { fetcher: current => {
      signal = current;
      return new Promise(() => {});
    } });
    const rejection = expect(failed).rejects.toThrow('zaman aşımına');
    await vi.advanceTimersByTimeAsync(51);
    await rejection;
    expect(signal?.aborted).toBe(true);
    await expect(cache.load(first, 1000, { force: true, fetcher: async () => 'ok' })).resolves.toBe('ok');
  });

  it('evicts expired or excess inactive reads rather than growing across navigation', async () => {
    const cache = new PageDataCache();
    for (let i = 0; i < 165; i++) cache.seed(`${first}/${i}`, i);
    expect(cache.snapshot(`${first}/0`).data).toBeUndefined();
    expect(cache.snapshot(`${first}/164`).data).toBe(164);
    vi.setSystemTime(Date.now() + 15 * 60_000 + 1);
    expect(cache.snapshot(`${first}/164`).data).toBeUndefined();
  });
});
