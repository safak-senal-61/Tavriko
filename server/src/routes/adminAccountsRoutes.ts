import { Router, type Request, type RequestHandler } from 'express';
import type { Prisma } from '@prisma/client';
import { db } from '../db/prismaClient';
import { getAdminSessionFromRequest, requireAdminAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { adminPageHeaders } from './adminShell';
import { renderAdminAccounts } from './adminAccountsPage';

const prefix = '/api/admin/accounts';
const size = 20;
const dayMs = 86_400_000;
const accountId = /^[a-z0-9_-]{1,128}$/i;
const reasons = ['support', 'display-policy', 'avatar-reset'];
const listSelect = {
  id: true, username: true, displayName: true, createdAt: true, level: true, totalMatches: true, hasPremiumPass: true,
} as const;
const detailSelect = {
  ...listSelect, avatarUrl: true, xp: true, coins: true, gems: true, wins: true, rankPoints: true, updatedAt: true,
  _count: { select: { inventoryItems: true, pushTokens: true } },
  matches: { orderBy: [{ playedAt: 'desc' }, { id: 'desc' }], take: 5, select: { playedAt: true, mode: true, score: true } },
} satisfies Prisma.UserSelect;

function portalOnly(req: Request, res: Parameters<RequestHandler>[1], next: Parameters<RequestHandler>[2]) {
  if (getAdminSessionFromRequest(req)?.email) { next(); return; }
  res.status(403).json({ error: 'Bu işlem için portal yönetici oturumu gerekli.' });
}

function sameOrigin(req: Request): boolean {
  try {
    const origin = req.get('origin') || '';
    const url = new URL(origin);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return origin === url.origin && url.host === req.get('host') &&
      (url.protocol === 'https:' || (local && url.protocol === 'http:')) &&
      (!req.get('sec-fetch-site') || req.get('sec-fetch-site') === 'same-origin');
  } catch { return false; }
}

export function registrationWindow(now: Date) {
  const localDay = Math.floor((now.getTime() + 3 * 3_600_000) / dayMs) * dayMs;
  const days = Array.from({ length: 7 }, (_, i) => new Date(localDay - (6 - i) * dayMs).toISOString().slice(0, 10));
  return { days, first: new Date(localDay - 6 * dayMs - 3 * 3_600_000) };
}

export function createAdminAccountsRouter(client = db.rawClient) {
  const router = Router();
  router.get('/admin/kullanicilar', adminPageHeaders, requireAdminAuth, (_req, res) => {
    res.type('html').send(renderAdminAccounts());
  });
  router.use(prefix, adminPageHeaders, requireAdminAuth, portalOnly);

  let pending: Promise<object> | undefined;
  let cached: { value: object; at: number } | undefined;
  async function getMetrics() {
    const now = new Date();
    const { days, first } = registrationWindow(now);
    const [total, rows] = await Promise.all([
      client.user.count(),
      client.$queryRaw<Array<{ day: string; count: bigint }>>`
        SELECT to_char("createdAt" + interval '3 hours', 'YYYY-MM-DD') AS day, count(*) AS count
        FROM "users" WHERE "createdAt" >= ${first} AND "createdAt" <= ${now}
        GROUP BY 1`,
    ]);
    const counts = new Map(rows.map(row => [row.day, Number(row.count)]));
    return { total, observedAt: now.toISOString(), days: days.map(day => ({ day, accounts: counts.get(day) ?? 0 })) };
  }
  const unavailable = (res: Parameters<RequestHandler>[1]) => res.status(503).json({ error: 'Hesap verileri şu anda alınamıyor. Tekrar deneyin.' });
  router.get(prefix + '/metrics', async (_req, res) => {
    try {
      if (cached && Date.now() - cached.at < 30_000) { res.json(cached.value); return; }
      pending ??= getMetrics().then(value => {
        cached = { value, at: Date.now() }; return value;
      }).finally(() => { pending = undefined; });
      res.json(await pending);
    } catch { unavailable(res); }
  });
  router.get(prefix, async (req, res) => {
    const { q = '', filter = 'all', sort = 'newest', page = '1' } = req.query;
    if (typeof q !== 'string' || q.length > 80 || !['all', 'premium', 'played', 'new'].includes(String(filter)) ||
        typeof filter !== 'string' || (sort !== 'newest' && sort !== 'matches') ||
        typeof page !== 'string' || !/^[1-9][0-9]{0,3}$/.test(page) || Number(page) > 1000) {
      res.status(400).json({ error: 'Arama veya sayfalama parametreleri geçersiz.' }); return;
    }
    const search = q.trim();
    // Prisma's LIKE patterns treat these as wildcard characters. Escape them for a literal search.
    const literal = search.replace(/[\\%_]/g, '\\$&');
    const where: Prisma.UserWhereInput = {
      ...(search ? { OR: [
        { id: search }, { username: { contains: literal, mode: 'insensitive' } },
        { displayName: { contains: literal, mode: 'insensitive' } },
      ] } : {}),
      ...(filter === 'premium' ? { hasPremiumPass: true } : {}),
      ...(filter === 'played' ? { totalMatches: { gt: 0 } } : {}),
      ...(filter === 'new' ? { createdAt: { gte: registrationWindow(new Date()).first } } : {}),
    };
    const currentPage = Number(page);
    try {
      const results = await client.user.findMany({
        where, select: listSelect, skip: (currentPage - 1) * size, take: size + 1,
        orderBy: sort === 'matches' ? [{ totalMatches: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'asc' }],
      });
      res.json({ accounts: results.slice(0, size), page: currentPage, hasNext: results.length > size && currentPage < 1000 });
    } catch { unavailable(res); }
  });
  router.get(prefix + '/:id', async (req, res) => {
    const { id } = req.params;
    if (typeof id !== 'string' || !accountId.test(id)) { res.status(400).json({ error: 'Hesap kimliği geçersiz.' }); return; }
    try {
      const account = await client.user.findUnique({ where: { id }, select: detailSelect });
      if (!account) { res.status(404).json({ error: 'Hesap bulunamadı.' }); return; }
      const { avatarUrl, ...fields } = account;
      res.json({ account: { ...fields, avatarState: avatarUrl === 'av1' ? 'default' : avatarUrl ? 'custom' : 'unset' } });
    } catch { unavailable(res); }
  });
  router.patch(prefix + '/:id/profile', async (req, res) => {
    if (!sameOrigin(req)) { res.status(403).json({ error: 'İşlemi Tavriko yönetim panelinden başlatın.' }); return; }
    if (!req.is('application/json')) { res.status(415).json({ error: 'JSON gerekli.' }); return; }
    const { id } = req.params;
    const input = req.body;
    if (typeof id !== 'string' || !accountId.test(id) || !input || Array.isArray(input) || typeof input !== 'object' ||
        Object.keys(input).some(key => !['displayName', 'resetAvatar', 'expectedUpdatedAt', 'reason'].includes(key))) {
      res.status(400).json({ error: 'İşlem geçersiz.' }); return;
    }
    const { displayName, resetAvatar, expectedUpdatedAt, reason } = input;
    const name = typeof displayName === 'string' && displayName.length <= 100 ? displayName.trim().normalize('NFC') : '';
    const timestamp = typeof expectedUpdatedAt === 'string' ? new Date(expectedUpdatedAt) : null;
    if ((displayName !== undefined && !/^[\p{L}\p{N}][\p{L}\p{M}\p{N} ._'’-]{1,39}$/u.test(name)) ||
        (resetAvatar !== undefined && resetAvatar !== true) || (!name && !resetAvatar) ||
        !timestamp || !Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== expectedUpdatedAt ||
        typeof reason !== 'string' || !reasons.includes(reason)) {
      res.status(400).json({ error: 'Görünür adı, işlem nedenini ve hesap sürümünü kontrol edin.' }); return;
    }
    try {
      const current = await client.user.findUnique({ where: { id }, select: { displayName: true, avatarUrl: true, updatedAt: true } });
      if (!current) { res.status(404).json({ error: 'Hesap bulunamadı.' }); return; }
      const data: { displayName?: string; avatarUrl?: string } = {};
      if (name && name !== current.displayName) data.displayName = name;
      if (resetAvatar && current.avatarUrl !== 'av1') data.avatarUrl = 'av1';
      if (current.updatedAt.getTime() !== timestamp.getTime()) {
        res.status(409).json({ error: 'Hesap bu sırada değişti. Bilgileri yeniden yükleyin.' }); return;
      }
      if (!Object.keys(data).length) { res.status(400).json({ error: 'Kaydedilecek değişiklik yok.' }); return; }
      const result = await client.user.updateMany({ where: { id, updatedAt: timestamp }, data });
      if (!result.count) { res.status(409).json({ error: 'Hesap bu sırada değişti. Bilgileri yeniden yükleyin.' }); return; }
      logger.success('AUTH', 'Yönetici profil düzeltmesi', {
        accountId: id, admin: getAdminSessionFromRequest(req)?.email, reason, fields: Object.keys(data),
      });
      res.json({ ok: true });
    } catch { res.status(503).json({ error: 'İşlem sonucu doğrulanamadı. Tekrar denemeden önce hesabı yenileyin.' }); }
  });
  return router;
}
