type Preference = { optedIn: boolean; canEnroll: boolean };
let known: { account: string; preference: Preference } | null = null;

export async function duelFunnelPreference(api: string, account: string, token: string, event?: 'enroll' | 'withdraw', signal?: AbortSignal) {
  const response = await fetch(`${api}/player/duel-funnel`, {
    method: event ? 'POST' : 'GET', signal, headers: { Authorization: `Bearer ${token}`, ...(event ? { 'Content-Type': 'application/json' } : {}) },
    ...(event ? { body: JSON.stringify({ event }) } : {}),
  });
  if (!response.ok) throw new Error('Ölçüm tercihi alınamadı.');
  const preference: Preference = await response.json();
  if (!signal?.aborted) known = { account, preference };
  return preference;
}

export function recordDuelSelection(api: string, account: string, token: string) {
  if (known?.account !== account || !known.preference.optedIn) return;
  void fetch(`${api}/player/duel-funnel`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'select' }) }).catch(() => {});
}
