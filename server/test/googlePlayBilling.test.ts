import { generateKeyPairSync } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  PLAY_PASS_PRODUCT_ID, PlayPurchaseRejected, playAccountId, playBillingConfig, resetPlayTokenCache,
  handlePlayRtdn, parseRtdnBody, revokePlayPurchase, syncVoidedPlayPurchases, verifyPlayPurchase,
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
  const notifications = new Map<string, any>();
  const find = (where: any) => where.purchaseToken ? rows.get(where.purchaseToken)
    : [...rows.values()].find(row => row.orderId === where.orderId);
  const tx = {
    $queryRaw: vi.fn(async () => [{ hasPremiumPass: user.hasPremiumPass, gems: user.gems }]),
    playPurchase: {
      findUnique: vi.fn(async ({ where }: any) => find(where) ?? null),
      findFirst: vi.fn(async () => null),
      count: vi.fn(async ({ where }: any) => [...rows.values()].filter(row => row.userId === where.userId &&
        row.status === where.status && where.voidReason.in.includes(row.voidReason) &&
        (where.test === undefined || row.test === where.test)).length),
      create: vi.fn(async ({ data }: any) => { rows.set(data.purchaseToken, { status: 'granted', createdAt: new Date('2026-11-27T11:32:00Z'), ...data }); return data; }),
      update: vi.fn(async ({ where, data }: any) => { Object.assign(find(where), data); }),
    },
    userNotification: {
      findUnique: vi.fn(async ({ where }: any) => notifications.get(where.id) ?? null),
      create: vi.fn(async ({ data }: any) => { const row = { ...data, createdAt: new Date() }; notifications.set(data.id, row); return row; }),
    },
    polarSeasonOrder: { findFirst: vi.fn(async () => null) },
    user: { update: vi.fn(async ({ data }: any) => {
      if (data.gems?.increment) user.gems += data.gems.increment;
      if (data.gems?.decrement) user.gems -= data.gems.decrement;
      if (typeof data.hasPremiumPass === 'boolean') user.hasPremiumPass = data.hasPremiumPass;
    }) },
  };
  const prisma = { ...tx, $transaction: vi.fn(async (fn: any) => fn(tx)) };
  return { prisma: prisma as unknown as PrismaClient, rows, user, tx, notifications };
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
    expect(rows.get(token)).toMatchObject({ gemsClawedBack: 30, gemsDebt: 70, balanceAfterVoid: -70, voidSource: 'voided_api' });
    expect(await revokePlayPurchase(prisma, token)).toBe(false);
    expect(user.gems).toBe(-70);

    const pass = fakePrisma({ hasPremiumPass: true, existing: { purchaseToken: token, userId, productId: PLAY_PASS_PRODUCT_ID, kind: 'pass', gems: 0, status: 'granted' } });
    expect(await revokePlayPurchase(pass.prisma, token)).toBe(true);
    expect(pass.user.hasPremiumPass).toBe(false);
  });

  it('writes an in-app purchase notification with product, time and order id', async () => {
    const config = playBillingConfig({ ...env, PLAY_BILLING_ALLOW_TEST_PURCHASES: 'true' })!;
    const { prisma, notifications } = fakePrisma();
    const notify = vi.fn();
    await verifyPlayPurchase(prisma, config, userId, 'gems_100', token, fakeFetch(paid({ purchaseType: 0 })) as any, { ip: '203.0.113.9', notify });
    const item = notifications.get('play_GPA.1234-5678');
    expect(item.type).toBe('reward');
    expect(item.title).toBe('Satın alma tamamlandı');
    expect(item.sub).toMatch(/100 Elmas hesabına eklendi\. Ürün: 100 Elmas · Tarih: \d\d\.\d\d\.\d{4} \d\d:\d\d · Sipariş: GPA\.1234-5678 · Test satın alması/);
    expect(notify).toHaveBeenCalledOnce();
  });

  describe('ters ibraz senaryoları (100 elmas satın alındı)', () => {
    const granted = { purchaseToken: token, orderId: 'GPA.1', userId, productId: 'gems_100', kind: 'gems', gems: 100,
      status: 'granted', test: false, createdAt: new Date('2026-11-27T11:32:00Z') };
    for (const [balance, removed, debt] of [[100, 100, 0], [70, 70, 30], [0, 0, 100]] as const) {
      it(`bakiye ${balance}: ${removed} düşülür, ${debt} borç kalır`, async () => {
        const config = playBillingConfig(env)!;
        const { prisma, user, rows, notifications } = fakePrisma({ existing: { ...granted } });
        user.gems = balance;
        expect(await revokePlayPurchase(prisma, token, { reason: 'chargeback', source: 'rtdn', config })).toBe(true);
        expect(user.gems).toBe(balance - 100);
        expect(rows.get(token)).toMatchObject({ status: 'voided', voidReason: 'chargeback', gemsClawedBack: removed, gemsDebt: debt });
        const note = notifications.get('play_void_GPA.1');
        expect(note.title).toBe('Ödeme itirazı: satın alma geri alındı');
        expect(note.sub).toContain(`Bakiyenden ${removed} elmas düşüldü`);
        if (debt) expect(note.sub).toContain(`${debt} elmas borç olarak kaldı`);
        if (debt) expect(note.sub).toContain('Borç kapanana kadar yeni Google Play satın alması yapılamaz');
      });
    }

    it('borç varken ve tekrarlanan ters ibrazda yeni satın almayı reddeder', async () => {
      const config = playBillingConfig(env)!;
      const voided = { ...granted, status: 'voided', voidReason: 'chargeback' };
      const debtor = fakePrisma({ existing: voided });
      debtor.user.gems = -30;
      const other = 'tok.' + 'b'.repeat(60);
      await expect(verifyPlayPurchase(debtor.prisma, config, userId, 'gems_100', other, fakeFetch(paid({ orderId: 'GPA.2' })) as any))
        .rejects.toThrow(/borcun kapanana kadar/);
      expect(debtor.user.gems).toBe(-30);
      // Borç kapandıysa tek ters ibraz satın almayı engellemez.
      debtor.user.gems = 5;
      expect((await verifyPlayPurchase(debtor.prisma, config, userId, 'gems_100', other, fakeFetch(paid({ orderId: 'GPA.2' })) as any)).status).toBe('granted');
      debtor.rows.get(other).status = 'voided';
      debtor.rows.get(other).voidReason = 'fraud';
      const third = 'tok.' + 'c'.repeat(60);
      await expect(verifyPlayPurchase(debtor.prisma, config, userId, 'gems_100', third, fakeFetch(paid({ orderId: 'GPA.3' })) as any))
        .rejects.toThrow(/Tekrarlanan ödeme itirazları/);
    });

    it('normal iade (remorse) hesabı kilitlemez; test ters ibrazları varsayılan olarak sayılmaz', async () => {
      const config = playBillingConfig({ ...env, PLAY_BILLING_ALLOW_TEST_PURCHASES: 'true' })!;
      const refund = fakePrisma({ existing: { ...granted, status: 'voided', voidReason: 'remorse' } });
      refund.user.gems = -100;
      const other = 'tok.' + 'd'.repeat(60);
      expect((await verifyPlayPurchase(refund.prisma, config, userId, 'gems_100', other, fakeFetch(paid({ orderId: 'GPA.4' })) as any)).status).toBe('granted');
      const tester = fakePrisma({ existing: { ...granted, test: true, status: 'voided', voidReason: 'chargeback' } });
      tester.user.gems = -100;
      expect((await verifyPlayPurchase(tester.prisma, config, userId, 'gems_100', other, fakeFetch(paid({ orderId: 'GPA.5', purchaseType: 0 })) as any)).status).toBe('granted');
      const strict = playBillingConfig({ ...env, PLAY_BILLING_ALLOW_TEST_PURCHASES: 'true', PLAY_CHARGEBACK_COUNT_TESTS: 'true' })!;
      const tester2 = fakePrisma({ existing: { ...granted, test: true, status: 'voided', voidReason: 'chargeback' } });
      tester2.user.gems = -100;
      await expect(verifyPlayPurchase(tester2.prisma, strict, userId, 'gems_100', other, fakeFetch(paid({ orderId: 'GPA.6', purchaseType: 0 })) as any))
        .rejects.toBeInstanceOf(PlayPurchaseRejected);
    });
  });

  describe('RTDN', () => {
    const encode = (payload: unknown) => ({ message: { data: Buffer.from(JSON.stringify(payload)).toString('base64') } });
    const granted = { purchaseToken: token, orderId: 'GPA.9', userId, productId: 'gems_100', kind: 'gems', gems: 100,
      status: 'granted', test: true, createdAt: new Date('2026-11-27T11:32:00Z'), purchaseIp: '203.0.113.9' };

    it('parses Pub/Sub push bodies', () => {
      expect(parseRtdnBody(encode({ packageName: 'com.tavriko.app' }))).toEqual({ packageName: 'com.tavriko.app' });
      expect(parseRtdnBody({ message: { data: '%%%' } })).toBeNull();
      expect(parseRtdnBody(null)).toBeNull();
    });

    it('ignores other packages and test notifications', async () => {
      const config = playBillingConfig(env)!;
      const { prisma } = fakePrisma();
      expect(await handlePlayRtdn(prisma, config, { packageName: 'com.other' })).toBe('ignored');
      expect(await handlePlayRtdn(prisma, config, { packageName: 'com.tavriko.app', testNotification: {} })).toBe('test');
    });

    it('answers a chargeback review once with consumption evidence, then claws back on void', async () => {
      const config = playBillingConfig(env)!;
      const { prisma, user, rows, notifications } = fakePrisma({ existing: { ...granted } });
      user.gems = 70; // 30 elmas harcandı
      const bodies: any[] = [];
      const request = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        if (String(url).startsWith('https://oauth2')) return jsonResponse({ access_token: 'ya29.test', expires_in: 3600 });
        if (String(url).endsWith(':reviewrefund')) bodies.push({ url: String(url), body: JSON.parse(String(init?.body)) });
        return new Response(null, { status: 200 });
      });
      const review = { packageName: 'com.tavriko.app', pendingRefundReviewNotification: { pendingRefundToken: 'prt-1', orderId: 'GPA.9', refundReason: 7 } };
      expect(await handlePlayRtdn(prisma, config, review, request as any)).toBe('review_sent');
      expect(bodies).toHaveLength(1);
      expect(bodies[0].url).toBe('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.tavriko.app/orders/GPA.9:reviewrefund');
      expect(bodies[0].body).toMatchObject({
        pendingRefundToken: 'prt-1', sampleContentProvided: true, refundPreference: 'DECLINE', consumptionPercentageMilliunits: 30_000,
      });
      expect(bodies[0].body.consumptionUsageEvents[0]).toMatchObject({ obfuscatedAccountId: playAccountId(userId), ipAddress: '203.0.113.9' });
      expect(await handlePlayRtdn(prisma, config, review, request as any)).toBe('review_duplicate');
      expect(bodies).toHaveLength(1);

      const voided = { packageName: 'com.tavriko.app', voidedPurchaseNotification: { purchaseToken: token, orderId: 'GPA.9', productType: 2, refundType: 1 } };
      expect(await handlePlayRtdn(prisma, config, voided, request as any)).toBe('voided');
      expect(user.gems).toBe(-30);
      expect(rows.get(token)).toMatchObject({ voidReason: 'chargeback', voidSource: 'rtdn', gemsClawedBack: 70, gemsDebt: 30 });
      expect(notifications.get('play_void_GPA.9').sub).toContain('30 elmas borç olarak kaldı');
      expect(await handlePlayRtdn(prisma, config, voided, request as any)).toBe('voided_unknown');
      expect(user.gems).toBe(-30);
    });

    it('stays neutral when nothing was used and retries on Google 5xx', async () => {
      const config = playBillingConfig(env)!;
      const { prisma, user } = fakePrisma({ existing: { ...granted } });
      user.gems = 100;
      let body: any;
      const ok = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        if (String(url).startsWith('https://oauth2')) return jsonResponse({ access_token: 'ya29.test', expires_in: 3600 });
        body = JSON.parse(String(init?.body));
        return new Response(null, { status: 200 });
      });
      const review = { packageName: 'com.tavriko.app', pendingRefundReviewNotification: { pendingRefundToken: 'prt-2', orderId: 'GPA.9' } };
      expect(await handlePlayRtdn(prisma, config, review, ok as any)).toBe('review_sent');
      expect(body).toMatchObject({ refundPreference: 'NEUTRAL', consumptionPercentageMilliunits: 0 });

      const fresh = fakePrisma({ existing: { ...granted } });
      const failing = vi.fn(async (url: string | URL | Request) => String(url).startsWith('https://oauth2')
        ? jsonResponse({ access_token: 'ya29.test', expires_in: 3600 }) : new Response('{}', { status: 503 }));
      await expect(handlePlayRtdn(fresh.prisma, config, { ...review, pendingRefundReviewNotification: { pendingRefundToken: 'prt-3', orderId: 'GPA.9' } }, failing as any))
        .rejects.toThrow();
    });
  });
});
