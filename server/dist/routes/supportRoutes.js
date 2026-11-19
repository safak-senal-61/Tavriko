"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSupportRouter = createSupportRouter;
const express_1 = require("express");
const prismaClient_1 = require("../db/prismaClient");
const auth_1 = require("../middleware/auth");
const adminAccountOperations_1 = require("../services/adminAccountOperations");
const supportCases_1 = require("../services/supportCases");
const playerAccess_1 = require("../services/playerAccess");
function createSupportRouter(client = prismaClient_1.db.rawClient) {
    const router = (0, express_1.Router)();
    router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    router.use(auth_1.requireUserAuth, (req, res, next) => {
        if (!req.authUserId || (0, playerAccess_1.isGuestIdentity)(req.authUserId))
            return res.status(403).json({ error: 'Kayıtlı oyuncu hesabı gerekli.' });
        next();
    });
    router.get('/', async (req, res) => {
        const accountId = req.authUserId;
        const page = Number(req.query.page ?? '1');
        if (!Number.isInteger(page) || page < 1 || page > 1000)
            return res.status(400).json({ error: 'Sayfa geçersiz.' });
        try {
            const [cases, events] = await Promise.all([
                client.supportCase.findMany({ where: { accountId }, select: supportCases_1.publicCaseFields, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 20, take: 21 }),
                client.adminAccountEvent.findMany({ where: { accountId, action: { in: ['warn', 'restrict'] }, createdAt: { gte: (0, supportCases_1.appealCutoff)() } },
                    select: { id: true, action: true, createdAt: true }, take: 30, orderBy: { createdAt: 'desc' } }),
            ]);
            const appealed = await client.supportCase.findMany({ where: { accountId, moderationId: { in: events.map(event => event.id) } }, select: { moderationId: true } });
            const used = new Set(appealed.map(item => item.moderationId));
            res.json({ cases: cases.slice(0, 20), more: cases.length > 20 && page < 1000, events: events.filter(event => !used.has(event.id)) });
        }
        catch {
            res.status(503).json({ error: 'Talepler yüklenemedi.' });
        }
    });
    router.post('/', async (req, res) => {
        if (!req.is('application/json'))
            return res.status(415).json({ error: 'JSON gerekli.' });
        const { kind, moderationId, message } = req.body || {};
        const text = (0, supportCases_1.caseText)(message, 12, 1200);
        const subject = kind === 'appeal' ? 'Moderasyon itirazı' : (0, supportCases_1.caseText)(req.body?.subject, 4, 80);
        if (!text || !subject || subject.includes('\n') || (kind === 'appeal' ? typeof moderationId !== 'string' || !adminAccountOperations_1.uuidPattern.test(moderationId)
            : kind !== 'support' || moderationId != null))
            return res.status(400).json({ error: 'Konu, açıklama veya itiraz kaydı geçersiz.' });
        try {
            res.status(201).json(await (0, supportCases_1.openCase)(client, req.authUserId, { kind, subject, message: text, moderationId: moderationId ?? null }));
        }
        catch (error) {
            if (error instanceof adminAccountOperations_1.OperationError)
                return res.status(error.status).json({ error: error.message });
            res.status(503).json({ error: 'Talep kaydedilemedi. Yeniden göndermeden önce listeyi yenileyin.' });
        }
    });
    router.get('/:id/replies', async (req, res) => {
        if (!adminAccountOperations_1.uuidPattern.test(req.params.id))
            return res.status(404).json({ error: 'Talep bulunamadı.' });
        try {
            res.json(await (0, supportCases_1.readCaseReplies)(client, req.params.id, { account: req.authUserId }));
        }
        catch (error) {
            res.status(error instanceof adminAccountOperations_1.OperationError ? error.status : 503).json({ error: error instanceof adminAccountOperations_1.OperationError ? error.message : 'Konuşma yüklenemedi.' });
        }
    });
    router.post('/:id/replies', async (req, res) => {
        if (!req.is('application/json'))
            return res.status(415).json({ error: 'JSON gerekli.' });
        const { revision, body } = req.body || {};
        const text = (0, supportCases_1.caseText)(body, 3, 1200);
        if (!adminAccountOperations_1.uuidPattern.test(req.params.id) || !Number.isSafeInteger(revision) || revision < 0 || !text) {
            return res.status(400).json({ error: 'Mesajı ve talep bilgilerini kontrol edin.' });
        }
        try {
            res.status(201).json(await (0, supportCases_1.replyToCase)(client, req.params.id, { account: req.authUserId }, { revision, body: text, ask: false }));
        }
        catch (error) {
            res.status(error instanceof adminAccountOperations_1.OperationError ? error.status : 503).json({ error: error instanceof adminAccountOperations_1.OperationError ? error.message : 'Mesaj kaydedilemedi. Tekrar göndermeden önce konuşmayı yenileyin.' });
        }
    });
    return router;
}
