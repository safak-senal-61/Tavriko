import { Router, Request, Response } from 'express';
import { db } from '../db/prismaClient';

const router = Router();

router.get('/leaderboard', (req: Request, res: Response): void => {
  const topPlayers = db.getLeaderboard(25);
  res.json({
    season: 'Sezon 1: Bilgi Çağı',
    endsInDays: 14,
    topPlayers,
  });
});

router.get('/friends/:userId', (req: Request, res: Response): void => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const data = db.getFriendsForUser(userId || 'anon');
  res.json(data);
});

router.post('/friends/add', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, codeOrUsername } = req.body;
    if (!userId || !codeOrUsername) {
      res.status(400).json({ error: 'userId ve codeOrUsername gereklidir.' });
      return;
    }
    const result = await db.addFriend(userId, codeOrUsername);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/shop/purchase', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, packId, coinsDelta, gemsDelta, itemId, itemQty } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'userId gerekli' });
      return;
    }

    let resolvedPack = { coinsDelta, gemsDelta, itemId, itemQty };
    let message = 'Satın alma işlemi veritabanına kaydedildi!';

    if (packId === 'starter_pack') {
      resolvedPack = { coinsDelta: 1000, gemsDelta: 50, itemId: 'chest', itemQty: 1 };
      message = 'Başlangıç Paketi (+1.000 Altın, +50 Elmas, +1 Sandık) hesabına eklendi!';
    } else if (packId === 'gems_100') {
      resolvedPack = { gemsDelta: 100, coinsDelta: 0, itemId: undefined, itemQty: 0 };
      message = '+100 Elmas hesabına başarıyla eklendi!';
    } else if (packId === 'gems_500') {
      resolvedPack = { gemsDelta: 550, coinsDelta: 0, itemId: undefined, itemQty: 0 };
      message = 'Ödeme Onaylandı! +550 Elmas (50 Bonus) hesabına eklendi!';
    } else if (packId === 'coins_2000') {
      resolvedPack = { coinsDelta: 2000, gemsDelta: -10, itemId: undefined, itemQty: 0 };
      message = '+2.000 Altın hesabına eklendi!';
    } else if (packId === 'mega_chest') {
      resolvedPack = { coinsDelta: -400, gemsDelta: 0, itemId: 'chest', itemQty: 2 };
      message = '2x Mega Sandık envanterine eklendi!';
    }

    const updated = await db.purchaseShopPack(userId, resolvedPack);
    res.json({ success: true, user: updated, message });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/inventory/use', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, itemId } = req.body;
    if (!userId || !itemId) {
      res.status(400).json({ error: 'userId ve itemId gerekli' });
      return;
    }
    const result = await db.useInventoryItem(userId, itemId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/season/claim', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, tier } = req.body;
    if (!userId || !tier) {
      res.status(400).json({ error: 'userId ve tier gerekli' });
      return;
    }
    const updated = await db.claimSeasonTier(userId, Number(tier));
    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/profile/:userId', async (req: Request, res: Response): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const profile = await db.getUserProfileAsync(userId);
  if (!profile) {
    res.status(404).json({ error: 'Profil bulunamadı' });
    return;
  }
  res.json(profile);
});

router.post('/daily-challenge/complete', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, correctAnswers, totalQuestions } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'userId gereklidir' });
      return;
    }
    const result = await db.recordDailyChallengeCompletion(userId, {
      correctAnswers: Number(correctAnswers) || 0,
      totalQuestions: Number(totalQuestions) || 5,
    });
    if (!result.success) {
      res.status(400).json({ error: result.error, user: result.user });
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
