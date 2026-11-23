import express, { Router } from 'express';
import { db } from '../db/prismaClient';
import { requireUserAuth } from '../middleware/auth';
import { applyGemOrder, createGemCheckout, polarGemConfig, verifyPolarGemSignature } from '../services/polarGemPayments';
import { checkoutIdPattern } from '../services/polarSandbox';

export const polarGemPlayerRoutes = Router();
polarGemPlayerRoutes.post('/shop/diamonds/availability', (req, res) => {
  const config = polarGemConfig();
  res.set('Cache-Control', 'no-store').json({
    enabled: Boolean(config && req.get('origin') === config.origin),
    sandbox: Boolean(config?.sandbox),
  });
});

polarGemPlayerRoutes.post('/shop/diamonds/checkout', requireUserAuth, async (req, res) => {
  const config = polarGemConfig();
  const userId = req.authUserId;
  const packId = req.body?.productId;
  if (!config || req.get('origin') !== config.origin) {
    res.status(503).json({ error: 'Elmas ödemesi şu anda açık değil.' }); return;
  }
  if (!userId || userId.startsWith('guest_') || typeof packId !== 'string' || !config.products.has(packId)) {
    res.status(400).json({ error: 'Elmas paketi ve giriş yapılmış bir hesap gerekli.' }); return;
  }
  try {
    const prisma = db.rawClient;
    const account = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!account) { res.status(401).json({ error: 'Lütfen tekrar giriş yap.' }); return; }
    const recent = await prisma.polarGemOrder.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 60_000) } } });
    if (recent >= 4) { res.status(429).json({ error: 'Yeni ödeme açmak için biraz bekle.' }); return; }
    const checkout = await createGemCheckout(config, packId, userId);
    if (!checkout) { res.status(400).json({ error: 'Paket bulunamadı.' }); return; }
    await prisma.polarGemOrder.create({ data: checkout.row });
    res.json({ url: checkout.url });
  } catch {
    res.status(502).json({ error: 'Ödeme sayfası açılamadı. Lütfen tekrar dene.' });
  }
});

polarGemPlayerRoutes.get('/shop/diamonds/checkout/:id', requireUserAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const id = req.params.id;
  if (!req.authUserId || typeof id !== 'string' || !checkoutIdPattern.test(id)) { res.sendStatus(404); return; }
  try {
    const row = await db.rawClient.polarGemOrder.findFirst({
      where: { checkoutId: id, userId: req.authUserId }, select: { status: true },
    });
    if (!row) { res.sendStatus(404); return; }
    res.json(row);
  } catch { res.sendStatus(503); }
});

export const polarGemWebhook = Router();
polarGemWebhook.post('/', express.raw({ type: 'application/json', limit: '128kb' }), async (req, res) => {
  const config = polarGemConfig();
  if (!config) { res.sendStatus(503); return; }
  if (!Buffer.isBuffer(req.body) || !verifyPolarGemSignature(req.body, name => req.get(name), config.secret)) {
    res.sendStatus(401); return;
  }
  let event: unknown;
  try { event = JSON.parse(req.body.toString('utf8')); } catch { res.sendStatus(400); return; }
  try {
    await applyGemOrder(db.rawClient, event);
    res.sendStatus(204);
  } catch {
    res.sendStatus(503); // Polar retries failed deliveries.
  }
});
