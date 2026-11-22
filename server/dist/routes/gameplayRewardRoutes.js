"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameplayRewardRoutes = void 0;
const node_net_1 = require("node:net");
const express_1 = require("express");
const express_rate_limit_1 = require("express-rate-limit");
const prismaClient_1 = require("../db/prismaClient");
const auth_1 = require("../middleware/auth");
const gameplayRewards_1 = require("../services/gameplayRewards");
exports.gameplayRewardRoutes = (0, express_1.Router)();
const limitOptions = {
    windowMs: 60_000,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Çok fazla istek. Lütfen biraz sonra tekrar dene.' },
    keyGenerator: (req) => {
        const forwarded = process.env.VERCEL === '1' ? req.get('x-forwarded-for')?.trim() : undefined;
        const ip = forwarded && (0, node_net_1.isIP)(forwarded) ? forwarded : req.ip || req.socket.remoteAddress;
        return ip && (0, node_net_1.isIP)(ip) ? (0, express_rate_limit_1.ipKeyGenerator)(ip) : 'unknown';
    },
};
const progressRateLimit = (0, express_rate_limit_1.rateLimit)({ ...limitOptions, limit: 120 });
const claimRateLimit = (0, express_rate_limit_1.rateLimit)({ ...limitOptions, limit: 20 });
exports.gameplayRewardRoutes.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});
function sendError(res, error) {
    if (error instanceof gameplayRewards_1.GameplayRewardError) {
        res.status(error.status).json({ error: error.message });
    }
    else {
        console.error('[gameplayRewards] Storage unavailable:', error instanceof Error ? error.name : 'Unknown');
        res.status(503).json({ error: 'Ödüller şu anda yüklenemiyor. Tekrar deneyebilirsin.' });
    }
}
exports.gameplayRewardRoutes.get('/', progressRateLimit, auth_1.requireUserAuth, async (req, res) => {
    try {
        res.json({ rewards: await (0, gameplayRewards_1.getGameplayRewardProgress)(prismaClient_1.db.rawClient, req.authUserId) });
    }
    catch (error) {
        sendError(res, error);
    }
});
exports.gameplayRewardRoutes.post('/claim', claimRateLimit, auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        const result = await (0, gameplayRewards_1.claimGameplayReward)(prismaClient_1.db.rawClient, userId, req.body?.rewardId);
        const user = await prismaClient_1.db.getUserProfileAsync(userId);
        res.json({ ...result, user });
    }
    catch (error) {
        sendError(res, error);
    }
});
