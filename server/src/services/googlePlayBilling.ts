import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { SHOP_CATALOG } from '@trivia/shared';
import type { PrismaClient } from '@prisma/client';
import type { NotificationItem } from '@trivia/shared';
import {
  blockMessage, clawbackPlan, consumptionMilliunits, isAbusiveVoid, playPurchaseBlock, purchaseNotification,
  refundPreference, voidNotification, voidReasonName, type PurchaseBlock,
} from './playChargebackPolicy';

/**
 * Google Play Billing (Android uygulama içi satın alma) doğrulaması.
 *
 * İstemci satın almayı Play üzerinden yapar ve yalnızca `purchaseToken` gönderir.
 * Sunucu Google Play Developer API'sinden satın almayı okur; bakiye ancak Google
 * "purchased" dediğinde, doğru paket/ürün ve aynı hesap için yazılır. Elmas ve
 * Premium Pass tüketilebilir (consumable) ürün olarak tanımlanır.
 */

export const PLAY_PASS_PRODUCT_ID = 'premium_pass';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const purchaseTokenPattern = /^[A-Za-z0-9._:-]{20,1024}$/;
const packageNamePattern = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

type PlayProduct = { kind: 'gems'; gems: number } | { kind: 'pass' };

export function playProducts(): Map<string, PlayProduct> {
  const products = new Map<string, PlayProduct>();
  for (const pack of SHOP_CATALOG) {
    if (pack.category === 'diamonds' && pack.currency === 'try' && pack.grantGems) {
      products.set(pack.id, { kind: 'gems', gems: pack.grantGems });
    }
  }
  products.set(PLAY_PASS_PRODUCT_ID, { kind: 'pass' });
  return products;
}

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };
function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  const text = raw?.trim();
  if (!text) return null;
  try {
    const json = text.startsWith('{') ? text : Buffer.from(text, 'base64').toString('utf8');
    const data = JSON.parse(json) as Partial<ServiceAccount>;
    if (typeof data.client_email !== 'string' || typeof data.private_key !== 'string' ||
        !data.private_key.includes('PRIVATE KEY')) return null;
    return { client_email: data.client_email, private_key: data.private_key };
  } catch { return null; }
}

export function playBillingConfig(env = process.env) {
  if (env.PLAY_BILLING_ENABLED !== 'true') return null;
  const packageName = env.GOOGLE_PLAY_PACKAGE_NAME?.trim() ?? '';
  const account = parseServiceAccount(env.GOOGLE_PLAY_SERVICE_ACCOUNT);
  if (!packageNamePattern.test(packageName) || !account) return null;
  return {
    packageName, account, products: playProducts(),
    // Lisans test hesaplarının ücretsiz test satın almaları yalnızca açıkça izin verilirse kabul edilir.
    allowTestPurchases: env.PLAY_BILLING_ALLOW_TEST_PURCHASES === 'true',
    // Test satın almalarının ters ibrazları normalde hesabı kilitlemez (test hesabı kilitlenmesin).
    countTestChargebacks: env.PLAY_CHARGEBACK_COUNT_TESTS === 'true',
    rtdnToken: env.PLAY_RTDN_TOKEN?.trim() || '',
  };
}
export type PlayConfig = NonNullable<ReturnType<typeof playBillingConfig>>;

/** Play'e `obfuscatedAccountId` olarak giden değer; kullanıcı kimliğini açık etmez. */
export function playAccountId(userId: string) {
  return createHash('sha256').update(`tavriko-play:${userId}`).digest('hex');
}

let cachedToken: { key: string; token: string; expires: number } | null = null;
export function resetPlayTokenCache() { cachedToken = null; }

