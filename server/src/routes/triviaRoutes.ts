import { Router, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from '../db/prismaClient';
import { CategoryId, DifficultyLevel, calculateScore, ClientQuestion, JOKERS } from '@trivia/shared';
import { generateQuestionsWithEvrenGLM } from '../ai/evrenLlmGenerator';
import { cacheService } from '../cache/redisClient';
import { supabaseService } from '../db/supabaseClient';
import { importQuestionsFromJson } from '../utils/questionImporter';
import { getJwtSecret, requireAdminAuth, requireUserAuth } from '../middleware/auth';
import { walletSchemaReady } from '../services/walletSchema';
import { walletRateLimitOptions } from '../middleware/walletRateLimit';

const router = Router();
const practiceQuestionsLimit = rateLimit({ ...walletRateLimitOptions, limit: 90 });
const practiceJokerLimit = rateLimit({ ...walletRateLimitOptions, limit: 45 });
const practiceSessionPattern = /^sess_[a-f0-9]{32}$/;
const practiceProof = (userId: string, sessionId: string, questionId: string, expiry: number, secret: string) =>
  createHmac('sha256', secret).update(JSON.stringify(['practice-joker', userId, sessionId, questionId, expiry])).digest('hex');

// Public trivia categories
router.get('/categories', async (req: Request, res: Response): Promise<void> => {
  // Sunucusuz ortamda canlı soru havuzunun hazır olmasını bekle (Keşfet sayısındaki güncel değerler için)
  await db.ensureQuestionsRestored();
  const categories = db.getCategories();
  res.json(categories);
});

// Single-player / practice question fetcher with anti-repeat support
router.get('/questions/practice', practiceQuestionsLimit, async (req: Request, res: Response): Promise<void> => {
  const category = (req.query.category as CategoryId) || 'mixed';
  const difficulty = req.query.difficulty as DifficultyLevel | undefined;
  const subCategory = (req.query.subcategory as string) || undefined;
  const count = Math.min(50, Math.max(1, parseInt(req.query.count as string, 10) || 5));
  const seenIdsRaw = req.query.seenIds as string | undefined;
  const seenIds = seenIdsRaw ? seenIdsRaw.split(',') : [];
  const sessionId = (req.query.sessionId as string) || 'practice';
  const authorization = req.get('Authorization');
  const proofOwner = authorization?.startsWith('Bearer ') ? db.verifyToken(authorization.slice(7))?.userId : undefined;
  const proofSecret = getJwtSecret();
  if (authorization) res.set('Cache-Control', 'private, no-store');
  const issueJokerProof = req.query.jokers === '1' && typeof proofOwner === 'string' &&
    !proofOwner.startsWith('guest_') && proofSecret && practiceSessionPattern.test(sessionId) &&
    await walletSchemaReady(db.rawClient);

  // Sunucusuz ortamda kalıcı soru havuzunun (Telegram soruları dahil) hazır olmasını bekle
  await db.ensureQuestionsRestored();

  const rawQuestions = db.getQuestions(category, difficulty, count, seenIds, subCategory);
  // Strip correctOptionId for client-safe delivery
  const questions: ClientQuestion[] = rawQuestions.map((q, idx) => ({
    id: q.id,
    categoryId: q.categoryId,
    difficulty: q.difficulty,
    text: q.text,
    options: q.options,
    roundNumber: idx + 1,
    totalRounds: rawQuestions.length,
    timeLimitSec: q.timeLimitSec || 15,
    ...(q.subCategory ? { subCategory: q.subCategory } : {}),
  }));

  // Authoritatively set expiry in cache for each question with realistic sequence offset
  let cumulativeMs = Date.now();
  await Promise.all(
    questions.map((q) => {
      cumulativeMs += q.timeLimitSec * 1000 + 4000;
      if (issueJokerProof && proofOwner) {
        q.jokerProof = `${cumulativeMs}.${practiceProof(proofOwner, sessionId, q.id, cumulativeMs, proofSecret)}`;
      }
      return cacheService.setQuestionExpiry(sessionId, q.id, cumulativeMs, 300);
    })
  );

  if (subCategory && questions.length === 0) {
    res.json({
      category,
      subCategory,
      count: 0,
      questions: [],
      code: 'SUBCATEGORY_EMPTY',
      message: 'Bu alt kategoride henüz yayınlanmış soru yok.',
    });
    return;
  }

  res.json({ category, subCategory: subCategory || null, count: questions.length, questions });
});

router.post('/questions/practice/joker', practiceJokerLimit, requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.authUserId;
  const { sessionId, questionId, jokerId, proof } = req.body || {};
  const joker = JOKERS.find(item => item.id === jokerId);
  const secret = getJwtSecret();
  const [deadline, signature] = typeof proof === 'string' && /^\d{13}\.[a-f0-9]{64}$/.test(proof) ? proof.split('.') : [];
  if (!userId || userId.startsWith('guest_') || !joker || !secret || !deadline || typeof sessionId !== 'string' ||
      !practiceSessionPattern.test(sessionId) || typeof questionId !== 'string' || questionId.length > 160 ||
      !timingSafeEqual(Buffer.from(practiceProof(userId, sessionId, questionId, Number(deadline), secret), 'hex'), Buffer.from(signature, 'hex'))) {
    res.status(400).json({ error: 'Bu soruda joker kullanılamıyor.' }); return;
  }
  if (!await walletSchemaReady(db.rawClient)) {
    res.status(503).json({ error: 'Jokerler henüz kullanıma açık değil.' }); return;
  }
  let question = db.getQuestionById(questionId);
  if (!question) {
    await db.ensureQuestionsRestored();
    question = db.getQuestionById(questionId);
  }
  const wrong = question?.options.filter(option => option.id !== question?.correctOptionId) ?? [];
  if (!question?.options.some(option => option.id === question?.correctOptionId) || wrong.length <= joker.eliminated || Date.now() > Number(deadline)) {
    res.status(409).json({ error: 'Bu soruda joker kullanılamıyor.' }); return;
  }
  try {
    const eliminated = await db.rawClient.$transaction(async tx => {
      const [account] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
      if (!account) return null;
      const key = { userId, sessionId, questionId };
      const used = await tx.practiceJokerUse.findUnique({ where: { userId_sessionId_questionId: key } });
      if (used) return used.eliminated;
      const stock = await tx.userInventoryItem.updateMany({
        where: { userId, itemId: joker.id, qty: { gt: 0 } }, data: { qty: { decrement: 1 } },
      });
      if (!stock.count) return null;
      const start = Math.floor(Math.random() * wrong.length);
      const hidden = [...wrong.slice(start), ...wrong.slice(0, start)].slice(0, joker.eliminated).map(option => option.id);
      await tx.practiceJokerUse.create({ data: { ...key, jokerId: joker.id, eliminated: hidden } });
      return hidden;
    });
    if (!eliminated) { res.status(409).json({ error: 'Envanterinde bu jokerden kalmadı.' }); return; }
    res.json({ eliminated });
  } catch {
    res.status(503).json({ error: 'Joker şu anda kullanılamadı. Tekrar dene.' });
  }
});

