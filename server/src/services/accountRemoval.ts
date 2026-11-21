import { createHmac, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Prisma, PrismaClient } from '@prisma/client';

export const REMOVAL_VALID_MINUTES = 15;
export const REMOVAL_RESEND_SECONDS = 60;
const PREFIX = 'account-removal:';
const MAX_ATTEMPTS = 5;
const deriveKey = promisify(scrypt);
const digestFormat = /^v1:([0-5]):([a-f0-9]{64})$/;

export type RemovalTarget = { id: string } | { email: string };
type RemovalAccount = { id: string; email: string };

export function accountRemovalEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

async function lockAccount(tx: Prisma.TransactionClient, target: RemovalTarget): Promise<RemovalAccount | null> {
  const match = await tx.user.findUnique({ where: target, select: { id: true } });
  if (!match || match.id.startsWith('guest_')) return null;
  const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM users WHERE id = ${match.id} FOR UPDATE`;
  if (!locked.length) return null;
  const account = await tx.user.findUnique({ where: target, select: { id: true, email: true } });
  return account?.id === match.id && accountRemovalEmail(account.email) ? account : null;
}

async function digest(secret: string, { id, email }: RemovalAccount, code: string): Promise<Buffer> {
  const salt = createHmac('sha256', secret).update(JSON.stringify([PREFIX, id, email])).digest();
  return await deriveKey(code, salt, 32) as Buffer;
}

export async function issueAccountRemoval(db: PrismaClient, target: RemovalTarget, secret: string) {
  return db.$transaction(async (tx) => {
    const account = await lockAccount(tx, target);
    if (!account) return { status: 'unavailable' } as const;
    const id = `${PREFIX}${account.id}`;
    const existing = await tx.passwordResetToken.findUnique({ where: { id } });
    const now = new Date();
    const live = existing?.email === account.email && existing.expiresAt > now;
    const attempts = live && existing ? Number(digestFormat.exec(existing.code)?.[1] ?? 0) : 0;
    if (live && existing && (existing.used || attempts >= MAX_ATTEMPTS)) {
      return { status: 'cooldown', remaining: Math.ceil((existing.expiresAt.getTime() - now.getTime()) / 1000) } as const;
    }
    const remaining = existing ? Math.ceil((existing.createdAt.getTime() - now.getTime()) / 1000) + REMOVAL_RESEND_SECONDS : 0;
    if (existing?.email === account.email && remaining > 0) {
      return { status: 'cooldown', remaining } as const;
    }
    let code: string;
    let mac: string;
    do {
      code = randomInt(1_000_000).toString().padStart(6, '0');
      mac = (await digest(secret, account, code)).toString('hex');
    } while (existing?.code.endsWith(`:${mac}`));
    const data = {
      email: account.email,
      code: `v1:${attempts}:${mac}`,
      expiresAt: new Date(now.getTime() + REMOVAL_VALID_MINUTES * 60_000),
      createdAt: now,
      used: false,
    };
    await tx.passwordResetToken.upsert({ where: { id }, create: { id, ...data }, update: data });
    return { status: 'issued', email: account.email, code, validMinutes: REMOVAL_VALID_MINUTES } as const;
  });
}

export async function confirmAccountRemoval(db: PrismaClient, target: RemovalTarget, code: string, secret: string) {
  if (!/^[0-9]{6}$/.test(code)) return null;
  return db.$transaction(async (tx) => {
    const account = await lockAccount(tx, target);
    if (!account) return null;
    const id = `${PREFIX}${account.id}`;
    const active = await tx.passwordResetToken.findUnique({ where: { id } });
    if (!active || active.used || active.email !== account.email || active.expiresAt.getTime() <= Date.now()) return null;
    // Never read the old plaintext codes or accept a password reset code.
    const parts = digestFormat.exec(active.code);
    if (!parts || Number(parts[1]) >= MAX_ATTEMPTS) return null;
    const attempts = Number(parts[1]) + 1;
    if (!timingSafeEqual(Buffer.from(parts[2], 'hex'), await digest(secret, account, code))) {
      await tx.passwordResetToken.update({
        where: { id }, data: { code: `v1:${attempts}:${parts[2]}`, used: attempts >= MAX_ATTEMPTS },
      });
      return null;
    }
    // Perform verification, cleanup and removal together. A failed deletion
    // rolls back instead of losing the user's only valid verification code.
    await tx.matchHistory.deleteMany({ where: { userId: account.id } });
    await tx.passwordResetToken.deleteMany({ where: { email: account.email } });
    await tx.$executeRaw`UPDATE users SET "friendIds" = ("friendIds" - ${account.id}), "blockedUserIds" = ("blockedUserIds" - ${account.id}) WHERE "friendIds" ? ${account.id} OR "blockedUserIds" ? ${account.id}`;
    await tx.user.delete({ where: { id: account.id } });
    return account;
  });
}
