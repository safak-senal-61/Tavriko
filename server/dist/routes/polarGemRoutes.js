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
exports.polarGemWebhook = exports.polarGemPlayerRoutes = void 0;
const express_1 = __importStar(require("express"));
const express_rate_limit_1 = require("express-rate-limit");
const prismaClient_1 = require("../db/prismaClient");
const auth_1 = require("../middleware/auth");
const polarGemPayments_1 = require("../services/polarGemPayments");
const polarClient_1 = require("../services/polarClient");
const polarSandbox_1 = require("../services/polarSandbox");
const walletSchema_1 = require("../services/walletSchema");
const walletRateLimit_1 = require("../middleware/walletRateLimit");
const availabilityLimit = (0, express_rate_limit_1.rateLimit)({ ...walletRateLimit_1.walletRateLimitOptions, limit: 120 });
const checkoutStartLimit = (0, express_rate_limit_1.rateLimit)({ ...walletRateLimit_1.walletRateLimitOptions, limit: 16 });
const checkoutStatusLimit = (0, express_rate_limit_1.rateLimit)({ ...walletRateLimit_1.walletRateLimitOptions, limit: 120 });
const webhookLimit = (0, express_rate_limit_1.rateLimit)({ ...walletRateLimit_1.walletRateLimitOptions, limit: 600 });
exports.polarGemPlayerRoutes = (0, express_1.Router)();
exports.polarGemPlayerRoutes.post('/shop/diamonds/availability', availabilityLimit, async (req, res) => {
    const config = (0, polarGemPayments_1.polarGemConfig)();
    res.set('Cache-Control', 'no-store').json({
        enabled: Boolean(config && (0, polarClient_1.clientOriginAllowed)(req.get('origin'), config.origin) &&
            await (0, walletSchema_1.walletSchemaReady)(prismaClient_1.db.rawClient, 'gems')),
        sandbox: Boolean(config?.sandbox),
    });
});
exports.polarGemPlayerRoutes.post('/shop/diamonds/checkout', checkoutStartLimit, auth_1.requireUserAuth, async (req, res) => {
    const config = (0, polarGemPayments_1.polarGemConfig)();
    const userId = req.authUserId;
    const packId = req.body?.productId;
    if (!config || !(0, polarClient_1.clientOriginAllowed)(req.get('origin'), config.origin) || !await (0, walletSchema_1.walletSchemaReady)(prismaClient_1.db.rawClient, 'gems')) {
        res.status(503).json({ error: 'Elmas ödemesi şu anda açık değil.' });
        return;
    }
    if (!userId || userId.startsWith('guest_') || typeof packId !== 'string' || !config.products.has(packId)) {
        res.status(400).json({ error: 'Elmas paketi ve giriş yapılmış bir hesap gerekli.' });
        return;
    }
    try {
        const prisma = prismaClient_1.db.rawClient;
        const account = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
        if (!account) {
            res.status(401).json({ error: 'Lütfen tekrar giriş yap.' });
            return;
        }
        const recent = await prisma.polarGemOrder.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 60_000) } } });
        if (recent >= 4) {
            res.status(429).json({ error: 'Yeni ödeme açmak için biraz bekle.' });
            return;
        }
        const checkout = await (0, polarGemPayments_1.createGemCheckout)(config, packId, userId, fetch, (0, polarClient_1.clientIpAddress)(req));
        if (!checkout) {
            res.status(400).json({ error: 'Paket bulunamadı.' });
            return;
        }
        await prisma.polarGemOrder.create({ data: checkout.row });
        res.json({ url: checkout.url });
    }
    catch {
        res.status(502).json({ error: 'Ödeme sayfası açılamadı. Lütfen tekrar dene.' });
    }
});
exports.polarGemPlayerRoutes.get('/shop/diamonds/checkout/:id', checkoutStatusLimit, auth_1.requireUserAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const id = req.params.id;
    if (!req.authUserId || typeof id !== 'string' || !polarSandbox_1.checkoutIdPattern.test(id)) {
        res.sendStatus(404);
        return;
    }
    try {
        const row = await prismaClient_1.db.rawClient.polarGemOrder.findFirst({
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
exports.polarGemWebhook = (0, express_1.Router)();
exports.polarGemWebhook.post('/', webhookLimit, express_1.default.raw({ type: 'application/json', limit: '128kb' }), async (req, res) => {
    const config = (0, polarGemPayments_1.polarGemConfig)();
    if (!config) {
        res.sendStatus(503);
        return;
    }
    if (!Buffer.isBuffer(req.body) || !(0, polarGemPayments_1.verifyPolarGemSignature)(req.body, name => req.get(name), config.secret)) {
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
        await (0, polarGemPayments_1.applyGemOrder)(prismaClient_1.db.rawClient, event);
        res.sendStatus(204);
    }
    catch {
        res.sendStatus(503); // Polar retries failed deliveries.
    }
});
