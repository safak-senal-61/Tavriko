"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = require("express-rate-limit");
const auth_1 = require("../middleware/auth");
const prismaClient_1 = require("../db/prismaClient");
const presenceManager_1 = require("../services/presenceManager");
const shared_1 = require("@trivia/shared");
const rewardedAdRoutes_1 = require("./rewardedAdRoutes");
const gameplayRewardRoutes_1 = require("./gameplayRewardRoutes");
const walletSchema_1 = require("../services/walletSchema");
const realtimeJokerAvailability_1 = require("../services/realtimeJokerAvailability");
const walletRateLimit_1 = require("../middleware/walletRateLimit");
const router = (0, express_1.Router)();
const shopAvailabilityLimit = (0, express_rate_limit_1.rateLimit)({ ...walletRateLimit_1.walletRateLimitOptions, limit: 120 });
const shopPurchaseLimit = (0, express_rate_limit_1.rateLimit)({ ...walletRateLimit_1.walletRateLimitOptions, limit: 40 });
router.get('/leaderboard', async (req, res) => {
    try {
        const topPlayers = await prismaClient_1.db.getLeaderboardAsync(30);
        res.json({
            season: 'Sezon 1: Bilgi Çağı',
            endsInDays: 45,
            topPlayers,
            leaders: topPlayers,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/friends/:userId', async (req, res) => {
    try {
        const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
        const data = await prismaClient_1.db.getFriendsForUserAsync(userId || 'anon');
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/friends/add', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const codeOrUsername = typeof req.body?.codeOrUsername === 'string'
            ? req.body.codeOrUsername.trim().replace(/^@/, '').trim()
            : '';
        if (!userId || !codeOrUsername || codeOrUsername.length > 120) {
            res.status(400).json({ error: 'Geçerli bir arkadaşlık kodu veya kullanıcı adı girin.' });
            return;
        }
        const result = await prismaClient_1.db.addFriend(userId, codeOrUsername);
        if (!result.success) {
            res.status(result.code === 'SESSION_REQUIRED' ? 401 : result.code === 'UNAVAILABLE' ? 503 : 400)
                .json({ error: result.error, code: result.code });
            return;
        }
        res.json(result);
    }
    catch {
        res.status(503).json({ error: 'Arkadaşlık isteği şu anda gönderilemedi. Lütfen tekrar deneyin.' });
    }
});
router.post('/friends/remove', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const { friendId, targetUserId } = req.body;
        const target = friendId || targetUserId;
        if (!userId || !target) {
            res.status(400).json({ error: 'userId ve friendId zorunludur.' });
            return;
        }
        const result = await prismaClient_1.db.removeFriend(userId, target);
        if (!result.success) {
            res.status(400).json({ error: result.error });
            return;
        }
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// --- 1v1 Match Challenge (Yarış İsteği) ---
router.post('/friends/challenge', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const { targetUserId, category } = req.body;
        if (!userId || !targetUserId) {
            res.status(400).json({ error: 'userId ve targetUserId zorunludur.' });
            return;
        }
        const result = await prismaClient_1.db.sendDuelChallenge(userId, targetUserId, category);
        if (!result.success) {
            res.status(400).json({ error: result.error });
            return;
        }
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// --- Özel Oda Daveti (oyun içi arkadaş çağırma) ---
router.post('/rooms/invite', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const { targetUserId, roomCode, roomName } = req.body;
        if (!userId || !targetUserId || !roomCode) {
            res.status(400).json({ error: 'targetUserId ve roomCode zorunludur.' });
            return;
        }
        const result = await prismaClient_1.db.sendRoomInvite(userId, targetUserId, roomCode, roomName);
        if (!result.success) {
            res.status(400).json({ error: result.error });
            return;
        }
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// --- Real Notifications API ---
// SECURITY: notifications are private; the identity comes from the verified token.
router.get('/notifications/:userId', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const notifications = await prismaClient_1.db.getUserNotificationsAsync(userId || 'anon');
        res.json({
            success: true,
            notifications,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/notifications/respond', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const { notificationId, action } = req.body;
        if (!userId || typeof notificationId !== 'string' || !notificationId || (action !== 'accept' && action !== 'decline')) {
            res.status(400).json({ error: 'Bildirim ve geçerli bir işlem seçilmelidir.' });
            return;
        }
        const result = await prismaClient_1.db.respondToNotification(userId, notificationId, action);
        if (!result.success) {
            res.status(result.code === 'UNAVAILABLE' ? 503 : 400).json({ error: result.error, code: result.code });
            return;
        }
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// --- Real-Time Presence API ---
router.get('/presence', (req, res) => {
    res.json({
        success: true,
        presences: presenceManager_1.presenceManager.getAllPresences(),
    });
});
router.post('/presence/heartbeat', (req, res) => {
    try {
        const { userId, inRoom, roomCode } = req.body;
        if (userId) {
            presenceManager_1.presenceManager.touchUser(userId);
            if (inRoom !== undefined) {
                presenceManager_1.presenceManager.setUserRoom(userId, roomCode || null);
            }
        }
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// --- Room Status Sync ---
router.post('/rooms/active', auth_1.requireUserAuth, (req, res) => {
    try {
        const { roomCode, name, hostName, category, categoryName, players, playerCount, maxPlayers, totalRounds, questionTimeSec, status, privacy, } = req.body;
        const userId = req.authUserId;
        const resolvedPlayers = typeof players === 'number' ? players : typeof playerCount === 'number' ? playerCount : undefined;
        if (userId) {
            prismaClient_1.db.setUserActiveRoom(userId, roomCode || null, roomCode
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
                : undefined);
        }
        else if (roomCode) {
            prismaClient_1.db.upsertPublicRoom({
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// --- Shop Catalog & Purchasing ---
router.get('/shop/catalog', async (req, res) => {
    const advanced = await (0, realtimeJokerAvailability_1.advancedJokersReady)();
    res.json({
        success: true,
        catalog: advanced ? shared_1.SHOP_CATALOG : shared_1.SHOP_CATALOG.filter(({ id }) => !(0, shared_1.isJokerId)(id) || !(0, shared_1.isAdvancedJoker)(id)),
    });
});
router.get('/shop/jokers/availability', shopAvailabilityLimit, async (_req, res) => {
    const [enabled, advanced] = await Promise.all([(0, walletSchema_1.walletSchemaReady)(prismaClient_1.db.rawClient), (0, realtimeJokerAvailability_1.advancedJokersReady)()]);
    res.set('Cache-Control', 'no-store').json({ enabled, advanced: enabled && advanced });
});
router.post('/shop/purchase', shopPurchaseLimit, auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const { productId, packId, durationId } = req.body || {};
        if (!userId) {
            res.status(400).json({ error: 'userId gerekli' });
            return;
        }
        const itemToBuy = productId || packId;
        const product = shared_1.SHOP_CATALOG.find((p) => p.id === itemToBuy);
        if (product?.currency === 'try' || itemToBuy === 'starter_pack' || itemToBuy === 'gems_500') {
            res.status(409).json({ error: 'Gerçek para ile satın alma şu anda kapalı.' });
            return;
        }
        if (product) {
            if (product.category === 'jokers' && !await (0, walletSchema_1.walletSchemaReady)(prismaClient_1.db.rawClient)) {
                res.status(503).json({ error: 'Jokerler henüz kullanıma açık değil.' });
                return;
            }
            if ((0, shared_1.isJokerId)(product.id) && (0, shared_1.isAdvancedJoker)(product.id) && !await (0, realtimeJokerAvailability_1.advancedJokersReady)()) {
                res.status(503).json({ error: 'Bu joker henüz canlı maçlarda kullanıma açık değil.' });
                return;
            }
            // Süreli kozmetiklerde durationId ('1h' | '1d' | '3d' | '1w' | '30d')
            // seçilen süreyi belirler; fiyat sunucuda ölçeklenir.
            const result = await prismaClient_1.db.purchaseShopProduct(userId, itemToBuy, product.currency, typeof durationId === 'string' ? durationId : undefined);
            res.json({ success: true, user: result.user, message: result.message });
            return;
        }
        res.status(400).json({ error: 'Ürün mağazada bulunamadı.' });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// --- Inventory & Chest Opening ---
router.post('/inventory/use', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const { itemId } = req.body || {};
        if (!userId || typeof itemId !== 'string' || !itemId) {
            res.status(400).json({ error: 'Geçerli bir eşya seç.' });
            return;
        }
        const result = await prismaClient_1.db.useInventoryItem(userId, itemId);
        res.json({ success: true, ...result });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/inventory/open-chest', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const { chestId } = req.body || {};
        if (!userId || typeof chestId !== 'string' || !chestId) {
            res.status(400).json({ error: 'Geçerli bir sandık seç.' });
            return;
        }
        const result = await prismaClient_1.db.openChest(userId, chestId);
        res.json({ success: true, ...result });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// --- Season 1 Pass & Tiers ---
router.get('/season/info', (req, res) => {
    res.json({
        seasonNumber: 1,
        seasonName: 'Sezon 1: Bilgi Çağı',
        totalTiers: 50,
        endsInDays: 45,
        tiers: shared_1.SEASON_1_TIERS,
    });
});
router.post('/season/claim', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const { tier, track = 'free' } = req.body;
        if (!userId || !tier) {
            res.status(400).json({ error: 'userId ve tier gereklidir' });
            return;
        }
        const result = await prismaClient_1.db.claimSeasonTier(userId, Number(tier), track);
        res.json({ success: true, user: result.user, reward: result.reward });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/season/premium-pass', (_req, res) => {
    res.status(410).json({ error: 'Premium Pass artık elmasla alınmıyor. Güncel web sürümündeki Sezon ekranını kullan.' });
});
// --- Live Events ---
router.get('/events', async (req, res) => {
    try {
        const userId = req.query.userId || '';
        const result = await prismaClient_1.db.getUserEvents(userId);
        res.json({
            success: true,
            events: result.events,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/events/claim', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const { eventId } = req.body;
        if (!userId || !eventId) {
            res.status(400).json({ error: 'userId ve eventId gereklidir' });
            return;
        }
        const result = await prismaClient_1.db.claimEventReward(userId, eventId);
        res.json({ success: true, ...result });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/events/start', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const { eventId } = req.body;
        if (!userId || !eventId) {
            res.status(400).json({ error: 'userId ve eventId gereklidir' });
            return;
        }
        const result = await prismaClient_1.db.startEvent(userId, eventId);
        res.json({ success: true, ...result });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// --- User Profile (Pro League & Inspect) ---
router.get('/profile/:userId', async (req, res) => {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const profile = await prismaClient_1.db.getUserProfileAsync(userId);
    if (!profile) {
        res.status(404).json({ error: 'Profil bulunamadı' });
        return;
    }
    // Ayarlar > Gizlilik > "Herkese Açık Profil" kapalıysa yalnızca temel kimlik bilgileri görünür.
    // Sahibi ve arkadaşları tam profili görmeye devam eder.
    if (profile.settings?.profilePublic === false) {
        let viewerId;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const payload = prismaClient_1.db.verifyToken(authHeader.split(' ')[1]);
            if (payload)
                viewerId = payload.userId;
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
router.post('/block', auth_1.requireUserAuth, async (req, res) => {
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
        const result = await prismaClient_1.db.blockUser(userId, targetUserId);
        if (!result.success) {
            res.status(400).json({ error: result.error });
            return;
        }
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/unblock', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const { targetUserId } = req.body;
        if (!userId || !targetUserId) {
            res.status(400).json({ error: 'userId ve targetUserId zorunludur.' });
            return;
        }
        const result = await prismaClient_1.db.unblockUser(userId, targetUserId);
        if (!result.success) {
            res.status(400).json({ error: result.error });
            return;
        }
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/blocked/:userId', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const blocked = await prismaClient_1.db.getBlockedUsers(userId || 'anon');
        res.json({ success: true, blockedUsers: blocked });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// --- Admin: bildirim gönder (developer paneli) ---
router.post('/notifications/send', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const { targetUserId, title, sub, type = 'system' } = req.body;
        if (!userId || !targetUserId || !title) {
            res.status(400).json({ error: 'userId, targetUserId ve title zorunludur.' });
            return;
        }
        const result = await prismaClient_1.db.sendCustomNotification(userId, targetUserId, {
            title,
            sub: sub || '',
            type,
        });
        if (!result.success) {
            res.status(400).json({ error: result.error });
            return;
        }
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// --- Toplu kozmetik sorgusu: liderlik, arkadaş, lobi ve quiz ekranlarında çerçeve/isim efekti göstermek için ---
const COSMETICS_BATCH_LIMIT = 60;
router.get('/cosmetics', auth_1.requireUserAuth, async (req, res) => {
    try {
        const raw = typeof req.query.ids === 'string' ? req.query.ids : '';
        const ids = [...new Set(raw.split(',').map(id => id.trim()).filter(id => id && id.length <= 64 && !/^(bot_|guest_)/i.test(id)))]
            .slice(0, COSMETICS_BATCH_LIMIT);
        const entries = await Promise.all(ids.map(async (id) => {
            try {
                const profile = await prismaClient_1.db.getUserProfileAsync(id);
                if (!profile)
                    return null;
                // Yalnızca herkese açık görünüm alanları; süresi dolanlar sunucuda zaten düşürülür.
                return [id, {
                        equippedFrame: profile.equippedFrame,
                        equippedFrameExpiresAt: profile.equippedFrameExpiresAt,
                        equippedNameEffect: profile.equippedNameEffect,
                        equippedNameEffectExpiresAt: profile.equippedNameEffectExpiresAt,
                    }];
            }
            catch {
                return null;
            }
        }));
        res.json({ cosmetics: Object.fromEntries(entries.filter((e) => !!e)) });
    }
    catch {
        res.status(500).json({ error: 'Kozmetikler alınamadı.' });
    }
});
// --- Public profile by friend code (profile share links) ---
router.get('/users/by-code/:friendCode', async (req, res) => {
    try {
        const friendCode = Array.isArray(req.params.friendCode) ? req.params.friendCode[0] : req.params.friendCode;
        const profile = await prismaClient_1.db.getUserProfileByFriendCodeAsync(friendCode || '');
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
            settings: { equippedTitle: profile.settings?.equippedTitle },
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/daily-challenge/complete', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const { correctAnswers, totalQuestions } = req.body;
        if (!userId) {
            res.status(400).json({ error: 'userId gereklidir' });
            return;
        }
        const result = await prismaClient_1.db.recordDailyChallengeCompletion(userId, {
            correctAnswers: Number(correctAnswers) || 0,
            totalQuestions: Number(totalQuestions) || 5,
        });
        if (!result.success) {
            res.status(400).json({ error: result.error, user: result.user });
            return;
        }
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.use('/ads/rewarded', rewardedAdRoutes_1.rewardedAdRoutes);
router.use('/rewards', gameplayRewardRoutes_1.gameplayRewardRoutes);
exports.default = router;
