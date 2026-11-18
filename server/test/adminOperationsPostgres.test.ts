import { randomUUID, scryptSync } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAdminAccountsRouter, registrationWindow } from '../src/routes/adminAccountsRoutes';
import { logRouter } from '../src/routes/logRoutes';
import { compensationCatalog } from '../src/services/adminAccountOperations';
import { readPlayerAnalytics, recordCompletedPlayers, type TrackedMatchSummary } from '../src/services/playerAnalytics';

const dbUrl = process.env.ADMIN_OPERATIONS_TEST_DATABASE_URL;
if (dbUrl && (!['127.0.0.1', 'localhost'].includes(new URL(dbUrl).hostname) || !new URL(dbUrl).pathname.endsWith('_qa'))) {
  throw new Error('Use an isolated local *_qa database only.');
}

describe.skipIf(!dbUrl)('account operations on PostgreSQL', () => {
  const suffix = randomUUID().slice(0, 8);
  const id = `usr_admin_qa_${suffix}`;
  const newId = `usr_admin_new_${suffix}`;
  const owner = 'owner@example.test';
  const support = 'support@example.test';
  const approver = 'approver@example.test';
  const moderator = 'moderator@example.test';
  const password = 'fixture-password-for-role-testing';
  const cookies: Record<string, string> = {};
  const root = '/api/admin/accounts';
  const reason = 'QA hesabı için örnek destek kaydı';
  let client: PrismaClient;
  let app: express.Express;

  async function login(email: string) {
    const res = await request(app).post('/api/portal/login').send({ email, password });
    expect(res.status).toBe(200);
    return res.headers['set-cookie'][0].split(';')[0]!;
  }
  const get = (path: string, who = owner) => request(app).get(root+path).set('Cookie', cookies[who]);
  const post = (path: string, who: string, body: object) => request(app).post(root+path).set('Cookie', cookies[who])
    .set('Host', 'localhost').set('Origin', 'http://localhost').send(body);
  const account = () => client.user.findUniqueOrThrow({ where: { id } });
  const grantRequest = (amount: number, kind = 'coins') => ({ id: randomUUID(), kind, amount, reason });

  beforeAll(async () => {
    vi.stubEnv('JWT_SECRET', 'isolated-test-portal-jwt');
    vi.stubEnv('PORTAL_ADMIN_EMAIL', owner);
    vi.stubEnv('PORTAL_ADMIN_PASSWORD', password);
    const staff = [[support, 'support'], [approver, 'approver'], [moderator, 'moderator']].map(([email, role], i) => {
      const salt = Buffer.alloc(16, i+1);
      return { email, role, passwordHash: `${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}` };
    });
    vi.stubEnv('PORTAL_STAFF_JSON', JSON.stringify(staff));
    vi.stubEnv('ACCOUNT_RESTRICTIONS_ENABLED', 'true');
    client = new PrismaClient({ datasourceUrl: dbUrl });
    for (const player of [id, newId]) await client.user.create({ data: {
      id: player, username: player, email: `${player}@example.test`, displayName: 'Örnek Hesap',
      friendCode: player, ...(player === id ? { createdAt: new Date(Date.now()-14*86_400_000) } : {}),
    } });
    app = express().use(express.json()).use('/api', logRouter).use(createAdminAccountsRouter(client));
    for (const email of [owner, support, approver, moderator]) cookies[email] = await login(email);
  });
  afterAll(async () => {
    if (client) {
      await client.adminAccountEvent.deleteMany({ where: { accountId: id } });
      await client.adminCompensation.deleteMany({ where: { accountId: id } });
      await client.matchHistory.deleteMany({ where: { userId: { in: [id, newId] } } });
      await client.user.deleteMany({ where: { id: { in: [id, newId] } } });
      await client.$disconnect();
    }
    vi.unstubAllEnvs();
  });

  it('separates staff capabilities and revokes a staff session when the directory changes', async () => {
    expect((await get('/access', support)).body.permissions).toEqual({ profile: true, note: true, moderate: false, grant: true, review: false });
    expect((await get('/access', moderator)).body.permissions).toMatchObject({ moderate: true, grant: false });
    expect((await request(app).get('/api/logs').set('Cookie', cookies[support])).status).toBe(403);
    expect((await get('/compensations/pending', moderator)).status).toBe(403);
    expect((await post(`/${id}/moderation`, support, { action: 'warn', reason })).status).toBe(403);
    const staff = process.env.PORTAL_STAFF_JSON!;
    vi.stubEnv('PORTAL_STAFF_JSON', JSON.stringify(JSON.parse(staff).filter((e: { email: string }) => e.email !== support)));
    try { expect((await get('/access', support)).status).toBe(401); } finally { vi.stubEnv('PORTAL_STAFF_JSON', staff); }
  });

  it('saves a private note, and notifies the player of warn, restrict and lift actions', async () => {
    expect((await post(`/${id}/notes`, support, { note: reason })).status).toBe(201);
    expect((await post(`/${id}/moderation`, moderator, { action: 'warn', reason })).status).toBe(200);
    expect((await post(`/${id}/moderation`, moderator, { action: 'restrict', reason, hours: 1 })).status).toBe(200);
    expect((await account()).restrictedUntil!.getTime()).toBeGreaterThan(Date.now());
    expect((await post(`/${id}/moderation`, moderator, { action: 'restrict', reason, hours: 1 })).status).toBe(409);
    expect((await post(`/${id}/moderation`, moderator, { action: 'lift', reason })).status).toBe(200);
    expect((await account()).restrictedUntil).toBeNull();
    const timeline = await get(`/${id}/timeline`);
    expect(timeline.body.entries.map((e: { action: string }) => e.action)).toEqual(['lift', 'restrict', 'warn', 'note']);
    const notifications = await client.userNotification.findMany({ where: { userId: id } });
    expect(notifications).toHaveLength(3);
    expect(JSON.stringify(notifications)).not.toContain(reason);
  });

  it('serializes split requests, records one payment for retries and checks approval independence', async () => {
    const before = (await account()).coins;
    const inputs = [grantRequest(700), grantRequest(700)];
    const responses = await Promise.all(inputs.map(input => post(`/${id}/compensations`, owner, input)));
    expect(responses.map(res => res.body.status).sort()).toEqual(['applied', 'pending']);
    expect((await account()).coins).toBe(before+700);
    const applied = responses.find(res => res.body.status === 'applied')!.body.id;
    const pending = responses.find(res => res.body.status === 'pending')!.body.id;
    const retry = await post(`/${id}/compensations`, owner, inputs.find(input => input.id === applied)!);
    expect(retry.body.id).toBe(applied);
    expect((await account()).coins).toBe(before+700);
    expect((await post(`/compensations/${pending}/review`, owner, { decision: 'approve', reason })).status).toBe(403);
    const approvals = await Promise.all([1,2].map(() => post(`/compensations/${pending}/review`, approver, { decision: 'approve', reason })));
    expect(approvals.map(res => res.status).sort()).toEqual([200,409]);
    expect((await account()).coins).toBe(before+1400);
    expect((await post(`/${id}/compensations`, support, grantRequest(9000))).status).toBe(409);
    const big = await post(`/${id}/compensations`, support, grantRequest(100, 'gems'));
    expect(big.body.status).toBe('pending');
    expect((await post(`/compensations/${big.body.id}/review`, approver, { decision: 'reject', reason })).body.status).toBe('rejected');
    expect((await account()).gems).toBe(15);
  });

  it('grants known cosmetics only; a conflicting duration rolls back the entire operation', async () => {
    const [item, collision] = compensationCatalog;
    expect((await post(`/${id}/compensations`, support, { ...grantRequest(1, 'item'), itemId: 'chest_gold' })).status).toBe(400);
    await client.userInventoryItem.create({
      data: { userId: id, itemId: collision.id, durationHours: 24, name: collision.name, desc: collision.desc },
    });
    const conflicting = { ...grantRequest(1, 'item'), itemId: collision.id };
    expect((await post(`/${id}/compensations`, support, conflicting)).status).toBe(409);
    expect(await client.adminCompensation.findUnique({ where: { id: conflicting.id } })).toBeNull();
    const valid = { ...grantRequest(1, 'item'), itemId: item.id };
    expect((await post(`/${id}/compensations`, support, valid)).body.status).toBe('applied');
    const inventory = await client.userInventoryItem.findUniqueOrThrow({ where: { userId_itemId: { userId: id, itemId: item.id } } });
    expect(inventory).toMatchObject({ qty: 1, durationHours: 1 });
  });

  it('deduplicates reported matches and counts active, returning and newly registered players', async () => {
    const now = new Date();
    const { days, first } = registrationWindow(now);
    await client.matchHistory.create({ data: {
      roomCode: 'qa-older', userId: id, mode: 'duel', categoryId: 'general_culture',
      playedAt: new Date(first.getTime()-86_400_000), rankingsJson: [],
    } });
    const summary: TrackedMatchSummary = {
      matchId: randomUUID(), roomCode: 'qa-current', mode: 'duel', podium: {}, totalRounds: 5,
      verifiedPlayerIds: [id, newId, 'guest_qa', 'bot_qa'],
      rankings: [id, newId, 'guest_qa', 'bot_qa'].map((playerId, i) => ({
        playerId, displayName: 'QA Player', score: 900, rank: i+1, isHost: i===0, streak: 3,
      })),
    };
    await Promise.all([recordCompletedPlayers(client, summary), recordCompletedPlayers(client, summary)]);
    expect(await client.matchHistory.count({ where: { roomCode: summary.roomCode, userId: { in: [id, newId] } } })).toBe(2);
    const stats = await readPlayerAnalytics(client, days, first, new Date());
    expect(stats.weeklyActive).toBeGreaterThanOrEqual(2);
    expect(stats.weeklyReturning).toBeGreaterThanOrEqual(1);
    expect(stats.newPlayersWithFirstMatch).toBeGreaterThanOrEqual(1);
    expect(stats.days.at(-1)?.active).toBeGreaterThanOrEqual(2);
  });
});
