import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { applySeasonOrder, polarSeasonConfig, startSeasonCheckout } from '../src/services/polarSeasonPayments';

const checkoutId = randomUUID();
const product = randomUUID();
const orderId = randomUUID();
const env = {
  POLAR_SEASON_ENABLED: 'true', POLAR_SEASON_SANDBOX: 'true', POLAR_SEASON_APP_ORIGIN: 'https://app.example.test',
  POLAR_SEASON_ACCESS_TOKEN: 'fake-token', POLAR_SEASON_WEBHOOK_SECRET: 'fake-secret',
  POLAR_SEASON_PRODUCT_ID: product, POLAR_SEASON_AMOUNT_KURUS: '9999',
};
const config = polarSeasonConfig(env)!;
const checkout = {
  id: checkoutId, url: `https://sandbox.polar.sh/checkout/${checkoutId}`, status: 'open',
  product_id: product, currency: 'try', amount: 9999, is_payment_required: true,
  product: { is_recurring: false }, product_price: { amount_type: 'fixed' },
};
const order = {
  id: orderId, checkout_id: checkoutId, product_id: product, customer: { external_id: 'player1' },
  currency: 'try', subtotal_amount: 9999, discount_amount: 0, status: 'paid', paid: true,
};

function fixture(legacy = false, withOrder = true) {
  const account = { hasPremiumPass: legacy };
  let row: Record<string, any> | null = withOrder ? {
    checkoutId, productId: product, userId: 'player1', amount: 9999, status: 'open', sandbox: true, granted: false,
  } : null;
  const tx = {
    $queryRaw: vi.fn(async () => [account]),
    user: { update: vi.fn(async ({ data }) => Object.assign(account, data)) },
    polarSeasonOrder: {
      create: vi.fn(async ({ data }) => { row = { status: 'open', granted: false, ...data }; }),
      update: vi.fn(async ({ data }) => Object.assign(row!, data)),
      findUnique: vi.fn(async () => row),
      findFirst: vi.fn(async ({ where }) => row?.status === where.status && row.checkoutId !== where.checkoutId?.not ? row : null),
    },
  };
  const prisma = { $transaction: async (fn: (manager: typeof tx) => unknown) => fn(tx) } as unknown as PrismaClient;
  return { prisma, tx, account, row: () => row };
}
const response = (payload: object) => new Response(JSON.stringify(payload));

describe('Polar Season 1 pass', () => {
  it('requires product and price and never enables Sandbox in Vercel production', () => {
    expect(config?.amount).toBe(9999);
    expect(polarSeasonConfig({ ...env, VERCEL_ENV: 'production' })).toBeNull();
    expect(polarSeasonConfig({ ...env, POLAR_SEASON_AMOUNT_KURUS: '' })).toBeNull();
    expect(polarSeasonConfig({ ...env, POLAR_SEASON_ENABLED: 'false' })).toBeNull();
  });

  it('validates fixed non-recurring checkout, writes a pending row, and reuses the existing checkout', async () => {
    const { prisma, tx, account, row } = fixture(false, false);
    const request = vi.fn<typeof fetch>().mockImplementation(async () => response(checkout));
    expect(await startSeasonCheckout(prisma, config, 'player1', request)).toBe(checkout.url);
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toMatchObject({
      products: [product], external_customer_id: 'player1', currency: 'try', allow_discount_codes: false,
      success_url: 'https://app.example.test/app?season_checkout={CHECKOUT_ID}',
    });
    expect(row()).toMatchObject({ status: 'open', amount: 9999, userId: 'player1' });
    expect(account.hasPremiumPass).toBe(false);
    expect(await startSeasonCheckout(prisma, config, 'player1', request)).toBe(checkout.url);
    expect(String(request.mock.calls[1][0])).toBe(`https://sandbox-api.polar.sh/v1/checkouts/${checkoutId}`);
    expect(tx.polarSeasonOrder.create).toHaveBeenCalledTimes(1);
  });

  it('forwards the customer IP so Polar prices the pass in TRY for the right region', async () => {
    const { prisma } = fixture(false, false);
    const request = vi.fn<typeof fetch>().mockImplementation(async () => response(checkout));
    await startSeasonCheckout(prisma, config, 'player1', request, '203.0.113.7');
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toMatchObject({
      currency: 'try', customer_ip_address: '203.0.113.7',
    });
  });

  it('blocks another checkout while a previous payment is confirming or the pass is already active', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async () => response({ ...checkout, status: 'confirmed' }));
    await expect(startSeasonCheckout(fixture().prisma, config, 'player1', request)).rejects.toThrow('doğrulanıyor');
    await expect(startSeasonCheckout(fixture(true).prisma, config, 'player1', request)).rejects.toThrow('zaten aktif');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('rejects wrong prices, subscriptions, and off-provider checkout addresses', async () => {
    for (const invalid of [{ amount: 1 }, { currency: 'usd' }, { product: { is_recurring: true } },
      { product_price: { amount_type: 'custom' } }, { url: 'https://external.example/checkout/order' }]) {
      const { prisma, tx } = fixture(false, false);
      await expect(startSeasonCheckout(prisma, config, 'player1', async () => response({ ...checkout, ...invalid }))).rejects.toThrow();
      expect(tx.polarSeasonOrder.create).not.toHaveBeenCalled();
    }
  });

  it('grants one pass only for a matching paid event, and revokes only after full refund', async () => {
    const { prisma, tx, account, row } = fixture();
    for (const data of [{ ...order, paid: false }, { ...order, product_id: randomUUID() }, { ...order, subtotal_amount: 1 },
      { ...order, customer: { external_id: 'another' } }]) {
      await applySeasonOrder(prisma, { type: 'order.paid', data }, true);
    }
    const paid = { type: 'order.paid', data: order };
    await applySeasonOrder(prisma, paid, false);
    expect(account.hasPremiumPass).toBe(false);
    await applySeasonOrder(prisma, paid, true);
    await applySeasonOrder(prisma, paid, true);
    expect(row()).toMatchObject({ status: 'paid', orderId, granted: true });
    expect(account.hasPremiumPass).toBe(true);
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    await applySeasonOrder(prisma, { type: 'order.refunded', data: { ...order, status: 'partially_refunded' } }, true);
    expect(account.hasPremiumPass).toBe(true);
    await applySeasonOrder(prisma, { type: 'order.refunded', data: { ...order, status: 'refunded' } }, true);
    await applySeasonOrder(prisma, paid, true);
    expect(row()).toMatchObject({ status: 'refunded', granted: false });
    expect(account.hasPremiumPass).toBe(false);
  });

  it('preserves legacy entitlements and prevents a delayed paid event from restoring a refunded pass', async () => {
    for (const legacy of [true, false]) {
      const { prisma, account, tx } = fixture(legacy);
      await applySeasonOrder(prisma, { type: 'order.refunded', data: { ...order, status: 'refunded' } }, true);
      await applySeasonOrder(prisma, { type: 'order.paid', data: order }, true);
      expect(account.hasPremiumPass).toBe(legacy);
      expect(tx.user.update).not.toHaveBeenCalled();
    }
  });
});
