import { generateKeyPairSync } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  PLAY_PASS_PRODUCT_ID, PlayPurchaseRejected, playAccountId, playBillingConfig, resetPlayTokenCache,
  revokePlayPurchase, syncVoidedPlayPurchases, verifyPlayPurchase,
} from '../src/services/googlePlayBilling';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const account = { client_email: 'play@tavriko.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
const env = {
  PLAY_BILLING_ENABLED: 'true', GOOGLE_PLAY_PACKAGE_NAME: 'com.tavriko.app',
  GOOGLE_PLAY_SERVICE_ACCOUNT: Buffer.from(JSON.stringify(account)).toString('base64'),
};
const token = 'tok.' + 'a'.repeat(60);
const userId = 'user-1';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function fakeFetch(purchase: Record<string, unknown> | number) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    if (href.startsWith('https://oauth2.googleapis.com/token')) return jsonResponse({ access_token: 'ya29.test', expires_in: 3600 });
    if (href.endsWith(':consume') && init?.method === 'POST') return new Response(null, { status: 204 });
    if (typeof purchase === 'number') return new Response('{}', { status: purchase });
    return jsonResponse(purchase);
  });
}
function fakePrisma(options: { hasPremiumPass?: boolean; existing?: Record<string, unknown> | null } = {}) {
  const rows = new Map<string, any>();
  if (options.existing) rows.set(String(options.existing.purchaseToken), options.existing);
  const user = { gems: 0, hasPremiumPass: options.hasPremiumPass ?? false };
  const tx = {
    $queryRaw: vi.fn(async () => [{ hasPremiumPass: user.hasPremiumPass }]),
    playPurchase: {
      findUnique: vi.fn(async ({ where }: any) => rows.get(where.purchaseToken) ?? null),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: any) => { rows.set(data.purchaseToken, { status: 'granted', ...data }); return data; }),
      update: vi.fn(async ({ where, data }: any) => { Object.assign(rows.get(where.purchaseToken), data); }),
    },
    polarSeasonOrder: { findFirst: vi.fn(async () => null) },
    user: { update: vi.fn(async ({ data }: any) => {
      if (data.gems?.increment) user.gems += data.gems.increment;
      if (data.gems?.decrement) user.gems -= data.gems.decrement;
      if (typeof data.hasPremiumPass === 'boolean') user.hasPremiumPass = data.hasPremiumPass;
    }) },
  };
  const prisma = { ...tx, $transaction: vi.fn(async (fn: any) => fn(tx)) };
  return { prisma: prisma as unknown as PrismaClient, rows, user, tx };
}
const paid = (extra: Record<string, unknown> = {}) => ({
  purchaseState: 0, consumptionState: 0, orderId: 'GPA.1234-5678', quantity: 1,
  obfuscatedExternalAccountId: playAccountId(userId), ...extra,
});