async function accessToken(config: PlayConfig, request: typeof fetch) {
  const now = Date.now();
  if (cachedToken && cachedToken.key === config.account.client_email && cachedToken.expires > now + 60_000) {
    return cachedToken.token;
  }
  const iat = Math.floor(now / 1000);
  const assertion = jwt.sign(
    { iss: config.account.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 },
    config.account.private_key, { algorithm: 'RS256' },
  );
  const response = await request(TOKEN_URL, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(6000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
  });
  if (!response.ok) throw new Error('Google OAuth token request failed');
  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (typeof data.access_token !== 'string') throw new Error('Unexpected Google OAuth response');
  cachedToken = { key: config.account.client_email, token: data.access_token, expires: now + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

async function playRequest(config: PlayConfig, path: string, request: typeof fetch, method = 'GET', body?: unknown) {
  const token = await accessToken(config, request);
  const json = body === undefined ? undefined : JSON.stringify(body);
  return request(`${API}/${encodeURIComponent(config.packageName)}${path}`, {
    method, redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: {
      Authorization: `Bearer ${token}`,
      ...(json ? { 'Content-Type': 'application/json' } : method === 'POST' ? { 'Content-Length': '0' } : {}),
    },
    ...(json ? { body: json } : {}),
  });
}

/** Uygulama içi bildirim + (varsa) push. Hata satın alma akışını asla bozmaz. */
export type PlayNotifier = (userId: string, item: NotificationItem) => void;

async function saveNotification(
  prisma: PrismaClient, userId: string, id: string, content: { type: NotificationItem['type']; title: string; sub: string },
  notify?: PlayNotifier,
) {
  try {
    const exists = await prisma.userNotification.findUnique({ where: { id } });
    if (exists) return;
    const row = await prisma.userNotification.create({ data: { id, userId, ...content, timeText: 'Şimdi' } });
    notify?.(userId, { id, ...content, timeText: 'Şimdi', createdAt: row?.createdAt ? new Date(row.createdAt).getTime() : Date.now() });
  } catch {
    // Bildirim kaydı başarısız olsa da bakiye işlemi geçerlidir.
  }
}

async function purchaseRisk(tx: any, userId: string, balance: number, config: PlayConfig) {
  const abusiveVoids = await tx.playPurchase.count({ where: {
    userId, status: 'voided', voidReason: { in: ['chargeback', 'fraud', 'friendly_fraud'] },
    ...(config.countTestChargebacks ? {} : { test: false }),
  } });
  return playPurchaseBlock({ abusiveVoids, balance });
}

type ProductPurchase = {
  purchaseState?: number; consumptionState?: number; orderId?: string; purchaseType?: number;
  obfuscatedExternalAccountId?: string; quantity?: number; productId?: string;
};

export class PlayPurchaseRejected extends Error {}

export type VerifyResult =
  | { status: 'granted'; gems?: number; pass?: boolean }
  | { status: 'already_processed'; gems?: number; pass?: boolean }
  | { status: 'pending' }
  | { status: 'pass_owned' };

/**
 * Satın almayı Google'dan okur, doğrular ve bir kez uygular. Aynı token tekrar
 * gönderilirse bakiye yeniden yazılmaz. Başarıda token sunucu tarafında tüketilir.
 */
export async function verifyPlayPurchase(
  prisma: PrismaClient, config: PlayConfig, userId: string, productId: string, purchaseToken: string,
  request: typeof fetch = fetch, options: { ip?: string; notify?: PlayNotifier } = {},
): Promise<VerifyResult> {
  const product = config.products.get(productId);
  if (!product || !purchaseTokenPattern.test(purchaseToken)) throw new PlayPurchaseRejected('Geçersiz satın alma.');
  const path = `/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
  const response = await playRequest(config, path, request);
  if (response.status === 400 || response.status === 404 || response.status === 410) {
    throw new PlayPurchaseRejected('Satın alma Google Play tarafından doğrulanamadı.');
  }
  if (!response.ok) throw new Error('Google Play purchase lookup failed');
  const data = await response.json() as ProductPurchase;
  if (data.purchaseState === 2) return { status: 'pending' };
  const test = data.purchaseType === 0;
  if (data.purchaseState !== 0 || typeof data.orderId !== 'string' || !data.orderId ||
      data.obfuscatedExternalAccountId !== playAccountId(userId) ||
      (data.quantity != null && data.quantity !== 1) ||
      (data.purchaseType != null && data.purchaseType !== 0) ||
      (test && !config.allowTestPurchases)) {
    throw new PlayPurchaseRejected('Satın alma bu hesap için doğrulanamadı.');
  }

  const outcome = await prisma.$transaction(async tx => {
    const [user] = await tx.$queryRaw<{ hasPremiumPass: boolean; gems: number }[]>`
      SELECT "hasPremiumPass", "gems" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
    if (!user) throw new PlayPurchaseRejected('Lütfen tekrar giriş yap.');
    const existing = await tx.playPurchase.findUnique({ where: { purchaseToken } });
    if (existing) {
      if (existing.userId !== userId || existing.productId !== productId) {
        throw new PlayPurchaseRejected('Satın alma bu hesap için doğrulanamadı.');
      }
      if (existing.status === 'voided') throw new PlayPurchaseRejected('Bu satın alma iade edildi.');
      return { status: 'already_processed' as const, consume: data.consumptionState !== 1,
        gems: existing.gems || undefined, pass: existing.kind === 'pass' || undefined };
    }
    if (product.kind === 'pass' && user.hasPremiumPass) {
      // Tüketilmeyen ve onaylanmayan satın almayı Google 3 gün içinde otomatik iade eder.
      return { status: 'pass_owned' as const, consume: false };
    }
    // Kötüye kullanım koruması: tekrarlanan ters ibrazda veya ters ibraz borcu varken
    // satın alma verilmez. Tüketilmeyen satın almayı Google kısa süre içinde iade eder.
    const block = await purchaseRisk(tx, userId, Number(user.gems ?? 0), config);
    if (block) throw new PlayPurchaseRejected(blockMessage(block));
    const ip = options.ip && options.ip.length <= 64 ? options.ip : null;
    await tx.playPurchase.create({ data: {
      purchaseToken, orderId: data.orderId!, userId, productId, kind: product.kind,
      gems: product.kind === 'gems' ? product.gems : 0, test, purchaseIp: ip,
    } });
    if (product.kind === 'gems') {
      await tx.user.update({ where: { id: userId }, data: { gems: { increment: product.gems } } });
      return { status: 'granted' as const, consume: true, gems: product.gems };
    }
    await tx.user.update({ where: { id: userId }, data: { hasPremiumPass: true } });
    return { status: 'granted' as const, consume: true, pass: true };
  }, { timeout: 12_000 });

  if (outcome.consume) {
    // İstemci de tüketmeyi dener; burada başarısız olması bakiyeyi etkilemez.
    await playRequest(config, `${path}:consume`, request, 'POST')
      .then(async res => { if (res.ok) await prisma.playPurchase.update({ where: { purchaseToken }, data: { consumedAt: new Date() } }).catch(() => {}); })
      .catch(() => {});
  }
  if (outcome.status === 'granted') {
    const createdAt = new Date();
    await saveNotification(prisma, userId, `play_${data.orderId}`, purchaseNotification({
      kind: product.kind, gems: product.kind === 'gems' ? product.gems : 0, orderId: data.orderId!, test, createdAt,
    }), options.notify);
  }
  const { consume: _consume, ...result } = outcome;
  return result as VerifyResult;
}

