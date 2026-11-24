import type { PrismaClient, SupportCase } from '@prisma/client';
import { portalAssignees, type AdminSession } from '../middleware/auth';
import { audit, OperationError } from './adminAccountOperations';
import { isBugReport, type BugPlayerEmail } from './supportBugEmails';

const dayMs = 86_400_000;
export const firstReplyHours = () => {
  const value = Number(process.env.SUPPORT_FIRST_REPLY_HOURS);
  return Number.isInteger(value) && value >= 1 && value <= 168 ? value : 24;
};
export const appealCutoff = () => new Date(Date.now() - 30 * dayMs);
export const attachmentSelect = { id: true, name: true, mime: true, size: true } as const;
export const publicCaseFields = {
  id: true, kind: true, subject: true, message: true, moderationId: true,
  status: true, resolution: true, createdAt: true, updatedAt: true, revision: true, waitingForPlayer: true,
  attachments: { select: attachmentSelect, orderBy: { createdAt: 'asc' } },
} as const;

export const attachmentLimits = { maxFiles: 3, maxBytes: 3 * 1024 * 1024, maxTotalBytes: 6 * 1024 * 1024 } as const;
const attachmentMimes = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'application/pdf', 'text/plain', 'application/zip',
]);
export type CaseAttachment = { name: string, mime: string, size: number, data: Buffer };

function attachmentName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/[\\/]+/g, '-').trim().slice(0, 120);
  return cleaned.length ? cleaned : null;
}

/** Validates player supplied attachments (base64 JSON) before they reach the database. */
export function parseAttachments(value: unknown): CaseAttachment[] | null | 'invalid' {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length > attachmentLimits.maxFiles) return 'invalid';
  const parsed: CaseAttachment[] = [];
  let total = 0;
  for (const item of value) {
    if (!item || typeof item !== 'object') return 'invalid';
    const { name, mime, data } = item as { name?: unknown, mime?: unknown, data?: unknown };
    const cleanName = attachmentName(name);
    if (!cleanName || typeof mime !== 'string' || !attachmentMimes.has(mime) || typeof data !== 'string') return 'invalid';
    if (data.length < 4 || data.length > Math.ceil(attachmentLimits.maxBytes / 3) * 4 + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return 'invalid';
    const bytes = Buffer.from(data, 'base64');
    if (!bytes.length || bytes.length > attachmentLimits.maxBytes) return 'invalid';
    total += bytes.length;
    if (total > attachmentLimits.maxTotalBytes) return 'invalid';
    parsed.push({ name: cleanName, mime, size: bytes.length, data: bytes });
  }
  return parsed;
}

export async function readCaseAttachment(client: PrismaClient, caseId: string, attachmentId: string,
  viewer: { account: string } | { admin: AdminSession }) {
  const row = await client.supportCaseAttachment.findFirst({
    where: { id: attachmentId, caseId },
    select: { name: true, mime: true, size: true, data: true, ticket: { select: { accountId: true, kind: true } } },
  });
  const allowed = !!row && ('account' in viewer ? viewer.account === row.ticket.accountId : ticketKinds(viewer.admin.role).includes(row.ticket.kind));
  if (!row || !allowed) throw new OperationError(404, 'Ek dosya bulunamadı.');
  return { name: row.name, mime: row.mime, size: row.size, data: row.data };
}

export function attachmentHeaders(name: string, mime: string, size: number) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return {
    'Content-Type': mime,
    'Content-Length': String(size),
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  };
}
export const ticketKinds = (role: AdminSession['role']) =>
  role === 'owner' ? ['support', 'appeal'] : role === 'support' ? ['support'] : role === 'moderator' ? ['appeal'] : [];

export function caseText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== 'string' || value.length > max || /[\p{Cc}\p{Cf}]/u.test(value.replace(/\r?\n/g, ''))) return null;
  const trimmed = value.trim();
  return trimmed.length >= min ? trimmed : null;
}

function canWorkCase(admin: AdminSession, old: SupportCase) {
  return admin.role === 'owner' || old.assignee === admin.email ||
    !portalAssignees().some(person => person.email === old.assignee && ticketKinds(person.role).includes(old.kind));
}

