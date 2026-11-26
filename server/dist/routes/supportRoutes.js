"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSupportRouter = createSupportRouter;
const express_1 = require("express");
const express_rate_limit_1 = require("express-rate-limit");
const functions_1 = require("@vercel/functions");
const prismaClient_1 = require("../db/prismaClient");
const auth_1 = require("../middleware/auth");
const adminAccountOperations_1 = require("../services/adminAccountOperations");
const supportCases_1 = require("../services/supportCases");
const playerAccess_1 = require("../services/playerAccess");
const supportBugEmails_1 = require("../services/supportBugEmails");
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
        const bug = kind === 'bug';
        const attachments = (0, supportCases_1.parseAttachments)(req.body?.attachments);
        const text = (0, supportCases_1.caseText)(message, 12, 1200);
        const subject = kind === 'appeal' ? 'Moderasyon itirazı' : (0, supportCases_1.caseText)(req.body?.subject, 4, bug ? 80 - supportBugEmails_1.BUG_REPORT_PREFIX.length : 80);
        if (attachments === 'invalid') {
            return res.status(400).json({ error: 'Ek dosyalar geçersiz. En fazla 3 dosya, her biri 3 MB olabilir; görsel, PDF, metin veya ZIP ekleyin.' });
        }
        if (!text || !subject || subject.includes('\n') || (kind === 'appeal' && attachments?.length) ||
            (kind === 'appeal' ? typeof moderationId !== 'string' || !adminAccountOperations_1.uuidPattern.test(moderationId)
                : (!bug && kind !== 'support') || moderationId != null || subject.startsWith(supportBugEmails_1.BUG_REPORT_PREFIX.trimEnd()))) {
            return res.status(400).json({ error: 'Konu, açıklama veya itiraz kaydı geçersiz.' });
        }
        try {
            const accountId = req.authUserId;
            const saved = await (0, supportCases_1.openCase)(client, accountId, {
                kind: kind === 'appeal' ? 'appeal' : 'support',
                subject: bug ? supportBugEmails_1.BUG_REPORT_PREFIX + subject : subject, message: text, moderationId: moderationId ?? null,
                attachments: attachments ?? [],
            });
            if (bug) {
                const delivery = (0, supportBugEmails_1.notifyOwnerOfBug)(client, { id: saved.id, accountId, subject: saved.subject, attachmentCount: saved.attachments?.length ?? 0 });
                if (process.env.VERCEL)
                    (0, functions_1.waitUntil)(delivery);
                else
                    void delivery;
            }
            res.status(201).json(saved);
        }
        catch (error) {
            if (error instanceof adminAccountOperations_1.OperationError)
                return res.status(error.status).json({ error: error.message });
            res.status(503).json({ error: 'Talep kaydedilemedi. Yeniden göndermeden önce listeyi yenileyin.' });
        }
    });
    const playerReportLimit = (0, express_rate_limit_1.rateLimit)({
        windowMs: 60_000, limit: 10,
        keyGenerator: req => req.authUserId,
        standardHeaders: 'draft-8', legacyHeaders: false,
        message: { error: 'Çok fazla bildirim denemesi. Lütfen biraz bekle.' },
    });
    router.post('/player-report', playerReportLimit, async (req, res) => {
        if (!req.is('application/json'))
            return res.status(415).json({ error: 'JSON gerekli.' });
        const { targetUserId, reason } = req.body || {};
        if (typeof targetUserId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(targetUserId) ||
            targetUserId === req.authUserId || (0, playerAccess_1.isGuestIdentity)(targetUserId) ||
            (reason !== 'profile' && reason !== 'behavior')) {
            return res.status(400).json({ error: 'Oyuncu veya bildirim nedeni geçersiz.' });
        }
        try {
            const target = await client.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
            if (!target)
                return res.status(404).json({ error: 'Oyuncu bulunamadı.' });
            const label = reason === 'profile' ? 'Uygunsuz profil (ad veya görsel)' : 'Uygunsuz oyuncu davranışı';
            const saved = await (0, supportCases_1.openCase)(client, req.authUserId, {
                kind: 'support', subject: 'Oyuncu bildirimi',
                message: `Bildirilen oyuncu kimliği: ${target.id}\nNeden: ${label}`, moderationId: null,
            });
            return res.status(201).json({ id: saved.id });
        }
        catch (error) {
            if (error instanceof adminAccountOperations_1.OperationError)
                return res.status(error.status).json({ error: error.message });
            return res.status(503).json({ error: 'Bildirim kaydedilemedi.' });
        }
    });
    router.get('/:id/attachments/:attachmentId', async (req, res) => {
        const { id, attachmentId } = req.params;
        if (!adminAccountOperations_1.uuidPattern.test(id) || !adminAccountOperations_1.uuidPattern.test(attachmentId))
            return res.status(404).json({ error: 'Ek dosya bulunamadı.' });
        try {
            const file = await (0, supportCases_1.readCaseAttachment)(client, id, attachmentId, { account: req.authUserId });
            res.set((0, supportCases_1.attachmentHeaders)(file.name, file.mime, file.size)).end(file.data);
        }
        catch (error) {
            res.status(error instanceof adminAccountOperations_1.OperationError ? error.status : 503).json({ error: error instanceof adminAccountOperations_1.OperationError ? error.message : 'Ek dosya açılamadı.' });
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
