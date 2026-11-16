/**
 * Expo Push kayıt uçları (istemci mobil uygulama tarafından kullanılır).
 *
 *  POST /api/push/register   — cihaz token'ını oturum sahibi kullanıcıya bağlar
 *  POST /api/push/unregister — token'ı kaldırır (çıkış / bildirim kapatma)
 *  GET  /api/push/status     — kullanıcının kayıtlı cihaz sayısı
 *  POST /api/push/test       — kendine test push'u gönderir
 *
 * Kimlik her zaman doğrulanmış JWT'den gelir (requireUserAuth); token'lar
 * istemciye asla geri döndürülmez.
 */
import { Router, Request, Response } from 'express';
import { requireUserAuth } from '../middleware/auth';
import { db } from '../db/prismaClient';
import { sendPushToUser } from '../services/pushService';
import { logger } from '../utils/logger';

const router = Router();

const MAX_TOKEN_LENGTH = 512;

router.post('/register', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    const { token, platform } = req.body || {};
    if (!userId || typeof token !== 'string' || !token.trim() || token.length > MAX_TOKEN_LENGTH) {
      res.status(400).json({ error: 'Geçerli bir push token gereklidir.' });
      return;
    }
    const normalizedPlatform =
      platform === 'ios' || platform === 'android' || platform === 'web' ? platform : null;
    await db.savePushTokenAsync(userId, token.trim(), normalizedPlatform || undefined);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('SYSTEM', `Push token kaydı hatası: ${err?.message || err}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/unregister', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body || {};
    if (typeof token !== 'string' || !token.trim()) {
      res.status(400).json({ error: 'Geçerli bir push token gereklidir.' });
      return;
    }
    await db.removePushTokenAsync(token.trim());
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/status', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(400).json({ error: 'Oturum gerekli.' });
      return;
    }
    const tokens = await db.getPushTokensAsync(userId);
    res.json({ registered: tokens.length > 0, deviceCount: tokens.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/test', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(400).json({ error: 'Oturum gerekli.' });
      return;
    }
    const result = await sendPushToUser(userId, {
      title: 'Tavriko test bildirimi',
      body: 'Push bildirimleri bu cihazda çalışıyor.',
      data: { type: 'system', test: true },
    });
    if (result.sent === 0) {
      res.status(400).json({ success: false, error: 'Kayıtlı push cihazı bulunamadı veya gönderim başarısız.' });
      return;
    }
    res.json({ success: true, sent: result.sent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
