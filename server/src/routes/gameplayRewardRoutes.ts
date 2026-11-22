import { Router, type Response } from 'express';
import { db } from '../db/prismaClient';
import { requireUserAuth } from '../middleware/auth';
import { claimGameplayReward, GameplayRewardError, getGameplayRewardProgress } from '../services/gameplayRewards';

export const gameplayRewardRoutes = Router();
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

gameplayRewardRoutes.get('/', requireUserAuth, async (req, res) => {
  try {
    res.json({ rewards: await getGameplayRewardProgress(db.rawClient, req.authUserId!) });
  } catch (error) { sendError(res, error); }
});

gameplayRewardRoutes.post('/claim', requireUserAuth, async (req, res) => {
  try {
    const userId = req.authUserId!;
    const result = await claimGameplayReward(db.rawClient, userId, req.body?.rewardId);
    const user = await db.getUserProfileAsync(userId);
    res.json({ ...result, user });
  } catch (error) { sendError(res, error); }
});
