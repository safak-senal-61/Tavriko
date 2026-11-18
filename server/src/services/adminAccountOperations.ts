import type { Prisma, PrismaClient } from '@prisma/client';
import { COSMETIC_DEFS, COSMETIC_RENTAL_HOURS } from '@trivia/shared';
import type { AdminSession } from '../middleware/auth';

export type Operation = 'profile' | 'note' | 'moderate' | 'grant' | 'review';
export const permissions = (admin: AdminSession) => ({
  profile: admin.role === 'owner' || admin.role === 'support',
  note: admin.role !== 'approver',
  moderate: admin.role === 'owner' || admin.role === 'moderator',
  grant: admin.role === 'owner' || admin.role === 'support',
  review: admin.role === 'owner' || admin.role === 'approver',
});

export const limits = {
  coins: { direct: 1000, max: 10000 },
  gems: { direct: 50, max: 500 },
  item: { direct: 1, max: 5 },
} as const;
export type GrantKind = keyof typeof limits;
export const compensationCatalog = COSMETIC_DEFS.map(({ id, name, desc }) => ({ id, name, desc }));
const catalog = new Map(compensationCatalog.map(item => [item.id, item]));
export const reasonText = (input: unknown) =>
  typeof input === 'string' && input.length <= 500 && !/[\p{Cc}\p{Cf}]/u.test(input) && input.trim().length >= 8 ? input.trim() : null;
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const restrictionsEnabled = () => process.env.ACCOUNT_RESTRICTIONS_ENABLED === 'true';

export class OperationError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export async function audit(
  tx: Prisma.TransactionClient, admin: AdminSession, accountId: string,
  action: string, reason: string, details: Prisma.InputJsonObject = {},
) {
  return tx.adminAccountEvent.create({ data: { accountId, actor: admin.email, role: admin.role, action, reason, details } });
}

// Every moderation/compensation decision for an account is ordered on the same PostgreSQL row.
async function lockAccount(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<{ restrictedUntil: Date | null }[]>`
    SELECT "restrictedUntil" FROM "users" WHERE "id" = ${id} FOR UPDATE`;
  if (!rows.length) throw new OperationError(404, 'Hesap bulunamadı.');
  return rows[0];
}

export async function addSupportNote(client: PrismaClient, admin: AdminSession, id: string, note: string) {
  return client.$transaction(async tx => {
    await lockAccount(tx, id);
    return audit(tx, admin, id, 'note', note);
  });
}

export type ModerationAction = 'warn' | 'restrict' | 'lift';
export async function moderateAccount(
  client: PrismaClient, admin: AdminSession, id: string, action: ModerationAction, reason: string, hours?: number,
) {
  if (action !== 'warn' && !restrictionsEnabled()) throw new OperationError(503, 'Oyun kısıtlaması bu ortamda etkin değil.');
  return client.$transaction(async tx => {
    const current = await lockAccount(tx, id);
    const now = new Date();
    const before = current.restrictedUntil;
    const active = before && before > now;
    let next = before;
    if (action === 'restrict') {
      if (active) throw new OperationError(409, 'Zaten bir kısıtlama var. Değiştirmek için önce kaldırın.');
      next = new Date(now.getTime() + hours! * 3_600_000);
    } else if (action === 'lift') {
      if (!active) throw new OperationError(409, 'Kaldırılacak etkin kısıtlama yok.');
      next = null;
    }
    if (action !== 'warn') await tx.user.update({ where: { id }, data: { restrictedUntil: next } });
    const entry = await audit(tx, admin, id, action, reason,
      action === 'warn' ? { channel: 'in-app' } : { before: before?.toISOString() ?? null, after: next?.toISOString() ?? null });
    const title = {
      warn: 'Moderasyon uyarısı',
      restrict: 'Çevrimiçi oyun kısıtlaması',
      lift: 'Oyun kısıtlaması kaldırıldı',
    }[action];
    // Internal notes/reasons stay private; the player sees the action and, if relevant, the expiry.
    const ends = next && new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul', dateStyle: 'medium', timeStyle: 'short',
    }).format(next);
    const sub = action === 'warn' ? 'Hesabınıza bir moderasyon uyarısı verildi. Ayrıntı için destek ekibiyle iletişime geçebilirsiniz.'
      : action === 'restrict' ? `Çevrimiçi oyun erişimi ${ends} (Türkiye saati) tarihine kadar kısıtlandı.`
      : 'Çevrimiçi oyun erişiminiz yeniden açıldı.';
    await tx.userNotification.create({ data: { id: `moderation_${entry.id}`, userId: id, type: 'system', title, sub, timeText: 'Şimdi' } });
    return { restrictedUntil: next, eventId: entry.id };
  });
}

type GrantInput = { id: string; kind: GrantKind; itemId: string | null; amount: number; reason: string };
export function grantInput(body: Record<string, unknown>): GrantInput | null {
  const { id, kind, amount, itemId, reason } = body;
  const text = reasonText(reason);
  if (typeof id !== 'string' || !uuidPattern.test(id) || (kind !== 'coins' && kind !== 'gems' && kind !== 'item') ||
      typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1 || amount > limits[kind].max || !text ||
      (kind === 'item' ? typeof itemId !== 'string' || !catalog.has(itemId) : itemId != null)) return null;
  return { id: id.toLowerCase(), kind, amount, itemId: kind === 'item' ? itemId as string : null, reason: text };
}

async function appliedAmount(tx: Prisma.TransactionClient, accountId: string, kind: GrantKind, now: Date) {
  const totals = await tx.adminCompensation.aggregate({
    where: { accountId, kind, status: 'applied', decidedAt: { gt: new Date(now.getTime() - 86_400_000) } },
    _sum: { amount: true },
  });
  return totals._sum.amount ?? 0;
}

