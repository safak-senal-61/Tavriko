import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import type { Prisma } from '@prisma/client';
import { getRewardedAdStatus, REWARDED_AD_COINS } from '@trivia/shared';
import { Request, Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { db } from '../db/prismaClient';
import { requireUserAuth } from '../middleware/auth';
import { isAdAttemptId, matchesAdAttemptTime, verifyAdMobCallback } from '../services/admobReward';

export const rewardedAdRoutes = Router();
const enabled = () => process.env.ADMOB_REWARDED_ENABLED === 'true';
const DAY_MS = 86_400_000;
const limiter = (limit: number) => rateLimit({
  windowMs: 60_000,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const forwarded = process.env.VERCEL === '1' ? req.get('x-forwarded-for')?.trim() : undefined;
    const ip = forwarded && isIP(forwarded) ? forwarded : req.ip || req.socket.remoteAddress;
    return ip && isIP(ip) ? ipKeyGenerator(ip) : 'unknown';
  },
});
const statusRateLimit = limiter(120);
const startRateLimit = limiter(20);
const callbackRateLimit = limiter(600);
rewardedAdRoutes.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

async function statusFor(tx: Prisma.TransactionClient, userId: string, now = Date.now()) {
  const startOfDay = new Date(Math.floor(now / DAY_MS) * DAY_MS);
  const where = { userId, rewardedAt: { not: null } };
  const [count, latest] = await Promise.all([
    tx.rewardedAdAttempt.count({ where: { userId, rewardedAt: { gte: startOfDay } } }),
    tx.rewardedAdAttempt.findFirst({ where, orderBy: { rewardedAt: 'desc' }, select: { rewardedAt: true } }),
  ]);
  return getRewardedAdStatus({ date: startOfDay.toISOString().slice(0, 10), count, lastAt: latest?.rewardedAt?.getTime() ?? 0 }, now);
}

async function lockAccount(tx: Prisma.TransactionClient, userId: string) {
  const [account] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
  return account;
}

rewardedAdRoutes.get('/status', statusRateLimit, requireUserAuth, async (req, res) => {
  const userId = req.authUserId!;
  if (!enabled() || userId.startsWith('guest_')) {
    res.json({ enabled: false });
    return;
  }
  if (req.query.attemptId !== undefined && !isAdAttemptId(req.query.attemptId)) {
    res.sendStatus(400);
    return;
  }
  try {
    const client = db.rawClient;
    const attempt = isAdAttemptId(req.query.attemptId)
      ? await client.rewardedAdAttempt.findFirst({ where: { id: req.query.attemptId, userId }, select: { rewardedAt: true } })
      : null;
    const [account, status] = await Promise.all([
      client.user.findUnique({ where: { id: userId }, select: { coins: true } }),
      statusFor(client, userId),
    ]);
    if (!account) { res.sendStatus(404); return; }
    res.json({ enabled: true, status, rewarded: Boolean(attempt?.rewardedAt), coins: account.coins });
  } catch {
    res.sendStatus(503);
  }
});

rewardedAdRoutes.post('/start', startRateLimit, requireUserAuth, async (req, res) => {
  const userId = req.authUserId!;
  if (!enabled() || userId.startsWith('guest_')) { res.sendStatus(404); return; }
  try {
    const result = await db.rawClient.$transaction(async tx => {
      if (!await lockAccount(tx, userId)) return null;
      const now = Date.now();
      const status = await statusFor(tx, userId, now);
      if (!status.remainingToday || status.cooldownSec) return { status };
      // Keep serverless instances from minting an unbounded number of attempts.
      const recent = await tx.rewardedAdAttempt.findFirst({
        where: { userId, createdAt: { gte: new Date(now - 5000) } },
        select: { id: true },
      });
      if (recent) return { status };
      await tx.rewardedAdAttempt.deleteMany({ where: { userId, rewardedAt: null, createdAt: { lt: new Date(now - DAY_MS) } } });
      const id = randomUUID();
      await tx.rewardedAdAttempt.create({ data: { id, userId, createdAt: new Date(now) } });
      return { status, attemptId: id };
    });
    if (!result) { res.sendStatus(404); return; }
    res.status(result.attemptId ? 200 : 429).json(result);
  } catch {
    res.sendStatus(503);
  }
});

rewardedAdRoutes.get('/admob-ssv', callbackRateLimit, async (req, res) => {
  const queryStart = req.originalUrl.indexOf('?');
  if (queryStart < 0) { res.sendStatus(400); return; }
  try {
    const callback = await verifyAdMobCallback(req.originalUrl.slice(queryStart + 1));
    if (!callback) { res.sendStatus(403); return; }
    // The dashboard's verification request never credits an account.
    if (callback === 'verification') { res.sendStatus(200); return; }
    if (!enabled()) { res.sendStatus(503); return; }
    await db.rawClient.$transaction(async tx => {
      const pending = await tx.rewardedAdAttempt.findUnique({ where: { id: callback.attemptId } });
      if (!pending || !await lockAccount(tx, pending.userId)) return;
      const attempt = await tx.rewardedAdAttempt.findUnique({ where: { id: callback.attemptId } });
      if (!attempt || attempt.rewardedAt || !matchesAdAttemptTime(attempt.createdAt.getTime(), callback.timestamp)) return;
      const now = Date.now();
      const status = await statusFor(tx, attempt.userId, now);
      if (!status.remainingToday || status.cooldownSec) return;
      // The unique AdMob transaction ID + locked account prevent double credits across instances.
      await tx.rewardedAdAttempt.update({
        where: { id: attempt.id },
        data: { transactionId: callback.transactionId, rewardedAt: new Date(now) },
      });
      await tx.user.update({ where: { id: attempt.userId }, data: { coins: { increment: REWARDED_AD_COINS } } });
    });
    res.sendStatus(200);
  } catch {
    res.sendStatus(503);
  }
});
