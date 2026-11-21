import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { pageDataCache } from './pageDataCache';

export function usePageData<T>(url: string | null, ttl: number, scope?: string, token?: string | null,
  fetcher?: (signal: AbortSignal) => Promise<T>) {
  const snapshot = useCallback(() => pageDataCache.snapshot<T>(url, scope), [url, scope]);
  const subscribe = useCallback((listener: () => void) => pageDataCache.subscribe(url, scope, listener), [url, scope]);
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);
  const read = useCallback((force = false) => url
    ? pageDataCache.load<T>(url, ttl, { scope, token, force, fetcher })
    : Promise.resolve(undefined), [url, ttl, scope, token, fetcher]);

  const invalidation = state.invalidated ? state : null;
  useEffect(() => { void read().catch(() => {}); }, [read, invalidation]);

  return { ...state, loading: Boolean(url && state.data === undefined && !state.error), read };
}