function assertLimit(kind: GrantKind, applied: number, amount: number) {
  if (applied + amount > limits[kind].max) throw new OperationError(409, 'Hesabın son 24 saatlik telafi limiti aşılır.');
}

async function applyGrant(tx: Prisma.TransactionClient, accountId: string, grant: GrantInput): Promise<Prisma.InputJsonObject> {
  if (grant.kind !== 'item') {
    const user = await tx.user.update({
      where: { id: accountId }, data: { [grant.kind]: { increment: grant.amount } }, select: { coins: true, gems: true },
    });
    return { before: user[grant.kind] - grant.amount, after: user[grant.kind] };
  }
  const item = catalog.get(grant.itemId || '');
  if (!item) throw new OperationError(409, 'Bu eşya artık telafi kataloğunda yok.');
  // Existing copies with another duration must not be overwritten or extended by the grant.
  const changed = await tx.$queryRaw<{ qty: number }[]>`
    INSERT INTO "user_inventory_items" ("id", "userId", "itemId", "name", "desc", "qty", "durationHours", "updatedAt")
    VALUES (${grant.id}, ${accountId}, ${item.id}, ${item.name}, ${item.desc}, ${grant.amount}, ${COSMETIC_RENTAL_HOURS}, now())
    ON CONFLICT ("userId", "itemId") DO UPDATE SET "qty" = "user_inventory_items"."qty" + EXCLUDED."qty",
      "updatedAt" = now()
    WHERE COALESCE("user_inventory_items"."durationHours", 1) = EXCLUDED."durationHours"
    RETURNING "qty"`;
  if (!changed.length) throw new OperationError(409, 'Envanterde farklı süreli bir kopya var. Telafi mevcut kopyayı değiştirmedi.');
  return { itemName: item.name, before: changed[0].qty - grant.amount, after: changed[0].qty };
}

export async function requestGrant(client: PrismaClient, admin: AdminSession, accountId: string, grant: GrantInput) {
  return client.$transaction(async tx => {
    // Serialize by requester across different player accounts so concurrent grants cannot miss the threshold.
    await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${`compensation:${admin.email}`}, 0))`;
    await lockAccount(tx, accountId);
    const existing = await tx.adminCompensation.findUnique({ where: { id: grant.id } });
    if (existing) {
      if (existing.accountId !== accountId || existing.requester !== admin.email || existing.kind !== grant.kind ||
          existing.itemId !== grant.itemId || existing.amount !== grant.amount || existing.reason !== grant.reason) {
        throw new OperationError(409, 'İşlem kimliği başka bir telafide kullanılmış.');
      }
      return existing;
    }
    const now = new Date();
    const applied = await appliedAmount(tx, accountId, grant.kind, now);
    assertLimit(grant.kind, applied, grant.amount);
    const pending = applied + grant.amount > limits[grant.kind].direct;
    if (pending && await tx.adminCompensation.count({ where: { accountId, status: 'pending', expiresAt: { gt: now } } }) >= 5) {
      throw new OperationError(409, 'Bu hesapta en fazla beş telafi onay bekleyebilir.');
    }
    const change = pending ? {} : await applyGrant(tx, accountId, grant);
    const saved = await tx.adminCompensation.create({ data: {
      ...grant, accountId, requester: admin.email, status: pending ? 'pending' : 'applied',
      createdAt: now, expiresAt: new Date(now.getTime() + 48 * 3_600_000), decidedAt: pending ? null : now,
    } });
    await audit(tx, admin, accountId, pending ? 'grant_requested' : 'grant_applied', grant.reason,
      { requestId: grant.id, kind: grant.kind, itemId: grant.itemId, amount: grant.amount, ...change });
    const since = new Date(now.getTime() - 3_600_000);
    const count = await tx.adminCompensation.count({ where: { requester: admin.email, createdAt: { gt: since } } });
    if (count >= 5 && !await tx.adminRiskAlert.findFirst({ where: { actor: admin.email, createdAt: { gt: since } }, select: { id: true } })) {
      await tx.adminRiskAlert.create({ data: { actor: admin.email, count, createdAt: now } });
    }
    return saved;
  });
}

export async function reviewGrant(
  client: PrismaClient, admin: AdminSession, grantId: string, decision: 'approve' | 'reject', reason: string,
) {
  return client.$transaction(async tx => {
    const first = await tx.adminCompensation.findUnique({ where: { id: grantId }, select: { accountId: true } });
    if (!first) throw new OperationError(404, 'Telafi kaydı bulunamadı.');
    await lockAccount(tx, first.accountId);
    const grant = await tx.adminCompensation.findUniqueOrThrow({ where: { id: grantId } });
    if (grant.requester === admin.email) throw new OperationError(403, 'Kendi telafi talebinizi değerlendiremezsiniz.');
    const now = new Date();
    if (grant.status !== 'pending' || grant.expiresAt <= now) throw new OperationError(409, 'Talep sonuçlandı veya süresi doldu.');
    const kind = grant.kind as GrantKind;
    let change: Prisma.InputJsonObject = {};
    if (decision === 'approve') {
      assertLimit(kind, await appliedAmount(tx, grant.accountId, kind, now), grant.amount);
      change = await applyGrant(tx, grant.accountId, { ...grant, kind });
    }
    const saved = await tx.adminCompensation.update({ where: { id: grantId }, data: {
      status: decision === 'approve' ? 'applied' : 'rejected', reviewer: admin.email, decidedAt: now,
    } });
    await audit(tx, admin, grant.accountId, decision === 'approve' ? 'grant_applied' : 'grant_rejected', reason,
      { requestId: grant.id, requester: grant.requester, kind, itemId: grant.itemId, amount: grant.amount, ...change });
    return saved;
  });
}
