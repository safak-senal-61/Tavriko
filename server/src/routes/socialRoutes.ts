import { Router, Request, Response } from 'express';
import { requireUser } from '../middleware/security';
import { db } from '../db/prismaClient';
import { presenceManager } from '../services/presenceManager';
import { SHOP_CATALOG, SEASON_1_TIERS, EVENT_DEFINITIONS } from '@trivia/shared';

const router = Router();

router.get('/leaderboard', async (_req: Request, res: Response): Promise<void> => {
  try {
    const profiles = await db.getLeaderboardAsync(30);
    // Leaderboards are public, but full UserProfile objects contain private
    // contact, account, inventory, notification and settings fields.
    const topPlayers = profiles.map((profile) => ({
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      level: profile.level,
      xp: profile.xp,
      rankTitle: profile.rankTitle,
      rankPoints: profile.rankPoints,
      stats: {
        totalMatches: profile.stats?.totalMatches ?? 0,
        wins: profile.stats?.wins ?? 0,
        correctAnswers: profile.stats?.correctAnswers ?? 0,
        totalAnswers: profile.stats?.totalAnswers ?? 0,
        bestStreak: profile.stats?.bestStreak ?? 0,
      },
    }));
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
    if (!userId || typeof notificationId !== 'string' || !notificationId || notificationId.length > 128) {
      res.status(400).json({ error: 'Geçerli bir bildirim kimliği gerekli.' });
      return;
    }
    if (action !== 'accept' && action !== 'decline') {
      res.status(400).json({ error: 'Geçersiz bildirim işlemi.' });
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
router.get('/presence', requireUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const authUserId = (req as any).authUserId as string;
    const friendData = await db.getFriendsForUserAsync(authUserId);
    const friendIds = new Set((friendData?.friends || []).map((friend: any) => friend.id));
    const presences = presenceManager.getAllPresences()
      .filter((presence: any) => friendIds.has(presence.userId))
      .map((presence: any) => ({
        userId: presence.userId,
        username: presence.username,
        displayName: presence.displayName,
        avatarUrl: presence.avatarUrl,
        online: Boolean(presence.online),
        inRoom: Boolean(presence.inRoom),
      }));
    res.json({ success: true, presences });
  } catch {
    res.status(500).json({ error: 'Çevrimiçi durum bilgisi alınamadı.' });
  }
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

    // Legacy packId purchases had no verified payment provider/webhook and
    // granted currency directly. Real-money purchases stay disabled until
    // a provider verifies the transaction server-to-server.
    if (packId || paymentMethod === 'credit_card' || paymentMethod === 'try') {
      res.status(501).json({ error: 'Gerçek para ödemeleri henüz güvenli ödeme sağlayıcısına bağlanmadı.' });
      return;
    }

    const product = SHOP_CATALOG.find((p) => p.id === productId);
    if (!product) {
      res.status(400).json({ error: 'Geçersiz mağaza ürünü.' });
      return;
    }
    if (product.currency === 'try') {
      res.status(501).json({ error: 'Bu ürün için güvenli ödeme sağlayıcısı henüz yapılandırılmadı.' });
      return;
    }
    if (paymentMethod !== product.currency) {
      res.status(400).json({ error: 'Ödeme yöntemi ürün para birimiyle eşleşmiyor.' });
      return;
    }

    const result = await db.purchaseShopProduct(userId, product.id, paymentMethod);
    res.json({ success: true, user: result.user, message: result.message });
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
router.get('/events', requireUser, (req: Request, res: Response): void => {
  try {
    const authUserId = (req as any).authUserId as string;
    const requestedUserId = (req.query.userId as string) || authUserId;
    if (requestedUserId !== authUserId) {
      res.status(403).json({ error: 'Bu kaynağa erişim yetkiniz yok.' });
      return;
    }
    const result = db.getUserEvents(authUserId);
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

router.post('/events/start', requireUser, (req: Request, res: Response): void => {
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
