import { createHmac, randomUUID } from 'node:crypto';
import { JOKERS, SHOP_CATALOG, EVENT_DEFINITIONS, SEASON_1_TIERS, plainDisplayText } from '@trivia/shared';
import { describe, expect, it, vi } from 'vitest';
import { createGemCheckout, polarGemConfig, verifyPolarGemSignature } from '../src/services/polarGemPayments';
import { walletSchemaReady } from '../src/services/walletSchema';
import type { PrismaClient } from '@prisma/client';

const products = { POLAR_GEMS_PRODUCT_100: randomUUID(), POLAR_GEMS_PRODUCT_300: randomUUID(),
  POLAR_GEMS_PRODUCT_600: randomUUID(), POLAR_GEMS_PRODUCT_1500: randomUUID() };
const env = { ...products, POLAR_GEMS_ENABLED: 'true', POLAR_GEMS_SANDBOX: 'true',
  POLAR_GEMS_APP_ORIGIN: 'https://app.example.test', POLAR_GEMS_ACCESS_TOKEN: 'fake-token', POLAR_GEMS_WEBHOOK_SECRET: 'test-webhook' };

describe('paid diamonds and joker economy', () => {
  it('keeps availability off without both tables or a working database', async () => {
    const missing = { $queryRaw: vi.fn().mockResolvedValue([{ ready: false }]) };
    const unavailable = { $queryRaw: vi.fn().mockRejectedValue(new Error('offline')) };
    const migrated = { $queryRaw: vi.fn().mockResolvedValue([{ ready: true }]) };
    expect(await walletSchemaReady(missing as unknown as PrismaClient)).toBe(false);
    expect(await walletSchemaReady(unavailable as unknown as PrismaClient)).toBe(false);
    expect(await walletSchemaReady(migrated as unknown as PrismaClient)).toBe(true);
    expect(await walletSchemaReady(migrated as unknown as PrismaClient)).toBe(true);
    expect(migrated.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('leaves checkout off without configuration and keeps packs separated', () => {
    expect(polarGemConfig({})).toBeNull();
    expect(polarGemConfig({ ...env, POLAR_GEMS_PRODUCT_300: products.POLAR_GEMS_PRODUCT_100 })).toBeNull();
    expect(polarGemConfig(env)?.products.size).toBe(4);
    expect(SHOP_CATALOG.filter(pack => pack.grantGems).every(pack =>
      pack.currency === 'try' && pack.category === 'diamonds' && !pack.grantItems?.length)).toBe(true);
    expect(SHOP_CATALOG.filter(pack => pack.category === 'jokers').map(pack => [pack.id, pack.currency, pack.price]))
      .toEqual(JOKERS.map(joker => [joker.id, 'coins', joker.price]));
    expect(EVENT_DEFINITIONS.every(event => event.rewardGems === 0)).toBe(true);
    expect(SEASON_1_TIERS.every(t => t.freeReward.type !== 'gem' && !['gem', 'chest', 'key'].includes(t.premiumReward.type))).toBe(true);
  });

  it('accepts a fresh signature over the original payload only', () => {
    const time = 1_800_000_000;
    const raw = Buffer.from('{"type":"order.paid"}');
    const headers: Record<string, string> = { 'webhook-id': 'evt_1', 'webhook-timestamp': String(time) };
    headers['webhook-signature'] = `v1,${createHmac('sha256', env.POLAR_GEMS_WEBHOOK_SECRET).update(`evt_1.${time}.`).update(raw).digest('base64')}`;
    const header = (name: string) => headers[name];
    expect(verifyPolarGemSignature(raw, header, env.POLAR_GEMS_WEBHOOK_SECRET, time * 1000)).toBe(true);
    expect(verifyPolarGemSignature(Buffer.from('{"type":"order.refunded"}'), header, env.POLAR_GEMS_WEBHOOK_SECRET, time * 1000)).toBe(false);
    expect(verifyPolarGemSignature(raw, header, env.POLAR_GEMS_WEBHOOK_SECRET, (time + 301) * 1000)).toBe(false);
  });

  it('returns only a checkout with the expected provider, product, currency and amount', async () => {
    const config = polarGemConfig(env)!;
    const id = randomUUID();
    const order = { id, url: `https://sandbox.polar.sh/checkout/${id}`, status: 'open',
      product_id: products.POLAR_GEMS_PRODUCT_100, amount: 3999, currency: 'try' };
    const reply = (data: object) => vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(data)));
    const ok = reply(order);
    expect(await createGemCheckout(config, 'gems_100', 'abc', ok)).toMatchObject({ row: { checkoutId: id, userId: 'abc', amount: 3999, gems: 100 } });
    expect(JSON.parse(String(ok.mock.calls[0][1]?.body))).toMatchObject({ external_customer_id: 'abc', products: [order.product_id], currency: 'try' });
    for (const modified of [{ amount: 1 }, { product_id: randomUUID() }, { currency: 'usd' }, { url: 'https://example.test/checkout/abc' }]) {
      await expect(createGemCheckout(config, 'gems_100', 'abc', reply({ ...order, ...modified }))).rejects.toThrow('Unexpected Polar');
    }
    expect(await createGemCheckout(config, 'joker_half', 'abc', reply(order))).toBeNull();
  });

  it('removes legacy pictograms without removing ordinary names, digits or punctuation', () => {
    const legacy = '\u{1F451} Tavriko \u{1F1F9}\u{1F1F7} #28 • 1\uFE0F\u20E3';
    expect(plainDisplayText(legacy)).toBe('Tavriko #28 •');
  });
});
