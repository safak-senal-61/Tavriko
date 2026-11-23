import { DEFAULT_REALTIME_URL } from './inviteDelivery';

let cached: { expires: number; result: Promise<boolean> } | undefined;

export function advancedJokersReady(): Promise<boolean> {
  const now = Date.now();
  if (cached && cached.expires > now) return cached.result;
  const result = (async () => {
    const endpoint = new URL('/health', process.env.REALTIME_HTTP_URL || DEFAULT_REALTIME_URL);
    if (endpoint.protocol !== 'https:') return false;
    const response = await fetch(endpoint, { redirect: 'error', signal: AbortSignal.timeout(1500) });
    if (!response.ok) return false;
    const body = await response.json() as { features?: { advancedQuizJokers?: boolean } } | null;
    return body?.features?.advancedQuizJokers === true;
  })().catch(() => false);
  cached = { expires: now + 30_000, result };
  return result;
}
