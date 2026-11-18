import { createHmac } from 'node:crypto';

const API = 'https://sandbox-api.polar.sh/v1';
export const checkoutIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = ['open', 'confirmed', 'succeeded', 'failed', 'expired'];

export class PolarSandboxError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export function sandboxConfig(env = process.env) {
  const token = env.POLAR_SANDBOX_ACCESS_TOKEN?.trim();
  const product = env.POLAR_SANDBOX_PRODUCT_ID?.trim();
  const origin = env.POLAR_SANDBOX_APP_ORIGIN?.trim();
  try {
    const url = new URL(origin || '');
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (env.POLAR_SANDBOX_ENABLED === 'true' && token && product && checkoutIdPattern.test(product) &&
        origin === url.origin && (url.protocol === 'https:' || (local && url.protocol === 'http:'))) {
      return { token, product, origin };
    }
  } catch { /* invalid configuration */ }
  return null;
}

export function buildPolarSandbox(config: NonNullable<ReturnType<typeof sandboxConfig>>, request = fetch) {
  // Do not send the administrator's email address to Polar.
  const owner = (email: string) => createHmac('sha256', config.token).update(`tavriko-sandbox:${email}`).digest('hex');
  type PolarData = {
    id?: unknown; product_id?: unknown; url?: unknown; metadata?: Record<string, unknown>; status?: unknown;
    amount?: unknown; currency?: unknown; is_archived?: unknown; is_recurring?: unknown;
    visibility?: unknown; benefits?: unknown; prices?: { is_archived?: unknown; amount_type?: unknown; price_amount?: unknown }[];
  };
  async function call(path: string, body?: object) {
    let response: Response;
    try {
      response = await request(API + path, {
        method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(4500),
        headers: { Authorization: `Bearer ${config.token}`, Accept: 'application/json', 'Content-Type': 'application/json', 'Polar-Version': '2026-10' },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new PolarSandboxError(502, 'Polar Sandbox bağlantısı kurulamadı.');
    }
    if (!response.ok) {
      if (!body && response.status === 404) throw new PolarSandboxError(404, 'Test oturumu bulunamadı.');
      if (response.status === 429) throw new PolarSandboxError(503, 'Polar istek sınırına ulaşıldı. Biraz sonra tekrar deneyin.');
      if ([401, 403].includes(response.status)) throw new PolarSandboxError(502, 'Polar Sandbox anahtarı veya izinleri geçersiz.');
      throw new PolarSandboxError(502, 'Polar Sandbox isteği reddetti. Test ürünü ve yapılandırmayı kontrol edin.');
    }
    try {
      const data = await response.json();
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid response');
      return data as PolarData;
    } catch {
      throw new PolarSandboxError(502, 'Polar Sandbox yanıtı okunamadı.');
    }
  }

  function safeCheckout(data: PolarData, email: string) {
    if (data?.product_id !== config.product || data.metadata?.tavriko_sandbox_owner !== owner(email) ||
        typeof data.status !== 'string' || !statuses.includes(data.status) || typeof data.id !== 'string' || !checkoutIdPattern.test(data.id) ||
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
    async create(email: string) {
      if (!await productAvailable()) throw new PolarSandboxError(502, 'Test ürünü özel, aktif, sabit fiyatlı ve faydasız olmalıdır.');
      const returnUrl = `${config.origin}/admin/health`;
      const data = await call('/checkouts/', {
        products: [config.product], metadata: { tavriko_sandbox_owner: owner(email) },
        allow_discount_codes: false, allow_trial: false,
        success_url: `${returnUrl}?checkout_id={CHECKOUT_ID}`, return_url: returnUrl,
      });
      const result = safeCheckout(data, email);
      let url: URL;
      try { url = new URL(typeof data.url === 'string' ? data.url : ''); } catch { throw new PolarSandboxError(502, 'Sandbox ödeme adresi geçersiz.'); }
      if (result.status !== 'open' || url.origin !== 'https://sandbox.polar.sh' ||
          !url.pathname.startsWith('/checkout/') || url.username || url.password) {
        throw new PolarSandboxError(502, 'Sandbox dışındaki ödeme adresi engellendi.');
      }
      return { ...result, url: url.href };
    },
    async status(id: string, email: string) {
      if (!checkoutIdPattern.test(id)) throw new PolarSandboxError(400, 'Test oturumu kimliği geçersiz.');
      const data = await call(`/checkouts/${id}`);
      if (data?.id !== id || data?.metadata?.tavriko_sandbox_owner !== owner(email)) {
        throw new PolarSandboxError(404, 'Test oturumu bulunamadı.');
      }
      return safeCheckout(data, email);
    },
    productAvailable,
  };
}
