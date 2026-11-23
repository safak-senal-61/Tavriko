import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { db } from '../db/prismaClient';
import { requireUserAuth } from '../middleware/auth';
import { walletRateLimitOptions } from '../middleware/walletRateLimit';
import { verifyPolarGemSignature } from '../services/polarGemPayments';
import { checkoutIdPattern } from '../services/polarSandbox';
import { applySeasonOrder, polarSeasonConfig, SeasonCheckoutConflict, startSeasonCheckout } from '../services/polarSeasonPayments';

const available = rateLimit({ ...walletRateLimitOptions, limit: 120 });
const start = rateLimit({ ...walletRateLimitOptions, limit: 12 });
const webhookLimit = rateLimit({ ...walletRateLimitOptions, limit: 600 });
const seasonSchemaReady = () => db.rawClient.$queryRaw<{ ready: boolean }[]>`
  SELECT pg_catalog.to_regclass('public.polar_season_orders') IS NOT NULL AS ready
`.then(rows => rows[0]?.ready === true, () => false);

export const polarSeasonPlayerRoutes = Router();
polarSeasonPlayerRoutes.post('/season/checkout/availability', available, async (req, res) => {
  const config = polarSeasonConfig();
  const enabled = !!config && req.get('origin') === config.origin && await seasonSchemaReady();
  res.set('Cache-Control', 'no-store').json({
    enabled, sandbox: enabled && config.sandbox, amount: enabled ? config.amount : undefined,
  });
});
polarSeasonPlayerRoutes.post('/season/checkout', start, requireUserAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const config = polarSeasonConfig();
  if (!config || req.get('origin') !== config.origin || !await seasonSchemaReady()) {
    res.status(503).json({ error: 'Premium Pass ödemesi şu anda açık değil.' }); return;
  }
  const userId = req.authUserId;
  if (!userId || /^(guest[_:]|bot_)/i.test(userId)) {
    res.status(401).json({ error: 'Premium Pass almak için giriş yap.' }); return;
  }
  try {
    res.json({ url: await startSeasonCheckout(db.rawClient, config, userId) });
  } catch (error) {
    const conflict = error instanceof SeasonCheckoutConflict;
    res.status(conflict ? 409 : 502).json({ error: conflict ? error.message : 'Polar ödeme sayfası açılamadı. Tekrar dene.' });
  }
});
polarSeasonPlayerRoutes.get('/season/checkout/:id', available, requireUserAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const id = req.params.id;
  if (!req.authUserId || typeof id !== 'string' || !checkoutIdPattern.test(id)) { res.sendStatus(404); return; }
  try {
    const row = await db.rawClient.polarSeasonOrder.findFirst({
      where: { checkoutId: id, userId: req.authUserId }, select: { status: true },
    });
    if (!row) { res.sendStatus(404); return; }
    res.json(row);
  } catch { res.sendStatus(503); }
});

export const polarSeasonWebhook = Router();
polarSeasonWebhook.post('/', webhookLimit, express.raw({ type: 'application/json', limit: '128kb' }), async (req, res) => {
  // Keep settling completed orders and refunds when new sales are paused.
  const secret = process.env.POLAR_SEASON_WEBHOOK_SECRET?.trim();
  const sandbox = process.env.POLAR_SEASON_SANDBOX === 'true';
  if (!secret || (sandbox && process.env.VERCEL_ENV === 'production')) { res.sendStatus(503); return; }
  if (!Buffer.isBuffer(req.body) || !verifyPolarGemSignature(req.body, name => req.get(name), secret)) {
    res.sendStatus(401); return;
  }
  let event: unknown;
  try { event = JSON.parse(req.body.toString('utf8')); } catch { res.sendStatus(400); return; }
  try {
    await applySeasonOrder(db.rawClient, event, sandbox);
    res.sendStatus(204);
  } catch { res.sendStatus(503); }
});
