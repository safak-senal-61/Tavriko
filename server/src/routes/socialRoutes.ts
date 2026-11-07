import { Router, Request, Response } from 'express';
import { requireUser } from '../middleware/security';
import { db } from '../db/prismaClient';
import { presenceManager } from '../services/presenceManager';
import { SHOP_CATALOG, SEASON_1_TIERS, EVENT_DEFINITIONS } from '@trivia/shared';

const router = Router();

router.get('/leaderboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const topPlayers = await db.getLeaderboardAsync(30);
    res.json({
      season: 'Sezon 1: Bilgi Çağı',
      endsInDays: 45,
      topPlayers,
      leaders: topPlayers,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/friends/:userId', requireUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    if ((req as any).authUserId !== userId) { res.status(403).json({ error: 'Bu kaynağa erişim yetkiniz yok.' }); return; }
    const data = await db.getFriendsForUserAsync(userId || 'anon');
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/friends/add', requireUser, async (req: Request, res: Response): Promise<void> => {
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

router.post('/friends/remove', requireUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, friendId, targetUserId } = req.body;
    const target = friendId || targetUserId;
    if (!userId || !target) {
      res.status(400).json({ error: 'userId ve friendId zorunludur.' });
      return;
    }
    const result = await db.removeFriend(userId, target);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- 1v1 Match Challenge (Yarış İsteği) ---
router.post('/friends/challenge', requireUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, targetUserId, category } = req.body;
    if (!userId || !targetUserId) {
      res.status(400).json({ error: 'userId ve targetUserId zorunludur.' });
      return;
    }
    const result = await db.sendDuelChallenge(userId, targetUserId, category);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Real Notifications API ---
router.get('/notifications/:userId', requireUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    if ((req as any).authUserId !== userId) { res.status(403).json({ error: 'Bu kaynağa erişim yetkiniz yok.' }); return; }
    const notifications = await db.getUserNotificationsAsync(userId || 'anon');
    res.json({
      success: true,
      notifications,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/notifications/respond', requireUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, notificationId, action } = req.body;
    if (!userId || !notificationId || !action) {
      res.status(400).json({ error: 'userId, notificationId ve action zorunludur.' });
      return;
    }
    const result = await db.respondToNotification(userId, notificationId, action);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Real-Time Presence API ---
router.get('/presence', (req: Request, res: Response): void => {
  res.json({
    success: true,
    presences: presenceManager.getAllPresences(),
  });
});

router.post('/presence/heartbeat', requireUser, (req: Request, res: Response): void => {
  try {
    const { userId, inRoom, roomCode } = req.body;
    if (userId) {
      presenceManager.touchUser(userId);
      if (inRoom !== undefined) {
        presenceManager.setUserRoom(userId, roomCode || null);
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Room Status Sync ---
router.post('/rooms/active', requireUser, (req: Request, res: Response): void => {
  try {
    const {
      userId,
      roomCode,
      name,
      hostName,
      category,
      categoryName,
      players,
      playerCount,
      maxPlayers,
      totalRounds,
      questionTimeSec,
      status,
      privacy,
    } = req.body;
    const resolvedPlayers = typeof players === 'number' ? players : typeof playerCount === 'number' ? playerCount : undefined;
    if (userId) {
      db.setUserActiveRoom(
        userId,
        roomCode || null,
        roomCode
          ? {
              name,
              hostName,
              category,
              categoryName,
              players: resolvedPlayers,
              maxPlayers,
              totalRounds,
              questionTimeSec,
              status,
              privacy,
            }
          : undefined
      );
    } else if (roomCode) {
      db.upsertPublicRoom({
        code: roomCode,
        name,
        hostName,
        category,
        categoryName,
        players: resolvedPlayers,
        maxPlayers,
        totalRounds,
        questionTimeSec,
        status,
        privacy,
      });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Shop Catalog & Purchasing ---
router.get('/shop/catalog', (req: Request, res: Response): void => {
  res.json({
    success: true,
    catalog: SHOP_CATALOG,
  });
});

router.post('/shop/purchase', requireUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, productId, packId, paymentMethod = 'coins' } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'userId gerekli' });
      return;
    }

    const itemToBuy = productId || packId;
    if (itemToBuy && SHOP_CATALOG.some((p) => p.id === itemToBuy)) {
      const result = await db.purchaseShopProduct(userId, itemToBuy, paymentMethod);
      res.json({ success: true, user: result.user, message: result.message });
      return;
    }

    // Fallback legacy pack support
    let resolvedPack: { coinsDelta?: number; gemsDelta?: number; itemId?: string; itemQty?: number };
    let message = 'Satın alma işlemi veritabanına kaydedildi!';
    if (packId === 'starter_pack') {
      resolvedPack = { coinsDelta: 1000, gemsDelta: 50, itemId: 'chest_wood', itemQty: 1 };
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
      resolvedPack = { coinsDelta: -400, gemsDelta: 0, itemId: 'chest_silver', itemQty: 2 };
      message = '2x Sandık envanterine eklendi!';
    } else {
      res.status(400).json({ error: 'Geçersiz mağaza ürünü.' });
      return;
    }

    const updated = await db.purchaseShopPack(userId, resolvedPack);
    res.json({ success: true, user: updated, message });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Inventory & Chest Opening ---
router.post('/inventory/use', requireUser, async (req: Request, res: Response): Promise<void> => {
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

router.post('/inventory/open-chest', requireUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, chestId, keyId } = req.body;
    if (!userId || !chestId) {
      res.status(400).json({ error: 'userId ve chestId gereklidir.' });
      return;
    }
    const result = await db.openChest(userId, chestId, keyId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Season 1 Pass & Tiers ---
router.get('/season/info', (req: Request, res: Response): void => {
  res.json({
    seasonNumber: 1,
    seasonName: 'Sezon 1: Bilgi Çağı',
    totalTiers: 50,
    endsInDays: 45,
    tiers: SEASON_1_TIERS,
  });
});

router.post('/season/claim', requireUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, tier, track = 'free' } = req.body;
    if (!userId || !tier) {
      res.status(400).json({ error: 'userId ve tier gereklidir' });
      return;
    }
    const result = await db.claimSeasonTier(userId, Number(tier), track);
    res.json({ success: true, user: result.user, reward: result.reward });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/season/premium-pass', requireUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'userId gereklidir' });
      return;
    }
    const updated = await db.buyPremiumPass(userId);
    res.json({
      success: true,
      user: updated,
      message: '🎉 Tebrikler! Sezon 1 Premium Pass aktif edildi!',
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Live Events ---
router.get('/events', (req: Request, res: Response): void => {
  try {
    const userId = (req.query.userId as string) || '';
    const result = db.getUserEvents(userId);
    res.json({
      success: true,
      events: result.events,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/events/claim', requireUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, eventId } = req.body;
    if (!userId || !eventId) {
      res.status(400).json({ error: 'userId ve eventId gereklidir' });
      return;
    }
    const result = await db.claimEventReward(userId, eventId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/events/start', (req: Request, res: Response): void => {
  try {
    const { userId, eventId } = req.body;
    if (!userId || !eventId) {
      res.status(400).json({ error: 'userId ve eventId gereklidir' });
      return;
    }
    const result = db.startEvent(userId, eventId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
*/

// --- Public User Profile (allowlisted fields only) ---
router.get('/profile/:userId', async (req: Request, res: Response): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

  // Email addresses must never be accepted as public profile lookup identifiers.
  if (!userId || userId.includes('@')) {
    res.status(404).json({ error: 'Profil bulunamadı' });
    return;
  }

  const profile = await db.getUserProfileAsync(userId);
  if (!profile) {
    res.status(404).json({ error: 'Profil bulunamadı' });
    return;
  }

  // Do not serialize the complete UserProfile here: it contains private contact,
  // account, inventory, notification, settings and progression data.
  res.json({
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    level: profile.level,
    rankTitle: profile.rankTitle,
    rankPoints: profile.rankPoints,
    equippedFrame: profile.equippedFrame,
    equippedBadge: profile.equippedBadge,
    equippedNameEffect: profile.equippedNameEffect,
    equippedBackground: profile.equippedBackground,
    stats: {
      totalMatches: profile.stats?.totalMatches ?? 0,
      wins: profile.stats?.wins ?? 0,
      correctAnswers: profile.stats?.correctAnswers ?? 0,
      totalAnswers: profile.stats?.totalAnswers ?? 0,
      bestStreak: profile.stats?.bestStreak ?? 0,
    },
  });
});

router.post('/daily-challenge/complete', requireUser, async (_req: Request, res: Response): Promise<void> => {
  res.status(410).json({ error: 'Günlük görev ödülleri, sunucu tarafından doğrulanmış cevap oturumu tamamlanana kadar devre dışıdır.' });
});


export default router;
