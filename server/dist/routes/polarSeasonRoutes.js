"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.polarSeasonWebhook = exports.polarSeasonPlayerRoutes = void 0;
const express_1 = __importStar(require("express"));
const express_rate_limit_1 = require("express-rate-limit");
const prismaClient_1 = require("../db/prismaClient");
const auth_1 = require("../middleware/auth");
const walletRateLimit_1 = require("../middleware/walletRateLimit");
const polarGemPayments_1 = require("../services/polarGemPayments");
const polarClient_1 = require("../services/polarClient");
const polarSandbox_1 = require("../services/polarSandbox");
const polarSeasonPayments_1 = require("../services/polarSeasonPayments");
const available = (0, express_rate_limit_1.rateLimit)({ ...walletRateLimit_1.walletRateLimitOptions, limit: 120 });
const start = (0, express_rate_limit_1.rateLimit)({ ...walletRateLimit_1.walletRateLimitOptions, limit: 12 });
const webhookLimit = (0, express_rate_limit_1.rateLimit)({ ...walletRateLimit_1.walletRateLimitOptions, limit: 600 });
const seasonSchemaReady = () => prismaClient_1.db.rawClient.$queryRaw `
  SELECT pg_catalog.to_regclass('public.polar_season_orders') IS NOT NULL AS ready
`.then(rows => rows[0]?.ready === true, () => false);
exports.polarSeasonPlayerRoutes = (0, express_1.Router)();
exports.polarSeasonPlayerRoutes.post('/season/checkout/availability', available, async (req, res) => {
    const config = (0, polarSeasonPayments_1.polarSeasonConfig)();
    const enabled = !!config && (0, polarClient_1.clientOriginAllowed)(req.get('origin'), config.origin) && await seasonSchemaReady();
    res.set('Cache-Control', 'no-store').json({
        enabled, sandbox: enabled && config.sandbox, amount: enabled ? config.amount : undefined,
    });
});
exports.polarSeasonPlayerRoutes.post('/season/checkout', start, auth_1.requireUserAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const config = (0, polarSeasonPayments_1.polarSeasonConfig)();
    if (!config || !(0, polarClient_1.clientOriginAllowed)(req.get('origin'), config.origin) || !await seasonSchemaReady()) {
        res.status(503).json({ error: 'Premium Pass ödemesi şu anda açık değil.' });
        return;
    }
    const userId = req.authUserId;
    if (!userId || /^(guest[_:]|bot_)/i.test(userId)) {
        res.status(401).json({ error: 'Premium Pass almak için giriş yap.' });
        return;
    }
    try {
        res.json({ url: await (0, polarSeasonPayments_1.startSeasonCheckout)(prismaClient_1.db.rawClient, config, userId, fetch, (0, polarClient_1.clientIpAddress)(req)) });
    }
    catch (error) {
        const conflict = error instanceof polarSeasonPayments_1.SeasonCheckoutConflict;
        res.status(conflict ? 409 : 502).json({ error: conflict ? error.message : 'Polar ödeme sayfası açılamadı. Tekrar dene.' });
    }
});
exports.polarSeasonPlayerRoutes.get('/season/checkout/:id', available, auth_1.requireUserAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const id = req.params.id;
    if (!req.authUserId || typeof id !== 'string' || !polarSandbox_1.checkoutIdPattern.test(id)) {
        res.sendStatus(404);
        return;
    }
    try {
        const row = await prismaClient_1.db.rawClient.polarSeasonOrder.findFirst({
            where: { checkoutId: id, userId: req.authUserId }, select: { status: true },
        });
        if (!row) {
            res.sendStatus(404);
            return;
        }
        res.json(row);
    }
    catch {
        res.sendStatus(503);
    }
});
exports.polarSeasonWebhook = (0, express_1.Router)();
exports.polarSeasonWebhook.post('/', webhookLimit, express_1.default.raw({ type: 'application/json', limit: '128kb' }), async (req, res) => {
    // Keep settling completed orders and refunds when new sales are paused.
    const secret = process.env.POLAR_SEASON_WEBHOOK_SECRET?.trim();
    const sandbox = process.env.POLAR_SEASON_SANDBOX === 'true';
    if (!secret || (sandbox && process.env.VERCEL_ENV === 'production')) {
        res.sendStatus(503);
        return;
    }
    if (!Buffer.isBuffer(req.body) || !(0, polarGemPayments_1.verifyPolarGemSignature)(req.body, name => req.get(name), secret)) {
        res.sendStatus(401);
        return;
    }
    let event;
    try {
        event = JSON.parse(req.body.toString('utf8'));
    }
    catch {
        res.sendStatus(400);
        return;
    }
    try {
        await (0, polarSeasonPayments_1.applySeasonOrder)(prismaClient_1.db.rawClient, event, sandbox);
        res.sendStatus(204);
    }
    catch {
        res.sendStatus(503);
    }
});
