"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameplayRewardRoutes = void 0;
const express_1 = require("express");
const prismaClient_1 = require("../db/prismaClient");
const auth_1 = require("../middleware/auth");
const gameplayRewards_1 = require("../services/gameplayRewards");
exports.gameplayRewardRoutes = (0, express_1.Router)();
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
exports.gameplayRewardRoutes.get('/', auth_1.requireUserAuth, async (req, res) => {
    try {
        res.json({ rewards: await (0, gameplayRewards_1.getGameplayRewardProgress)(prismaClient_1.db.rawClient, req.authUserId) });
    }
    catch (error) {
        sendError(res, error);
    }
});
exports.gameplayRewardRoutes.post('/claim', auth_1.requireUserAuth, async (req, res) => {
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