export async function readCaseReplies(client: PrismaClient, id: string, viewer: { account: string } | { admin: AdminSession }) {
  const row = await client.supportCase.findUnique({
    where: { id }, select: { accountId: true, kind: true, status: true, revision: true, waitingForPlayer: true,
      replies: { take: 60, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, sender: true, body: true, createdAt: true } } },
  });
  if (!row || ('account' in viewer ? viewer.account !== row.accountId : !ticketKinds(viewer.admin.role).includes(row.kind))) {
    throw new OperationError(404, 'Talep bulunamadı.');
  }
  return { items: row.replies, status: row.status, revision: row.revision, waitingForPlayer: row.waitingForPlayer };
}

export async function replyToCase(client: PrismaClient, id: string, actor: { account: string } | { admin: AdminSession },
  input: { revision: number; body: string; ask: boolean }) {
  return client.$transaction(async tx => {
    const player = 'account' in actor;
    if (player) await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${actor.account} FOR UPDATE`;
    const old = await tx.supportCase.findUnique({ where: { id } });
    if (!old || (player ? old.accountId !== actor.account : !ticketKinds(actor.admin.role).includes(old.kind))) {
      throw new OperationError(404, 'Talep bulunamadı.');
    }
    if (old.status === 'resolved') throw new OperationError(409, 'Sonuçlanan talebe mesaj gönderilemez.');
    if (!player && !canWorkCase(actor.admin, old)) throw new OperationError(403, 'Bu talep başka bir görevliye atanmış.');
    const [total, recent] = await Promise.all([
      tx.supportCaseReply.count({ where: { caseId: id } }),
      player ? tx.supportCaseReply.count({ where: { sender: 'player', createdAt: { gt: new Date(Date.now()-3_600_000) },
        ticket: { accountId: old.accountId } } }) : Promise.resolve(0),
    ]);
    if (total >= 60 || recent >= 10) throw new OperationError(429, 'Mesaj sınırına ulaşıldı.');
    const changed = await tx.supportCase.updateMany({
      where: { id, revision: input.revision, status: { not: 'resolved' } },
      data: { revision: { increment: 1 }, waitingForPlayer: !player && input.ask, ...(!player && !old.firstReplyAt ? { firstReplyAt: new Date() } : {}) },
    });
    if (!changed.count) throw new OperationError(409, 'Konuşma güncellendi. Yenileyip tekrar deneyin.');
    const reply = await tx.supportCaseReply.create({ data: { caseId: id, body: input.body, sender: player ? 'player' : 'staff' } });
    if (!player) {
      await audit(tx, actor.admin, old.accountId, 'case_updated', input.ask ? 'Oyuncudan ek bilgi istendi.' : 'Oyuncuya destek mesajı gönderildi.',
        { caseId: id, replyId: reply.id, expectsReply: input.ask });
      await tx.userNotification.create({ data: { id: `reply_${reply.id}`, userId: old.accountId, type: 'system',
        title: input.ask ? 'Destek ekibi bilgi bekliyor' : 'Destek talebinize yeni mesaj', sub: 'Mesajı Ayarlar → Hesap → Destek talepleri bölümünden açın.',
        timeText: 'Şimdi' } });
    }
    const email: BugPlayerEmail | null = !player && isBugReport(old)
      ? { id, accountId: old.accountId, subject: old.subject, text: input.body, event: 'reply' } : null;
    return { id: reply.id, revision: input.revision + 1, ...(email ? { email } : {}) };
  });
}

export async function openCase(client: PrismaClient, accountId: string, input: {
  kind: 'support' | 'appeal'; subject: string; message: string; moderationId: string | null;
  attachments?: CaseAttachment[];
}) {
  return client.$transaction(async tx => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "users" WHERE "id"=${accountId} FOR UPDATE`;
    if (!locked.length) throw new OperationError(403, 'Kayıtlı oyuncu hesabı gerekli.');
    if (input.moderationId) {
      const record = await tx.adminAccountEvent.findFirst({ where: {
        id: input.moderationId, accountId, action: { in: ['warn', 'restrict'] }, createdAt: { gte: appealCutoff() },
      }, select: { id: true } });
      if (!record) throw new OperationError(404, 'İtiraza açık işlem bulunamadı.');
      if (await tx.supportCase.findUnique({ where: { moderationId: input.moderationId }, select: { id: true } })) {
        throw new OperationError(409, 'Bu işlem için zaten bir itiraz var.');
      }
    }
    const active = await tx.supportCase.count({ where: { accountId, status: { not: 'resolved' } } });
    const recent = await tx.supportCase.count({ where: { accountId, createdAt: { gt: new Date(Date.now() - dayMs) } } });
    if (active >= 3 || recent >= 5) throw new OperationError(429, 'Açık talep veya günlük başvuru sınırına ulaşıldı.');
    const { attachments, ...fields } = input;
    const saved = await tx.supportCase.create({ data: {
      accountId, ...fields,
      ...(attachments?.length ? { attachments: { create: attachments.map(file => ({
        name: file.name, mime: file.mime, size: file.size, data: new Uint8Array(file.data),
      })) } } : {}),
    }, select: publicCaseFields });
    await tx.adminAccountEvent.create({ data: {
      accountId, actor: accountId, role: 'player', action: 'case_opened',
      reason: input.kind === 'appeal' ? 'Oyuncu moderasyon itirazı açtı.' : 'Oyuncu destek talebi açtı.',
      details: { caseId: saved.id, kind: input.kind, moderationId: input.moderationId },
    } });
    return saved;
  });
}

