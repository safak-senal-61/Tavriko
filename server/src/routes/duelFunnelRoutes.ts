import { Router } from 'express';
import { requireUserAuth, getInternalSecret } from '../middleware/auth';
import { safeEqualStrings } from '../telegram/telegramBot';
import { db } from '../db/prismaClient';
import { isGuestIdentity, validPlayerId } from '../services/playerAccess';
import { changeDuelConsent, duelCoverageStart, readDuelConsent, recordDuelMilestone } from '../services/duelFunnel';
import { uuidPattern } from '../services/adminAccountOperations';

export function createDuelFunnelRouter(client = db.rawClient) {
  const router = Router();
  const path = '/api/player/duel-funnel';
  router.use([path, '/api/internal/duel-funnel/matched'], (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get(path, requireUserAuth, async (req, res) => {
    if (!req.authUserId || isGuestIdentity(req.authUserId)) return res.status(403).end();
    try { res.json(await readDuelConsent(client, req.authUserId)); }
    catch { res.status(503).end(); }
  });
  router.post(path, requireUserAuth, async (req, res) => {
    if (!req.authUserId || isGuestIdentity(req.authUserId)) return res.status(403).end();
    const event = req.body?.event;
    if (!req.is('application/json') || !['enroll','select','withdraw'].includes(event)) return res.status(400).end();
    try {
      await changeDuelConsent(client, req.authUserId, event);
      if (event === 'select') return res.status(204).end();
      res.json(await readDuelConsent(client, req.authUserId));
    } catch { res.status(503).end(); }
  });
  router.post('/api/internal/duel-funnel/matched', async (req, res) => {
    const secret = getInternalSecret(), supplied = req.get('x-internal-secret');
    if (!secret || !supplied || !safeEqualStrings(secret, supplied)) return res.status(403).end();
    const { room, ids, matchedAt } = req.body || {};
    if (typeof room !== 'string' || !uuidPattern.test(room) || !Array.isArray(ids) || !ids.length || ids.length > 2 ||
      ids.some(id => typeof id !== 'string' || !validPlayerId.test(id)) || !Number.isSafeInteger(matchedAt) || Math.abs(matchedAt-Date.now()) > 300_000) {
      return res.status(400).end();
    }
    if (!duelCoverageStart()) return res.status(204).end();
    try { await client.$transaction(tx => recordDuelMilestone(tx, 'matched', room, ids, new Date(matchedAt))); res.status(204).end(); }
    catch { res.status(503).end(); }
  });
  return router;
}
