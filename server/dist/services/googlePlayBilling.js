"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayPurchaseRejected = exports.PLAY_PASS_PRODUCT_ID = void 0;
exports.playProducts = playProducts;
exports.playBillingConfig = playBillingConfig;
exports.playAccountId = playAccountId;
exports.resetPlayTokenCache = resetPlayTokenCache;
exports.verifyPlayPurchase = verifyPlayPurchase;
exports.syncVoidedPlayPurchases = syncVoidedPlayPurchases;
exports.revokePlayPurchase = revokePlayPurchase;
exports.playSchemaReady = playSchemaReady;
const node_crypto_1 = require("node:crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const shared_1 = require("@trivia/shared");
/**
 * Google Play Billing (Android uygulama içi satın alma) doğrulaması.
 *
 * İstemci satın almayı Play üzerinden yapar ve yalnızca `purchaseToken` gönderir.
 * Sunucu Google Play Developer API'sinden satın almayı okur; bakiye ancak Google
 * "purchased" dediğinde, doğru paket/ürün ve aynı hesap için yazılır. Elmas ve
 * Premium Pass tüketilebilir (consumable) ürün olarak tanımlanır.
 */
exports.PLAY_PASS_PRODUCT_ID = 'premium_pass';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const purchaseTokenPattern = /^[A-Za-z0-9._:-]{20,1024}$/;
const packageNamePattern = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
function playProducts() {
    const products = new Map();
    for (const pack of shared_1.SHOP_CATALOG) {
        if (pack.category === 'diamonds' && pack.currency === 'try' && pack.grantGems) {
            products.set(pack.id, { kind: 'gems', gems: pack.grantGems });
        }
    }
    products.set(exports.PLAY_PASS_PRODUCT_ID, { kind: 'pass' });
    return products;
}
function parseServiceAccount(raw) {
    const text = raw?.trim();
    if (!text)
        return null;
    try {
        const json = text.startsWith('{') ? text : Buffer.from(text, 'base64').toString('utf8');
        const data = JSON.parse(json);
        if (typeof data.client_email !== 'string' || typeof data.private_key !== 'string' ||
            !data.private_key.includes('PRIVATE KEY'))
            return null;
        return { client_email: data.client_email, private_key: data.private_key };
    }
    catch {
        return null;
    }
}
function playBillingConfig(env = process.env) {
    if (env.PLAY_BILLING_ENABLED !== 'true')
        return null;
    const packageName = env.GOOGLE_PLAY_PACKAGE_NAME?.trim() ?? '';
    const account = parseServiceAccount(env.GOOGLE_PLAY_SERVICE_ACCOUNT);
    if (!packageNamePattern.test(packageName) || !account)
        return null;
    return {
        packageName, account, products: playProducts(),
        // Lisans test hesaplarının ücretsiz test satın almaları yalnızca açıkça izin verilirse kabul edilir.
        allowTestPurchases: env.PLAY_BILLING_ALLOW_TEST_PURCHASES === 'true',
    };
}
/** Play'e `obfuscatedAccountId` olarak giden değer; kullanıcı kimliğini açık etmez. */
function playAccountId(userId) {
    return (0, node_crypto_1.createHash)('sha256').update(`tavriko-play:${userId}`).digest('hex');
}
let cachedToken = null;
function resetPlayTokenCache() { cachedToken = null; }
async function accessToken(config, request) {
    const now = Date.now();
    if (cachedToken && cachedToken.key === config.account.client_email && cachedToken.expires > now + 60_000) {
        return cachedToken.token;
    }
    const iat = Math.floor(now / 1000);
    const assertion = jsonwebtoken_1.default.sign({ iss: config.account.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }, config.account.private_key, { algorithm: 'RS256' });
    const response = await request(TOKEN_URL, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(6000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    });
    if (!response.ok)
        throw new Error('Google OAuth token request failed');
    const data = await response.json();
    if (typeof data.access_token !== 'string')
        throw new Error('Unexpected Google OAuth response');
    cachedToken = { key: config.account.client_email, token: data.access_token, expires: now + (data.expires_in ?? 3600) * 1000 };
    return data.access_token;
}
async function playRequest(config, path, request, method = 'GET') {
    const token = await accessToken(config, request);
    return request(`${API}/${encodeURIComponent(config.packageName)}${path}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${token}`, ...(method === 'POST' ? { 'Content-Length': '0' } : {}) },
    });
}
class PlayPurchaseRejected extends Error {
}
exports.PlayPurchaseRejected = PlayPurchaseRejected;
/**
 * Satın almayı Google'dan okur, doğrular ve bir kez uygular. Aynı token tekrar
 * gönderilirse bakiye yeniden yazılmaz. Başarıda token sunucu tarafında tüketilir.
 */