export async function updateCase(client: PrismaClient, admin: AdminSession, id: string, input: {
  revision: number; assignee: string | null; status: 'open' | 'in_progress' | 'resolved'; reason: string; resolution: string | null;
}) {
  return client.$transaction(async tx => {
    const old = await tx.supportCase.findUnique({ where: { id } });
    if (!old || !ticketKinds(admin.role).includes(old.kind)) throw new OperationError(404, 'Talep bulunamadı.');
    if (old.status === 'resolved') throw new OperationError(409, 'Sonuçlanan talep değiştirilemez.');
    const assignee = portalAssignees().find(entry => entry.email === input.assignee && ticketKinds(entry.role).includes(old.kind));
    if ((input.assignee !== null && !assignee) || (input.status !== 'open' && !assignee)) {
      throw new OperationError(400, 'Bu durum için yetkili bir sorumlu seçin.');
    }
    if (admin.role !== 'owner' &&
        ((old.assignee && old.assignee !== admin.email && portalAssignees().some(e => e.email === old.assignee && ticketKinds(e.role).includes(old.kind))) ||
         (input.assignee !== null && input.assignee !== admin.email))) {
      throw new OperationError(403, 'Yalnızca kendinize atanmış veya atanmamış talepleri yönetebilirsiniz.');
    }
    if (input.status === 'resolved' && old.moderationId) {
      const event = await tx.adminAccountEvent.findUnique({ where: { id: old.moderationId }, select: { actor: true } });
      if (event?.actor === admin.email) throw new OperationError(403, 'Kendi moderasyon işleminizin itirazını sonuçlandıramazsınız.');
    }
    const changed = await tx.supportCase.updateMany({
      where: { id, revision: input.revision, status: { not: 'resolved' } },
      data: { assignee: input.assignee, status: input.status, resolution: input.resolution, revision: { increment: 1 },
        ...(input.status === 'resolved' ? { waitingForPlayer: false, firstReplyAt: old.firstReplyAt ?? new Date() } : {}) },
    });
    if (!changed.count) throw new OperationError(409, 'Talep başka biri tarafından güncellendi. Listeyi yenileyin.');
    await audit(tx, admin, old.accountId, 'case_updated', input.reason, {
      caseId: id, kind: old.kind, before: old.status, after: input.status, assignee: input.assignee,
    });
    if (input.status === 'resolved') {
      await tx.userNotification.create({ data: {
        id: `support_${id}`, userId: old.accountId, type: 'system', title: 'Talebiniz sonuçlandı',
        sub: 'Yanıtı Ayarlar → Hesap → Destek talepleri bölümünde görebilirsiniz.', timeText: 'Şimdi',
      } });
    }
    const email: BugPlayerEmail | null = input.status === 'resolved' && input.resolution && isBugReport(old)
      ? { id, accountId: old.accountId, subject: old.subject, text: input.resolution, event: 'resolved' } : null;
    return email;
  });
}
