import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db/prismaClient';
import { ReferralError, ReferralService } from '../services/referralService';
import { presenceManager } from '../services/presenceManager';

const router = Router();
const service = new ReferralService(db.rawClient);
const signedIn = (req: Request, res: Response, next: NextFunction) => {
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  const session = bearer ? db.verifyToken(bearer) : null;
  if (!session?.userId || session.userId.startsWith('guest_')) {
    res.status(401).json({ error: 'Davet için hesabına giriş yap.' }); return;
  }
  res.locals.userId = session.userId;
  next();
};
const fail = (res: Response, error: unknown) => {
  if (!(error instanceof ReferralError)) console.error('[Referral] Database operation failed');
  res.status(error instanceof ReferralError ? error.status : 503).json({
    error: error instanceof ReferralError ? error.message : 'Davet servisine ulaşılamadı. Tekrar dene.',
  });
};
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
router.get('/me', signedIn, async (_req, res) => {
  try { res.json(await service.personalLink(res.locals.userId)); } catch (e) { fail(res, e); }
});
router.get('/preview/:token', async (req, res) => {
  try { res.json(await service.preview(String(req.params.token))); } catch (e) { fail(res, e); }
});
router.post('/confirm', signedIn, async (req, res) => {
  try {
    const result = await service.confirm(res.locals.userId, req.body.token);
    // Refresh legacy in-process caches only AFTER the transaction commits.
    await Promise.allSettled([
      db.getUserProfileAsync(res.locals.userId), db.getUserProfileAsync(result.inviterId),
    ]);
    presenceManager.notifyUser(result.inviterId, 'friends:update', { friendId: res.locals.userId });
    presenceManager.notifyUser(res.locals.userId, 'friends:update', { friendId: result.inviterId });
    if (result.notification) presenceManager.notifyUser(result.inviterId, 'notification:new', result.notification);
    const { notification, ...safeResult } = result;
    res.json(safeResult);
  } catch (e) { fail(res, e); }
});
export default router;