async function verifyPlayPurchase(prisma, config, userId, productId, purchaseToken, request = fetch) {
    const product = config.products.get(productId);
    if (!product || !purchaseTokenPattern.test(purchaseToken))
        throw new PlayPurchaseRejected('Geçersiz satın alma.');
    const path = `/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
    const response = await playRequest(config, path, request);
    if (response.status === 400 || response.status === 404 || response.status === 410) {
        throw new PlayPurchaseRejected('Satın alma Google Play tarafından doğrulanamadı.');
    }
    if (!response.ok)
        throw new Error('Google Play purchase lookup failed');
    const data = await response.json();
    if (data.purchaseState === 2)
        return { status: 'pending' };
    const test = data.purchaseType === 0;
    if (data.purchaseState !== 0 || typeof data.orderId !== 'string' || !data.orderId ||
        data.obfuscatedExternalAccountId !== playAccountId(userId) ||
        (data.quantity != null && data.quantity !== 1) ||
        (data.purchaseType != null && data.purchaseType !== 0) ||
        (test && !config.allowTestPurchases)) {
        throw new PlayPurchaseRejected('Satın alma bu hesap için doğrulanamadı.');
    }
    const outcome = await prisma.$transaction(async (tx) => {
        const [user] = await tx.$queryRaw `
      SELECT "hasPremiumPass" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
        if (!user)
            throw new PlayPurchaseRejected('Lütfen tekrar giriş yap.');
        const existing = await tx.playPurchase.findUnique({ where: { purchaseToken } });
        if (existing) {
            if (existing.userId !== userId || existing.productId !== productId) {
                throw new PlayPurchaseRejected('Satın alma bu hesap için doğrulanamadı.');
            }
            if (existing.status === 'voided')
                throw new PlayPurchaseRejected('Bu satın alma iade edildi.');
            return { status: 'already_processed', consume: data.consumptionState !== 1,
                gems: existing.gems || undefined, pass: existing.kind === 'pass' || undefined };
        }
        if (product.kind === 'pass' && user.hasPremiumPass) {
            // Tüketilmeyen ve onaylanmayan satın almayı Google 3 gün içinde otomatik iade eder.
            return { status: 'pass_owned', consume: false };
        }
        await tx.playPurchase.create({ data: {
                purchaseToken, orderId: data.orderId, userId, productId, kind: product.kind,
                gems: product.kind === 'gems' ? product.gems : 0, test,
            } });
        if (product.kind === 'gems') {
            await tx.user.update({ where: { id: userId }, data: { gems: { increment: product.gems } } });
            return { status: 'granted', consume: true, gems: product.gems };
        }
        await tx.user.update({ where: { id: userId }, data: { hasPremiumPass: true } });
        return { status: 'granted', consume: true, pass: true };
    }, { timeout: 12_000 });
    if (outcome.consume) {
        // İstemci de tüketmeyi dener; burada başarısız olması bakiyeyi etkilemez.
        await playRequest(config, `${path}:consume`, request, 'POST')
            .then(async (res) => { if (res.ok)
            await prisma.playPurchase.update({ where: { purchaseToken }, data: { consumedAt: new Date() } }).catch(() => { }); })
            .catch(() => { });
    }
    const { consume: _consume, ...result } = outcome;
    return result;
}
/**
 * İade edilen / geri alınan Play satın almalarını okur ve verilen elmas veya Pass'i
 * geri alır. Polar iadeleriyle aynı kural: elmas bakiyesi negatife düşebilir.
 */
async function syncVoidedPlayPurchases(prisma, config, request = fetch, now = Date.now()) {
    const startTime = now - 30 * 24 * 60 * 60 * 1000; // Google en fazla 30 gün geriye izin verir.
    let pageToken;
    let revoked = 0;
    for (let page = 0; page < 20; page += 1) {
        const query = new URLSearchParams({ startTime: String(startTime), type: '0', maxResults: '1000' });
        if (pageToken)
            query.set('token', pageToken);
        const response = await playRequest(config, `/purchases/voidedpurchases?${query}`, request);
        if (!response.ok)
            throw new Error('Google Play voided purchases lookup failed');
        const data = await response.json();
        for (const voided of data.voidedPurchases ?? []) {
            if (typeof voided.purchaseToken !== 'string')
                continue;
            if (await revokePlayPurchase(prisma, voided.purchaseToken))
                revoked += 1;
        }
        pageToken = data.tokenPagination?.nextPageToken;
        if (!pageToken)
            break;
    }
    return { revoked };
}
async function revokePlayPurchase(prisma, purchaseToken) {
    const initial = await prisma.playPurchase.findUnique({ where: { purchaseToken } });
    if (!initial || initial.status === 'voided')
        return false;
    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw `SELECT "id" FROM "users" WHERE "id" = ${initial.userId} FOR UPDATE`;
        const row = await tx.playPurchase.findUnique({ where: { purchaseToken } });
        if (!row || row.status === 'voided')
            return false;
        await tx.playPurchase.update({ where: { purchaseToken }, data: { status: 'voided', voidedAt: new Date() } });
        if (row.kind === 'gems' && row.gems > 0) {
            await tx.user.update({ where: { id: row.userId }, data: { gems: { decrement: row.gems } } });
        }
        else if (row.kind === 'pass') {
            const otherPlay = await tx.playPurchase.findFirst({ where: { userId: row.userId, kind: 'pass', status: 'granted' } });
            const otherPolar = otherPlay ? null : await tx.polarSeasonOrder.findFirst({ where: { userId: row.userId, status: 'paid', granted: true } });
            if (!otherPlay && !otherPolar)
                await tx.user.update({ where: { id: row.userId }, data: { hasPremiumPass: false } });
        }
        return true;
    });
}
const schemaChecks = new WeakMap();
function playSchemaReady(prisma) {
    const now = Date.now();
    const cached = schemaChecks.get(prisma);
    if (cached && cached.expires > now)
        return cached.result;
    const result = prisma.$queryRaw `
    SELECT pg_catalog.to_regclass('public.play_purchases') IS NOT NULL AS ready
  `.then(rows => rows[0]?.ready === true, () => false);
    schemaChecks.set(prisma, { expires: now + 30_000, result });
    return result;
}