// Authoritative practice / guest answer validation endpoint
router.post('/questions/submit', async (req: Request, res: Response): Promise<void> => {
  const { questionId, selectedOptionId, timeRemainingMs, totalTimeMs, currentStreak, playerId, sessionId } = req.body;
  const sessionKey = sessionId || 'practice';
  const userKey = playerId || sessionKey || req.ip || 'anon_player';

  let question = db.getQuestionById(questionId);
  if (!question) {
    // Vercel may serve the submit on a different cold instance than /practice.
    await db.ensureQuestionsRestored();
    question = db.getQuestionById(questionId);
  }
  if (!question) {
    res.status(404).json({ error: 'Soru bulunamadı' });
    return;
  }

  // 1. Idempotency Lock Check via Upstash Redis/Cache
  const lockAcquired = await cacheService.acquireAnswerLock(sessionKey, questionId, userKey);
  if (!lockAcquired) {
    res.status(409).json({ error: 'Bu soruya zaten cevap verildi.', code: 'ALREADY_ANSWERED' });
    return;
  }

  // 2. Authoritative Expiration Check
  const expiry = await cacheService.getQuestionExpiry(sessionKey, questionId);
  const isExpiredByServer = expiry !== null && Date.now() > expiry + 500;
  const isExpiredByClient = timeRemainingMs !== undefined && timeRemainingMs <= 0;
  const isTimeout = !selectedOptionId || isExpiredByServer || isExpiredByClient;

  const isCorrect = !isTimeout && selectedOptionId === question.correctOptionId;

  const scoreResult = calculateScore({
    isCorrect,
    timeRemainingMs: isTimeout ? 0 : (timeRemainingMs ?? 0),
    totalTimeMs: totalTimeMs || 15000,
    currentStreak: currentStreak || 0,
    penaltyForWrong: false,
  });

  // Record in anti-repeat seen set
  if (playerId) {
    cacheService.recordSeenQuestion(playerId, question.categoryId, questionId).catch(() => {});
  }

  res.json({
    questionId,
    isCorrect,
    isTimeout,
    correctOptionId: question.correctOptionId,
    explanation: question.explanation,
    pointsAwarded: scoreResult.pointsAwarded,
    speedBonus: scoreResult.speedBonus,
    streak: scoreResult.streak,
  });
});

