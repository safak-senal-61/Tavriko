import { createPublicKey, KeyObject, verify } from 'node:crypto';

const keyUrl = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
export const ADMOB_REWARDED_UNIT = '5338495031';
export const AD_ATTEMPT_TTL_MS = 15 * 60_000;
const MAX_CALLBACK_AGE_MS = 24 * 60 * 60_000;
const CLOCK_SKEW_MS = 30_000;
const keyTtlMs = 6 * 60 * 60_000;
const refreshCooldownMs = 60_000;
let cachedKeys = new Map<string, KeyObject>();
let keysExpireAt = 0;
let lastRefreshAt = 0;
let refreshing: Promise<void> | undefined;

async function googleKey(id: string): Promise<KeyObject | undefined> {
  const now = Date.now();
  if (now < keysExpireAt && cachedKeys.has(id)) return cachedKeys.get(id);
  if (!refreshing && now - lastRefreshAt >= refreshCooldownMs) {
    lastRefreshAt = now;
    refreshing = (async () => {
      const response = await fetch(keyUrl, { signal: AbortSignal.timeout(3500), redirect: 'error' });
      if (!response.ok) throw new Error('AdMob public keys unavailable');
      const body = await response.json() as { keys: { keyId: number; pem: string }[] };
      const next = new Map(body.keys.map(key => [String(key.keyId), createPublicKey(key.pem)]));
      if (!next.size) throw new Error('AdMob public key set is empty');
      cachedKeys = next;
      keysExpireAt = Date.now() + keyTtlMs;
    })().finally(() => { refreshing = undefined; });
  }
  await refreshing;
  if (Date.now() >= keysExpireAt) throw new Error('AdMob public keys expired');
  return cachedKeys.get(id);
}

export const isAdAttemptId = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);

type Callback = { attemptId: string; transactionId: string; timestamp: number };

export function matchesAdAttemptTime(createdAt: number, timestamp: number): boolean {
  return timestamp >= createdAt - CLOCK_SKEW_MS && timestamp <= createdAt + AD_ATTEMPT_TTL_MS;
}

export async function verifyAdMobCallback(
  query: string,
  readKey = googleKey,
  now = Date.now(),
): Promise<Callback | 'verification' | null> {
  if (query.length > 4096 || /[^\x21-\x7e]/.test(query)) return null;
  const tail = /&signature=([A-Za-z0-9_-]{1,256}(?:={1,2}|(?:%3[dD]){1,2})?)&key_id=([0-9]{1,16})$/.exec(query);
  if (!tail || tail.index === 0) return null;
  const signed = query.slice(0, tail.index);
  const params = new URLSearchParams(signed);
  const names = [...params.keys()];
  if (new Set(names).size !== names.length || ['signature', 'key_id'].some(name => params.has(name))) return null;
  if (params.get('ad_unit') !== ADMOB_REWARDED_UNIT) return null;
  const transactionId = params.get('transaction_id');
  const timestampRaw = params.get('timestamp') ?? '';
  const timestamp = Number(timestampRaw);
  if (!transactionId || !/^[a-zA-Z0-9_-]{1,128}$/.test(transactionId) ||
      !/^\d{13}$/.test(timestampRaw) || timestamp < now - MAX_CALLBACK_AGE_MS || timestamp > now + CLOCK_SKEW_MS) return null;
  const attemptId = params.get('custom_data');
  if (attemptId !== null && !isAdAttemptId(attemptId)) return null;
  const key = await readKey(tail[2]);
  if (!key || !verify('sha256', Buffer.from(signed), key, Buffer.from(decodeURIComponent(tail[1]), 'base64url'))) return null;
  // AdMob can verify the callback URL without an actual in-app attempt.
  return attemptId === null ? 'verification' : { attemptId, transactionId, timestamp };
}
