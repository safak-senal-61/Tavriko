import { Router, type Request, type RequestHandler } from 'express';
import type { Prisma } from '@prisma/client';
import { db } from '../db/prismaClient';
import { getAdminSessionFromRequest, portalAssignees, requireAdminAuth, type AdminSession } from '../middleware/auth';
import { adminPageHeaders } from './adminShell';
import { renderAdminAccounts } from './adminAccountsPage';
import { addSupportNote, audit, compensationCatalog, grantInput, limits, moderateAccount, OperationError,
  permissions, reasonText, requestGrant, restrictionsEnabled, reviewGrant, uuidPattern, type Operation } from '../services/adminAccountOperations';
import { readPlayerAnalytics, readSignupCohorts } from '../services/playerAnalytics';
import { caseText, ticketKinds, updateCase } from '../services/supportCases';

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
  router.get('/admin/kullanicilar', adminPageHeaders, (req, res, next) => {
    const session = getAdminSessionFromRequest(req);
    if (!session) { next(); return; }
    res.type('html').send(renderAdminAccounts(session.role !== 'owner'));
  });
  router.get('/admin/kullanicilar', adminPageHeaders, requireAdminAuth, (_req, res) => {
    res.redirect(302, '/admin/login?next=%2Fadmin%2Fkullanicilar');
  });
  router.use(prefix, adminPageHeaders, (req, res, next) => {
    const session = getAdminSessionFromRequest(req);
    if (session) { res.locals.accountAdmin = session; next(); return; }
    // Do not let service, Basic or Telegram credentials operate on player accounts.
    void requireAdminAuth(req, res, () => res.status(403).json({ error: 'Bu işlem için portal oturumu gerekli.' }));
  });

  const mutation = (operation: Operation | 'cases', keys: string[]): RequestHandler => (req, res, next) => {
    const admin: AdminSession = res.locals.accountAdmin;
    if (!(operation === 'cases' ? ticketKinds(admin.role).length : permissions(admin)[operation])) { res.status(403).json({ error: 'Bu işlem için rolünüz yetkili değil.' }); return; }
    if (!sameOrigin(req)) { res.status(403).json({ error: 'İşlemi Tavriko yönetim panelinden başlatın.' }); return; }
    if (!req.is('application/json')) { res.status(415).json({ error: 'JSON gerekli.' }); return; }
    if (!req.body || Array.isArray(req.body) || typeof req.body !== 'object' || Object.keys(req.body).some(key => !keys.includes(key))) {
      res.status(400).json({ error: 'İşlem alanları geçersiz.' }); return;
    }
    next();
  };
  const validId: RequestHandler = (req, res, next) => {
    if (typeof req.params.id !== 'string' || !accountId.test(req.params.id)) {
      res.status(400).json({ error: 'Hesap kimliği geçersiz.' }); return;
    }
    next();
  };
  const failed = (res: Parameters<RequestHandler>[1], error: unknown) => {
    if (error instanceof OperationError) return res.status(error.status).json({ error: error.message });
    return res.status(503).json({ error: 'İşlem sonucu doğrulanamadı. Tekrar denemeden önce hesabı yenileyin.' });
  };
  router.get(prefix + '/access', (_req, res) => {
    const admin = res.locals.accountAdmin;
    const roles = permissions(admin);
    res.json({ role: admin.role, actor: admin.email, permissions: roles, caseKinds: ticketKinds(admin.role), restrictions: restrictionsEnabled(), limits,
      ...(roles.grant ? { items: compensationCatalog.map(({ id, name }) => ({ id, name })) } : {}) });
  });

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
  type Metrics = Awaited<ReturnType<typeof readPlayerAnalytics>> & { signup: Awaited<ReturnType<typeof readSignupCohorts>> | null };
  let playerCache: { value: Metrics; at: number } | undefined;
  let loadingPlayers: Promise<Metrics> | undefined;
  router.get(prefix + '/player-metrics', async (_req, res) => {
    try {
      const now = new Date();
      const { days, first } = registrationWindow(now);
      if (playerCache && now.getTime() - playerCache.at < 30_000 && playerCache.value.days.at(-1)?.day === days.at(-1)) {
        res.json(playerCache.value); return;
      }
      loadingPlayers ??= Promise.all([readPlayerAnalytics(client, days, first, now), readSignupCohorts(client, now).catch(() => null)])
        .then(([value, signup]) => ({ ...value, signup }))
        .then(value => { playerCache = { value, at: now.getTime() }; return value; })
        .finally(() => { loadingPlayers = undefined; });
      res.json(await loadingPlayers);
    } catch { unavailable(res); }
  });
  router.get(prefix + '/cases', async (req, res) => {
    const admin: AdminSession = res.locals.accountAdmin;
    const kinds = ticketKinds(admin.role);
    if (!kinds.length) return res.status(403).json({ error: 'Talep kuyruğu için yetki gerekli.' });
    const { queue = 'active', owner = 'all', page = '1', account } = req.query;
    if (typeof page !== 'string' || !/^[1-9]\d{0,2}$/.test(page) || !['active', 'resolved'].includes(String(queue)) ||
        typeof queue !== 'string' || typeof owner !== 'string' || !['all', 'mine', 'unassigned'].includes(owner) ||
        (account !== undefined && (typeof account !== 'string' || !accountId.test(account)))) {
      return res.status(400).json({ error: 'Talep filtreleri geçersiz.' });
    }
    const directory = portalAssignees();
    const where: Prisma.SupportCaseWhereInput = { kind: { in: kinds },
      status: queue === 'resolved' ? 'resolved' : { in: ['open', 'in_progress'] }, ...(account ? { accountId: account as string } : {}),
      ...(owner === 'mine' ? { assignee: admin.email } : owner === 'unassigned' ? { OR: [
        { assignee: null }, ...kinds.map(kind => ({ kind, assignee: { notIn: directory.filter(person => ticketKinds(person.role).includes(kind)).map(person => person.email) } })),
      ] } : {}) };
    try {
      const items = await client.supportCase.findMany({ where, take: 21, skip: (Number(page) - 1) * 20,
        orderBy: [{ createdAt: queue === 'active' ? 'asc' : 'desc' }, { id: 'asc' }] });
      res.json({ items: items.slice(0,20).map(item => ({ ...item, canEdit: admin.role === 'owner' || item.assignee === admin.email ||
        !directory.some(person => person.email === item.assignee && ticketKinds(person.role).includes(item.kind)) })), more: items.length > 20 && Number(page) < 999,
        staff: directory.filter(person => (admin.role === 'owner' || person.email === admin.email) && ticketKinds(person.role).some(kind => kinds.includes(kind))) });
    } catch { unavailable(res); }
  });
  router.post(prefix + '/cases/:id', mutation('cases', ['revision','assignee','status','reason','resolution']), async (req, res) => {
    const { revision, assignee, status } = req.body;
    const reason = reasonText(req.body.reason);
    const resolution = status === 'resolved' ? caseText(req.body.resolution, 8, 1000) : null;
    if (!uuidPattern.test(String(req.params.id)) || !Number.isInteger(revision) || revision < 0 ||
        (assignee !== null && (typeof assignee !== 'string' || assignee.length > 160)) ||
        !['open','in_progress','resolved'].includes(status) || !reason || (status === 'resolved' && !resolution)) {
      return res.status(400).json({ error: 'Talep durumunu, gerekçeyi ve varsa oyuncuya gönderilecek yanıtı kontrol edin.' });
    }
    try {
      await updateCase(client, res.locals.accountAdmin, String(req.params.id), { revision, assignee, status, reason, resolution });
      res.json({ success: true });
    } catch (error) { failed(res, error); }
  });
  router.get(prefix + '/risk', async (req, res) => {
    if (!permissions(res.locals.accountAdmin).review) return res.status(403).json({ error: 'İnceleme yetkisi gerekli.' });
    const queue = req.query.queue ?? 'pending';
    if (queue !== 'pending' && queue !== 'reviewed') return res.status(400).json({ error: 'Kuyruk geçersiz.' });
    try {
      const items = await client.adminRiskAlert.findMany({ where: { reviewedAt: queue === 'reviewed' ? { not: null } : null },
        orderBy: [{ createdAt: queue === 'reviewed' ? 'desc' : 'asc' }, { id: 'asc' }], take: 51 });
      res.json({ items: items.slice(0, 50), more: items.length > 50 });
    } catch { unavailable(res); }
  });
  router.get(prefix + '/risk/:id/grants', async (req, res) => {
    if (!permissions(res.locals.accountAdmin).review) return res.status(403).json({ error: 'İnceleme yetkisi gerekli.' });
    const id = String(req.params.id);
    if (!uuidPattern.test(id)) return res.status(400).json({ error: 'Uyarı kimliği geçersiz.' });
    try {
      const alert = await client.adminRiskAlert.findUnique({ where: { id } });
      if (!alert) return res.status(404).json({ error: 'Uyarı bulunamadı.' });
      const items = await client.adminCompensation.findMany({
        where: { requester: alert.actor, createdAt: { gt: new Date(alert.createdAt.getTime()-3_600_000), lte: alert.createdAt } },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 25,
        select: { id: true, accountId: true, amount: true, kind: true, status: true, createdAt: true },
      });
      res.json({ items });
    } catch { unavailable(res); }
  });
  router.post(prefix + '/risk/:id', mutation('review', ['reason']), async (req, res) => {
    const reason = reasonText(req.body.reason);
    const id = String(req.params.id);
    if (!reason || !uuidPattern.test(id)) return res.status(400).json({ error: 'İnceleme gerekçesi geçersiz.' });
    const admin: AdminSession = res.locals.accountAdmin;
    try {
      const alert = await client.adminRiskAlert.findUnique({ where: { id } });
      if (!alert) return res.status(404).json({ error: 'Uyarı bulunamadı.' });
      if (alert.actor === admin.email) return res.status(403).json({ error: 'Kendi uyarınızı kapatamazsınız.' });
      const changed = await client.adminRiskAlert.updateMany({ where: { id, reviewedAt: null },
        data: { reviewer: admin.email, reason, reviewedAt: new Date() } });
      if (!changed.count) return res.status(409).json({ error: 'Bu uyarı zaten incelendi.' });
      res.json({ success: true });
    } catch (error) { failed(res, error); }
  });
  router.get(prefix + '/compensations/pending', async (_req, res) => {
    if (!permissions(res.locals.accountAdmin).review) { res.status(403).json({ error: 'Onay yetkisi gerekli.' }); return; }
    try {
      const requests = await client.adminCompensation.findMany({
        where: { status: 'pending', expiresAt: { gt: new Date() } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 51,
      });
      res.json({ requests: requests.slice(0, 50), more: requests.length > 50 });
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
  router.get(prefix + '/:id/timeline', validId, async (req, res) => {
    const id = String(req.params.id);
    const page = req.query.page ?? '1';
    if (typeof page !== 'string' || !/^[1-9][0-9]{0,2}$/.test(page)) { res.status(400).json({ error: 'Sayfa geçersiz.' }); return; }
    try {
      const [user, entries] = await Promise.all([
        client.user.findUnique({ where: { id }, select: { restrictedUntil: true } }),
        client.adminAccountEvent.findMany({
          where: { accountId: id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (Number(page) - 1) * 20, take: 21,
        }),
      ]);
      if (!user && !entries.length) { res.status(404).json({ error: 'Hesap veya geçmiş bulunamadı.' }); return; }
      res.json({ entries: entries.slice(0, 20), hasNext: entries.length > 20 && Number(page) < 999,
        restrictedUntil: user?.restrictedUntil && user.restrictedUntil > new Date() ? user.restrictedUntil : null });
    } catch { unavailable(res); }
  });
  router.post(prefix + '/:id/notes', validId, mutation('note', ['note']), async (req, res) => {
    const note = reasonText(req.body.note);
    if (!note) { res.status(400).json({ error: 'Not 8–500 karakter olmalı ve tek satır olmalı.' }); return; }
    try {
      const entry = await addSupportNote(client, res.locals.accountAdmin, String(req.params.id), note);
      res.status(201).json({ id: entry.id });
    } catch (error) { failed(res, error); }
  });
  router.post(prefix + '/:id/moderation', validId, mutation('moderate', ['action', 'reason', 'hours']), async (req, res) => {
    const { action, hours } = req.body;
    const reason = reasonText(req.body.reason);
    if (!reason || !['warn', 'restrict', 'lift'].includes(action) ||
        (action === 'restrict' ? !Number.isInteger(hours) || hours < 1 || hours > 24 * 30 : hours !== undefined)) {
      res.status(400).json({ error: 'İşlemi, gerekçeyi ve kısıtlama süresini (1–720 saat) kontrol edin.' }); return;
    }
    try {
      res.json(await moderateAccount(client, res.locals.accountAdmin, String(req.params.id), action, reason, hours));
    } catch (error) { failed(res, error); }
  });
  router.post(prefix + '/:id/compensations', validId, mutation('grant', ['id', 'kind', 'itemId', 'amount', 'reason']), async (req, res) => {
    const input = grantInput(req.body);
    if (!input) { res.status(400).json({ error: 'Telafi türünü, miktarı, kataloğu ve gerekçeyi kontrol edin.' }); return; }
    try {
      const grant = await requestGrant(client, res.locals.accountAdmin, String(req.params.id), input);
      res.json({ id: grant.id, status: grant.status, expiresAt: grant.expiresAt });
    } catch (error) { failed(res, error); }
  });
  router.post(prefix + '/compensations/:id/review', mutation('review', ['decision', 'reason']), async (req, res) => {
    const { decision } = req.body;
    const reason = reasonText(req.body.reason);
    if (!reason || typeof req.params.id !== 'string' || !uuidPattern.test(req.params.id) || (decision !== 'approve' && decision !== 'reject')) {
      res.status(400).json({ error: 'Kararı ve gerekçeyi kontrol edin.' }); return;
    }
    try {
      const grant = await reviewGrant(client, res.locals.accountAdmin, req.params.id.toLowerCase(), decision, reason);
      res.json({ id: grant.id, status: grant.status });
    } catch (error) { failed(res, error); }
  });
  router.patch(prefix + '/:id/profile', mutation('profile', ['displayName', 'resetAvatar', 'expectedUpdatedAt', 'reason']), async (req, res) => {
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
      await client.$transaction(async tx => {
        const result = await tx.user.updateMany({ where: { id, updatedAt: timestamp }, data });
        if (!result.count) throw new OperationError(409, 'Hesap bu sırada değişti. Bilgileri yeniden yükleyin.');
        await audit(tx, res.locals.accountAdmin, id, 'profile', reason, {
          ...(data.displayName ? { displayName: { before: current.displayName, after: data.displayName } } : {}),
          ...(data.avatarUrl ? { avatar: { before: current.avatarUrl ? 'custom' : 'unset', after: 'default' } } : {}),
        });
      });
      res.json({ ok: true });
    } catch (error) { failed(res, error); }
  });
  return router;
}
