import { Router, Request, Response } from 'express';
import { db } from '../db/prismaClient';
import { CategoryId, DifficultyLevel, calculateScore, ClientQuestion } from '@trivia/shared';
import { generateQuestionsWithEvrenGLM } from '../ai/evrenLlmGenerator';
import { cacheService } from '../cache/redisClient';
import { supabaseService } from '../db/supabaseClient';

const router = Router();

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
  const reviewedBy = req.body.reviewedBy || 'admin';
  const approved = db.approveQuestion(id, reviewedBy);

  if (!approved) {
    res.status(404).json({ error: 'Soru bulunamadı' });
    return;
  }
  supabaseService.updateQuestionStatus(id, 'published', reviewedBy).catch(() => {});
  res.json({ success: true, question: approved });
});

// Reject question
router.post('/admin/questions/:id/reject', (req: Request, res: Response): void => {
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

// Question pool & review statistics
router.get('/admin/questions/stats', (req: Request, res: Response): void => {
  const stats = db.getReviewStats();
  res.json(stats);
});

export default router;