describe('Google Play Billing', () => {
  beforeEach(() => resetPlayTokenCache());

  it('stays off without complete configuration and maps catalog products', () => {
    expect(playBillingConfig({})).toBeNull();
    expect(playBillingConfig({ ...env, GOOGLE_PLAY_SERVICE_ACCOUNT: 'nope' })).toBeNull();
    expect(playBillingConfig({ ...env, GOOGLE_PLAY_PACKAGE_NAME: 'bad name' })).toBeNull();
    const config = playBillingConfig(env)!;
    expect([...config.products.keys()]).toEqual(['gems_100', 'gems_300', 'gems_600', 'gems_1500', PLAY_PASS_PRODUCT_ID]);
    expect(config.products.get('gems_300')).toEqual({ kind: 'gems', gems: 330 });
    expect(config.allowTestPurchases).toBe(false);
  });

  it('grants gems once for a verified purchase and consumes the token', async () => {
    const config = playBillingConfig(env)!;
    const { prisma, user } = fakePrisma();
    const request = fakeFetch(paid());
    expect(await verifyPlayPurchase(prisma, config, userId, 'gems_100', token, request as any)).toEqual({ status: 'granted', gems: 100 });
    expect(user.gems).toBe(100);
    expect(request.mock.calls.some(([url, init]) => String(url).endsWith(':consume') && init?.method === 'POST')).toBe(true);
    expect(String(request.mock.calls[1][0])).toBe(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.tavriko.app/purchases/products/gems_100/tokens/${encodeURIComponent(token)}`);
    expect(await verifyPlayPurchase(prisma, config, userId, 'gems_100', token, request as any)).toEqual({ status: 'already_processed', gems: 100 });
    expect(user.gems).toBe(100);
  });

  it('rejects purchases for another account, unpaid, wrong quantity or test purchases', async () => {
    const config = playBillingConfig(env)!;
    for (const purchase of [
      paid({ obfuscatedExternalAccountId: playAccountId('someone-else') }), paid({ purchaseState: 1 }),
      paid({ quantity: 2 }), paid({ purchaseType: 0 }), paid({ purchaseType: 1 }), paid({ orderId: '' }),
    ]) {
      const { prisma, user } = fakePrisma();
      await expect(verifyPlayPurchase(prisma, config, userId, 'gems_100', token, fakeFetch(purchase) as any))
        .rejects.toBeInstanceOf(PlayPurchaseRejected);
      expect(user.gems).toBe(0);
    }
    const { prisma } = fakePrisma();
    await expect(verifyPlayPurchase(prisma, config, userId, 'gems_100', token, fakeFetch(404) as any)).rejects.toBeInstanceOf(PlayPurchaseRejected);
    await expect(verifyPlayPurchase(prisma, config, userId, 'gems_999', token, fakeFetch(paid()) as any)).rejects.toBeInstanceOf(PlayPurchaseRejected);
    await expect(verifyPlayPurchase(prisma, config, userId, 'gems_100', 'short', fakeFetch(paid()) as any)).rejects.toBeInstanceOf(PlayPurchaseRejected);
  });

  it('accepts license-tester purchases only when explicitly allowed', async () => {
    const config = playBillingConfig({ ...env, PLAY_BILLING_ALLOW_TEST_PURCHASES: 'true' })!;
    const { prisma, rows } = fakePrisma();
    expect((await verifyPlayPurchase(prisma, config, userId, 'gems_100', token, fakeFetch(paid({ purchaseType: 0 })) as any)).status).toBe('granted');
    expect(rows.get(token).test).toBe(true);
  });

  it('reports pending purchases without granting', async () => {
    const config = playBillingConfig(env)!;
    const { prisma, user } = fakePrisma();
    expect(await verifyPlayPurchase(prisma, config, userId, 'gems_100', token, fakeFetch(paid({ purchaseState: 2 })) as any)).toEqual({ status: 'pending' });
    expect(user.gems).toBe(0);
  });

  it('grants the pass, and leaves a duplicate pass unconsumed for automatic refund', async () => {
    const config = playBillingConfig(env)!;
    const fresh = fakePrisma();
    expect(await verifyPlayPurchase(fresh.prisma, config, userId, PLAY_PASS_PRODUCT_ID, token, fakeFetch(paid()) as any)).toEqual({ status: 'granted', pass: true });
    expect(fresh.user.hasPremiumPass).toBe(true);
    const owned = fakePrisma({ hasPremiumPass: true });
    const request = fakeFetch(paid());
    expect(await verifyPlayPurchase(owned.prisma, config, userId, PLAY_PASS_PRODUCT_ID, token, request as any)).toEqual({ status: 'pass_owned' });
    expect(owned.rows.size).toBe(0);
    expect(request.mock.calls.some(([url]) => String(url).endsWith(':consume'))).toBe(false);
  });

  it('refuses a token recorded for another user', async () => {
    const config = playBillingConfig(env)!;
    const { prisma } = fakePrisma({ existing: { purchaseToken: token, userId: 'other', productId: 'gems_100', kind: 'gems', gems: 100, status: 'granted' } });
    await expect(verifyPlayPurchase(prisma, config, userId, 'gems_100', token, fakeFetch(paid()) as any)).rejects.toBeInstanceOf(PlayPurchaseRejected);
  });

  it('revokes voided purchases once', async () => {
    const config = playBillingConfig(env)!;
    const { prisma, user, rows } = fakePrisma({ existing: { purchaseToken: token, userId, productId: 'gems_100', kind: 'gems', gems: 100, status: 'granted' } });
    user.gems = 30;
    const request = vi.fn(async (url: string | URL | Request) => String(url).startsWith('https://oauth2')
      ? jsonResponse({ access_token: 'ya29.test', expires_in: 3600 })
      : jsonResponse({ voidedPurchases: [{ purchaseToken: token, orderId: 'GPA.1234-5678' }, { purchaseToken: 'unknown-token-xxxxxxxxxxxx' }] }));
    expect(await syncVoidedPlayPurchases(prisma, config, request as any)).toEqual({ revoked: 1 });
    expect(user.gems).toBe(-70);
    expect(rows.get(token).status).toBe('voided');
    expect(await revokePlayPurchase(prisma, token)).toBe(false);
    expect(user.gems).toBe(-70);

    const pass = fakePrisma({ hasPremiumPass: true, existing: { purchaseToken: token, userId, productId: PLAY_PASS_PRODUCT_ID, kind: 'pass', gems: 0, status: 'granted' } });
    expect(await revokePlayPurchase(pass.prisma, token)).toBe(true);
    expect(pass.user.hasPremiumPass).toBe(false);
  });
});
