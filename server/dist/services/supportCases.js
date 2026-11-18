"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ticketKinds = exports.publicCaseFields = exports.appealCutoff = void 0;
exports.caseText = caseText;
exports.openCase = openCase;
exports.updateCase = updateCase;
const auth_1 = require("../middleware/auth");
const adminAccountOperations_1 = require("./adminAccountOperations");
const dayMs = 86_400_000;
const appealCutoff = () => new Date(Date.now() - 30 * dayMs);
exports.appealCutoff = appealCutoff;
exports.publicCaseFields = {
    id: true, kind: true, subject: true, message: true, moderationId: true,
    status: true, resolution: true, createdAt: true, updatedAt: true,
};
const ticketKinds = (role) => role === 'owner' ? ['support', 'appeal'] : role === 'support' ? ['support'] : role === 'moderator' ? ['appeal'] : [];
exports.ticketKinds = ticketKinds;
function caseText(value, min, max) {
    if (typeof value !== 'string' || value.length > max || /[\p{Cc}\p{Cf}]/u.test(value.replace(/\r?\n/g, '')))
        return null;
    const trimmed = value.trim();
    return trimmed.length >= min ? trimmed : null;
}
async function openCase(client, accountId, input) {
    return client.$transaction(async (tx) => {
        const locked = await tx.$queryRaw `SELECT "id" FROM "users" WHERE "id"=${accountId} FOR UPDATE`;
        if (!locked.length)
            throw new adminAccountOperations_1.OperationError(403, 'Kayıtlı oyuncu hesabı gerekli.');
        if (input.moderationId) {
            const record = await tx.adminAccountEvent.findFirst({ where: {
                    id: input.moderationId, accountId, action: { in: ['warn', 'restrict'] }, createdAt: { gte: (0, exports.appealCutoff)() },
                }, select: { id: true } });
            if (!record)
                throw new adminAccountOperations_1.OperationError(404, 'İtiraza açık işlem bulunamadı.');
            if (await tx.supportCase.findUnique({ where: { moderationId: input.moderationId }, select: { id: true } })) {
                throw new adminAccountOperations_1.OperationError(409, 'Bu işlem için zaten bir itiraz var.');
            }
        }
        const active = await tx.supportCase.count({ where: { accountId, status: { not: 'resolved' } } });
        const recent = await tx.supportCase.count({ where: { accountId, createdAt: { gt: new Date(Date.now() - dayMs) } } });
        if (active >= 3 || recent >= 5)
            throw new adminAccountOperations_1.OperationError(429, 'Açık talep veya günlük başvuru sınırına ulaşıldı.');
        const saved = await tx.supportCase.create({ data: { accountId, ...input }, select: exports.publicCaseFields });
        await tx.adminAccountEvent.create({ data: {
                accountId, actor: accountId, role: 'player', action: 'case_opened',
                reason: input.kind === 'appeal' ? 'Oyuncu moderasyon itirazı açtı.' : 'Oyuncu destek talebi açtı.',
                details: { caseId: saved.id, kind: input.kind, moderationId: input.moderationId },
            } });
        return saved;
    });
}
async function updateCase(client, admin, id, input) {
    return client.$transaction(async (tx) => {
        const old = await tx.supportCase.findUnique({ where: { id } });
        if (!old || !(0, exports.ticketKinds)(admin.role).includes(old.kind))
            throw new adminAccountOperations_1.OperationError(404, 'Talep bulunamadı.');
        if (old.status === 'resolved')
            throw new adminAccountOperations_1.OperationError(409, 'Sonuçlanan talep değiştirilemez.');
        const assignee = (0, auth_1.portalAssignees)().find(entry => entry.email === input.assignee && (0, exports.ticketKinds)(entry.role).includes(old.kind));
        if ((input.assignee !== null && !assignee) || (input.status !== 'open' && !assignee)) {
            throw new adminAccountOperations_1.OperationError(400, 'Bu durum için yetkili bir sorumlu seçin.');
        }
        if (admin.role !== 'owner' &&
            ((old.assignee && old.assignee !== admin.email && (0, auth_1.portalAssignees)().some(e => e.email === old.assignee && (0, exports.ticketKinds)(e.role).includes(old.kind))) ||
                (input.assignee !== null && input.assignee !== admin.email))) {
            throw new adminAccountOperations_1.OperationError(403, 'Yalnızca kendinize atanmış veya atanmamış talepleri yönetebilirsiniz.');
        }
        if (input.status === 'resolved' && old.moderationId) {
            const event = await tx.adminAccountEvent.findUnique({ where: { id: old.moderationId }, select: { actor: true } });
            if (event?.actor === admin.email)
                throw new adminAccountOperations_1.OperationError(403, 'Kendi moderasyon işleminizin itirazını sonuçlandıramazsınız.');
        }
        const changed = await tx.supportCase.updateMany({
            where: { id, revision: input.revision, status: { not: 'resolved' } },
            data: { assignee: input.assignee, status: input.status, resolution: input.resolution, revision: { increment: 1 } },
        });
        if (!changed.count)
            throw new adminAccountOperations_1.OperationError(409, 'Talep başka biri tarafından güncellendi. Listeyi yenileyin.');
        await (0, adminAccountOperations_1.audit)(tx, admin, old.accountId, 'case_updated', input.reason, {
            caseId: id, kind: old.kind, before: old.status, after: input.status, assignee: input.assignee,
        });
        if (input.status === 'resolved') {
            await tx.userNotification.create({ data: {
                    id: `support_${id}`, userId: old.accountId, type: 'system', title: 'Talebiniz sonuçlandı',
                    sub: 'Yanıtı Ayarlar → Hesap → Destek talepleri bölümünde görebilirsiniz.', timeText: 'Şimdi',
                } });
        }
    });
}
