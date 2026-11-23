type Snapshot<T> = { data?: T; error?: Error; updatedAt?: number; invalidated?: true };
type Entry = {
  url: string;
  scope?: string;
  snapshot: Snapshot<unknown>;
  expiresAt: number;
  retryAfter?: number;
  pending?: Promise<unknown>;
  controller?: AbortController;
};

const EMPTY: Snapshot<never> = {};
const RETAIN_MS = 15 * 60_000;
const RETRY_MS = 5_000;
const MAX_ENTRIES = 160;
const keyOf = (url: string, scope?: string) => JSON.stringify([scope ?? null, url]);

export const PAGE_TTL = {
  categories: 5 * 60_000,
  leaderboard: 60_000,
  friends: 30_000,
  events: 45_000,
  profile: 30_000,
  inbox: 30_000,
  support: 30_000,
  referral: 60_000,
  gameplayRewards: 20_000,
  rooms: 10_000,
};

export class PageDataError extends Error {
  constructor(readonly status: number) {
    super(`İstek tamamlanamadı (HTTP ${status}).`);
  }
}

export async function fetchPageJson<T>(url: string, signal: AbortSignal, token?: string | null): Promise<T> {
  const response = await fetch(url, {
    signal,
    cache: 'no-store',
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  });
  if (!response.ok) throw new PageDataError(response.status);
  return response.json() as Promise<T>;
}

export class PageDataCache {
  private entries = new Map<string, Entry>();
  private listeners = new Map<string, Set<() => void>>();

  constructor(private readonly timeoutMs = 8_000) {}

  snapshot<T>(url: string | null, scope?: string): Snapshot<T> {
    if (!url) return EMPTY;
    const entry = this.entries.get(keyOf(url, scope));
    return entry && (entry.pending || entry.expiresAt > Date.now()) ? entry.snapshot as Snapshot<T> : EMPTY;
  }

  subscribe(url: string | null, scope: string | undefined, listener: () => void) {
    if (!url) return () => {};
    const key = keyOf(url, scope);
    const subscribers = this.listeners.get(key) ?? new Set();
    this.listeners.set(key, subscribers);
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
      if (subscribers.size === 0) this.listeners.delete(key);
    };
  }

  private notify(key: string) {
    this.listeners.get(key)?.forEach(listener => listener());
  }

  private prune() {
    for (const [key, entry] of this.entries) {
      if (entry.pending || this.listeners.has(key)) continue;
      if (entry.expiresAt <= Date.now() || this.entries.size >= MAX_ENTRIES) this.entries.delete(key);
    }
  }

  load<T>(url: string, ttl: number, options: { scope?: string; token?: string | null; force?: boolean;
    fetcher?: (signal: AbortSignal) => Promise<T> } = {}): Promise<T> {
    const { scope, token, force, fetcher } = options;
    if (token && !scope) return Promise.reject(new Error('Authenticated reads need an account scope.'));
    const key = keyOf(url, scope);
    const now = Date.now();
    let entry = this.entries.get(key);
    if (entry && entry.expiresAt <= now && !entry.pending) {
      this.entries.delete(key);
      entry = undefined;
    }
    if (entry?.pending) return entry.pending as Promise<T>;
    if (!force && entry) {
      const { data, updatedAt, error } = entry.snapshot;
      if (data !== undefined && updatedAt !== undefined && now - updatedAt < ttl) return Promise.resolve(data as T);
      if (error && (entry.retryAfter ?? 0) > now) return Promise.reject(error);
    }
    if (!entry) {
      this.prune();
      entry = { url, scope, snapshot: EMPTY, expiresAt: now + RETAIN_MS };
      this.entries.set(key, entry);
    }
    const active = entry;
    const controller = new AbortController();
    active.controller = controller;
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new Error('İstek zaman aşımına uğradı veya iptal edildi.')), { once: true });
    });
    const request = Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new Error('İstek iptal edildi.');
      return fetcher ? fetcher(controller.signal) : fetchPageJson<T>(url, controller.signal, token);
    });
    const pending = Promise.race([request, onAbort]).then(data => {
      if (this.entries.get(key) === active && active.controller === controller) {
        active.snapshot = { data, updatedAt: Date.now() };
        active.expiresAt = Date.now() + RETAIN_MS;
        active.retryAfter = undefined;
      }
      return data;
    }, reason => {
      const error = reason instanceof Error ? reason : new Error('Veri alınamadı.');
      if (this.entries.get(key) === active && active.controller === controller) {
        // A denied or deleted resource must not remain visible from cache.
        const revoked = error instanceof PageDataError && [401, 403, 404].includes(error.status);
        active.snapshot = revoked ? { error } : { data: active.snapshot.data, error };
        active.retryAfter = Date.now() + RETRY_MS;
      }
      throw error;
    }).finally(() => {
      clearTimeout(timeout);
      if (this.entries.get(key) === active && active.controller === controller) {
        active.pending = undefined;
        active.controller = undefined;
        this.notify(key);
      }
    });
    active.pending = pending;
    return pending;
  }

  invalidate<T>(url: string, scope?: string, patch?: (data: T) => T) {
    const key = keyOf(url, scope);
    const entry = this.entries.get(key);
    if (!entry) return;
    const data = entry.snapshot.data as T | undefined;
    entry.controller?.abort();
    entry.controller = undefined;
    entry.pending = undefined;
    entry.retryAfter = undefined;
    entry.snapshot = { data: data === undefined ? undefined : patch ? patch(data) : data, invalidated: true };
    this.notify(key);
  }

  invalidateWhere(matches: (url: string, scope?: string) => boolean) {
    for (const entry of this.entries.values()) {
      if (matches(entry.url, entry.scope)) this.invalidate(entry.url, entry.scope);
    }
  }

  seed<T>(url: string, data: T, scope?: string) {
    const key = keyOf(url, scope);
    this.entries.get(key)?.controller?.abort();
    if (!this.entries.has(key)) this.prune();
    const now = Date.now();
    this.entries.set(key, { url, scope, snapshot: { data, updatedAt: now }, expiresAt: now + RETAIN_MS });
    this.notify(key);
  }

  discardWhere(matches: (url: string, scope?: string) => boolean, revalidate = false) {
    for (const [key, entry] of this.entries) {
      if (!matches(entry.url, entry.scope)) continue;
      entry.controller?.abort();
      if (revalidate && this.listeners.has(key)) {
        this.entries.set(key, { url: entry.url, scope: entry.scope, snapshot: { invalidated: true },
          expiresAt: Date.now() + RETAIN_MS });
      } else this.entries.delete(key);
      this.notify(key);
    }
  }

  clearPrivate() {
    this.discardWhere((_, scope) => scope !== undefined);
  }
}

export const pageDataCache = new PageDataCache();
