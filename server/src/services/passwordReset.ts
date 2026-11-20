import { createHmac, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export const PASSWORD_RESET_VALID_MINUTES = 15;
export const PASSWORD_RESET_RESEND_SECONDS = 60;
export const PASSWORD_RESET_TOKEN_PREFIX = 'password-reset:';
const MAX_ATTEMPTS = 5;
const deriveKey = promisify(scrypt);

export function getPasswordResetSecret(): string {
  return process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || '';
}

type ResetAccount = { id: string; email: string; passwordHash: string };

async function lockAccount(tx: Prisma.TransactionClient, identifier: string): Promise<ResetAccount | null> {
  const byEmail = identifier.includes('@');
  const where = byEmail ? { email: identifier } : { username: identifier };
  const match = await tx.user.findUnique({ where, select: { id: true } });
  if (!match || match.id.startsWith('guest_')) return null;

  // Serializes resends, guesses and consumption across serverless instances.
  const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM users WHERE id = ${match.id} FOR UPDATE`;
  if (!locked.length) return null;
  const account = await tx.user.findUnique({
    where,
    select: { id: true, email: true, passwordHash: true },
  });
  if (!account || account.id !== match.id || !account.passwordHash || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email)) {
    return null;
  }
  return { ...account, passwordHash: account.passwordHash };
}

const tokenId = (id: string) => `${PASSWORD_RESET_TOKEN_PREFIX}${id}`;

async function digest(secret: string, account: ResetAccount, code: string): Promise<string> {
  // The per-account salt is keyed by the server secret. scrypt limits offline
  // guesses even if that secret leaks. Changing the mailbox or password invalidates the code.
  const salt = createHmac('sha256', secret)
    .update(JSON.stringify(['password-reset-v2', account.id, account.email]))
    .digest();
  const digest = await deriveKey(JSON.stringify([account.passwordHash, code]), salt, 32) as Buffer;
  return digest.toString('hex');
}

export async function issuePasswordReset(db: PrismaClient, identifier: string, secret: string) {
  return db.$transaction(async (tx) => {
    const account = await lockAccount(tx, identifier);
    if (!account) return null;
    const id = tokenId(account.id);
    const existing = await tx.passwordResetToken.findUnique({ where: { id } });
    const now = new Date();
    if (existing && now.getTime() - existing.createdAt.getTime() < PASSWORD_RESET_RESEND_SECONDS * 1000) {
      return null;
    }

    let code: string;
    let mac: string;
    do {
      code = randomInt(1_000_000).toString().padStart(6, '0');
      mac = await digest(secret, account, code);
    } while (existing?.code.endsWith(`:${mac}`));
    const data = {
      email: account.email,
      // Store the version, attempt count and keyed digest in the existing column.
      // This slot never matches the legacy account-deletion flow's raw six-digit code.
      code: `v2:0:${mac}`,
      used: false,
      createdAt: now,
      expiresAt: new Date(now.getTime() + PASSWORD_RESET_VALID_MINUTES * 60_000),
    };
    await tx.passwordResetToken.upsert({ where: { id }, create: { id, ...data }, update: data });
    return { email: account.email, code, validMinutes: PASSWORD_RESET_VALID_MINUTES };
  });
}

export async function confirmPasswordReset(
  db: PrismaClient, input: { identifier: string; code: string; password: string }, secret: string,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const account = await lockAccount(tx, input.identifier);
    if (!account) return false;
    const id = tokenId(account.id);
    const active = await tx.passwordResetToken.findUnique({ where: { id } });
    if (!active || active.used || active.email !== account.email || active.expiresAt.getTime() <= Date.now()) {
      return false;
    }
    const parts = /^v2:([0-4]):([a-f0-9]{64})$/.exec(active.code);
    if (!parts) return false;
    const [, failures, storedMac] = parts;
    const candidateMac = await digest(secret, account, input.code);
    if (!timingSafeEqual(Buffer.from(storedMac, 'hex'), Buffer.from(candidateMac, 'hex'))) {
      const attempts = Number(failures) + 1;
      await tx.passwordResetToken.update({
        where: { id }, data: { code: `v2:${attempts}:${storedMac}`, used: attempts >= MAX_ATTEMPTS },
      });
      return false;
    }
    await tx.user.update({
      where: { id: account.id }, data: { passwordHash: await bcrypt.hash(input.password, 10) },
    });
    await tx.passwordResetToken.update({ where: { id }, data: { used: true } });
    return true;
  });
}
