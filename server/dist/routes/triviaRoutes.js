"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prismaClient_1 = require("../db/prismaClient");
const shared_1 = require("@trivia/shared");
const evrenLlmGenerator_1 = require("../ai/evrenLlmGenerator");
const redisClient_1 = require("../cache/redisClient");
const supabaseClient_1 = require("../db/supabaseClient");
const questionImporter_1 = require("../utils/questionImporter");
const router = (0, express_1.Router)();
// Public trivia categories
router.get('/categories', (req, res) => {
    const categories = prismaClient_1.db.getCategories();
    res.json(categories);
});
// Single-player / practice question fetcher with anti-repeat support
router.get('/questions/practice', async (req, res) => {
    const category = req.query.category || 'mixed';
    const difficulty = req.query.difficulty;
    const count = parseInt(req.query.count, 10) || 5;
    const seenIdsRaw = req.query.seenIds;
    const seenIds = seenIdsRaw ? seenIdsRaw.split(',') : [];
    const sessionId = req.query.sessionId || 'practice';
    // Sunucusuz ortamda kalıcı soru havuzunun (Telegram soruları dahil) hazır olmasını bekle
    await prismaClient_1.db.ensureQuestionsRestored();
    const rawQuestions = prismaClient_1.db.getQuestions(category, difficulty, count, seenIds);
    // Strip correctOptionId for client-safe delivery
    const questions = rawQuestions.map((q, idx) => ({
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
    await Promise.all(questions.map((q) => {
        cumulativeMs += q.timeLimitSec * 1000 + 4000;
        return redisClient_1.cacheService.setQuestionExpiry(sessionId, q.id, cumulativeMs, 300);
    }));
    res.json({ category, count: questions.length, questions });
});
// Authoritative practice / guest answer validation endpoint
router.post('/questions/submit', async (req, res) => {
    const { questionId, selectedOptionId, timeRemainingMs, totalTimeMs, currentStreak, playerId, sessionId } = req.body;
    const sessionKey = sessionId || 'practice';
    const userKey = playerId || sessionKey || req.ip || 'anon_player';
    const question = prismaClient_1.db.getQuestionById(questionId);
    if (!question) {
        res.status(404).json({ error: 'Soru bulunamadı' });
        return;
    }
    // 1. Idempotency Lock Check via Upstash Redis/Cache
    const lockAcquired = await redisClient_1.cacheService.acquireAnswerLock(sessionKey, questionId, userKey);
    if (!lockAcquired) {
        res.status(409).json({ error: 'Bu soruya zaten cevap verildi.', code: 'ALREADY_ANSWERED' });
        return;
    }
    // 2. Authoritative Expiration Check
    const expiry = await redisClient_1.cacheService.getQuestionExpiry(sessionKey, questionId);
    const isExpiredByServer = expiry !== null && Date.now() > expiry + 500;
    const isExpiredByClient = timeRemainingMs !== undefined && timeRemainingMs <= 0;
    const isTimeout = !selectedOptionId || isExpiredByServer || isExpiredByClient;
    const isCorrect = !isTimeout && selectedOptionId === question.correctOptionId;
    const scoreResult = (0, shared_1.calculateScore)({
        isCorrect,
        timeRemainingMs: isTimeout ? 0 : (timeRemainingMs ?? 0),
        totalTimeMs: totalTimeMs || 15000,
        currentStreak: currentStreak || 0,
        penaltyForWrong: false,
    });
    // Record in anti-repeat seen set
    if (playerId) {
        redisClient_1.cacheService.recordSeenQuestion(playerId, question.categoryId, questionId).catch(() => { });
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
router.get('/questions/daily', async (req, res) => {
    await prismaClient_1.db.ensureQuestionsRestored();
    const daily = prismaClient_1.db.getDailyChallenge();
    res.json(daily);
});
// -------------------------------------------------------------
// Admin & AI Question Management Endpoints
// -------------------------------------------------------------
// AI Question Generator endpoint (Evren Türkiye GLM 5.3)
router.post('/admin/questions/generate', async (req, res) => {
    const { categoryId = 'general_culture', subCategory, difficulty = 'medium', count = 1 } = req.body;
    try {
        const result = await (0, evrenLlmGenerator_1.generateQuestionsWithEvrenGLM)({
            categoryId: categoryId,
            subCategory,
            difficulty: difficulty,
            count: Math.min(10, Math.max(1, count)),
            db: prismaClient_1.db,
        });
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// List questions awaiting review
router.get('/admin/questions/review', (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;
    const pending = prismaClient_1.db.getQuestionsByStatus('pending_review', limit, offset);
    res.json({ count: pending.length, questions: pending });
});
// Approve question to published
router.post('/admin/questions/:id/approve', (req, res) => {
    const id = String(req.params.id);
    const reviewedBy = req.body.reviewedBy || 'admin';
    const pool = req.body.targetPool || req.body.pool || 'standard';
    const approved = prismaClient_1.db.approveQuestion(id, reviewedBy, pool);
    if (!approved) {
        res.status(404).json({ error: 'Soru bulunamadı' });
        return;
    }
    supabaseClient_1.supabaseService.updateQuestionStatus(id, 'published', reviewedBy).catch(() => { });
    res.json({ success: true, question: approved, pool });
});
// Reject question
router.post('/admin/questions/:id/reject', (req, res) => {
    const id = String(req.params.id);
    const { reviewedBy = 'admin', reason = 'Uygun görülmedi' } = req.body;
    const rejected = prismaClient_1.db.rejectQuestion(id, reviewedBy, reason);
    if (!rejected) {
        res.status(404).json({ error: 'Soru bulunamadı' });
        return;
    }
    supabaseClient_1.supabaseService.updateQuestionStatus(id, 'rejected', reviewedBy, reason).catch(() => { });
    res.json({ success: true, question: rejected });
});
// Question pool & review statistics (with full category x difficulty matrix)
router.get('/admin/questions/stats', (req, res) => {
    const stats = prismaClient_1.db.getReviewStats();
    res.json(stats);
});
// Search and filter questions in pool
router.get('/admin/questions/list', (req, res) => {
    const { search, categoryId, difficulty, reviewStatus, targetPool, limit, offset, } = req.query;
    const result = prismaClient_1.db.getQuestionsFiltered({
        search: search,
        categoryId: categoryId,
        difficulty: difficulty,
        reviewStatus: reviewStatus,
        targetPool: targetPool,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
    });
    res.json(result);
});
// Scan pool for duplicate questions
router.get('/admin/questions/duplicates', (req, res) => {
    const result = prismaClient_1.db.findDuplicates();
    res.json(result);
});
// Delete a question by ID
router.delete('/admin/questions/:id', (req, res) => {
    const id = String(req.params.id);
    const deleted = prismaClient_1.db.deleteQuestion(id);
    if (!deleted) {
        res.status(404).json({ error: 'Soru bulunamadı veya silinemedi.' });
        return;
    }
    if (typeof supabaseClient_1.supabaseService.deleteQuestion === 'function') {
        supabaseClient_1.supabaseService.deleteQuestion(id).catch(() => { });
    }
    res.json({ success: true, id, message: 'Soru başarıyla silindi.' });
});
// Update a question by ID
router.put('/admin/questions/:id', (req, res) => {
    const id = String(req.params.id);
    const updated = prismaClient_1.db.updateQuestion(id, req.body);
    if (!updated) {
        res.status(404).json({ error: 'Soru bulunamadı veya güncellenemedi.' });
        return;
    }
    res.json({ success: true, question: updated });
});
// Import questions manually via JSON text or parsed array
router.post('/admin/questions/import-json', (req, res) => {
    try {
        const body = req.body || {};
        console.log('📥 [/admin/questions/import-json] İstek alındı:', {
            bodyKeys: Object.keys(body),
            contentType: req.headers['content-type'],
            ip: req.ip || req.headers['x-forwarded-for'],
        });
        // Extract input from various potential keys
        let input = body.jsonContent ??
            body.json ??
            body.content ??
            body.questions ??
            body.sorular ??
            body.data;
        // If none of the specific keys matched, check if body itself is an array or string
        if (input === undefined || input === null) {
            input = body;
        }
        const publishDirectly = body.publishDirectly !== undefined
            ? Boolean(body.publishDirectly)
            : body.autoPublish !== undefined
                ? Boolean(body.autoPublish)
                : true;
        const defaultTargetPool = body.defaultTargetPool || body.targetPool || body.pool || 'standard';
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
        const result = (0, questionImporter_1.importQuestionsFromJson)(input, prismaClient_1.db, addedBy, publishDirectly, defaultTargetPool);
        console.log('📊 [/admin/questions/import-json] İçe aktarma sonucu:', {
            success: result.success,
            importedCount: result.importedCount,
            totalProcessed: result.totalProcessed,
            duplicateCount: result.duplicateCount,
            errorCount: result.errorCount,
            errors: result.errors,
        });
        res.json(result);
    }
    catch (err) {
        console.error('❌ [/admin/questions/import-json] Beklenmeyen hata:', err);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});
exports.default = router;
