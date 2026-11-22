import { isIP } from 'node:net';
import { Router, type Request, type Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { db } from '../db/prismaClient';
import { requireUserAuth } from '../middleware/auth';
import { claimGameplayReward, GameplayRewardError, getGameplayRewardProgress } from '../services/gameplayRewards';

export const gameplayRewardRoutes = Router();
const limitOptions = {
  windowMs: 60_000,
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek. Lütfen biraz sonra tekrar dene.' },
  keyGenerator: (req: Request) => {
    const forwarded = process.env.VERCEL === '1' ? req.get('x-forwarded-for')?.trim() : undefined;
    const ip = forwarded && isIP(forwarded) ? forwarded : req.ip || req.socket.remoteAddress;
    return ip && isIP(ip) ? ipKeyGenerator(ip) : 'unknown';
  },
};
const progressRateLimit = rateLimit({ ...limitOptions, limit: 120 });
const claimRateLimit = rateLimit({ ...limitOptions, limit: 20 });

gameplayRewardRoutes.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

function sendError(res: Response, error: unknown) {
  if (error instanceof GameplayRewardError) {
    res.status(error.status).json({ error: error.message });
  } else {
    console.error('[gameplayRewards] Storage unavailable:', error instanceof Error ? error.name : 'Unknown');
    res.status(503).json({ error: 'Ödüller şu anda yüklenemiyor. Tekrar deneyebilirsin.' });
  }
}

gameplayRewardRoutes.get('/', progressRateLimit, requireUserAuth, async (req, res) => {
  try {
    res.json({ rewards: await getGameplayRewardProgress(db.rawClient, req.authUserId!) });
  } catch (error) { sendError(res, error); }
});

gameplayRewardRoutes.post('/claim', claimRateLimit, requireUserAuth, async (req, res) => {
  try {
    const userId = req.authUserId!;
    const result = await claimGameplayReward(db.rawClient, userId, req.body?.rewardId);
    const user = await db.getUserProfileAsync(userId);
    res.json({ ...result, user });
  } catch (error) { sendError(res, error); }
});