type VoidedPurchase = { purchaseToken?: string; orderId?: string; voidedTimeMillis?: string; voidedReason?: number; voidedSource?: number };

/**
 * İade edilen / geri alınan Play satın almalarını okur ve verilen elmas veya Pass'i
 * geri alır. Polar iadeleriyle aynı kural: elmas bakiyesi negatife düşebilir.
 */
export async function syncVoidedPlayPurchases(
  prisma: PrismaClient, config: PlayConfig, request: typeof fetch = fetch, now = Date.now(), notify?: PlayNotifier,
) {
  const startTime = now - 30 * 24 * 60 * 60 * 1000; // Google en fazla 30 gün geriye izin verir.
  let pageToken: string | undefined;
  let revoked = 0;
  for (let page = 0; page < 20; page += 1) {
    const query = new URLSearchParams({ startTime: String(startTime), type: '0', maxResults: '1000' });
    if (pageToken) query.set('token', pageToken);
    const response = await playRequest(config, `/purchases/voidedpurchases?${query}`, request);
    if (!response.ok) throw new Error('Google Play voided purchases lookup failed');
    const data = await response.json() as { voidedPurchases?: VoidedPurchase[]; tokenPagination?: { nextPageToken?: string } };
    for (const voided of data.voidedPurchases ?? []) {
      if (typeof voided.purchaseToken !== 'string') continue;
      if (await revokePlayPurchase(prisma, voided.purchaseToken, {
        reason: voidReasonName(voided.voidedReason), source: 'voided_api', config, notify,
      })) revoked += 1;
    }
    pageToken = data.tokenPagination?.nextPageToken;
    if (!pageToken) break;
  }
  return { revoked };
}

export interface RevokeOptions {
  /** `voidReasonName` çıktısı; RTDN geri alma bildirimi neden içermez ('unknown'). */
  reason?: string;
  source?: 'rtdn' | 'voided_api' | 'admin';
  config?: PlayConfig;
  notify?: PlayNotifier;
}

/**
 * Geri alınan (iade / ters ibraz) satın almayı uygular: elmasların tamamı geri
 * alınır (bakiye yetmezse kalan kısım borç = negatif bakiye), Pass kaldırılır,
 * hesabın satın alma riski güncellenir ve oyuncuya bildirim gider. Tekrar
 * çağrılırsa ikinci kez düşmez; yalnızca daha kesin bir neden geldiyse kaydı günceller.
 */
