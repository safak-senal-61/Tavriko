import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { confirmPasswordReset, issuePasswordReset, PASSWORD_RESET_TOKEN_PREFIX } from '../src/services/passwordReset';

const fixtureUrl = process.env.PASSWORD_RESET_TEST_DATABASE_URL;

describe.skipIf(!fixtureUrl)('password reset with isolated PostgreSQL', () => {
  const url = new URL(fixtureUrl ?? 'postgresql://localhost/unused_qa');
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_qa')) {
    throw new Error('Use only an isolated localhost PostgreSQL database named *_qa');
  }
  const dbA = new PrismaClient({ datasources: { db: { url: url.href } } });
  const dbB = new PrismaClient({ datasources: { db: { url: url.href } } });
  const secret = 'test-only-password-reset-secret';
  const initialPassword = 'InitialTestPassword1!';
  const nextPassword = 'NewTestPassword1!';
  const allUsers: string[] = [];
  let id: string;
  let email: string;
  let username: string;
  let tokenId: string;
  const verify = (code: string, identifier = email) =>
    confirmPasswordReset(dbB, { identifier, code, password: nextPassword }, secret);
  const expireCooldown = () => dbA.passwordResetToken.update({
    where: { id: tokenId }, data: { createdAt: new Date(Date.now() - 61_000) },
  });

  beforeEach(async () => {
    id = `pwreset-qa-${randomUUID()}`;
    username = id;
    email = `${id}@example.test`;
    tokenId = `${PASSWORD_RESET_TOKEN_PREFIX}${id}`;
    allUsers.push(id);
    await dbA.user.create({
      data: { id, username, email, displayName: 'Password QA', friendCode: id, passwordHash: await bcrypt.hash(initialPassword, 4) },
    });
  });

  afterAll(async () => {
    try {
      if (allUsers.length) {
        await dbA.passwordResetToken.deleteMany({ where: { id: { in: allUsers.flatMap((user) => [`${PASSWORD_RESET_TOKEN_PREFIX}${user}`, `${user}-legacy`]) } } });
        await dbA.user.deleteMany({ where: { id: { in: allUsers } } });
      }
    } finally {
      await Promise.all([dbA.$disconnect(), dbB.$disconnect()]);
    }
  });

  it('persists only a keyed digest, sends one code under concurrency, and changes the password exactly once across clients', async () => {
    const [a, b] = await Promise.all([issuePasswordReset(dbA, email, secret), issuePasswordReset(dbB, username, secret)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    const issued = (a ?? b)!;
    expect(issued).toMatchObject({ email, validMinutes: 15, code: /^\d{6}$/ });
    const stored = await dbB.passwordResetToken.findUniqueOrThrow({ where: { id: tokenId } });
    expect(stored.code).toMatch(/^v1:0:[a-f0-9]{64}$/);
    expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBe(900_000);
    expect(await Promise.all([verify(issued.code), verify(issued.code, username)])).toEqual(expect.arrayContaining([true, false]));
    const after = await dbA.user.findUniqueOrThrow({ where: { id } });
    expect(await bcrypt.compare(nextPassword, after.passwordHash!)).toBe(true);
    expect(await bcrypt.compare(initialPassword, after.passwordHash!)).toBe(false);
    expect(await verify(issued.code)).toBe(false);
  });

  it('locks out a code after five persisted wrong guesses and replaces it only after the cooldown', async () => {
    const first = (await issuePasswordReset(dbA, email, secret))!;
    expect(await issuePasswordReset(dbB, username, secret)).toBeNull();
    const wrong = first.code === '000000' ? '000001' : '000000';
    expect(await Promise.all(Array.from({ length: 5 }, () => verify(wrong)))).toEqual(Array(5).fill(false));
    const locked = await dbA.passwordResetToken.findUniqueOrThrow({ where: { id: tokenId } });
    expect(locked.used).toBe(true);
    expect(locked.code).toMatch(/^v1:5:/);
    expect(await verify(first.code)).toBe(false);
    await expireCooldown();
    const second = (await issuePasswordReset(dbB, username, secret))!;
    expect(second.code).not.toBe(first.code);
    expect(await verify(first.code)).toBe(false);
    expect(await verify(second.code)).toBe(true);
  });

  it('rejects expired codes, legacy account-deletion codes, and codes for changed mailboxes', async () => {
    const legacy = '831427';
    await dbA.passwordResetToken.create({ data: {
      id: `${id}-legacy`, email, code: legacy, expiresAt: new Date(Date.now() + 60_000),
    } });
    expect(await verify(legacy)).toBe(false);
    const issued = (await issuePasswordReset(dbA, email, secret))!;
    await dbA.passwordResetToken.update({ where: { id: tokenId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await verify(issued.code)).toBe(false);
    await expireCooldown();
    const reissued = (await issuePasswordReset(dbA, email, secret))!;
    const changed = `new-${email}`;
    await dbA.user.update({ where: { id }, data: { email: changed } });
    expect(await verify(reissued.code, changed)).toBe(false);
    expect(await verify(reissued.code, username)).toBe(false);
  });

  it('does not issue OTPs for unknown or Google-only accounts', async () => {
    await dbA.user.update({ where: { id }, data: { passwordHash: null, googleId: randomUUID() } });
    expect(await issuePasswordReset(dbA, email, secret)).toBeNull();
    expect(await issuePasswordReset(dbB, 'unknown@example.test', secret)).toBeNull();
  });
});
