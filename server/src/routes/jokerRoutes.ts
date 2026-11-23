import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { isJokerId } from '@trivia/shared';
import { getRawPrisma } from '../db/rawPrisma';
import { walletRateLimitOptions } from '../middleware/walletRateLimit';
import { consumeQuizJoker } from '../services/quizJokers';
import { getJokerSigningSecret, practiceSessionPattern, readPracticeJoker, type JokerQuestion } from '../services/practiceJokerProof';

const router = Router();
const practiceJokerLimit = rateLimit({ ...walletRateLimitOptions, limit: 45 });
const playerIdPattern = /^[a-z0-9_-]{1,128}$/i;

router.use(['/questions/practice/joker', '/internal/room-joker'], (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

function jokerFailure(res: Response, status: 'empty' | 'already_used' | 'expired' | 'unavailable') {
  const messages = {
    empty: 'Envanterinde bu jokerden kalmadı.',
    already_used: 'Bu soruda başka bir joker kullanıldı.',
    expired: 'Bu sorunun süresi doldu. Sonraki soruda tekrar dene.',
    unavailable: 'Bu joker bu soruya veya maç türüne uygun değil.',
  };
  res.status(409).json({ error: messages[status], code: status });
}

function jokerBackendError(res: Response, error: unknown) {
  const { code, meta } = (error ?? {}) as { code?: string; meta?: { code?: string } };
  const migrationMissing = code === 'P2021' || meta?.code === '42P01';
  console.warn('[quiz-joker] Wallet request failed', { code, databaseCode: meta?.code });
  res.status(503).json({ error: migrationMissing ? 'Joker envanteri şu anda kullanıma açık değil.'
    : 'Joker işlemi tamamlanamadı. Tekrar dene.', code: migrationMissing ? 'wallet_not_ready' : 'wallet_unavailable' });
}

async function loadLegacyQuestion(questionId: string): Promise<JokerQuestion | undefined> {
  const stored = await getRawPrisma().question.findFirst({
    where: { id: questionId, reviewStatus: 'published' }, select: { options: true, correctOptionId: true },
  }).catch(() => null);
  if (stored && Array.isArray(stored.options)) {
    const options = stored.options.flatMap(option => {
      if (!option || typeof option !== 'object' || Array.isArray(option) ||
          typeof option.id !== 'string' || typeof option.text !== 'string') return [];
      return [{ id: option.id, text: option.text }];
    });
    if (options.length === stored.options.length && options.some(option => option.id === stored.correctOptionId)) {
      return { correctOptionId: stored.correctOptionId, options };
    }
  }
  // Old signed references may be seed questions, not persisted rows.
  const { db } = await import('../db/prismaClient');
  const known = db.getQuestionById(questionId);
  if (known) return known;
  await db.ensureQuestionsRestored();
  return db.getQuestionById(questionId) ?? undefined;
}

function sendJokerResult(res: Response, started: number, result: Awaited<ReturnType<typeof consumeQuizJoker>>) {
  res.set('Server-Timing', `joker-wallet;dur=${Math.round(performance.now() - started)}`);
  if (result.status !== 'applied') { jokerFailure(res, result.status); return; }
  res.json(result.effect);
}

router.post('/questions/practice/joker', practiceJokerLimit, async (req: Request, res: Response): Promise<void> => {
  const authorization = req.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Yetkilendirme başlığı eksik' }); return;
  }
  const secret = getJokerSigningSecret();
  let userId: string | undefined;
  try {
    const token = jwt.verify(authorization.slice(7), secret, { algorithms: ['HS256'] });
    if (typeof token !== 'string' && typeof token.userId === 'string') userId = token.userId;
  } catch {}
  if (!userId) { res.status(401).json({ error: 'Geçersiz veya süresi dolmuş oturum' }); return; }
  const { sessionId, questionId, jokerId, proof } = req.body || {};
  if (!playerIdPattern.test(userId) || /^(guest_|bot_)/i.test(userId) || !isJokerId(jokerId) || typeof sessionId !== 'string' ||
      !practiceSessionPattern.test(sessionId) || typeof questionId !== 'string' || !questionId || questionId.length > 160) {
    res.status(400).json({ error: 'Bu soruda joker kullanılamıyor.' }); return;
  }
  const scope = { userId, sessionId, questionId };
  const receipt = readPracticeJoker(proof, scope, secret);
  if (!receipt) { res.status(400).json({ error: 'Bu soruda joker kullanılamıyor.' }); return; }
  try {
    if (Date.now() >= receipt.deadline) { jokerFailure(res, 'expired'); return; }
    const question = receipt.question ?? await loadLegacyQuestion(questionId);
    if (!question) { jokerFailure(res, 'unavailable'); return; }
    const started = performance.now();
    sendJokerResult(res, started, await consumeQuizJoker(scope, jokerId, question, receipt.deadline));
  } catch (error) {
    jokerBackendError(res, error);
  }
});

router.post('/internal/room-joker', async (req: Request, res: Response): Promise<void> => {
  const secret = process.env.INTERNAL_API_SECRET;
  const supplied = req.get('x-internal-secret');
  if (!secret || !supplied || Buffer.byteLength(secret) !== Buffer.byteLength(supplied) ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))) {
    res.status(403).json({ error: 'Yetkisiz erişim' }); return;
  }
  const { userId, roomCode, roundNumber, startedAt, deadline, questionId, jokerId, options, correctOptionId, tactics, capabilities, votes, requestedAt = Date.now() } = req.body || {};
  const choices = Array.isArray(options) && options.length >= 2 && options.length <= 12 &&
    options.every(option => typeof option?.id === 'string' && option.id.length <= 160 &&
      typeof option.text === 'string' && option.text.length <= 1000);
  if (typeof userId !== 'string' || !playerIdPattern.test(userId) || /^(guest_|bot_)/i.test(userId) ||
      typeof roomCode !== 'string' || !/^[A-Z0-9_-]{1,16}$/.test(roomCode) ||
      !Number.isSafeInteger(roundNumber) || roundNumber < 1 || roundNumber > 50 ||
      !Number.isSafeInteger(startedAt) || !Number.isSafeInteger(deadline) || startedAt > Date.now() + 2000 ||
      !Number.isSafeInteger(requestedAt) || requestedAt < startedAt || requestedAt > Date.now() + 2000 ||
      deadline <= startedAt || deadline > startedAt + 120_000 ||
      typeof questionId !== 'string' || !questionId || questionId.length > 160 ||
      !isJokerId(jokerId) || !choices || typeof correctOptionId !== 'string' ||
      (tactics !== undefined && tactics !== 'friendly')) {
    res.status(400).json({ error: 'Geçersiz joker isteği.' }); return;
  }
  try {
    const activeCapabilities = capabilities && typeof capabilities === 'object' && !Array.isArray(capabilities)
      ? { replacement: capabilities.replacement === true, freeze: capabilities.freeze === true, shield: capabilities.shield === true,
        gold: capabilities.gold === true, nextRound: capabilities.nextRound === true } : undefined;
    const counts = votes && typeof votes === 'object' && !Array.isArray(votes)
      ? Object.fromEntries(options.map((option: { id: string }) => {
        const count = Object.hasOwn(votes, option.id) ? votes[option.id] : 0;
        return [option.id, Number.isSafeInteger(count) && count > 0 ? Math.min(count, 1_000_000) : 0];
      })) : undefined;
    const started = performance.now();
    sendJokerResult(res, started, await consumeQuizJoker(
      { userId, sessionId: `room:${roomCode}:${startedAt}:${roundNumber}`, questionId },
      jokerId, { options, correctOptionId }, deadline, { tactics, startedAt, requestedAt, capabilities: activeCapabilities, votes: counts },
    ));
  } catch (error) {
    jokerBackendError(res, error);
  }
});

export default router;