export async function revokePlayPurchase(prisma: PrismaClient, purchaseToken: string, options: RevokeOptions = {}) {
  const reason = options.reason ?? 'unknown';
  const initial = await prisma.playPurchase.findUnique({ where: { purchaseToken } });
  if (!initial) return false;
  if (initial.status === 'voided') {
    if (reason !== 'unknown' && (initial as any).voidReason === 'unknown') {
      await prisma.playPurchase.update({ where: { purchaseToken }, data: { voidReason: reason } }).catch(() => {});
    }
    return false;
  }
  const result = await prisma.$transaction(async tx => {
    const [user] = await tx.$queryRaw<{ gems: number; hasPremiumPass: boolean }[]>`
      SELECT "gems", "hasPremiumPass" FROM "users" WHERE "id" = ${initial.userId} FOR UPDATE`;
    const row = await tx.playPurchase.findUnique({ where: { purchaseToken } });
    if (!row || row.status === 'voided') return null;
    // Daha önce bu sipariş için ters ibraz incelemesi geldiyse neden kesin olarak ters ibrazdır.
    const finalReason = reason === 'unknown' && (row as any).disputeToken ? 'chargeback' : reason;
    let plan = null as ReturnType<typeof clawbackPlan> | null;
    let passRevoked = false;
    let balance = Number(user?.gems ?? 0);
    if (row.kind === 'gems' && row.gems > 0) {
      plan = clawbackPlan(balance, row.gems);
      balance = plan.balanceAfter;
      await tx.user.update({ where: { id: row.userId }, data: { gems: { decrement: row.gems } } });
    } else if (row.kind === 'pass') {
      const otherPlay = await tx.playPurchase.findFirst({ where: { userId: row.userId, kind: 'pass', status: 'granted', NOT: { purchaseToken } } });
      const otherPolar = otherPlay ? null : await tx.polarSeasonOrder.findFirst({ where: { userId: row.userId, status: 'paid', granted: true } });
      if (!otherPlay && !otherPolar && user?.hasPremiumPass !== false) {
        await tx.user.update({ where: { id: row.userId }, data: { hasPremiumPass: false } });
        passRevoked = true;
      }
    }
    await tx.playPurchase.update({ where: { purchaseToken }, data: {
      status: 'voided', voidedAt: new Date(), voidReason: finalReason, voidSource: options.source ?? null,
      gemsClawedBack: plan?.removedNow ?? 0, gemsDebt: plan?.debt ?? 0, balanceAfterVoid: plan ? plan.balanceAfter : null,
    } });
    let block: PurchaseBlock = null;
    if (options.config) block = await purchaseRisk(tx, row.userId, balance, options.config);
    else if (isAbusiveVoid(finalReason) && balance < 0) block = 'debt';
    return { row, plan, passRevoked, block, reason: finalReason };
  });
  if (!result) return false;
  await saveNotification(prisma, result.row.userId, `play_void_${result.row.orderId}`, voidNotification(result.row, {
    reason: result.reason, plan: result.plan, passRevoked: result.passRevoked, block: result.block,
  }), options.notify);
  return true;
}

// ---- Gerçek zamanlı geliştirici bildirimleri (RTDN, Cloud Pub/Sub push) ----

type DeveloperNotification = {
  packageName?: string;
  eventTimeMillis?: string;
  voidedPurchaseNotification?: { purchaseToken?: string; orderId?: string; productType?: number; refundType?: number };
  pendingRefundReviewNotification?: {
    pendingRefundToken?: string; orderId?: string; refundReason?: number; obfuscatedAccountId?: string;
  };
  oneTimeProductNotification?: { notificationType?: number; purchaseToken?: string; sku?: string };
  testNotification?: unknown;
};

/** Pub/Sub push gövdesinden (message.data base64) Play bildirimini çıkarır. */
export function parseRtdnBody(body: unknown): DeveloperNotification | null {
  const data = (body as { message?: { data?: unknown } } | null)?.message?.data;
  if (typeof data !== 'string' || data.length > 64_000) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed as DeveloperNotification : null;
  } catch { return null; }
}

export type RtdnOutcome =
  | 'ignored' | 'test' | 'voided' | 'voided_unknown' | 'review_sent' | 'review_duplicate' | 'review_unknown_order';

/**
 * Bir RTDN mesajını işler. Geçici bir hata (Google API, veritabanı) fırlatılırsa
 * çağıran 5xx döner ve Pub/Sub mesajı yeniden gönderir.
 */
