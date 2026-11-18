"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolarSandboxError = exports.checkoutIdPattern = void 0;
exports.sandboxConfig = sandboxConfig;
exports.buildPolarSandbox = buildPolarSandbox;
const node_crypto_1 = require("node:crypto");
const API = 'https://sandbox-api.polar.sh/v1';
exports.checkoutIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = ['open', 'confirmed', 'succeeded', 'failed', 'expired'];
class PolarSandboxError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
exports.PolarSandboxError = PolarSandboxError;
function sandboxConfig(env = process.env) {
    const token = env.POLAR_SANDBOX_ACCESS_TOKEN?.trim();
    const product = env.POLAR_SANDBOX_PRODUCT_ID?.trim();
    const origin = env.POLAR_SANDBOX_APP_ORIGIN?.trim();
    try {
        const url = new URL(origin || '');
        const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        if (env.POLAR_SANDBOX_ENABLED === 'true' && token && product && exports.checkoutIdPattern.test(product) &&
            origin === url.origin && (url.protocol === 'https:' || (local && url.protocol === 'http:'))) {
            return { token, product, origin };
        }
    }
    catch { /* invalid configuration */ }
    return null;
}
function buildPolarSandbox(config, request = fetch) {
    // Do not send the administrator's email address to Polar.
    const owner = (email) => (0, node_crypto_1.createHmac)('sha256', config.token).update(`tavriko-sandbox:${email}`).digest('hex');
    async function call(path, body) {
        let response;
        try {
            response = await request(API + path, {
                method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(4500),
                headers: { Authorization: `Bearer ${config.token}`, Accept: 'application/json', 'Content-Type': 'application/json', 'Polar-Version': '2026-10' },
                body: body ? JSON.stringify(body) : undefined,
            });
        }
        catch {
            throw new PolarSandboxError(502, 'Polar Sandbox bağlantısı kurulamadı.');
        }
        if (!response.ok) {
            if (!body && response.status === 404)
                throw new PolarSandboxError(404, 'Test oturumu bulunamadı.');
            if (response.status === 429)
                throw new PolarSandboxError(503, 'Polar istek sınırına ulaşıldı. Biraz sonra tekrar deneyin.');
            if ([401, 403].includes(response.status))
                throw new PolarSandboxError(502, 'Polar Sandbox anahtarı veya izinleri geçersiz.');
            throw new PolarSandboxError(502, 'Polar Sandbox isteği reddetti. Test ürünü ve yapılandırmayı kontrol edin.');
        }
        try {
            const data = await response.json();
            if (!data || typeof data !== 'object' || Array.isArray(data))
                throw new Error('Invalid response');
            return data;
        }
        catch {
            throw new PolarSandboxError(502, 'Polar Sandbox yanıtı okunamadı.');
        }
    }
    function safeCheckout(data, email) {
        if (data?.product_id !== config.product || data.metadata?.tavriko_sandbox_owner !== owner(email) ||
            typeof data.status !== 'string' || !statuses.includes(data.status) || typeof data.id !== 'string' || !exports.checkoutIdPattern.test(data.id) ||
            typeof data.amount !== 'number' || !Number.isSafeInteger(data.amount) || data.amount <= 0 || typeof data.currency !== 'string' ||
            !/^[a-z]{3}$/i.test(data.currency)) {
            throw new PolarSandboxError(502, 'Test oturumu beklenen ürün, sahiplik veya tutarla eşleşmiyor.');
        }
        return { id: data.id, status: data.status, amount: data.amount, currency: data.currency };
    }
    async function productAvailable() {
        const data = await call(`/products/${config.product}`);
        const prices = Array.isArray(data.prices) ? data.prices.filter((p) => p?.is_archived === false) : [];
        return data.id === config.product && data.visibility === 'private' && data.is_archived === false && data.is_recurring === false &&
            Array.isArray(data.benefits) && data.benefits.length === 0 && prices.length === 1 &&
            prices[0].amount_type === 'fixed' && typeof prices[0].price_amount === 'number' && prices[0].price_amount > 0;
    }
    return {
        async create(email) {
            if (!await productAvailable())
                throw new PolarSandboxError(502, 'Test ürünü özel, aktif, sabit fiyatlı ve faydasız olmalıdır.');
            const returnUrl = `${config.origin}/admin/health`;
            const data = await call('/checkouts/', {
                products: [config.product], metadata: { tavriko_sandbox_owner: owner(email) },
                allow_discount_codes: false, allow_trial: false,
                success_url: `${returnUrl}?checkout_id={CHECKOUT_ID}`, return_url: returnUrl,
            });
            const result = safeCheckout(data, email);
            let url;
            try {
                url = new URL(typeof data.url === 'string' ? data.url : '');
            }
            catch {
                throw new PolarSandboxError(502, 'Sandbox ödeme adresi geçersiz.');
            }
            if (result.status !== 'open' || url.origin !== 'https://sandbox.polar.sh' ||
                !url.pathname.startsWith('/checkout/') || url.username || url.password) {
                throw new PolarSandboxError(502, 'Sandbox dışındaki ödeme adresi engellendi.');
            }
            return { ...result, url: url.href };
        },
        async status(id, email) {
            if (!exports.checkoutIdPattern.test(id))
                throw new PolarSandboxError(400, 'Test oturumu kimliği geçersiz.');
            const data = await call(`/checkouts/${id}`);
            if (data?.id !== id || data?.metadata?.tavriko_sandbox_owner !== owner(email)) {
                throw new PolarSandboxError(404, 'Test oturumu bulunamadı.');
            }
            return safeCheckout(data, email);
        },
        productAvailable,
    };
}
