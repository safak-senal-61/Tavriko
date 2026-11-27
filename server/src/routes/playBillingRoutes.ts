import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { db } from '../db/prismaClient';
import { requireUserAuth } from '../middleware/auth';
import { walletRateLimitOptions } from '../middleware/walletRateLimit';
import { timingSafeEqual } from 'node:crypto';
import { queuePushForNotification } from '../services/pushService';
import { clientIpAddress } from '../services/polarClient';
import {
  handlePlayRtdn, parseRtdnBody, playAccountId, playBillingConfig, playSchemaReady, PlayPurchaseRejected, syncVoidedPlayPurchases, verifyPlayPurchase,
} from '../services/googlePlayBilling';

const availabilityLimit = rateLimit({ ...walletRateLimitOptions, limit: 120 });
const verifyLimit = rateLimit({ ...walletRateLimitOptions, limit: 40 });

export const playBillingPlayerRoutes = Router();

/** Android uygulaması Play satın alma düğmelerini yalnızca bu uç `enabled: true` derse gösterir. */
playBillingPlayerRoutes.post('/shop/play/availability', availabilityLimit, async (_req, res) => {
  const config = playBillingConfig();
  const enabled = Boolean(config && await playSchemaReady(db.rawClient));
  res.set('Cache-Control', 'no-store').json({
    enabled, products: enabled ? [...config!.products.keys()] : [],
  });
});

/** Satın alma başlatmadan önce Play'e verilecek hesap kimliği (kullanıcı kimliğinin özeti). */
playBillingPlayerRoutes.get('/shop/play/account', availabilityLimit, requireUserAuth, (req, res) => {
  const userId = req.authUserId;
  if (!userId || /^(guest[_:]|bot_)/i.test(userId)) { res.status(401).json({ error: 'Satın alma için giriş yap.' }); return; }
  res.set('Cache-Control', 'no-store').json({ accountId: playAccountId(userId) });
});

playBillingPlayerRoutes.post('/shop/play/verify', verifyLimit, requireUserAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const config = playBillingConfig();
  if (!config || !await playSchemaReady(db.rawClient)) {
    res.status(503).json({ error: 'Google Play satın alması şu anda açık değil.' }); return;
  }
  const userId = req.authUserId;
  const { productId, purchaseToken } = req.body ?? {};
  if (!userId || /^(guest[_:]|bot_)/i.test(userId)) { res.status(401).json({ error: 'Satın alma için giriş yap.' }); return; }
  if (typeof productId !== 'string' || typeof purchaseToken !== 'string') {
    res.status(400).json({ error: 'Geçersiz satın alma.' }); return;
  }
  try {
    const result = await verifyPlayPurchase(db.rawClient, config, userId, productId, purchaseToken, fetch, {
      ip: clientIpAddress(req), notify: undefined,
    });
    res.status(result.status === 'pending' ? 202 : 200).json(result);
  } catch (error) {
    if (error instanceof PlayPurchaseRejected) { res.status(409).json({ error: error.message }); return; }
    res.status(502).json({ error: 'Satın alma şu anda doğrulanamadı. Tekrar dene.' });
  }
});

/** Vercel cron: Google Play iadelerini (voided purchases) uygular. CRON_SECRET ile korunur. */
export async function handlePlayVoidedCron(req: any, res: any) {
  const secret = process.env.CRON_SECRET || '';
  const header = (req.headers['authorization'] || '').toString();
  if (!secret || header !== `Bearer ${secret}`) { res.status(401).json({ success: false }); return; }
  const config = playBillingConfig();
  if (!config || !await playSchemaReady(db.rawClient)) { res.json({ success: true, skipped: true }); return; }
  try {
    res.json({ success: true, ...await syncVoidedPlayPurchases(db.rawClient, config, fetch, Date.now(), queuePushForNotification) });
  } catch {
    res.status(502).json({ success: false });
  }
}

function sameSecret(given: unknown, expected: string) {
  if (typeof given !== 'string' || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Google Play gerçek zamanlı geliştirici bildirimleri (Cloud Pub/Sub push).
 * Push URL'si: /api/webhooks/google-play?token=<PLAY_RTDN_TOKEN>
 * 2xx = mesaj işlendi (veya bizi ilgilendirmiyor); 5xx = Pub/Sub yeniden dener.
 */
export async function handlePlayRtdnWebhook(req: any, res: any) {
  res.set('Cache-Control', 'no-store');
  const config = playBillingConfig();
  if (!config || !config.rtdnToken || !sameSecret(req.query?.token, config.rtdnToken)) {
    res.status(401).json({ success: false }); return;
  }
  const notification = parseRtdnBody(req.body);
  if (!notification) { res.status(204).end(); return; }
  if (!await playSchemaReady(db.rawClient)) { res.status(503).json({ success: false }); return; }
  try {
    const outcome = await handlePlayRtdn(db.rawClient, config, notification, fetch, queuePushForNotification);
    res.json({ success: true, outcome });
  } catch {
    res.status(500).json({ success: false });
  }
}
