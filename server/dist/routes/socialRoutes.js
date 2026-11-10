"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prismaClient_1 = require("../db/prismaClient");
const presenceManager_1 = require("../services/presenceManager");
const shared_1 = require("@trivia/shared");
const router = (0, express_1.Router)();
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
        const { codeOrUsername } = req.body;
        if (!userId || !codeOrUsername) {
            res.status(400).json({ error: 'userId ve codeOrUsername gereklidir.' });
            return;
        }
        const result = await prismaClient_1.db.addFriend(userId, codeOrUsername);
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
        if (!userId || !notificationId || !action) {
            res.status(400).json({ error: 'userId, notificationId ve action zorunludur.' });
            return;
        }
        const result = await prismaClient_1.db.respondToNotification(userId, notificationId, action);
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
router.get('/shop/catalog', (req, res) => {
    res.json({
        success: true,
        catalog: shared_1.SHOP_CATALOG,
    });
});
router.post('/shop/purchase', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const { productId, packId, paymentMethod = 'coins' } = req.body;
        if (!userId) {
            res.status(400).json({ error: 'userId gerekli' });
            return;
        }
        const itemToBuy = productId || packId;
        if (itemToBuy && shared_1.SHOP_CATALOG.some((p) => p.id === itemToBuy)) {
            const result = await prismaClient_1.db.purchaseShopProduct(userId, itemToBuy, paymentMethod);
            res.json({ success: true, user: result.user, message: result.message });
            return;
        }
        // Fallback legacy pack support
        let resolvedPack = req.body;
        let message = 'Satın alma işlemi veritabanına kaydedildi!';
        if (packId === 'starter_pack') {
            resolvedPack = { coinsDelta: 1000, gemsDelta: 50, itemId: 'chest_wood', itemQty: 1 };
            message = 'Başlangıç Paketi (+1.000 Altın, +50 Elmas, +1 Sandık) hesabına eklendi!';
        }
        else if (packId === 'gems_100') {
            resolvedPack = { gemsDelta: 100, coinsDelta: 0, itemId: undefined, itemQty: 0 };
            message = '+100 Elmas hesabına başarıyla eklendi!';
        }
        else if (packId === 'gems_500') {
            resolvedPack = { gemsDelta: 550, coinsDelta: 0, itemId: undefined, itemQty: 0 };
            message = 'Ödeme Onaylandı! +550 Elmas (50 Bonus) hesabına eklendi!';
        }
        else if (packId === 'coins_2000') {
            resolvedPack = { coinsDelta: 2000, gemsDelta: -10, itemId: undefined, itemQty: 0 };
            message = '+2.000 Altın hesabına eklendi!';
        }
        else if (packId === 'mega_chest') {
            resolvedPack = { coinsDelta: -400, gemsDelta: 0, itemId: 'chest_silver', itemQty: 2 };
            message = '2x Sandık envanterine eklendi!';
        }
        const updated = await prismaClient_1.db.purchaseShopPack(userId, resolvedPack);
        res.json({ success: true, user: updated, message });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// --- Inventory & Chest Opening ---
router.post('/inventory/use', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const { itemId } = req.body;
        if (!userId || !itemId) {
            res.status(400).json({ error: 'userId ve itemId gerekli' });
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
        const { chestId, keyId } = req.body;
        if (!userId || !chestId) {
            res.status(400).json({ error: 'userId ve chestId gereklidir.' });
            return;
        }
        const result = await prismaClient_1.db.openChest(userId, chestId, keyId);
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
router.post('/season/premium-pass', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        if (!userId) {
            res.status(400).json({ error: 'userId gereklidir' });
            return;
        }
        const updated = await prismaClient_1.db.buyPremiumPass(userId);
        res.json({
            success: true,
            user: updated,
            message: '🎉 Tebrikler! Sezon 1 Premium Pass aktif edildi!',
        });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// --- Live Events ---
router.get('/events', (req, res) => {
    try {
        const userId = req.query.userId || '';
        const result = prismaClient_1.db.getUserEvents(userId);
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
router.post('/events/start', auth_1.requireUserAuth, (req, res) => {
    try {
        const userId = req.authUserId;
        const { eventId } = req.body;
        if (!userId || !eventId) {
            res.status(400).json({ error: 'userId ve eventId gereklidir' });
            return;
        }
        const result = prismaClient_1.db.startEvent(userId, eventId);
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
exports.default = router;
