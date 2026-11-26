"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeasonCheckoutConflict = void 0;
exports.polarSeasonConfig = polarSeasonConfig;
exports.startSeasonCheckout = startSeasonCheckout;
exports.applySeasonOrder = applySeasonOrder;
const polarSandbox_1 = require("./polarSandbox");
function polarSeasonConfig(env = process.env) {
    const token = env.POLAR_SEASON_ACCESS_TOKEN?.trim();
    const secret = env.POLAR_SEASON_WEBHOOK_SECRET?.trim();
    const productId = env.POLAR_SEASON_PRODUCT_ID?.trim() ?? '';
    const rawAmount = env.POLAR_SEASON_AMOUNT_KURUS ?? '';
    const amount = Number(rawAmount);
    const sandbox = env.POLAR_SEASON_SANDBOX === 'true';
    if (env.POLAR_SEASON_ENABLED !== 'true' || !token || !secret || !polarSandbox_1.checkoutIdPattern.test(productId) ||
        !/^[1-9]\d{0,7}$/.test(rawAmount) || (sandbox && env.VERCEL_ENV === 'production'))
        return null;
    try {
        const app = new URL(env.POLAR_SEASON_APP_ORIGIN ?? '');
        if (app.protocol !== 'https:' || app.origin !== env.POLAR_SEASON_APP_ORIGIN)
            return null;
        return { token, secret, productId, amount, sandbox, origin: app.origin };
    }
    catch {
        return null;
    }
}
class SeasonCheckoutConflict extends Error {
}
exports.SeasonCheckoutConflict = SeasonCheckoutConflict;
const polarUrl = (config) => config.sandbox ? 'https://sandbox-api.polar.sh' : 'https://api.polar.sh';
const headers = (config) => ({
    Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json', 'Polar-Version': '2026-10',
});
async function readCheckout(response) {
    const data = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new Error('Unexpected Polar checkout');
    return data;
}
function paymentUrl(config, data, productId, amount) {
    const price = data.product_price ?? (data.product_price_id
        ? data.product?.prices?.find(price => price.id === data.product_price_id) : undefined);
    if (typeof data.id !== 'string' || !polarSandbox_1.checkoutIdPattern.test(data.id) || typeof data.url !== 'string' ||
        data.status !== 'open' || data.product_id !== productId || data.currency !== 'try' ||
        data.amount !== amount || (data.units != null && data.units !== 1) || data.product?.is_recurring !== false ||
        price?.amount_type !== 'fixed' || data.is_payment_required !== true) {
        throw new Error('Unexpected Polar checkout');
    }
    const url = new URL(data.url);
    const origins = config.sandbox ? ['https://sandbox.polar.sh'] : ['https://polar.sh', 'https://buy.polar.sh'];
    if (!origins.includes(url.origin) || !url.pathname.startsWith('/checkout/') || url.username || url.password) {
        throw new Error('Unexpected Polar checkout origin');
    }
    return { url: url.href, id: data.id };
}
async function startSeasonCheckout(prisma, config, userId, request = fetch, customerIp) {
    return prisma.$transaction(async (tx) => {
        const [user] = await tx.$queryRaw `
      SELECT "hasPremiumPass" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
        if (!user)
            throw new SeasonCheckoutConflict('Lütfen tekrar giriş yap.');
        if (user.hasPremiumPass)
            throw new SeasonCheckoutConflict('Premium Pass zaten aktif.');
        const pending = await tx.polarSeasonOrder.findFirst({ where: { userId, status: 'open', sandbox: config.sandbox } });
        if (pending) {
            const response = await request(`${polarUrl(config)}/v1/checkouts/${pending.checkoutId}`, {
                headers: headers(config), redirect: 'error', signal: AbortSignal.timeout(5000),
            });
            if (!response.ok)
                throw new Error('Polar checkout lookup failed');
            const data = await readCheckout(response);
            if (data.id !== pending.checkoutId)
                throw new Error('Unexpected Polar checkout ID');
            if (data.status === 'open')
                return paymentUrl(config, data, pending.productId, pending.amount).url;
            if (data.status !== 'expired' && data.status !== 'failed') {
                throw new SeasonCheckoutConflict('Önceki ödemen doğrulanıyor. Yeni bir ödeme başlatma.');
            }
            await tx.polarSeasonOrder.update({ where: { checkoutId: pending.checkoutId }, data: { status: 'closed' } });
        }
        const response = await request(`${polarUrl(config)}/v1/checkouts/`, {
            method: 'POST', headers: headers(config), redirect: 'error', signal: AbortSignal.timeout(5000),
            body: JSON.stringify({
                products: [config.productId], currency: 'try', external_customer_id: userId,
                ...(customerIp ? { customer_ip_address: customerIp } : {}),
                allow_discount_codes: false, allow_trial: false,
                metadata: { tavriko_season: '1' },
                return_url: `${config.origin}/app?season=1`,
                success_url: `${config.origin}/app?season_checkout={CHECKOUT_ID}`,
            }),
        });
        if (!response.ok)
            throw new Error('Polar checkout creation failed');
        const checkout = paymentUrl(config, await readCheckout(response), config.productId, config.amount);
        await tx.polarSeasonOrder.create({ data: {
                checkoutId: checkout.id, userId, productId: config.productId, amount: config.amount, sandbox: config.sandbox,
            } });
        return checkout.url;
    }, { timeout: 14_000 });
}
async function applySeasonOrder(prisma, payload, sandbox) {
    const event = payload;
    const order = event?.data;
    const refund = event?.type === 'order.refunded';
    if (!order || (!refund && event?.type !== 'order.paid') ||
        typeof order.checkout_id !== 'string' || !polarSandbox_1.checkoutIdPattern.test(order.checkout_id) ||
        typeof order.id !== 'string' || !polarSandbox_1.checkoutIdPattern.test(order.id))
        return;
    await prisma.$transaction(async (tx) => {
        const initial = await tx.polarSeasonOrder.findUnique({ where: { checkoutId: order.checkout_id } });
        if (!initial)
            return;
        // Keep the same lock order as checkout creation and season reward claims.
        const [user] = await tx.$queryRaw `
      SELECT "hasPremiumPass" FROM "users" WHERE "id" = ${initial.userId} FOR UPDATE`;
        const row = await tx.polarSeasonOrder.findUnique({ where: { checkoutId: order.checkout_id } });
        if (!user || !row || row.sandbox !== sandbox || row.status === 'refunded' ||
            (row.orderId && row.orderId !== order.id) || row.userId !== order.customer?.external_id ||
            row.productId !== order.product_id || order.currency !== 'try' ||
            order.subtotal_amount !== row.amount || order.discount_amount !== 0 || (order.units != null && order.units !== 1) ||
            order.subscription_id != null)
            return;
        if (refund) {
            if (order.status !== 'refunded')
                return; // Partial refunds do not revoke access.
            if (row.granted) {
                const other = await tx.polarSeasonOrder.findFirst({
                    where: { userId: row.userId, checkoutId: { not: row.checkoutId }, status: 'paid', sandbox },
                });
                if (other) {
                    await tx.polarSeasonOrder.update({ where: { checkoutId: other.checkoutId }, data: { granted: true } });
                }
                else {
                    await tx.user.update({ where: { id: row.userId }, data: { hasPremiumPass: false } });
                }
            }
            await tx.polarSeasonOrder.update({ where: { checkoutId: row.checkoutId }, data: { orderId: order.id, status: 'refunded', granted: false } });
        }
        else if (order.paid === true && order.status === 'paid' && row.status !== 'paid') {
            const granted = !user.hasPremiumPass;
            if (granted)
                await tx.user.update({ where: { id: row.userId }, data: { hasPremiumPass: true } });
            await tx.polarSeasonOrder.update({ where: { checkoutId: row.checkoutId }, data: { orderId: order.id, status: 'paid', granted } });
        }
    });
}
