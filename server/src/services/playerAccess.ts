import { db } from '../db/prismaClient';
import { restrictionsEnabled } from './adminAccountOperations';

export const validPlayerId = /^[a-z0-9_-]{1,128}$/i;
export const isGuestIdentity = (id: string) => /^guest_[a-z0-9_-]{1,110}$/i.test(id) || /^guest:[a-z0-9_-]{1,110}$/i.test(id);
export type PlayerAccess = 'allowed' | 'restricted' | 'unavailable';

export async function checkPlayerAccess(id: string): Promise<PlayerAccess> {
  if (!restrictionsEnabled() || isGuestIdentity(id)) return 'allowed';
  if (!validPlayerId.test(id)) return 'unavailable';
  try {
    const account = await db.rawClient.user.findUnique({ where: { id }, select: { restrictedUntil: true } });
    if (!account) return 'unavailable';
    return account.restrictedUntil && account.restrictedUntil > new Date() ? 'restricted' : 'allowed';
  } catch { return 'unavailable'; }
}

export function socketIdentity(token: unknown, requested: unknown) {
  if (typeof token === 'string') {
    const payload = db.verifyToken(token);
    if (typeof payload?.userId === 'string' && validPlayerId.test(payload.userId)) return payload.userId;
  }
  return typeof requested === 'string' && isGuestIdentity(requested) ? requested : null;
}
