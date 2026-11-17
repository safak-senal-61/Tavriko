"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Expo Push kayıt uçları (istemci mobil uygulama tarafından kullanılır).
 *
 *  POST /api/push/register   — cihaz token'ını oturum sahibi kullanıcıya bağlar
 *  POST /api/push/unregister — token'ı kaldırır (çıkış / bildirim kapatma)
 *  GET  /api/push/status     — kullanıcının kayıtlı cihaz sayısı
 *  POST /api/push/test       — kendine test push'u gönderir
 *
 * Kimlik her zaman doğrulanmış JWT'den gelir (requireUserAuth); token'lar
 * istemciye asla geri döndürülmez.
 */
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prismaClient_1 = require("../db/prismaClient");
const pushService_1 = require("../services/pushService");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
const MAX_TOKEN_LENGTH = 512;
router.post('/register', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const { token, platform } = req.body || {};
        if (!userId || typeof token !== 'string' || !token.trim() || token.length > MAX_TOKEN_LENGTH) {
            res.status(400).json({ error: 'Geçerli bir push token gereklidir.' });
            return;
        }
        const normalizedPlatform = platform === 'ios' || platform === 'android' || platform === 'web' ? platform : null;
        await prismaClient_1.db.savePushTokenAsync(userId, token.trim(), normalizedPlatform || undefined);
        res.json({ success: true });
    }
    catch (err) {
        logger_1.logger.error('SYSTEM', `Push token kaydı hatası: ${err?.message || err}`);
        res.status(500).json({ error: err.message });
    }
});
router.post('/unregister', auth_1.requireUserAuth, async (req, res) => {
    try {
        const { token } = req.body || {};
        if (typeof token !== 'string' || !token.trim()) {
            res.status(400).json({ error: 'Geçerli bir push token gereklidir.' });
            return;
        }
        await prismaClient_1.db.removePushTokenAsync(token.trim());
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/status', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        if (!userId) {
            res.status(400).json({ error: 'Oturum gerekli.' });
            return;
        }
        const tokens = await prismaClient_1.db.getPushTokensAsync(userId);
        res.json({ registered: tokens.length > 0, deviceCount: tokens.length });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/test', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        if (!userId) {
            res.status(400).json({ error: 'Oturum gerekli.' });
            return;
        }
        const result = await (0, pushService_1.sendPushToUser)(userId, {
            title: 'Tavriko test bildirimi',
            body: 'Push bildirimleri bu cihazda çalışıyor.',
            data: { type: 'system', test: true },
        });
        if (result.sent === 0) {
            res.status(400).json({ success: false, error: 'Kayıtlı push cihazı bulunamadı veya gönderim başarısız.' });
            return;
        }
        res.json({ success: true, sent: result.sent });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
