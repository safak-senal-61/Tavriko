"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playBillingPlayerRoutes = void 0;
exports.handlePlayVoidedCron = handlePlayVoidedCron;
const express_1 = require("express");
const express_rate_limit_1 = require("express-rate-limit");
const prismaClient_1 = require("../db/prismaClient");
const auth_1 = require("../middleware/auth");
const walletRateLimit_1 = require("../middleware/walletRateLimit");
const googlePlayBilling_1 = require("../services/googlePlayBilling");
const availabilityLimit = (0, express_rate_limit_1.rateLimit)({ ...walletRateLimit_1.walletRateLimitOptions, limit: 120 });
const verifyLimit = (0, express_rate_limit_1.rateLimit)({ ...walletRateLimit_1.walletRateLimitOptions, limit: 40 });
exports.playBillingPlayerRoutes = (0, express_1.Router)();
/** Android uygulaması Play satın alma düğmelerini yalnızca bu uç `enabled: true` derse gösterir. */
exports.playBillingPlayerRoutes.post('/shop/play/availability', availabilityLimit, async (_req, res) => {
    const config = (0, googlePlayBilling_1.playBillingConfig)();
    const enabled = Boolean(config && await (0, googlePlayBilling_1.playSchemaReady)(prismaClient_1.db.rawClient));
    res.set('Cache-Control', 'no-store').json({
        enabled, products: enabled ? [...config.products.keys()] : [],
    });
});
/** Satın alma başlatmadan önce Play'e verilecek hesap kimliği (kullanıcı kimliğinin özeti). */
exports.playBillingPlayerRoutes.get('/shop/play/account', availabilityLimit, auth_1.requireUserAuth, (req, res) => {
    const userId = req.authUserId;
    if (!userId || /^(guest[_:]|bot_)/i.test(userId)) {
        res.status(401).json({ error: 'Satın alma için giriş yap.' });
        return;
    }
    res.set('Cache-Control', 'no-store').json({ accountId: (0, googlePlayBilling_1.playAccountId)(userId) });
});
exports.playBillingPlayerRoutes.post('/shop/play/verify', verifyLimit, auth_1.requireUserAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const config = (0, googlePlayBilling_1.playBillingConfig)();
    if (!config || !await (0, googlePlayBilling_1.playSchemaReady)(prismaClient_1.db.rawClient)) {
        res.status(503).json({ error: 'Google Play satın alması şu anda açık değil.' });
        return;
    }
    const userId = req.authUserId;
    const { productId, purchaseToken } = req.body ?? {};
    if (!userId || /^(guest[_:]|bot_)/i.test(userId)) {
        res.status(401).json({ error: 'Satın alma için giriş yap.' });
        return;
    }
    if (typeof productId !== 'string' || typeof purchaseToken !== 'string') {
        res.status(400).json({ error: 'Geçersiz satın alma.' });
        return;
    }
    try {
        const result = await (0, googlePlayBilling_1.verifyPlayPurchase)(prismaClient_1.db.rawClient, config, userId, productId, purchaseToken);
        res.status(result.status === 'pending' ? 202 : 200).json(result);
    }
    catch (error) {
        if (error instanceof googlePlayBilling_1.PlayPurchaseRejected) {
            res.status(409).json({ error: error.message });
            return;
        }
        res.status(502).json({ error: 'Satın alma şu anda doğrulanamadı. Tekrar dene.' });
    }
});
/** Vercel cron: Google Play iadelerini (voided purchases) uygular. CRON_SECRET ile korunur. */
async function handlePlayVoidedCron(req, res) {
    const secret = process.env.CRON_SECRET || '';
    const header = (req.headers['authorization'] || '').toString();
    if (!secret || header !== `Bearer ${secret}`) {
        res.status(401).json({ success: false });
        return;
    }
    const config = (0, googlePlayBilling_1.playBillingConfig)();
    if (!config || !await (0, googlePlayBilling_1.playSchemaReady)(prismaClient_1.db.rawClient)) {
        res.json({ success: true, skipped: true });
        return;
    }
    try {
        res.json({ success: true, ...await (0, googlePlayBilling_1.syncVoidedPlayPurchases)(prismaClient_1.db.rawClient, config) });
    }
    catch {
        res.status(502).json({ success: false });
    }
}