export async function handlePlayRtdn(
  prisma: PrismaClient, config: PlayConfig, notification: DeveloperNotification,
  request: typeof fetch = fetch, notify?: PlayNotifier,
): Promise<RtdnOutcome> {
  if (notification.packageName !== config.packageName) return 'ignored';
  if (notification.testNotification) return 'test';

  const voided = notification.voidedPurchaseNotification;
  if (voided) {
    if (voided.productType != null && voided.productType !== 2) return 'ignored';
    if (typeof voided.purchaseToken !== 'string') return 'ignored';
    const done = await revokePlayPurchase(prisma, voided.purchaseToken, { reason: 'unknown', source: 'rtdn', config, notify });
    return done ? 'voided' : 'voided_unknown';
  }

  const review = notification.pendingRefundReviewNotification;
  if (review) {
    if (typeof review.pendingRefundToken !== 'string' || typeof review.orderId !== 'string') return 'ignored';
    return reviewChargeback(prisma, config, review.pendingRefundToken, review.orderId, request);
  }
  return 'ignored';
}

/**
 * Ters ibraz incelemesi: 24 saat içinde `orders.reviewrefund` ile tercih ve
 * kullanım kanıtı gönderilir. Google yalnızca ilk yanıtı dikkate aldığından
 * her `pendingRefundToken` için tek kez çağrılır.
 */
export async function reviewChargeback(
  prisma: PrismaClient, config: PlayConfig, pendingRefundToken: string, orderId: string, request: typeof fetch = fetch,
): Promise<RtdnOutcome> {
  const row = await prisma.playPurchase.findUnique({ where: { orderId } }) as any;
  if (!row) {
    // Tanımadığımız sipariş: tarafsız yanıt (Google'ın kararını etkilemeyiz).
    await sendReviewRefund(config, orderId, { pendingRefundToken, sampleContentProvided: true, refundPreference: 'NEUTRAL' }, request);
    return 'review_unknown_order';
  }
  if (row.disputeToken === pendingRefundToken && row.disputeReviewedAt) return 'review_duplicate';
  const [user] = await prisma.$queryRaw<{ gems: number; hasPremiumPass: boolean }[]>`
    SELECT "gems", "hasPremiumPass" FROM "users" WHERE "id" = ${row.userId}`;
  const consumption = row.status === 'voided' ? 0
    : consumptionMilliunits(row.kind, row.gems, Number(user?.gems ?? 0), Boolean(user?.hasPremiumPass));
  const preference = refundPreference(consumption);
  await prisma.playPurchase.update({ where: { orderId }, data: {
    disputeToken: pendingRefundToken, disputeAt: new Date(), disputePreference: preference,
  } });
  await sendReviewRefund(config, orderId, {
    pendingRefundToken,
    // Tavriko ücretsiz oynanır; oyuncu satın almadan önce tüm oyunu deneyebilir.
    sampleContentProvided: true,
    refundPreference: preference,
    consumptionPercentageMilliunits: consumption,
    consumptionUsageEvents: [{
      obfuscatedAccountId: playAccountId(row.userId),
      consumptionTime: new Date(row.createdAt).toISOString(),
      ...(row.purchaseIp ? { ipAddress: row.purchaseIp } : {}),
      consumptionItemDescription: row.kind === 'pass'
        ? 'Sezon Premium Pass oyuncu hesabına anında teslim edildi.'
        : `${row.gems} elmas oyuncu hesabına anında teslim edildi; teslimden sonra harcanan oran %${(consumption / 1000).toFixed(1)}.`,
    }],
  }, request);
  await prisma.playPurchase.update({ where: { orderId }, data: { disputeReviewedAt: new Date() } });
  return 'review_sent';
}

async function sendReviewRefund(config: PlayConfig, orderId: string, body: Record<string, unknown>, request: typeof fetch) {
  const response = await playRequest(config, `/orders/${encodeURIComponent(orderId)}:reviewrefund`, request, 'POST', body);
  // 4xx: süre dolmuş / geçersiz token — yeniden denemek işe yaramaz.
  if (response.status >= 500 || response.status === 429) throw new Error('Google Play reviewrefund failed');
}

const schemaChecks = new WeakMap<PrismaClient, { expires: number; result: Promise<boolean> }>();
export function playSchemaReady(prisma: PrismaClient) {
  const now = Date.now();
  const cached = schemaChecks.get(prisma);
  if (cached && cached.expires > now) return cached.result;
  const result = prisma.$queryRaw<{ ready: boolean }[]>`
    SELECT pg_catalog.to_regclass('public.play_purchases') IS NOT NULL AS ready
  `.then(rows => rows[0]?.ready === true, () => false);
  schemaChecks.set(prisma, { expires: now + 30_000, result });
  return result;
}
