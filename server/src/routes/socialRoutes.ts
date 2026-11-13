import { Router, Request, Response } from 'express';
import { requireUserAuth } from '../middleware/auth';
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

router.get('/friends/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const data = await db.getFriendsForUserAsync(userId || 'anon');
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/friends/add', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    const { codeOrUsername } = req.body;
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

router.post('/friends/remove', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    const { friendId, targetUserId } = req.body;
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
router.post('/friends/challenge', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    const { targetUserId, category } = req.body;
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
// SECURITY: notifications are private; the identity comes from the verified token.
router.get('/notifications/:userId', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    const notifications = await db.getUserNotificationsAsync(userId || 'anon');
    res.json({
      success: true,
      notifications,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/notifications/respond', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    const { notificationId, action } = req.body;
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

router.post('/presence/heartbeat', (req: Request, res: Response): void => {
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
router.post('/rooms/active', requireUserAuth, (req: Request, res: Response): void => {
  try {
    const {
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
    const userId = req.authUserId;
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

router.post('/shop/purchase', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    const { productId, packId, paymentMethod = 'coins', durationId } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'userId gerekli' });
      return;
    }

    const itemToBuy = productId || packId;
    if (itemToBuy && SHOP_CATALOG.some((p) => p.id === itemToBuy)) {
      // Süreli kozmetiklerde durationId ('1h' | '1d' | '3d' | '1w' | '30d')
      // seçilen süreyi belirler; fiyat sunucuda ölçeklenir.
      const result = await db.purchaseShopProduct(
        userId,
        itemToBuy,
        paymentMethod,
        typeof durationId === 'string' ? durationId : undefined
      );
      res.json({ success: true, user: result.user, message: result.message });
      return;
    }

    // Fallback legacy pack support
    let resolvedPack = req.body;
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
    }

    const updated = await db.purchaseShopPack(userId, resolvedPack);
    res.json({ success: true, user: updated, message });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Inventory & Chest Opening ---
router.post('/inventory/use', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    const { itemId } = req.body;
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

router.post('/inventory/open-chest', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    const { chestId, keyId } = req.body;
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

router.post('/season/claim', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    const { tier, track = 'free' } = req.body;
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

router.post('/season/premium-pass', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
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
router.get('/events', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.query.userId as string) || '';
    const result = await db.getUserEvents(userId);
    res.json({
      success: true,
      events: result.events,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/events/claim', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    const { eventId } = req.body;
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

router.post('/events/start', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    const { eventId } = req.body;
    if (!userId || !eventId) {
      res.status(400).json({ error: 'userId ve eventId gereklidir' });
      return;
    }
    const result = await db.startEvent(userId, eventId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- User Profile (Pro League & Inspect) ---
router.get('/profile/:userId', async (req: Request, res: Response): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const profile = await db.getUserProfileAsync(userId);
  if (!profile) {
    res.status(404).json({ error: 'Profil bulunamadı' });
    return;
  }

  // Ayarlar > Gizlilik > "Herkese Açık Profil" kapalıysa yalnızca temel kimlik bilgileri görünür.
  // Sahibi ve arkadaşları tam profili görmeye devam eder.
  if ((profile.settings as any)?.profilePublic === false) {
    let viewerId: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const payload = db.verifyToken(authHeader.split(' ')[1]);
      if (payload) viewerId = payload.userId;
    }
    const isOwner = !!viewerId && viewerId === profile.id;
    const isFriend = !!viewerId && (profile.friendIds || []).includes(viewerId);
    if (!isOwner && !isFriend) {
      res.json({
        id: profile.id,
        displayName: profile.displayName,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
        level: profile.level,
        rankTitle: profile.rankTitle,
        isPrivate: true,
      });
      return;
    }
  }
  res.json(profile);
});

// --- Block / Unblock (kullanıcı engelleme sistemi) ---
router.post('/block', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    const { targetUserId } = req.body;
    if (!userId || !targetUserId) {
      res.status(400).json({ error: 'userId ve targetUserId zorunludur.' });
      return;
    }
    if (userId === targetUserId) {
      res.status(400).json({ error: 'Kendinizi engelleyemezsiniz.' });
      return;
    }
    const result = await db.blockUser(userId, targetUserId);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/unblock', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    const { targetUserId } = req.body;
    if (!userId || !targetUserId) {
      res.status(400).json({ error: 'userId ve targetUserId zorunludur.' });
      return;
    }
    const result = await db.unblockUser(userId, targetUserId);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/blocked/:userId', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    const blocked = await db.getBlockedUsers(userId || 'anon');
    res.json({ success: true, blockedUsers: blocked });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Admin: bildirim gönder (developer paneli) ---
router.post('/notifications/send', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    const { targetUserId, title, sub, type = 'system' } = req.body;
    if (!userId || !targetUserId || !title) {
      res.status(400).json({ error: 'userId, targetUserId ve title zorunludur.' });
      return;
    }
    const result = await db.sendCustomNotification(userId, targetUserId, {
      title,
      sub: sub || '',
      type,
    });
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Public profile by friend code (profile share links) ---
router.get('/users/by-code/:friendCode', async (req: Request, res: Response): Promise<void> => {
  try {
    const friendCode = Array.isArray(req.params.friendCode) ? req.params.friendCode[0] : req.params.friendCode;
    const profile = await db.getUserProfileByFriendCodeAsync(friendCode || '');
    if (!profile) {
      res.status(404).json({ error: 'Bu arkadaşlık koduna ait profil bulunamadı.' });
      return;
    }
    // Sadece herkese açık alanlar
    res.json({
      id: profile.id,
      displayName: profile.displayName,
      username: profile.username,
      avatarUrl: profile.avatarUrl,
      friendCode: profile.friendCode,
      xp: profile.xp,
      stats: profile.stats,
      settings: { equippedTitle: (profile as any).settings?.equippedTitle },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/daily-challenge/complete', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    const { correctAnswers, totalQuestions } = req.body;
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
