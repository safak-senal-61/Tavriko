"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ticketKinds = exports.attachmentLimits = exports.publicCaseFields = exports.attachmentSelect = exports.appealCutoff = exports.firstReplyHours = void 0;
exports.parseAttachments = parseAttachments;
exports.readCaseAttachment = readCaseAttachment;
exports.attachmentHeaders = attachmentHeaders;
exports.caseText = caseText;
exports.readCaseReplies = readCaseReplies;
exports.replyToCase = replyToCase;
exports.openCase = openCase;
exports.updateCase = updateCase;
const auth_1 = require("../middleware/auth");
const adminAccountOperations_1 = require("./adminAccountOperations");
const supportBugEmails_1 = require("./supportBugEmails");
const dayMs = 86_400_000;
const firstReplyHours = () => {
    const value = Number(process.env.SUPPORT_FIRST_REPLY_HOURS);
    return Number.isInteger(value) && value >= 1 && value <= 168 ? value : 24;
};
exports.firstReplyHours = firstReplyHours;
const appealCutoff = () => new Date(Date.now() - 30 * dayMs);
exports.appealCutoff = appealCutoff;
exports.attachmentSelect = { id: true, name: true, mime: true, size: true };
exports.publicCaseFields = {
    id: true, kind: true, subject: true, message: true, moderationId: true,
    status: true, resolution: true, createdAt: true, updatedAt: true, revision: true, waitingForPlayer: true,
    attachments: { select: exports.attachmentSelect, orderBy: { createdAt: 'asc' } },
};
exports.attachmentLimits = { maxFiles: 3, maxBytes: 3 * 1024 * 1024, maxTotalBytes: 6 * 1024 * 1024 };
const attachmentMimes = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'application/pdf', 'text/plain', 'application/zip',
]);
function attachmentName(value) {
    if (typeof value !== 'string')
        return null;
    const cleaned = value.replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/[\\/]+/g, '-').trim().slice(0, 120);
    return cleaned.length ? cleaned : null;
}
/** Validates player supplied attachments (base64 JSON) before they reach the database. */
function parseAttachments(value) {
    if (value === undefined || value === null)
        return null;
    if (!Array.isArray(value) || value.length > exports.attachmentLimits.maxFiles)
        return 'invalid';
    const parsed = [];
    let total = 0;
    for (const item of value) {
        if (!item || typeof item !== 'object')
            return 'invalid';
        const { name, mime, data } = item;
        const cleanName = attachmentName(name);
        if (!cleanName || typeof mime !== 'string' || !attachmentMimes.has(mime) || typeof data !== 'string')
            return 'invalid';
        if (data.length < 4 || data.length > Math.ceil(exports.attachmentLimits.maxBytes / 3) * 4 + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data))
            return 'invalid';
        const bytes = Buffer.from(data, 'base64');
        if (!bytes.length || bytes.length > exports.attachmentLimits.maxBytes)
            return 'invalid';
        total += bytes.length;
        if (total > exports.attachmentLimits.maxTotalBytes)
            return 'invalid';
        parsed.push({ name: cleanName, mime, size: bytes.length, data: bytes });
    }
    return parsed;
}
async function readCaseAttachment(client, caseId, attachmentId, viewer) {
    const row = await client.supportCaseAttachment.findFirst({
        where: { id: attachmentId, caseId },
        select: { name: true, mime: true, size: true, data: true, ticket: { select: { accountId: true, kind: true } } },
    });
    const allowed = !!row && ('account' in viewer ? viewer.account === row.ticket.accountId : (0, exports.ticketKinds)(viewer.admin.role).includes(row.ticket.kind));
    if (!row || !allowed)
        throw new adminAccountOperations_1.OperationError(404, 'Ek dosya bulunamadı.');
    return { name: row.name, mime: row.mime, size: row.size, data: row.data };
}
function attachmentHeaders(name, mime, size) {
    const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    return {
        'Content-Type': mime,
        'Content-Length': String(size),
        'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
    };
}
const ticketKinds = (role) => role === 'owner' ? ['support', 'appeal'] : role === 'support' ? ['support'] : role === 'moderator' ? ['appeal'] : [];
exports.ticketKinds = ticketKinds;
function caseText(value, min, max) {
    if (typeof value !== 'string' || value.length > max || /[\p{Cc}\p{Cf}]/u.test(value.replace(/\r?\n/g, '')))
        return null;
    const trimmed = value.trim();
    return trimmed.length >= min ? trimmed : null;
}
function canWorkCase(admin, old) {
    return admin.role === 'owner' || old.assignee === admin.email ||
        !(0, auth_1.portalAssignees)().some(person => person.email === old.assignee && (0, exports.ticketKinds)(person.role).includes(old.kind));
}
async function readCaseReplies(client, id, viewer) {
    const row = await client.supportCase.findUnique({
        where: { id }, select: { accountId: true, kind: true, status: true, revision: true, waitingForPlayer: true,
            replies: { take: 60, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, sender: true, body: true, createdAt: true } } },
    });
    if (!row || ('account' in viewer ? viewer.account !== row.accountId : !(0, exports.ticketKinds)(viewer.admin.role).includes(row.kind))) {
        throw new adminAccountOperations_1.OperationError(404, 'Talep bulunamadı.');
    }
    return { items: row.replies, status: row.status, revision: row.revision, waitingForPlayer: row.waitingForPlayer };
}
async function replyToCase(client, id, actor, input) {
    return client.$transaction(async (tx) => {
        const player = 'account' in actor;
        if (player)
            await tx.$queryRaw `SELECT "id" FROM "users" WHERE "id"=${actor.account} FOR UPDATE`;
        const old = await tx.supportCase.findUnique({ where: { id } });
        if (!old || (player ? old.accountId !== actor.account : !(0, exports.ticketKinds)(actor.admin.role).includes(old.kind))) {
            throw new adminAccountOperations_1.OperationError(404, 'Talep bulunamadı.');
        }
        if (old.status === 'resolved')
            throw new adminAccountOperations_1.OperationError(409, 'Sonuçlanan talebe mesaj gönderilemez.');
        if (!player && !canWorkCase(actor.admin, old))
            throw new adminAccountOperations_1.OperationError(403, 'Bu talep başka bir görevliye atanmış.');
        const [total, recent] = await Promise.all([
            tx.supportCaseReply.count({ where: { caseId: id } }),
            player ? tx.supportCaseReply.count({ where: { sender: 'player', createdAt: { gt: new Date(Date.now() - 3_600_000) },
                    ticket: { accountId: old.accountId } } }) : Promise.resolve(0),
        ]);
        if (total >= 60 || recent >= 10)
            throw new adminAccountOperations_1.OperationError(429, 'Mesaj sınırına ulaşıldı.');
        const changed = await tx.supportCase.updateMany({
            where: { id, revision: input.revision, status: { not: 'resolved' } },
            data: { revision: { increment: 1 }, waitingForPlayer: !player && input.ask, ...(!player && !old.firstReplyAt ? { firstReplyAt: new Date() } : {}) },
        });
        if (!changed.count)
            throw new adminAccountOperations_1.OperationError(409, 'Konuşma güncellendi. Yenileyip tekrar deneyin.');
        const reply = await tx.supportCaseReply.create({ data: { caseId: id, body: input.body, sender: player ? 'player' : 'staff' } });
        if (!player) {
            await (0, adminAccountOperations_1.audit)(tx, actor.admin, old.accountId, 'case_updated', input.ask ? 'Oyuncudan ek bilgi istendi.' : 'Oyuncuya destek mesajı gönderildi.', { caseId: id, replyId: reply.id, expectsReply: input.ask });
            await tx.userNotification.create({ data: { id: `reply_${reply.id}`, userId: old.accountId, type: 'system',
                    title: input.ask ? 'Destek ekibi bilgi bekliyor' : 'Destek talebinize yeni mesaj', sub: 'Mesajı Ayarlar → Hesap → Destek talepleri bölümünden açın.',
                    timeText: 'Şimdi' } });
        }
        const email = !player && (0, supportBugEmails_1.isBugReport)(old)
            ? { id, accountId: old.accountId, subject: old.subject, text: input.body, event: 'reply' } : null;
        return { id: reply.id, revision: input.revision + 1, ...(email ? { email } : {}) };
    });
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
        const { attachments, ...fields } = input;
        const saved = await tx.supportCase.create({ data: {
                accountId, ...fields,
                ...(attachments?.length ? { attachments: { create: attachments.map(file => ({
                            name: file.name, mime: file.mime, size: file.size, data: new Uint8Array(file.data),
                        })) } } : {}),
            }, select: exports.publicCaseFields });
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
            data: { assignee: input.assignee, status: input.status, resolution: input.resolution, revision: { increment: 1 },
                ...(input.status === 'resolved' ? { waitingForPlayer: false, firstReplyAt: old.firstReplyAt ?? new Date() } : {}) },
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
        const email = input.status === 'resolved' && input.resolution && (0, supportBugEmails_1.isBugReport)(old)
            ? { id, accountId: old.accountId, subject: old.subject, text: input.resolution, event: 'resolved' } : null;
        return email;
    });
}
