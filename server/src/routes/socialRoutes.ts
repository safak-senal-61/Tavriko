import { Router, Request, Response } from 'express';
import { db } from '../db/dbAdapter';

const router = Router();

router.get('/leaderboard', (req: Request, res: Response): void => {
  const topPlayers = db.getLeaderboard(20);
  res.json({
    season: 'Sezon 1: Bilgi Çağı',
    endsInDays: 14,
    topPlayers,
  });
});

router.get('/profile/:userId', (req: Request, res: Response): void => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const profile = db.getUserProfile(userId);
  if (!profile) {
    res.status(404).json({ error: 'Profil bulunamadı' });
    return;
  }
  res.json(profile);
});

export default router;
