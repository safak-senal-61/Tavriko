import type { PrismaClient } from '@prisma/client';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminAccountsRouter } from '../src/routes/adminAccountsRoutes';
import { createSupportRouter } from '../src/routes/supportRoutes';

const session = vi.hoisted(() => ({ email: 'owner@example.test', role: 'owner' }));
vi.mock('../src/db/prismaClient', () => ({ db: { rawClient: {} } }));
vi.mock('../src/middleware/auth', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/middleware/auth')>()),
  getAdminSessionFromRequest: async () => session,
  portalAssignees: () => [{ email: session.email, role: 'owner' }],
  requireUserAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.headers.authorization !== 'Bearer fixture') return res.sendStatus(401);
    req.authUserId = 'fixture-player';
    next();
  },
}));

const ticketId = '82b0e434-e966-4a5b-922a-99379099c8c6';
const accountId = 'fixture-player';
const playerEmail = 'registered@example.test';
const site = 'https://tavriko-app.vercel.app';
const transport = vi.fn<typeof fetch>();
const savedCase = { id: ticketId, kind: 'support', subject: '[HATA] <Kart> bozuk', accountId, status: 'open', assignee: null, revision: 0 };
const reason = 'Personel iç kayıt gerekçesi.';
const resolution = { revision: 0, assignee: session.email, status: 'resolved', reason, resolution: 'Hata düzeltildi. <Kart> artık açılıyor.' };
const input = { kind: 'bug', subject: '<Kart> bozuk', message: 'Oyun kartı tıklanınca açılmıyor.' };

function fixture(ticket = savedCase, updateCount = 1) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: accountId }]),
    supportCase: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockImplementation(async ({ data }) => ({ id: ticketId, ...data })),
      findUnique: vi.fn().mockResolvedValue(ticket),
      updateMany: vi.fn().mockResolvedValue({ count: updateCount }),
    },
    supportCaseReply: { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({ id: 'fixture-reply' }) },
    adminAccountEvent: { create: vi.fn().mockResolvedValue({}) },
    userNotification: { create: vi.fn().mockResolvedValue({}) },
  };
  const findUnique = vi.fn().mockImplementation(async ({ select }) =>
    select.email ? { email: playerEmail } : { username: 'oyuncu<1>' });
  const client = {
    $transaction: (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    user: { findUnique },
  } as unknown as PrismaClient;
  const app = express().use(express.json()).use('/api/support', createSupportRouter(client)).use(createAdminAccountsRouter(client));
  const player = (path = '') => request(app).post('/api/support' + path).set('Authorization', 'Bearer fixture');
  const admin = (path = '') => request(app).post(`/api/admin/accounts/cases/${ticketId}${path}`)
    .set('Origin', site).set('Host', new URL(site).host).set('X-Forwarded-Proto', 'https');
  return { player, admin, app, tx, findUnique };
}
const sent = () => JSON.parse(String(transport.mock.calls[0]?.[1]?.body));

beforeEach(() => {
  session.role = 'owner';
  vi.stubEnv('PORTAL_ADMIN_EMAIL', session.email);
  vi.stubEnv('ONESIGNAL_APP_ID', 'bce93cc5-2299-4f9d-ae2a-1aa6fc4e3523');
  vi.stubEnv('ONESIGNAL_APP_API_KEY', 'test-only-not-a-real-key');
  vi.stubEnv('VERCEL', undefined);
  vi.stubGlobal('fetch', transport);
  transport.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'message-accepted' }) } as Response);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe('bug report OneSignal email flow', () => {
  it('uses the authenticated player and configured owner, not body-supplied identities', async () => {
    const { player, findUnique, tx } = fixture();
    await player().send({ ...input, accountId: 'other', email: 'wrong@example.test' }).expect(201);
    await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce());
    expect(tx.supportCase.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { kind: 'support', accountId, subject: savedCase.subject, message: input.message, moderationId: null },
    }));
    expect(findUnique).toHaveBeenCalledWith({ where: { id: accountId }, select: { username: true } });
    expect(sent()).toMatchObject({ email_to: [session.email], email_subject: expect.stringContaining('Yeni hata bildirimi') });
    expect(sent().email_body).toContain('oyuncu&lt;1&gt;');
    expect(sent().email_body).toContain(accountId);
    expect(sent().email_body).not.toContain(input.message);
  });

  it('sends no mail for unauthenticated, forged, general, or failed requests', async () => {
    const { player, app, tx } = fixture();
    await request(app).post('/api/support').send(input).expect(401);
    await player().send({ ...input, kind: 'support', subject: savedCase.subject }).expect(400);
    await player().send({ ...input, kind: 'support' }).expect(201);
    tx.supportCase.create.mockRejectedValueOnce(new Error('fixture failure'));
    await player().send(input).expect(503);
    expect(transport).not.toHaveBeenCalled();
  });

  it('sends the saved public resolution to the registered player only', async () => {
    const { admin, tx, findUnique } = fixture();
    await admin().send({ ...resolution, email: 'wrong@example.test' }).expect(400);
    await admin().send(resolution).expect(200, { success: true, emailStatus: 'accepted' });
    expect(tx.userNotification.create).toHaveBeenCalledOnce();
    expect(findUnique).toHaveBeenCalledWith({ where: { id: accountId }, select: { email: true } });
    expect(sent()).toMatchObject({ email_to: [playerEmail], email_subject: expect.stringContaining('sonuçlandı') });
    expect(sent().email_body).toContain('Hata düzeltildi. &lt;Kart&gt; artık açılıyor.');
    expect(sent().email_body).not.toContain(reason);
    expect(sent().email_body).not.toContain(session.email);
  });

  it('keeps a staff reply and the in-app notification if OneSignal fails', async () => {
    const { admin, tx } = fixture();
    transport.mockRejectedValueOnce(new Error('fixture timeout'));
    const response = await admin('/replies').send({ revision: 0, body: 'Düzelttik, tekrar deneyin.', ask: false }).expect(201);
    expect(response.body).toEqual({ id: 'fixture-reply', revision: 1, emailStatus: 'failed' });
    expect(tx.supportCaseReply.create).toHaveBeenCalledOnce();
    expect(tx.userNotification.create).toHaveBeenCalledOnce();
    expect(sent()).toMatchObject({ email_to: [playerEmail], email_subject: expect.stringContaining('yanıt geldi') });
  });

  it('does not email on stale, unauthorized, ordinary support, or player updates', async () => {
    await fixture(savedCase, 0).admin().send(resolution).expect(409);
    session.role = 'moderator';
    await fixture().admin().send(resolution).expect(404);
    session.role = 'owner';
    await fixture({ ...savedCase, subject: 'Genel destek' }).admin().send(resolution).expect(200, { success: true, emailStatus: 'not_applicable' });
    await fixture().player(`/${ticketId}/replies`).send({ revision: 0, body: 'Oyuncudan ek bilgi.' }).expect(201);
    expect(transport).not.toHaveBeenCalled();
  });
});
