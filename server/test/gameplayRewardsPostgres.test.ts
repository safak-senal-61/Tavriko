import { createHmac, randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const url = process.env.GAMEPLAY_REWARDS_TEST_DATABASE_URL;
const secret = 'isolated-gameplay-rewards-jwt-test-only';
const root = '/api/social';
const suffix = randomUUID().slice(0, 8);
const ids = new Set<string>();
let client: PrismaClient;
let app: express.Express;
let recordCompletedPlayers: typeof import('../src/services/playerAnalytics').recordCompletedPlayers;

const auth = (userId: string) => `Bearer ${jwt.sign({ userId, username: userId }, secret)}`;
const get = (id: string) => request(app).get(`${root}/rewards`).set('Authorization', auth(id));
const post = (id: string, path: string, body: object) => request(app).post(`${root}${path}`).set('Authorization', auth(id)).send(body);
const statusOf = (body: any, id: string) => body.rewards.find((s: { id: string }) => s.id === id);
const player = async (name: string, friendIds: string[] = []) => {
  const id = `qa_rewards_${name}_${suffix}`;
  ids.add(id);
  await client.user.create({ data: { id, username: id, email: `${id}@example.test`, displayName: 'QA', friendCode: id, friendIds } });
  return id;
};
const inventory = (userId: string) => client.userInventoryItem.findMany({ where: { userId }, orderBy: { itemId: 'asc' } });
const item = (userId: string, itemId: string, durationHours?: number) =>
  client.userInventoryItem.create({ data: { userId, itemId, name: itemId, desc: 'QA', durationHours } });

const match = async (userId: string, otherId: string, correctAnswersCount: number, verified = true) => {
  const roomCode = randomUUID();
  const summary = {
    matchId: randomUUID(), roomCode, mode: 'duel' as const, totalRounds: 5,
    verifiedPlayerIds: verified ? [userId] : [otherId],
    rankings: [
      { playerId: userId, displayName: 'QA', rank: 1, score: 500, correctAnswersCount, isBot: false },
      { playerId: otherId, displayName: 'QA', rank: 2, score: 250, correctAnswersCount: 2, isBot: false },
    ],
  };
  // The same final event sent twice produces one match for the verified account.
  await recordCompletedPlayers(client, summary as Parameters<typeof recordCompletedPlayers>[1]);
  await recordCompletedPlayers(client, summary as Parameters<typeof recordCompletedPlayers>[1]);
  return roomCode;
};

describe.skipIf(!url)('gameplay rewards on isolated PostgreSQL', () => {
  beforeAll(async () => {
    const database = new URL(url!);
    if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.pathname !== '/tavriko_rewards_qa') {
      throw new Error('Use the dedicated local tavriko_rewards_qa database only.');
    }
    vi.stubEnv('DATABASE_URL', url);
    vi.stubEnv('DIRECT_URL', url);
    vi.stubEnv('JWT_SECRET', secret);
    const { db } = await import('../src/db/prismaClient');
    const { default: socialRoutes } = await import('../src/routes/socialRoutes');
    const { default: triviaRoutes } = await import('../src/routes/triviaRoutes');
    ({ recordCompletedPlayers } = await import('../src/services/playerAnalytics'));
    client = db.rawClient;
    app = express().use(express.json()).use(root, socialRoutes).use('/api', triviaRoutes);
  });

  it('debits gold for a joker, then deducts one copy despite concurrent requests', async () => {
    const { db } = await import('../src/db/prismaClient');
    const id = await player('joker');
    await client.user.update({ where: { id }, data: { coins: 250, gems: 99 } });
    expect((await post(id, '/shop/purchase', { productId: 'gems_100', paymentMethod: 'try' })).status).toBe(409);
    const purchases = await Promise.all([1, 2].map(() => post(id, '/shop/purchase', { productId: 'joker_eliminate', paymentMethod: 'gems' })));
    expect(purchases.map(r => r.status).sort()).toEqual([200, 400]);
    expect(await client.user.findUnique({ where: { id } })).toMatchObject({ coins: 0, gems: 99 });
    expect(await inventory(id)).toMatchObject([{ itemId: 'joker_eliminate', qty: 1 }]);
    expect((await post(id, '/inventory/use', { itemId: 'joker_eliminate' })).status).toBe(400);
    const questionId = 'qa_joker_question';
    const q = { id: questionId, correctOptionId: 'a', options: ['a', 'b', 'c', 'd'].map(id => ({ id, text: id })) };
    const spy = vi.spyOn(db, 'getQuestionById').mockReturnValue(q as ReturnType<typeof db.getQuestionById>);
    try {
      const sessionId = `sess_${randomUUID().replaceAll('-', '')}`;
      const deadline = Date.now() + 60000;
      const signature = createHmac('sha256', secret).update(JSON.stringify(['practice-joker', id, sessionId, questionId, deadline])).digest('hex');
      const data = { sessionId, questionId, jokerId: 'joker_eliminate', proof: `${deadline}.${signature}` };
      const use = (owner: string, body: object) => request(app).post('/api/questions/practice/joker').set('Authorization', auth(owner)).send(body);
      expect((await use(await player('wrong_joker'), data)).status).toBe(400);
      const plays = await Promise.all([use(id, data), use(id, data)]);
      expect(plays.map(r => r.status)).toEqual([200, 200]);
      expect(plays[0].body.eliminated).toHaveLength(1);
      expect(plays[0].body.eliminated).not.toContain('a');
      expect(plays[0].body).toEqual(plays[1].body);
      expect(await inventory(id)).toMatchObject([{ itemId: 'joker_eliminate', qty: 0 }]);
    } finally { spy.mockRestore(); }
  });

  it('does not credit mismatched orders, duplicate deliveries, or replayed refunds', async () => {
    const { applyGemOrder } = await import('../src/services/polarGemPayments');
    const userId = await player('payment');
    const checkoutId = randomUUID(), orderId = randomUUID(), productId = randomUUID();
    await client.polarGemOrder.create({ data: { checkoutId, userId, productId, gems: 100, amount: 3999 } });
    const order = { id: orderId, checkout_id: checkoutId, product_id: productId, customer: { external_id: userId },
      currency: 'try', subtotal_amount: 3999, discount_amount: 0, paid: true, status: 'paid' };
    const pay = (patch: object = {}) => applyGemOrder(client, { type: 'order.paid', data: { ...order, ...patch } });
    const refund = (refunded_amount: number, status = 'paid') =>
      applyGemOrder(client, { type: 'order.refunded', data: { ...order, refunded_amount, status } });
    const balance = async () => (await client.user.findUniqueOrThrow({ where: { id: userId } })).gems;
    await pay({ subtotal_amount: 1 });
    await pay({ customer: { external_id: 'different-account' } });
    await pay({ product_id: randomUUID() });
    expect(await balance()).toBe(0);
    await Promise.all([pay(), pay(), pay()]);
    expect(await balance()).toBe(100);
    await Promise.all([refund(2000), refund(2000)]);
    await pay();
    expect(await balance()).toBe(50);
    await refund(3999, 'refunded');
    await pay();
    expect(await balance()).toBe(0);
  });

  afterAll(async () => {
    if (client) {
      await client.matchHistory.deleteMany({ where: { userId: { in: [...ids] } } });
      await client.user.deleteMany({ where: { id: { in: [...ids] } } });
      await client.$disconnect();
    }
    vi.unstubAllEnvs();
  });

  it('requires authenticated registered accounts and does not accept body identity or progress', async () => {
    const id = await player('auth');
    const other = await player('impersonation', [id]);
    expect((await request(app).get(`${root}/rewards`)).status).toBe(401);
    expect((await request(app).post(`${root}/rewards/claim`).send({ userId: id })).status).toBe(401);
    expect((await get('guest_test')).status).toBe(403);
    expect((await get('missing_account')).status).toBe(403);
    expect((await post(id, '/rewards/claim', { rewardId: 'key_master' })).status).toBe(400);
    const locked = await post(id, '/rewards/claim', { userId: other, current: 99, rewardId: 'chest_wood' });
    expect(locked.status).toBe(409);
    expect(locked.headers['cache-control']).toBe('no-store');
    expect(await inventory(id)).toHaveLength(0);
    expect(await inventory(other)).toHaveLength(0);
    for (const productId of ['chest_wood', 'key_silver', 'badge_veteran', 'pack_starter', 'pack_mega_bundle']) {
      expect((await post(id, '/shop/purchase', { productId })).status).toBe(400);
    }
  });

  it('counts only verified completed matches with a correct answer and counts separate Türkiye days', async () => {
    const id = await player('matches');
    const other = await player('other');
    await client.user.update({ where: { id }, data: { totalMatches: 90, correctAnswers: 500, totalAnswers: 500 } });
    const times = ['2026-10-01T20:59:59Z', '2026-10-01T21:00:00Z', '2026-10-02T21:00:00Z'];
    for (let i = 0; i < times.length; i++) {
      const roomCode = await match(id, other, i + 3);
      await client.matchHistory.updateMany({ where: { roomCode }, data: { playedAt: new Date(times[i]) } });
    }
    await match(id, other, 0);
    await match(id, other, 5, false);
    await client.matchHistory.create({ data: { userId: id, roomCode: 'practice', mode: 'practice', categoryId: 'history', correctAnswers: 5, rankingsJson: [] } });
    const res = await get(id);
    expect(res.status).toBe(200);
    expect(statusOf(res.body, 'chest_wood')).toMatchObject({ current: 3, claimed: false });
    expect(statusOf(res.body, 'chest_silver').current).toBe(3);
    expect(statusOf(res.body, 'badge_trivia_master').current).toBe(12);
    expect(statusOf(res.body, 'badge_genius').current).toBe(1);
    expect(statusOf(res.body, 'badge_consistent_player').current).toBe(3);
  });

  it('counts reciprocal friends only and preserves permanent badges while legacy badges expire', async () => {
    const id = await player('badge');
    const other = await player('friend');
    await client.user.update({ where: { id }, data: { friendIds: [id, other, other, 'missing_account'] } });
    expect(statusOf((await get(id)).body, 'badge_social_player').current).toBe(0);
    expect((await post(id, '/rewards/claim', { rewardId: 'badge_social_player' })).status).toBe(409);
    await client.user.update({ where: { id: other }, data: { friendIds: [id] } });
    expect(statusOf((await get(id)).body, 'badge_social_player').current).toBe(1);
    expect((await post(id, '/rewards/claim', { rewardId: 'badge_social_player' })).status).toBe(409);
    const moreFriends = await Promise.all(Array.from({ length: 4 }, (_, i) => player(`friend_${i}`, [id])));
    await client.user.update({ where: { id }, data: { friendIds: [other, ...moreFriends] } });
    const claim = await post(id, '/rewards/claim', { userId: other, rewardId: 'badge_social_player' });
    expect(claim.status).toBe(200);
    expect(claim.body.user.inventory).toContainEqual(expect.objectContaining({ id: 'badge_social_player', durationHours: 0 }));
    expect(await inventory(other)).toHaveLength(0);

    await item(id, 'badge_veteran', 24);
    for (const itemId of ['badge_social_player', 'badge_veteran', 'badge_social_player']) {
      expect((await post(id, '/inventory/use', { itemId })).status).toBe(200);
      const owner = await client.user.findUniqueOrThrow({ where: { id } });
      expect(owner.equippedBadge).toBe(itemId);
      if (itemId === 'badge_veteran') expect(Number(owner.equippedBadgeExpiresAt)).toBeGreaterThan(Date.now());
      else expect(owner.equippedBadgeExpiresAt).toBeNull();
    }
    expect(await inventory(id)).toMatchObject([{ itemId: 'badge_social_player', qty: 1, durationHours: 0 }]);
    await client.user.update({ where: { id }, data: { friendIds: [] } });
    expect(statusOf((await get(id)).body, 'badge_social_player')).toMatchObject({ current: 5, claimed: true });
  });

  it('grants a chest and key once under concurrency and opens it once', async () => {
    const id = await player('chest');
    const other = await player('opponent');
    for (let n = 0; n < 3; n++) await match(id, other, 3);
    const claim = () => post(id, '/rewards/claim', { rewardId: 'chest_wood' });
    const claims = await Promise.all([claim(), claim(), claim()]);
    expect(claims.map(r => r.status)).toEqual([200, 200, 200]);
    expect(claims.filter(r => r.body.claimedNow)).toHaveLength(1);
    expect(await inventory(id)).toMatchObject([{ itemId: 'chest_wood', qty: 1 }, { itemId: 'key_silver', qty: 1 }]);
    const opens = await Promise.all([1, 2].map(() => post(id, '/inventory/open-chest', { chestId: 'chest_wood' })));
    expect(opens.map(r => r.status).sort()).toEqual([200, 400]);
    expect(await inventory(id)).toHaveLength(0);
    expect((await claim()).body.claimedNow).toBe(false);
    const { coins, xp, gems } = opens.find(r => r.status === 200)!.body.reward;
    expect(gems).toBe(0);
    expect(await client.user.findUnique({ where: { id } })).toMatchObject({ coins: 500 + coins, xp, gems: 0 });
  });

  it('rolls back failed claims, rejects mismatched keys and spends the actual master key', async () => {
    const id = await player('rollback');
    const other = await player('rollback_opponent');
    for (let n = 0; n < 3; n++) await match(id, other, 2);
    await client.$executeRawUnsafe(`ALTER TABLE "user_inventory_items" ADD CONSTRAINT qa_no_silver CHECK ("itemId" <> 'key_silver') NOT VALID`);
    try {
      expect((await post(id, '/rewards/claim', { rewardId: 'chest_wood' })).status).toBe(503);
      expect(await inventory(id)).toHaveLength(0);
      expect(await client.gameplayRewardClaim.count({ where: { userId: id } })).toBe(0);
    } finally {
      await client.$executeRawUnsafe('ALTER TABLE "user_inventory_items" DROP CONSTRAINT qa_no_silver');
    }
    await item(id, 'chest_gold');
    await item(id, 'key_silver');
    const open = () => post(id, '/inventory/open-chest', { chestId: 'chest_gold', keyId: 'key_silver' });
    expect((await open()).status).toBe(400);
    expect(await inventory(id)).toMatchObject([{ itemId: 'chest_gold', qty: 1 }, { itemId: 'key_silver', qty: 1 }]);
    await item(id, 'key_master');
    expect((await open()).status).toBe(200);
    expect((await inventory(id)).map(i => i.itemId)).not.toContain('key_master');
    expect((await inventory(id)).map(i => i.itemId)).toContain('key_silver');
    await item(id, 'gift_box');
    expect((await post(id, '/inventory/open-chest', { chestId: 'gift_box' })).status).toBe(200);
  });

  it('keeps the reward claim ledger inaccessible to anon and authenticated database roles', async () => {
    for (const role of ['anon', 'authenticated']) {
      await expect(client.$transaction(async tx => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
        return tx.$queryRaw`SELECT * FROM "gameplay_reward_claims"`;
      })).rejects.toThrow('permission denied');
    }
  });

  it('keeps payment and joker usage tables private', async () => {
    const readOrders = (tx: PrismaClient) => tx.$queryRaw`SELECT 1 FROM "polar_gem_orders" LIMIT 1`;
    const readJokers = (tx: PrismaClient) => tx.$queryRaw`SELECT 1 FROM "practice_joker_uses" LIMIT 1`;
    for (const role of ['anon', 'authenticated']) {
      for (const query of [readOrders, readJokers]) {
        await expect(client.$transaction(async tx => {
          await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
          return query(tx as PrismaClient);
        })).rejects.toThrow('permission denied');
      }
    }
  });
});
