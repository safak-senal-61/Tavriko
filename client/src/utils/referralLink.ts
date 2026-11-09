const KEY = 'tavriko_pending_referral_v1';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
let pending: { token: string; at: number } | null = null;
export const isReferralToken = (token: unknown): token is string =>
  typeof token === 'string' && /^[a-f0-9]{48}$/.test(token);

/** Capture BEFORE OAuth navigation. No URL/token logging, no automatic friendship. */
export function captureReferralLink(url?: string | null): string | null {
  try {
    const parsed = new URL(url || (typeof window !== 'undefined' ? window.location.href : ''));
    const token = parsed.searchParams.get('invite');
    if (isReferralToken(token)) {
      pending = { token, at: Date.now() };
      try { window.localStorage.setItem(KEY, JSON.stringify(pending)); } catch {}
    }
  } catch {}
  return getPendingReferral();
}
export function getPendingReferral(): string | null {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored) pending = JSON.parse(stored);
  } catch {}
  if (!pending || !isReferralToken(pending.token) || !Number.isFinite(pending.at)
    || pending.at > Date.now() || Date.now() - pending.at > MAX_AGE) {
    clearPendingReferral(); return null;
  }
  return pending.token;
}
export function clearPendingReferral() {
  pending = null;
  try { window.localStorage.removeItem(KEY); } catch {}
  // Prevent a handled link being captured again after reload.
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('invite')) {
      url.searchParams.delete('invite');
      window.history.replaceState(window.history.state, '', url.toString());
    }
  } catch {}
}
