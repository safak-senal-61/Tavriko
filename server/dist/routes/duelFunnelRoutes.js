"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDuelFunnelRouter = createDuelFunnelRouter;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const telegramBot_1 = require("../telegram/telegramBot");
const prismaClient_1 = require("../db/prismaClient");
const playerAccess_1 = require("../services/playerAccess");
const duelFunnel_1 = require("../services/duelFunnel");
const adminAccountOperations_1 = require("../services/adminAccountOperations");
function createDuelFunnelRouter(client = prismaClient_1.db.rawClient) {
    const router = (0, express_1.Router)();
    const path = '/api/player/duel-funnel';
    router.use([path, '/api/internal/duel-funnel/matched'], (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    router.get(path, auth_1.requireUserAuth, async (req, res) => {
        if (!req.authUserId || (0, playerAccess_1.isGuestIdentity)(req.authUserId))
            return res.status(403).end();
        try {
            res.json(await (0, duelFunnel_1.readDuelConsent)(client, req.authUserId));
        }
        catch {
            res.status(503).end();
        }
    });
    router.post(path, auth_1.requireUserAuth, async (req, res) => {
        if (!req.authUserId || (0, playerAccess_1.isGuestIdentity)(req.authUserId))
            return res.status(403).end();
        const event = req.body?.event;
        if (!req.is('application/json') || !['enroll', 'select', 'withdraw'].includes(event))
            return res.status(400).end();
        try {
            await (0, duelFunnel_1.changeDuelConsent)(client, req.authUserId, event);
            if (event === 'select')
                return res.status(204).end();
            res.json(await (0, duelFunnel_1.readDuelConsent)(client, req.authUserId));
        }
        catch {
            res.status(503).end();
        }
    });
    router.post('/api/internal/duel-funnel/matched', async (req, res) => {
        const secret = (0, auth_1.getInternalSecret)(), supplied = req.get('x-internal-secret');
        if (!secret || !supplied || !(0, telegramBot_1.safeEqualStrings)(secret, supplied))
            return res.status(403).end();
        const { room, ids, matchedAt } = req.body || {};
        if (typeof room !== 'string' || !adminAccountOperations_1.uuidPattern.test(room) || !Array.isArray(ids) || !ids.length || ids.length > 2 ||
            ids.some(id => typeof id !== 'string' || !playerAccess_1.validPlayerId.test(id)) || !Number.isSafeInteger(matchedAt) || Math.abs(matchedAt - Date.now()) > 300_000) {
            return res.status(400).end();
        }
        if (!(0, duelFunnel_1.duelCoverageStart)())
            return res.status(204).end();
        try {
            await client.$transaction(tx => (0, duelFunnel_1.recordDuelMilestone)(tx, 'matched', room, ids, new Date(matchedAt)));
            res.status(204).end();
        }
        catch {
            res.status(503).end();
        }
    });
    return router;
}
