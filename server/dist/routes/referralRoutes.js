"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prismaClient_1 = require("../db/prismaClient");
const referralService_1 = require("../services/referralService");
const presenceManager_1 = require("../services/presenceManager");
const router = (0, express_1.Router)();
const service = new referralService_1.ReferralService(prismaClient_1.db.rawClient);
const signedIn = (req, res, next) => {
    const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    const session = bearer ? prismaClient_1.db.verifyToken(bearer) : null;
    if (!session?.userId || session.userId.startsWith('guest_')) {
        res.status(401).json({ error: 'Davet için hesabına giriş yap.' });
        return;
    }
    res.locals.userId = session.userId;
    next();
};
const fail = (res, error) => {
    if (!(error instanceof referralService_1.ReferralError))
        console.error('[Referral] Database operation failed');
    res.status(error instanceof referralService_1.ReferralError ? error.status : 503).json({
        error: error instanceof referralService_1.ReferralError ? error.message : 'Davet servisine ulaşılamadı. Tekrar dene.',
    });
};
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
router.get('/me', signedIn, async (_req, res) => {
    try {
        res.json(await service.personalLink(res.locals.userId));
    }
    catch (e) {
        fail(res, e);
    }
});
router.get('/preview/:token', async (req, res) => {
    try {
        res.json(await service.preview(String(req.params.token)));
    }
    catch (e) {
        fail(res, e);
    }
});
router.post('/confirm', signedIn, async (req, res) => {
    try {
        const result = await service.confirm(res.locals.userId, req.body.token);
        // Refresh legacy in-process caches only AFTER the transaction commits.
        await Promise.allSettled([
            prismaClient_1.db.getUserProfileAsync(res.locals.userId), prismaClient_1.db.getUserProfileAsync(result.inviterId),
        ]);
        presenceManager_1.presenceManager.notifyUser(result.inviterId, 'friends:update', { friendId: res.locals.userId });
        presenceManager_1.presenceManager.notifyUser(res.locals.userId, 'friends:update', { friendId: result.inviterId });
        if (result.notification)
            presenceManager_1.presenceManager.notifyUser(result.inviterId, 'notification:new', result.notification);
        const { notification, ...safeResult } = result;
        res.json(safeResult);
    }
    catch (e) {
        fail(res, e);
    }
});
exports.default = router;
