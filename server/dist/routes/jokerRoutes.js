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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = require("express-rate-limit");
const node_crypto_1 = require("node:crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const shared_1 = require("@trivia/shared");
const rawPrisma_1 = require("../db/rawPrisma");
const walletRateLimit_1 = require("../middleware/walletRateLimit");
const quizJokers_1 = require("../services/quizJokers");
const practiceJokerProof_1 = require("../services/practiceJokerProof");
const router = (0, express_1.Router)();
const practiceJokerLimit = (0, express_rate_limit_1.rateLimit)({ ...walletRateLimit_1.walletRateLimitOptions, limit: 45 });
const quickPurchaseLimit = (0, express_rate_limit_1.rateLimit)({ ...walletRateLimit_1.walletRateLimitOptions, limit: 24 });
const playerIdPattern = /^[a-z0-9_-]{1,128}$/i;
router.use(['/questions/practice/joker', '/internal/room-joker', '/social/shop/jokers/quick-purchase'], (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});
function jokerFailure(res, status) {
    const messages = {
        empty: 'Envanterinde bu jokerden kalmadı.',
        already_used: 'Bu soruda başka bir joker kullanıldı.',
        expired: 'Bu sorunun süresi doldu. Sonraki soruda tekrar dene.',
        unavailable: 'Bu joker bu soruya veya maç türüne uygun değil.',
    };
    res.status(409).json({ error: messages[status], code: status });
}
function jokerBackendError(res, error) {
    const { code, meta } = (error ?? {});
    const migrationMissing = code === 'P2021' || meta?.code === '42P01';
    console.warn('[quiz-joker] Wallet request failed', { code, databaseCode: meta?.code });
    res.status(503).json({ error: migrationMissing ? 'Joker envanteri şu anda kullanıma açık değil.'
            : 'Joker işlemi tamamlanamadı. Tekrar dene.', code: migrationMissing ? 'wallet_not_ready' : 'wallet_unavailable' });
}
async function loadLegacyQuestion(questionId) {
    const stored = await (0, rawPrisma_1.getRawPrisma)().question.findFirst({
        where: { id: questionId, reviewStatus: 'published' }, select: { options: true, correctOptionId: true },
    }).catch(() => null);
    if (stored && Array.isArray(stored.options)) {
        const options = stored.options.flatMap(option => {
            if (!option || typeof option !== 'object' || Array.isArray(option) ||
                typeof option.id !== 'string' || typeof option.text !== 'string')
                return [];
            return [{ id: option.id, text: option.text }];
        });
        if (options.length === stored.options.length && options.some(option => option.id === stored.correctOptionId)) {
            return { correctOptionId: stored.correctOptionId, options };
        }
    }
    // Old signed references may be seed questions, not persisted rows.
    const { db } = await Promise.resolve().then(() => __importStar(require('../db/prismaClient')));
    const known = db.getQuestionById(questionId);
    if (known)
        return known;
    await db.ensureQuestionsRestored();
    return db.getQuestionById(questionId) ?? undefined;
}
function sendJokerResult(res, started, result) {
    res.set('Server-Timing', `joker-wallet;dur=${Math.round(performance.now() - started)}`);
    if (result.status !== 'applied') {
        jokerFailure(res, result.status);
        return;
    }
    res.json(result.effect);
}
function authenticatedJokerPlayer(req, res) {
    const authorization = req.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Yetkilendirme başlığı eksik' });
        return;
    }
    const secret = (0, practiceJokerProof_1.getJokerSigningSecret)();
    let userId;
    try {
        const token = jsonwebtoken_1.default.verify(authorization.slice(7), secret, { algorithms: ['HS256'] });
        if (typeof token !== 'string' && typeof token.userId === 'string')
            userId = token.userId;
    }
    catch { }
    if (!userId) {
        res.status(401).json({ error: 'Geçersiz veya süresi dolmuş oturum' });
        return;
    }
    return userId;
}
router.post('/questions/practice/joker', practiceJokerLimit, async (req, res) => {
    const userId = authenticatedJokerPlayer(req, res);
    if (!userId)
        return;
    const secret = (0, practiceJokerProof_1.getJokerSigningSecret)();
    const { sessionId, questionId, jokerId, proof } = req.body || {};
    if (!playerIdPattern.test(userId) || /^(guest_|bot_)/i.test(userId) || !(0, shared_1.isJokerId)(jokerId) || typeof sessionId !== 'string' ||
        !practiceJokerProof_1.practiceSessionPattern.test(sessionId) || typeof questionId !== 'string' || !questionId || questionId.length > 160) {
        res.status(400).json({ error: 'Bu soruda joker kullanılamıyor.' });
        return;
    }
    const scope = { userId, sessionId, questionId };
    const receipt = (0, practiceJokerProof_1.readPracticeJoker)(proof, scope, secret);
    if (!receipt) {
        res.status(400).json({ error: 'Bu soruda joker kullanılamıyor.' });
        return;
    }
    try {
        if (Date.now() >= receipt.deadline) {
            jokerFailure(res, 'expired');
            return;
        }
        const question = receipt.question ?? await loadLegacyQuestion(questionId);
        if (!question) {
            jokerFailure(res, 'unavailable');
            return;
        }
        const started = performance.now();
        sendJokerResult(res, started, await (0, quizJokers_1.consumeQuizJoker)(scope, jokerId, question, receipt.deadline));
    }
    catch (error) {
        jokerBackendError(res, error);
    }
});
router.post('/social/shop/jokers/quick-purchase', quickPurchaseLimit, async (req, res) => {
    const userId = authenticatedJokerPlayer(req, res);
    if (!userId)
        return;
    const { productId } = req.body || {};
    const product = (0, shared_1.isJokerId)(productId) ? shared_1.SHOP_CATALOG.find(item => item.id === productId && item.category === 'jokers' && item.currency === 'coins') : undefined;
    const item = product?.grantItems?.[0];
    if (!product || !item || !playerIdPattern.test(userId) || /^(guest_|bot_)/i.test(userId)) {
        res.status(400).json({ error: 'Satın almak için geçerli bir joker seç.' });
        return;
    }
    try {
        if ((0, shared_1.isAdvancedJoker)(productId) && !await (await Promise.resolve().then(() => __importStar(require('../services/realtimeJokerAvailability')))).advancedJokersReady()) {
            res.status(503).json({ error: 'Bu joker henüz canlı maçlarda kullanıma açık değil.' });
            return;
        }
        const started = performance.now();
        const [result] = await (0, rawPrisma_1.getRawPrisma)().$queryRaw `
      WITH ready AS MATERIALIZED (
        SELECT pg_catalog.to_regclass('public.practice_joker_uses') IS NOT NULL AS enabled
      ), account AS MATERIALIZED (
        SELECT u."id", u."coins" FROM "users" u, ready WHERE u."id" = ${userId} AND ready.enabled FOR UPDATE OF u
      ), grant_item AS (
        INSERT INTO "user_inventory_items" AS i ("id", "userId", "itemId", "name", "desc", "qty", "updatedAt")
        SELECT ${(0, node_crypto_1.randomUUID)()}, "id", ${item.id}, ${item.name}, ${item.desc}, ${item.qty}, CURRENT_TIMESTAMP
        FROM account WHERE "coins" >= ${product.price}
        ON CONFLICT ("userId", "itemId") DO UPDATE
          SET "qty" = EXCLUDED."qty", "updatedAt" = CURRENT_TIMESTAMP WHERE i."qty" <= 0
        RETURNING "userId", "qty"
      ), debit AS (
        UPDATE "users" u SET "coins" = u."coins" - ${product.price}, "updatedAt" = CURRENT_TIMESTAMP
        FROM grant_item g WHERE u."id" = g."userId" RETURNING u."coins", g."qty"
      )
      SELECT ready.enabled AS "ready", COALESCE(account."coins" >= ${product.price}, false) AS "hasFunds",
        debit."coins", debit."qty" FROM ready LEFT JOIN account ON true LEFT JOIN debit ON true
    `;
        res.set('Server-Timing', `joker-purchase;dur=${Math.round(performance.now() - started)}`);
        if (!result?.ready) {
            res.status(503).json({ error: 'Joker mağazası şu anda kullanıma açık değil.' });
            return;
        }
        if (result.coins !== null && result.qty !== null) {
            res.json({ coins: result.coins, item: { ...item, qty: result.qty } });
            return;
        }
        if (!result.hasFunds) {
            res.status(409).json({ error: `Bu joker için ${product.price} altın gerekli.` });
            return;
        }
        res.status(409).json({ error: 'Bu joker zaten envanterinde.', code: 'already_owned' });
    }
    catch (error) {
        jokerBackendError(res, error);
    }
});
router.post('/internal/room-joker', async (req, res) => {
    const secret = process.env.INTERNAL_API_SECRET;
    const supplied = req.get('x-internal-secret');
    if (!secret || !supplied || Buffer.byteLength(secret) !== Buffer.byteLength(supplied) ||
        !(0, node_crypto_1.timingSafeEqual)(Buffer.from(secret), Buffer.from(supplied))) {
        res.status(403).json({ error: 'Yetkisiz erişim' });
        return;
    }
    const { userId, roomCode, roundNumber, startedAt, deadline, questionId, jokerId, options, correctOptionId, tactics, capabilities, votes, requestedAt = Date.now() } = req.body || {};
    const choices = Array.isArray(options) && options.length >= 2 && options.length <= 12 &&
        options.every(option => typeof option?.id === 'string' && option.id.length <= 160 &&
            typeof option.text === 'string' && option.text.length <= 1000);
    if (typeof userId !== 'string' || !playerIdPattern.test(userId) || /^(guest_|bot_)/i.test(userId) ||
        typeof roomCode !== 'string' || !/^[A-Z0-9_-]{1,16}$/.test(roomCode) ||
        !Number.isSafeInteger(roundNumber) || roundNumber < 1 || roundNumber > 50 ||
        !Number.isSafeInteger(startedAt) || !Number.isSafeInteger(deadline) || startedAt > Date.now() + 2000 ||
        !Number.isSafeInteger(requestedAt) || requestedAt < startedAt || requestedAt > Date.now() + 2000 ||
        deadline <= startedAt || deadline > startedAt + 120_000 ||
        typeof questionId !== 'string' || !questionId || questionId.length > 160 ||
        !(0, shared_1.isJokerId)(jokerId) || !choices || typeof correctOptionId !== 'string' ||
        (tactics !== undefined && tactics !== 'friendly')) {
        res.status(400).json({ error: 'Geçersiz joker isteği.' });
        return;
    }
    try {
        const activeCapabilities = capabilities && typeof capabilities === 'object' && !Array.isArray(capabilities)
            ? { replacement: capabilities.replacement === true, freeze: capabilities.freeze === true, shield: capabilities.shield === true,
                gold: capabilities.gold === true, nextRound: capabilities.nextRound === true } : undefined;
        const counts = votes && typeof votes === 'object' && !Array.isArray(votes)
            ? Object.fromEntries(options.map((option) => {
                const count = Object.hasOwn(votes, option.id) ? votes[option.id] : 0;
                return [option.id, Number.isSafeInteger(count) && count > 0 ? Math.min(count, 1_000_000) : 0];
            })) : undefined;
        const started = performance.now();
        sendJokerResult(res, started, await (0, quizJokers_1.consumeQuizJoker)({ userId, sessionId: `room:${roomCode}:${startedAt}:${roundNumber}`, questionId }, jokerId, { options, correctOptionId }, deadline, { tactics, startedAt, requestedAt, capabilities: activeCapabilities, votes: counts }));
    }
    catch (error) {
        jokerBackendError(res, error);
    }
});
exports.default = router;
