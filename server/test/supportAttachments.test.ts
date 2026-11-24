import type { PrismaClient } from '@prisma/client';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupportRouter } from '../src/routes/supportRoutes';

vi.mock('../src/db/prismaClient', () => ({ db: { rawClient: {} } }));
vi.mock('../src/middleware/auth', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/middleware/auth')>()),
  requireUserAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.headers.authorization !== 'Bearer fixture') return res.sendStatus(401);
    req.authUserId = 'fixture-player';
    next();
  },
}));

const ticketId = '82b0e434-e966-4a5b-922a-99379099c8c6';
const attachmentId = '2fa6a6c9-6d17-4d34-9c40-8fbb2f0f6f6f';
const fileBytes = Buffer.from('ekran goruntusu');
const base64 = fileBytes.toString('base64');

function fixture(options: { owner?: string; missing?: boolean } = {}) {
  const created: any[] = [];
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: 'fixture-player' }]),
    supportCase: {
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }) => {
        created.push(data);
        return { id: ticketId, attachments: [], ...data };
      }),
    },
    adminAccountEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  const client = {
    $transaction: (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    supportCaseAttachment: {
      findFirst: vi.fn().mockImplementation(async () => options.missing ? null : ({
        name: 'ekran goruntusu.png', mime: 'image/png', size: fileBytes.length, data: fileBytes,
        ticket: { accountId: options.owner ?? 'fixture-player', kind: 'support' },
      })),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ username: 'oyuncu' }) },
  } as unknown as PrismaClient;
  const app = express().use(express.json({ limit: '15mb' })).use('/api/support', createSupportRouter(client));
  return { app, created };
}

const report = (attachments?: unknown) => ({
  kind: 'bug', subject: 'Kart açılmıyor', message: 'Oyun kartı tıklanınca açılmıyor.',
  ...(attachments === undefined ? {} : { attachments }),
});
const post = (app: express.Express, body: unknown) =>
  request(app).post('/api/support').set('Authorization', 'Bearer fixture').send(body);

describe('support attachments', () => {
  let ctx: ReturnType<typeof fixture>;
  beforeEach(() => { ctx = fixture(); });

  it('stores an uploaded screenshot with the new case', async () => {
    const response = await post(ctx.app, report([{ name: 'ekran goruntusu.png', mime: 'image/png', data: base64 }]));
    expect(response.status).toBe(201);
    const stored = ctx.created[0].attachments.create;
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ name: 'ekran goruntusu.png', mime: 'image/png', size: fileBytes.length });
    expect(Buffer.from(stored[0].data).toString()).toBe('ekran goruntusu');
  });

  it('rejects unsupported file types, oversized lists and malformed base64', async () => {
    for (const attachments of [
      [{ name: 'kurulum.exe', mime: 'application/x-msdownload', data: base64 }],
      Array.from({ length: 4 }, () => ({ name: 'ek.png', mime: 'image/png', data: base64 })),
      [{ name: 'ek.png', mime: 'image/png', data: '!!!not-base64!!!' }],
    ]) {
      const response = await post(ctx.app, report(attachments));
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Ek dosyalar');
    }
    expect(ctx.created).toHaveLength(0);
  });

  it('strips path separators from attachment names', async () => {
    await post(ctx.app, report([{ name: '../../etc/passwd.png', mime: 'image/png', data: base64 }]));
    expect(ctx.created[0].attachments.create[0].name).toBe('..-..-etc-passwd.png');
  });

  it('serves the file only to its owner', async () => {
    const path = `/api/support/${ticketId}/attachments/${attachmentId}`;
    const ok = await request(ctx.app).get(path).set('Authorization', 'Bearer fixture');
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toContain('image/png');
    expect(ok.headers['x-content-type-options']).toBe('nosniff');
    expect(ok.body.equals(fileBytes)).toBe(true);

    const stranger = fixture({ owner: 'someone-else' });
    expect((await request(stranger.app).get(path).set('Authorization', 'Bearer fixture')).status).toBe(404);
  });

  it('returns 404 for unknown attachments', async () => {
    const missing = fixture({ missing: true });
    const response = await request(missing.app).get(`/api/support/${ticketId}/attachments/${attachmentId}`)
      .set('Authorization', 'Bearer fixture');
    expect(response.status).toBe(404);
  });
});
