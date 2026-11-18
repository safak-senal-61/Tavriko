import type { PrismaClient } from '@prisma/client';
import { portalAssignees, type AdminSession } from '../middleware/auth';
import { audit, OperationError } from './adminAccountOperations';

const dayMs = 86_400_000;
export const appealCutoff = () => new Date(Date.now() - 30 * dayMs);
export const publicCaseFields = {
  id: true, kind: true, subject: true, message: true, moderationId: true,
  status: true, resolution: true, createdAt: true, updatedAt: true,
} as const;
export const ticketKinds = (role: AdminSession['role']) =>
  role === 'owner' ? ['support', 'appeal'] : role === 'support' ? ['support'] : role === 'moderator' ? ['appeal'] : [];

export function caseText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== 'string' || value.length > max || /[\p{Cc}\p{Cf}]/u.test(value.replace(/\r?\n/g, ''))) return null;
  const trimmed = value.trim();
  return trimmed.length >= min ? trimmed : null;
}

export async function openCase(client: PrismaClient, accountId: string, input: {
  kind: 'support' | 'appeal'; subject: string; message: string; moderationId: string | null;
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
    const saved = await tx.supportCase.create({ data: { accountId, ...input }, select: publicCaseFields });
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
      data: { assignee: input.assignee, status: input.status, resolution: input.resolution, revision: { increment: 1 } },
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
  });
}
