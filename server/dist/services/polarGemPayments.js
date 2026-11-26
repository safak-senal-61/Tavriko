"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.polarGemConfig = polarGemConfig;
exports.verifyPolarGemSignature = verifyPolarGemSignature;
exports.createGemCheckout = createGemCheckout;
exports.applyGemOrder = applyGemOrder;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@trivia/shared");
const polarSandbox_1 = require("./polarSandbox");
const diamondPacks = shared_1.SHOP_CATALOG.filter(p => p.category === 'diamonds' && p.currency === 'try' && p.grantGems);
function polarGemConfig(env = process.env) {
    if (env.POLAR_GEMS_ENABLED !== 'true')
        return null;
    const token = env.POLAR_GEMS_ACCESS_TOKEN?.trim();
    const secret = env.POLAR_GEMS_WEBHOOK_SECRET?.trim();
    try {
        const app = new URL(env.POLAR_GEMS_APP_ORIGIN || '');
        if (app.protocol !== 'https:' || app.origin !== env.POLAR_GEMS_APP_ORIGIN || !token || !secret)
            return null;
        const products = new Map(diamondPacks.map(pack => [pack.id, {
                polarId: (env[`POLAR_GEMS_PRODUCT_${pack.id.slice('gems_'.length)}`] ?? '').trim(),
                amount: Math.round(pack.price * 100), gems: pack.grantGems,
            }]));
        if ([...products.values()].some(p => !polarSandbox_1.checkoutIdPattern.test(p.polarId)) ||
            new Set([...products.values()].map(p => p.polarId.toLowerCase())).size !== products.size)
            return null;
        return { token, secret, origin: app.origin, products, sandbox: env.POLAR_GEMS_SANDBOX === 'true' };
    }
    catch {
        return null;
    }
}
function verifyPolarGemSignature(bytes, header, secret, now = Date.now()) {
    const id = header('webhook-id');
    const timestamp = header('webhook-timestamp') ?? '';
    const signatures = header('webhook-signature') ?? '';
    if (!id || !/^\d{10}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300)
        return false;
    const expected = (0, node_crypto_1.createHmac)('sha256', secret).update(`${id}.${timestamp}.`).update(bytes).digest();
    return signatures.split(' ').some(signature => {
        if (!/^v1,[A-Za-z0-9+/]{43}=$/.test(signature))
            return false;
        const incoming = Buffer.from(signature.slice(3), 'base64');
        return incoming.length === expected.length && (0, node_crypto_1.timingSafeEqual)(expected, incoming);
    });
}
async function createGemCheckout(config, packId, userId, request = fetch, customerIp) {
    const pack = config.products.get(packId);
    if (!pack)
        return null;
    const api = config.sandbox ? 'https://sandbox-api.polar.sh' : 'https://api.polar.sh';
    const origins = config.sandbox ? ['https://sandbox.polar.sh'] : ['https://polar.sh', 'https://buy.polar.sh'];
    const returnUrl = `${config.origin}/app`;
    const response = await request(`${api}/v1/checkouts/`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(6000),
        headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json', 'Polar-Version': '2026-10' },
        body: JSON.stringify({
            products: [pack.polarId], currency: 'try', external_customer_id: userId,
            ...(customerIp ? { customer_ip_address: customerIp } : {}),
            metadata: { tavriko_gem_pack: packId }, allow_discount_codes: false, allow_trial: false,
            return_url: returnUrl, success_url: `${returnUrl}?gem_checkout={CHECKOUT_ID}`,
        }),
    });
    if (!response.ok)
        throw new Error('Polar checkout unavailable');
    const data = await response.json();
    if (!data || typeof data.url !== 'string' || typeof data.id !== 'string')
        throw new Error('Unexpected Polar checkout response');
    const url = new URL(data.url);
    if (!polarSandbox_1.checkoutIdPattern.test(data.id) || data.status !== 'open' || data.product_id !== pack.polarId ||
        data.amount !== pack.amount || data.currency !== 'try' || !origins.includes(url.origin) ||
        !url.pathname.startsWith('/checkout/') || url.username || url.password)
        throw new Error('Unexpected Polar checkout response');
    return { url: url.href, row: { checkoutId: data.id, userId, productId: pack.polarId, amount: pack.amount, gems: pack.gems } };
}
async function applyGemOrder(prisma, payload) {
    const event = payload;
    const order = event?.data;
    const isRefund = event?.type === 'order.refunded';
    if (!order || (!isRefund && event?.type !== 'order.paid') ||
        typeof order.checkout_id !== 'string' || !polarSandbox_1.checkoutIdPattern.test(order.checkout_id) ||
        typeof order.id !== 'string' || !polarSandbox_1.checkoutIdPattern.test(order.id))
        return;
    await prisma.$transaction(async (tx) => {
        await tx.$queryRaw `SELECT "checkoutId" FROM "polar_gem_orders" WHERE "checkoutId" = ${order.checkout_id} FOR UPDATE`;
        const checkout = await tx.polarGemOrder.findUnique({ where: { checkoutId: order.checkout_id } });
        if (!checkout || (checkout.orderId && checkout.orderId !== order.id) ||
            checkout.userId !== order.customer?.external_id || checkout.productId !== order.product_id ||
            order.currency !== 'try' || order.subtotal_amount !== checkout.amount || order.discount_amount !== 0 ||
            (!isRefund && (order.paid !== true || order.status !== 'paid')))
            return;
        const refunded = order.refunded_amount ?? 0;
        if (!Number.isSafeInteger(refunded) || refunded < 0)
            return;
        const refundedGems = Math.max(checkout.refundedGems, order.status === 'refunded' ? checkout.gems :
            Math.min(checkout.gems, Math.floor(checkout.gems * refunded / checkout.amount)));
        const delta = (checkout.status === 'open' ? checkout.gems : 0) - (refundedGems - checkout.refundedGems);
        if (delta !== 0) {
            await tx.user.update({ where: { id: checkout.userId }, data: { gems: { increment: delta } } });
        }
        await tx.polarGemOrder.update({ where: { checkoutId: checkout.checkoutId }, data: {
                orderId: order.id, refundedGems, status: refundedGems === checkout.gems ? 'refunded' : 'paid',
            } });
    });
}
