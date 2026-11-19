import type { Env } from '../env';

export type PlayerAccess = 'allowed' | 'restricted' | 'unavailable';
export const isGuestIdentity = (id: string) => /^guest_[a-z0-9_-]{1,110}$/i.test(id) || /^guest:[a-z0-9_-]{1,110}$/i.test(id);
export const enforcingPlayerAccess = (env: Env) => env.ACCOUNT_RESTRICTIONS_ENABLED === 'true';

export class PlayerAccessGate {
  private cache = new WeakMap<WebSocket, { id: string; at: number; result: Promise<PlayerAccess> }>();
  constructor(private env: Env) {}

  async check(id: string, socket?: WebSocket): Promise<PlayerAccess> {
    if (!enforcingPlayerAccess(this.env) || isGuestIdentity(id)) return 'allowed';
    const cached = socket && this.cache.get(socket);
    if (cached?.id === id && Date.now() - cached.at < 10_000) return cached.result;
    const result = this.lookup(id);
    if (socket) this.cache.set(socket, { id, at: Date.now(), result });
    return result;
  }

  private async lookup(id: string): Promise<PlayerAccess> {
    if (!this.env.INTERNAL_API_SECRET || !this.env.BACKEND_API_URL) return 'unavailable';
    try {
      const response = await fetch(this.env.BACKEND_API_URL.replace(/\/+$/, '')+'/api/internal/player-access', {
        method: 'POST',
        // Workers only support follow/manual. A redirect must not forward the service secret.
        redirect: 'manual',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': this.env.INTERNAL_API_SECRET },
        signal: AbortSignal.timeout(2500),
        body: JSON.stringify({ id }),
      });
      if (!response.ok) return 'unavailable';
      const data = await response.json() as { access?: string; enabled?: boolean };
      if (!data.enabled) return 'unavailable';
      if (data.access === 'allowed' || data.access === 'restricted') return data.access;
    } catch {}
    return 'unavailable';
  }
}

export function accessResponse(access: Exclude<PlayerAccess, 'allowed'>) {
  return new Response(access === 'restricted' ? 'Çevrimiçi oyun erişimi kısıtlı.' : 'Oyuncu erişimi doğrulanamadı.', {
    status: access === 'restricted' ? 403 : 503,
  });
}
