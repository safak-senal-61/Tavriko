import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rewardedAdRoutes } from '../src/routes/rewardedAdRoutes';
import { verifyAdMobCallback } from '../src/services/admobReward';

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  read: vi.fn(),
  mark: vi.fn(),
  credit: vi.fn(),
  count: vi.fn(),
  latest: vi.fn(),
  lock: vi.fn(),
}));
vi.mock('../src/db/prismaClient', () => ({ db: { rawClient: { $transaction: mocks.run } } }));
vi.mock('../src/middleware/auth', () => ({
  requireUserAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.get('Authorization') !== 'Bearer test-user') { res.sendStatus(401); return; }
    req.authUserId = 'player_1';
    next();
  },
}));
vi.mock('../src/services/admobReward', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/services/admobReward')>(),
  verifyAdMobCallback: vi.fn(),
}));

const app = express().use('/rewarded', rewardedAdRoutes);
const attemptId = randomUUID();
const query = '/rewarded/admob-ssv?signed-query';

describe('rewarded ad routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('ADMOB_REWARDED_ENABLED', 'true');
    mocks.run.mockImplementation(fn => fn({
      $queryRaw: mocks.lock,
      user: { update: mocks.credit },
      rewardedAdAttempt: { findUnique: mocks.read, update: mocks.mark, count: mocks.count, findFirst: mocks.latest },
    }));
    mocks.lock.mockResolvedValue([{ id: 'player_1' }]);
    mocks.count.mockResolvedValue(0);
    mocks.latest.mockResolvedValue(null);
    mocks.read.mockResolvedValue(null);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('disables ad attempts by default and requires authentication', async () => {
    vi.stubEnv('ADMOB_REWARDED_ENABLED', '');
    await request(app).get('/rewarded/status').expect(401);
    await request(app).get('/rewarded/status').set('Authorization', 'Bearer test-user').expect(200, { enabled: false });
    await request(app).post('/rewarded/start').set('Authorization', 'Bearer test-user').expect(404);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it('does not offer a client claim and rejects unverified callbacks without entering a transaction', async () => {
    vi.mocked(verifyAdMobCallback).mockResolvedValue(null);
    await request(app).post('/rewarded/claim').set('Authorization', 'Bearer test-user').expect(404);
    await request(app).get(query).expect(403);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it('credits a verified event once and acknowledges duplicate delivery', async () => {
    const attempt = { id: attemptId, userId: 'player_1', createdAt: new Date(), rewardedAt: null };
    const alreadyRewarded = { ...attempt, rewardedAt: new Date() };
    vi.mocked(verifyAdMobCallback).mockResolvedValue({ attemptId, transactionId: 'ad-tx-1', timestamp: Date.now() });
    mocks.read.mockResolvedValueOnce(attempt).mockResolvedValueOnce(attempt).mockResolvedValue(alreadyRewarded);
    await request(app).get(query).expect(200);
    await request(app).get(query).expect(200);
    expect(mocks.mark).toHaveBeenCalledTimes(1);
    expect(mocks.credit).toHaveBeenCalledExactlyOnceWith({ where: { id: 'player_1' }, data: { coins: { increment: 25 } } });
  });

  it('acknowledges AdMob dashboard verification without crediting any account', async () => {
    vi.stubEnv('ADMOB_REWARDED_ENABLED', '');
    vi.mocked(verifyAdMobCallback).mockResolvedValue('verification');
    await request(app).get(query).expect(200);
    expect(mocks.run).not.toHaveBeenCalled();
  });
});
