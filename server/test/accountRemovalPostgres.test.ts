import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { confirmAccountRemoval, issueAccountRemoval } from '../src/services/accountRemoval';

const fixtureUrl = process.env.PASSWORD_RESET_TEST_DATABASE_URL;
describe.skipIf(!fixtureUrl)('account removal with isolated PostgreSQL', () => {
  const url = new URL(fixtureUrl ?? 'postgresql://localhost/unused_qa');
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_qa')) {
    throw new Error('Use only an isolated localhost PostgreSQL database named *_qa');
  }

  const a = new PrismaClient({ datasources: { db: { url: url.href } } });
  const b = new PrismaClient({ datasources: { db: { url: url.href } } });
  const secret = 'test-only-account-removal-secret';
  const accounts: string[] = [];
  let id: string;
  let email: string;
  let tokenId: string;
  async function makeAccount() {
    const id = `removal-qa-${randomUUID()}`;
    accounts.push(id);
    return a.user.create({ data: { id, email: `${id}@example.test`, username: id, displayName: 'Removal QA', friendCode: id } });
  }
  async function send() {
    const issued = await issueAccountRemoval(a, { id }, secret);
    if (issued.status !== 'issued') throw new Error('Expected a synthetic OTP');
    return issued.code;
  }
  const confirm = (code: string) => confirmAccountRemoval(b, { email }, code, secret);
  const cooldownEnds = () => a.passwordResetToken.update({
    where: { id: tokenId }, data: { createdAt: new Date(Date.now() - 61_000) },
  });
  const expires = () => a.passwordResetToken.update({
    where: { id: tokenId }, data: { createdAt: new Date(Date.now() - 901_000), expiresAt: new Date(Date.now() - 1000) },
  });

  beforeEach(async () => {
    ({ id, email } = await makeAccount());
    tokenId = `account-removal:${id}`;
  });

  afterAll(async () => {
    try {
      await a.passwordResetToken.deleteMany({ where: { email: { in: accounts.map((id) => `${id}@example.test`) } } });
      await a.matchHistory.deleteMany({ where: { userId: { in: accounts } } });
      await a.user.deleteMany({ where: { id: { in: accounts } } });
    } finally {
      await Promise.all([a.$disconnect(), b.$disconnect()]);
    }
  });

  it('issues one code under concurrency and deletes the account and linked data exactly once', async () => {
    const friend = await makeAccount();
    await a.user.update({ where: { id: friend.id }, data: { friendIds: [id], blockedUserIds: [id] } });
    await a.matchHistory.create({ data: { userId: id, roomCode: 'fixture', mode: 'solo', categoryId: 'test', rankingsJson: [] } });
    await a.userInventoryItem.create({ data: { userId: id, itemId: 'fixture-frame', name: 'Fixture', desc: '', qty: 1 } });
    const issued = await Promise.all([issueAccountRemoval(a, { id }, secret), issueAccountRemoval(b, { email }, secret)]);
    expect(issued.map((r) => r.status).sort()).toEqual(['cooldown', 'issued']);
    const code = issued.find((r) => r.status === 'issued')!.code;
    const stored = await a.passwordResetToken.findUniqueOrThrow({ where: { id: tokenId } });
    expect(stored.code).toMatch(/^v1:0:[a-f0-9]{64}$/);
    expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBe(900_000);
    const results = await Promise.all([confirm(code), confirmAccountRemoval(a, { id }, code, secret)]);
    expect(results).toEqual(expect.arrayContaining([{ id, email }, null]));
    expect(await a.user.findUnique({ where: { id } })).toBeNull();
    expect(await a.user.findUnique({ where: { id: friend.id } })).toMatchObject({ friendIds: [], blockedUserIds: [] });
    expect(await a.matchHistory.count({ where: { userId: id } })).toBe(0);
    expect(await a.userInventoryItem.count({ where: { userId: id } })).toBe(0);
    expect(await a.passwordResetToken.count({ where: { email } })).toBe(0);
    expect(await confirm(code)).toBeNull();
  });

  it('keeps the guess limit across resends and rejects old, expired and exhausted codes', async () => {
    const first = await send();
    expect(await confirm(first === '000000' ? '000001' : '000000')).toBeNull();
    await cooldownEnds();
    const second = await send();
    expect(second).not.toBe(first);
    expect(await confirm(first)).toBeNull();
    const wrong = second === '000000' ? '000001' : '000000';
    expect(await Promise.all([confirm(wrong), confirm(wrong), confirm(wrong)])).toEqual([null, null, null]);
    expect(await confirm(second)).toBeNull();
    await cooldownEnds();
    expect(await issueAccountRemoval(a, { id }, secret)).toMatchObject({ status: 'cooldown' });
    expect(await a.passwordResetToken.findUnique({ where: { id: tokenId } })).toMatchObject({ used: true, code: expect.stringMatching(/^v1:5:/) });
    await expires();
    const third = await send();
    await expires();
    expect(await confirm(third)).toBeNull();
    expect(await a.user.findUnique({ where: { id } })).not.toBeNull();
  });

  it('rejects legacy plaintext, password reset tokens and codes for a changed mailbox or different account', async () => {
    const legacy = '019382';
    const expiresAt = new Date(Date.now() + 60_000);
    await a.passwordResetToken.createMany({ data: [
      { id: `${id}-legacy`, email, code: legacy, expiresAt },
      { id: `password-reset:${id}`, email, code: '192836', expiresAt },
    ] });
    expect(await confirm(legacy)).toBeNull();
    expect(await confirm('192836')).toBeNull();
    const code = await send();
    const other = await makeAccount();
    expect(await confirmAccountRemoval(b, { id: other.id }, code, secret)).toBeNull();
    await a.user.update({ where: { id }, data: { email: `changed-${email}` } });
    expect(await confirmAccountRemoval(b, { id }, code, secret)).toBeNull();
    expect(await confirm(code)).toBeNull();
    expect(await issueAccountRemoval(a, { email: 'missing@example.test' }, secret)).toEqual({ status: 'unavailable' });
  });
});