// Daily challenge set
router.get('/questions/daily', async (req: Request, res: Response): Promise<void> => {
  await db.ensureQuestionsRestored();
  const daily = db.getDailyChallenge();
  res.json(daily);
});

// SECURITY: all admin & AI question management endpoints require admin
// authentication (HTTP Basic / portal JWT / x-internal-secret).
router.use('/admin/questions', requireAdminAuth);

// -------------------------------------------------------------
// Admin & AI Question Management Endpoints
// -------------------------------------------------------------

// AI Question Generator endpoint (Evren Türkiye GLM 5.3)
router.post('/admin/questions/generate', async (req: Request, res: Response): Promise<void> => {
  const { categoryId = 'general_culture', subCategory, difficulty = 'medium', count = 1 } = req.body;

  try {
    await db.ensureQuestionsRestored();

    const result = await generateQuestionsWithEvrenGLM({
      categoryId: categoryId as CategoryId,
      subCategory,
      difficulty: difficulty as DifficultyLevel,
      count: Math.min(10, Math.max(1, count)),
      db,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List questions awaiting review
router.get('/admin/questions/review', async (req: Request, res: Response): Promise<void> => {
  await db.ensureQuestionsRestored();
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const offset = parseInt(req.query.offset as string, 10) || 0;
  const pending = db.getQuestionsByStatus('pending_review', limit, offset);
  res.json({ count: pending.length, questions: pending });
});

// Approve question to published
router.post('/admin/questions/:id/approve', async (req: Request, res: Response): Promise<void> => {
  await db.ensureQuestionsRestored();
  const id = String(req.params.id);
  const reviewedBy = req.body.reviewedBy || 'admin';
  const pool = req.body.targetPool || req.body.pool || 'standard';
  const approved = db.approveQuestion(id, reviewedBy, pool);

  if (!approved) {
    res.status(404).json({ error: 'Soru bulunamadı' });
    return;
  }
  supabaseService.updateQuestionStatus(id, 'published', reviewedBy).catch(() => {});
  res.json({ success: true, question: approved, pool });
});

// Reject question
router.post('/admin/questions/:id/reject', async (req: Request, res: Response): Promise<void> => {
  await db.ensureQuestionsRestored();
  const id = String(req.params.id);
  const { reviewedBy = 'admin', reason = 'Uygun görülmedi' } = req.body;
  const rejected = db.rejectQuestion(id, reviewedBy, reason);

  if (!rejected) {
    res.status(404).json({ error: 'Soru bulunamadı' });
    return;
  }
  supabaseService.updateQuestionStatus(id, 'rejected', reviewedBy, reason).catch(() => {});
  res.json({ success: true, question: rejected });
});

// Question pool & review statistics (with full category x difficulty matrix)
router.get('/admin/questions/stats', async (req: Request, res: Response): Promise<void> => {
  await db.ensureQuestionsRestored();
  const stats = db.getReviewStats();
  res.json(stats);
});

// Search and filter questions in pool
router.get('/admin/questions/list', async (req: Request, res: Response): Promise<void> => {
  await db.ensureQuestionsRestored();
  const {
    search,
    categoryId,
    difficulty,
    reviewStatus,
    targetPool,
    limit,
    offset,
  } = req.query;

  const result = db.getQuestionsFiltered({
    search: search as string,
    categoryId: categoryId as string,
    difficulty: difficulty as string,
    reviewStatus: reviewStatus as string,
    targetPool: targetPool as string,
    limit: limit ? parseInt(limit as string, 10) : 50,
    offset: offset ? parseInt(offset as string, 10) : 0,
  });

  res.json(result);
});

// Scan pool for duplicate questions
router.get('/admin/questions/duplicates', async (req: Request, res: Response): Promise<void> => {
  await db.ensureQuestionsRestored();
  const result = db.findDuplicates();
  res.json(result);
});

// Delete a question by ID
router.delete('/admin/questions/:id', async (req: Request, res: Response): Promise<void> => {
  await db.ensureQuestionsRestored();
  const id = String(req.params.id);
  const deleted = db.deleteQuestion(id);
  if (!deleted) {
    res.status(404).json({ error: 'Soru bulunamadı veya silinemedi.' });
    return;
  }
  if (typeof (supabaseService as any).deleteQuestion === 'function') {
    (supabaseService as any).deleteQuestion(id).catch(() => {});
  }
  res.json({ success: true, id, message: 'Soru başarıyla silindi.' });
});

// Update a question by ID
router.put('/admin/questions/:id', async (req: Request, res: Response): Promise<void> => {
  await db.ensureQuestionsRestored();
  const id = String(req.params.id);
  const updated = db.updateQuestion(id, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Soru bulunamadı veya güncellenemedi.' });
    return;
  }
  res.json({ success: true, question: updated });
});

// Import questions manually via JSON text or parsed array
router.post('/admin/questions/import-json', async (req: Request, res: Response): Promise<void> => {
  try {
    // Önce kalıcı depodaki (Supabase/PostgreSQL) soruları belleğe geri yükle.
    // Bu, sunucusuz ortamda mükerrer kontrolün doğru çalışmasını ve yeni
    // yüklenen soruların bulut deposundaki mevcut soruları ezmesini önler.
    await db.ensureQuestionsRestored();

    const body = req.body || {};
    console.log('📥 [/admin/questions/import-json] İstek alındı:', {
      bodyKeys: Object.keys(body),
      contentType: req.headers['content-type'],
      ip: req.ip || req.headers['x-forwarded-for'],
    });

    // Extract input from various potential keys
    let input =
      body.input ??
      body.jsonContent ??
      body.json ??
      body.content ??
      body.questions ??
      body.sorular ??
      body.data;

    // If none of the specific keys matched, check if body itself is an array or string
    if (input === undefined || input === null) {
      input = body;
    }

    const publishDirectly =
      body.publishDirectly !== undefined
        ? Boolean(body.publishDirectly)
        : body.autoPublish !== undefined
        ? Boolean(body.autoPublish)
        : true;

    const defaultTargetPool =
      body.defaultTargetPool || body.targetPool || body.pool || 'standard';

    const addedBy = body.addedBy || 'Web Admin';

    console.log('🔍 [/admin/questions/import-json] İşlenecek parametreler:', {
      hasInput: Boolean(input),
      inputType: typeof input,
      isArray: Array.isArray(input),
      inputLength: typeof input === 'string' ? input.length : Array.isArray(input) ? input.length : undefined,
      publishDirectly,
      defaultTargetPool,
      addedBy,
    });

    const result = importQuestionsFromJson(input, db, addedBy, publishDirectly, defaultTargetPool);

    console.log('📊 [/admin/questions/import-json] İçe aktarma sonucu:', {
      success: result.success,
      importedCount: result.importedCount,
      totalProcessed: result.totalProcessed,
      duplicateCount: result.duplicateCount,
      errorCount: result.errorCount,
      errors: result.errors,
    });

    res.json(result);
  } catch (err: any) {
    console.error('❌ [/admin/questions/import-json] Beklenmeyen hata:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

export default router;
