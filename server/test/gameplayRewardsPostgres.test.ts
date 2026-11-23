import { createHmac, randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const url = process.env.GAMEPLAY_REWARDS_TEST_DATABASE_URL;
const secret = 'isolated-gameplay-rewards-jwt-test-only';
const internalSecret = 'isolated-room-joker-test-only';
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

const match = async (userId: string, otherId: string, correctAnswersCount: number, verified = true, completed = true) => {
  const roomCode = randomUUID();
  const summary = {
    matchId: randomUUID(), roomCode, mode: 'duel' as const, totalRounds: 5, rewardCompletedPlayerIds: completed ? [userId] : [],
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
    vi.stubEnv('INTERNAL_API_SECRET', internalSecret);
    const { db } = await import('../src/db/prismaClient');
    const { default: socialRoutes } = await import('../src/routes/socialRoutes');
    const { default: triviaRoutes } = await import('../src/routes/triviaRoutes');
    const { polarGemPlayerRoutes } = await import('../src/routes/polarGemRoutes');
    ({ recordCompletedPlayers } = await import('../src/services/playerAnalytics'));
    client = db.rawClient;
    app = express().use(express.json()).use(root, socialRoutes, polarGemPlayerRoutes).use('/api', triviaRoutes);
  });

  it('debits gold for a joker, then deducts one copy despite concurrent requests', async () => {
    const { db } = await import('../src/db/prismaClient');
    const health = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ features: { liveQuizJokers: true } }));
    try {
      expect((await request(app).get(`${root}/shop/jokers/availability`)).body).toEqual({ enabled: true, advanced: false });
    } finally { health.mockRestore(); }
    const id = await player('joker');
    await client.user.update({ where: { id }, data: { coins: 250, gems: 99 } });
    expect((await post(id, '/shop/purchase', { productId: 'joker_retry' })).status).toBe(503);
    expect((await post(id, '/shop/purchase', { productId: 'gems_100', paymentMethod: 'try' })).status).toBe(409);
    const purchases = await Promise.all([1, 2].map(() => post(id, '/shop/purchase', { productId: 'joker_eliminate', paymentMethod: 'gems' })));
    expect(purchases.map(r => r.status).sort()).toEqual([200, 400]);
    expect(purchases.find(r => r.ok)?.body.user).toMatchObject({
      coins: 0, gems: 99, inventory: [{ id: 'joker_eliminate', qty: 1 }],
    });
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

  it('returns committed balances for gold, a booster and an auto-equipped rental', async () => {
    const id = await player('shop');
    await client.user.update({ where: { id }, data: { gems: 250 } });
    const gold = await post(id, '/shop/purchase', { productId: 'coins_1000' });
    expect(gold.status).toBe(200);
    expect(gold.body.user).toMatchObject({ coins: 1500, gems: 240 });
    const booster = await post(id, '/shop/purchase', { productId: 'booster_xp_2x_1h' });
    expect(booster.status).toBe(200);
    expect(booster.body.user).toMatchObject({ gems: 215, inventory: [{ id: 'booster_xp_2x_1h', qty: 1 }] });
    const frame = await post(id, '/shop/purchase', { productId: 'frame_ice', durationId: '1h' });
    expect(frame.status).toBe(200);
    expect(frame.body.user).toMatchObject({ equippedFrame: 'frame_ice', inventory: [{ id: 'booster_xp_2x_1h', qty: 1 }] });
    expect(await client.user.findUnique({ where: { id } })).toMatchObject({
      coins: 1500, gems: frame.body.user.gems, equippedFrame: 'frame_ice', equippedFrameExpiresAt: expect.any(BigInt),
    });
    expect(await inventory(id)).toMatchObject([{ itemId: 'booster_xp_2x_1h', qty: 1 }]);
  });

  it('uses live stock once per round, even with concurrent different jokers', async () => {
    const userId = await player('livejoker');
    await client.user.update({ where: { id: userId }, data: { coins: 600 } });
    expect((await post(userId, '/shop/purchase', { productId: 'joker_word_count' })).status).toBe(200);
    expect((await post(userId, '/shop/purchase', { productId: 'joker_eliminate' })).status).toBe(200);
    const startedAt = Date.now();
    const round = {
      userId, roomCode: 'QA0001', startedAt, deadline: startedAt + 15_000, roundNumber: 1,
      questionId: 'qa_live_joker', correctOptionId: 'a', jokerId: 'joker_word_count',
      options: [{ id: 'a', text: 'İstanbul Boğazı' }, { id: 'b', text: 'Van' }, { id: 'c', text: 'İzmir' }, { id: 'd', text: 'Ankara' }],
    };
    const play = (patch: object = {}, key = internalSecret) => request(app).post('/api/internal/room-joker')
      .set('x-internal-secret', key).send({ ...round, ...patch });
    expect((await play({}, 'wrong')).status).toBe(403);
    expect((await play({ startedAt: startedAt - 20_000, deadline: startedAt - 5000 })).status).toBe(409);
    expect((await play({ options: round.options.map(o => ({ ...o, text: 'Aynı' })) })).status).toBe(409);
    const outcomes = await Promise.all([play(), play({ jokerId: 'joker_eliminate' })]);
    expect(outcomes.map(response => response.status).sort()).toEqual([200, 409]);
    expect(outcomes.find(response => response.status === 409)?.body.code).toBe('already_used');
    expect((await inventory(userId)).reduce((sum, entry) => sum + entry.qty, 0)).toBe(1);
    expect(await client.practiceJokerUse.count({ where: { userId } })).toBe(1);
    const played = await client.practiceJokerUse.findFirstOrThrow({ where: { userId } });
    const retry = await play({ jokerId: played.jokerId });
    expect(retry.status).toBe(200);
    expect(retry.body).toEqual(outcomes.find(response => response.status === 200)?.body);
    expect((await inventory(userId)).reduce((sum, entry) => sum + entry.qty, 0)).toBe(1);
    const remaining = played.jokerId === 'joker_word_count' ? 'joker_eliminate' : 'joker_word_count';
    const next = await play({ roundNumber: 2, jokerId: remaining });
    expect(next.status).toBe(200);
    if (remaining === 'joker_word_count') expect(next.body).toEqual({ eliminated: [], hint: '2 kelime' });
    else expect(next.body.eliminated).toHaveLength(1);
    expect((await play({ roundNumber: 3 })).status).toBe(409);
  });

  it('uses an issued practice snapshot through the lightweight app with no catalogue lookup', async () => {
    const { createJokerApp } = await import('../src/jokerApp');
    const { sealPracticeJoker } = await import('../src/services/practiceJokerProof');
    const { db } = await import('../src/db/prismaClient');
    const userId = await player('fast_joker');
    await item(userId, 'joker_eliminate');
    const scope = { userId, sessionId: `sess_${randomUUID().replaceAll('-', '')}`, questionId: 'snapshot-only-qa' };
    const question = { correctOptionId: 'a', options: ['a', 'b', 'c', 'd'].map(id => ({ id, text: id })) };
    const proof = sealPracticeJoker(scope, question, Date.now() + 30_000, secret);
    const questionRead = vi.spyOn(db, 'getQuestionById');
    try {
      const server = request(createJokerApp());
      const send = () => server.post('/api/questions/practice/joker').set('Authorization', auth(userId))
        .send({ sessionId: scope.sessionId, questionId: scope.questionId, jokerId: 'joker_eliminate', proof });
      const [first, retry] = await Promise.all([send(), send()]);
      expect(first.status).toBe(200);
      expect(first.headers['server-timing']).toMatch(/^joker-wallet;dur=\d+$/);
      expect(first.body.eliminated).toHaveLength(1);
      expect(first.body.eliminated).not.toContain('a');
      expect(retry.status).toBe(200);
      expect(retry.body).toEqual(first.body);
      expect(questionRead).not.toHaveBeenCalled();
      expect(await inventory(userId)).toMatchObject([{ itemId: 'joker_eliminate', qty: 0 }]);
      expect(await client.practiceJokerUse.count({ where: { userId } })).toBe(1);
    } finally { questionRead.mockRestore(); }
  });

  it('does not consume a tactic in a standard duel and debits an eligible tactic only once', async () => {
    const userId = await player('bot_tactic');
    expect((await post(userId, '/shop/purchase', { productId: 'joker_double' })).status).toBe(200);
    const startedAt = Date.now();
    const body = { userId, startedAt, deadline: startedAt + 15000, roomCode: 'QABOT', roundNumber: 1,
      questionId: 'qa_bot_joker', correctOptionId: 'a', jokerId: 'joker_double',
      options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] };
    const play = (tactics?: string) => request(app).post('/api/internal/room-joker')
      .set('x-internal-secret', internalSecret).send({ ...body, tactics });
    expect((await play()).status).toBe(409);
    expect(await inventory(userId)).toMatchObject([{ itemId: 'joker_double', qty: 1 }]);
    const outcomes = await Promise.all([play('friendly'), play('friendly')]);
    expect(outcomes.map(response => response.status)).toEqual([200, 200]);
    for (const response of outcomes) expect(response.body).toMatchObject({ modifier: 'double', eliminated: [] });
    expect(await inventory(userId)).toMatchObject([{ itemId: 'joker_double', qty: 0 }]);
    expect(await client.practiceJokerUse.count({ where: { userId } })).toBe(1);
  });

  it('checks capability and real vote count before consuming an advanced joker', async () => {
    const userId = await player('advanced_tactic');
    await item(userId, 'joker_audience');
    const startedAt = Date.now();
    const body = { userId, startedAt, deadline: startedAt + 15000, roomCode: 'QAADV', roundNumber: 1,
      questionId: 'qa_advanced_joker', correctOptionId: 'a', jokerId: 'joker_audience', tactics: 'friendly',
      options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] };
    const play = (patch: object) => request(app).post('/api/internal/room-joker')
      .set('x-internal-secret', internalSecret).send({ ...body, ...patch });
    expect((await play({ votes: { a: 4, b: 1 } })).status).toBe(409);
    expect((await play({ capabilities: {}, votes: { a: 4, b: 0 } })).status).toBe(409);
    expect(await inventory(userId)).toMatchObject([{ itemId: 'joker_audience', qty: 1 }]);
    const results = await Promise.all([play({ capabilities: {}, votes: { a: 4, b: 1 } }), play({ capabilities: {}, votes: { a: 4, b: 1 } })]);
    expect(results.map(response => response.status)).toEqual([200, 200]);
    expect(results[0].body).toMatchObject({ votes: { a: 4, b: 1 } });
    expect(await inventory(userId)).toMatchObject([{ itemId: 'joker_audience', qty: 0 }]);
    expect(await client.practiceJokerUse.count({ where: { userId } })).toBe(1);
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

  it('limits repeated checkout requests before reaching the payment service', async () => {
    const send = () => request(app).post(`${root}/shop/diamonds/checkout`).send({});
    for (let i = 0; i < 16; i++) expect((await send()).status).toBe(401);
    expect((await send()).status).toBe(429);
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

  it('counts only verified completed matches and distinct Türkiye days, even with zero correct answers', async () => {
    const id = await player('matches');
    const other = await player('other');
    await client.user.update({ where: { id }, data: { totalMatches: 90, correctAnswers: 500, totalAnswers: 500 } });
    const times = ['2026-10-01T20:59:59Z', '2026-10-01T21:00:00Z', '2026-10-02T21:00:00Z'];
    for (let i = 0; i < times.length; i++) {
      const roomCode = await match(id, other, i + 3);
      await client.matchHistory.updateMany({ where: { roomCode }, data: { playedAt: new Date(times[i]) } });
    }
    await match(id, other, 3, true, false);
    await match(id, other, 0, true, false);
    await match(id, other, 5, false);
    await client.matchHistory.create({ data: { userId: id, roomCode: 'practice', mode: 'practice', categoryId: 'history', correctAnswers: 5, rankingsJson: [] } });
    const res = await get(id);
    expect(res.status).toBe(200);
    expect(statusOf(res.body, 'chest_wood')).toMatchObject({ current: 3, claimed: false });
    expect(statusOf(res.body, 'chest_silver').current).toBe(3);
    expect(statusOf(res.body, 'badge_trivia_master').current).toBe(12);
    expect(statusOf(res.body, 'badge_genius').current).toBe(1);
    expect(statusOf(res.body, 'badge_consistent_player').current).toBe(3);
    expect(statusOf(res.body, 'badge_veteran').current).toBe(3);
    await match(id, other, 0);
    const afterWrong = await get(id);
    expect(statusOf(afterWrong.body, 'chest_wood').current).toBe(4);
    expect(statusOf(afterWrong.body, 'badge_trivia_master').current).toBe(12);
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
    for (let n = 0; n < 8; n++) await match(id, other, 3);
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
    for (let n = 0; n < 8; n++) await match(id, other, 2);
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
