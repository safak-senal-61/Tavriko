import { Router, Request, Response } from 'express';
import { db } from '../db/prismaClient';
import { CategoryId, DifficultyLevel, calculateScore, ClientQuestion } from '@trivia/shared';
import { generateQuestionsWithEvrenGLM } from '../ai/evrenLlmGenerator';
import { cacheService } from '../cache/redisClient';
import { supabaseService } from '../db/supabaseClient';
import { importQuestionsFromJson } from '../utils/questionImporter';
import { requirePortalAdmin } from '../middleware/security';

const router = Router();
router.use('/admin', requirePortalAdmin);

// Public trivia categories
router.get('/categories', (req: Request, res: Response): void => {
  const categories = db.getCategories();
  res.json(categories);
});

// Single-player / practice question fetcher with anti-repeat support
router.get('/questions/practice', async (req: Request, res: Response): Promise<void> => {
  const category = (req.query.category as CategoryId) || 'mixed';
  const difficulty = req.query.difficulty as DifficultyLevel | undefined;
  const count = parseInt(req.query.count as string, 10) || 5;
  const seenIdsRaw = req.query.seenIds as string | undefined;
  const seenIds = seenIdsRaw ? seenIdsRaw.split(',') : [];
  const sessionId = (req.query.sessionId as string) || 'practice';

  const rawQuestions = db.getQuestions(category, difficulty, count, seenIds);
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
  }));

  // Authoritatively set expiry in cache for each question with realistic sequence offset
  let cumulativeMs = Date.now();
  await Promise.all(
    questions.map((q) => {
      cumulativeMs += q.timeLimitSec * 1000 + 4000;
      return cacheService.setQuestionExpiry(sessionId, q.id, cumulativeMs, 300);
    })
  );

  res.json({ category, count: questions.length, questions });
});

// Authoritative practice / guest answer validation endpoint
router.post('/questions/submit', async (req: Request, res: Response): Promise<void> => {
  const { questionId, selectedOptionId, timeRemainingMs, totalTimeMs, currentStreak, playerId, sessionId } = req.body;
  const sessionKey = sessionId || 'practice';
  const userKey = playerId || sessionKey || req.ip || 'anon_player';

  const question = db.getQuestionById(questionId);
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
router.get('/questions/daily', (req: Request, res: Response): void => {
  const daily = db.getDailyChallenge();
  res.json(daily);
});

// -------------------------------------------------------------
// Admin & AI Question Management Endpoints
// -------------------------------------------------------------

// AI Question Generator endpoint (Evren Türkiye GLM 5.3)
router.post('/admin/questions/generate', async (req: Request, res: Response): Promise<void> => {
  const { categoryId = 'general_culture', subCategory, difficulty = 'medium', count = 1 } = req.body;

  try {
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
router.get('/admin/questions/review', (req: Request, res: Response): void => {
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const offset = parseInt(req.query.offset as string, 10) || 0;
  const pending = db.getQuestionsByStatus('pending_review', limit, offset);
  res.json({ count: pending.length, questions: pending });
});

// Approve question to published
router.post('/admin/questions/:id/approve', (req: Request, res: Response): void => {
  const id = String(req.params.id);
  const reviewedBy = (req as any).portalAdminEmail || 'portal_admin';
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
router.post('/admin/questions/:id/reject', (req: Request, res: Response): void => {
  const id = String(req.params.id);
  const reviewedBy = (req as any).portalAdminEmail || 'portal_admin';
  const { reason = 'Uygun görülmedi' } = req.body;
  const rejected = db.rejectQuestion(id, reviewedBy, reason);

  if (!rejected) {
    res.status(404).json({ error: 'Soru bulunamadı' });
    return;
  }
  supabaseService.updateQuestionStatus(id, 'rejected', reviewedBy, reason).catch(() => {});
  res.json({ success: true, question: rejected });
});

// Question pool & review statistics (with full category x difficulty matrix)
router.get('/admin/questions/stats', (req: Request, res: Response): void => {
  const stats = db.getReviewStats();
  res.json(stats);
});

// Search and filter questions in pool
router.get('/admin/questions/list', (req: Request, res: Response): void => {
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
router.get('/admin/questions/duplicates', (req: Request, res: Response): void => {
  const result = db.findDuplicates();
  res.json(result);
});

// Delete a question by ID
router.delete('/admin/questions/:id', (req: Request, res: Response): void => {
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
router.put('/admin/questions/:id', (req: Request, res: Response): void => {
  const id = String(req.params.id);
  const updated = db.updateQuestion(id, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Soru bulunamadı veya güncellenemedi.' });
    return;
  }
  res.json({ success: true, question: updated });
});

// Import questions manually via JSON text or parsed array
router.post('/admin/questions/import-json', (req: Request, res: Response): void => {
  try {
    const body = req.body || {};
    console.log('📥 [/admin/questions/import-json] İstek alındı:', {
      bodyKeys: Object.keys(body),
      contentType: req.headers['content-type'],
      ip: req.ip || req.headers['x-forwarded-for'],
    });

    // Extract input from various potential keys
    let input =
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

    const addedBy = (req as any).portalAdminEmail || 'portal_admin';

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
