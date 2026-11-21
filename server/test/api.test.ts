import request from 'supertest';
import bcrypt from 'bcryptjs';
import { vi } from 'vitest';
import { createApp } from '../src/server';
import { db } from '../src/db/prismaClient';
import { logger } from '../src/utils/logger';
import { Server } from 'http';

describe('Trivia REST API', () => {
  let app: any;
  let server: Server;
  let authToken: string;
  let teardown: () => void;

  beforeAll(async () => {
    const created = createApp();
    app = created.app;
    teardown = created.close;
    await new Promise<void>((resolve) => {
      server = created.httpServer.listen(0, () => resolve());
    });
  });

  afterAll(async () => {
    teardown();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('allows guest login and returns token and user profile', async () => {
    const res = await request(app)
      .post('/api/auth/guest')
      .send({ displayName: 'TestOyuncu' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.displayName).toBe('TestOyuncu');
    expect(res.body.user.level).toBe(1);
    authToken = res.body.token;
  });

  it('does not expose an internal error when guest login fails', async () => {
    const createGuest = vi.spyOn(db, 'createGuest').mockRejectedValueOnce(new Error('private-storage-diagnostic'));
    try {
      const res = await request(app).post('/api/auth/guest').send({ displayName: 'TestOyuncu' });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Misafir oturumu oluşturulamadı.' });
    } finally {
      createGuest.mockRestore();
    }
  });

  it('verifies existing player password hashes after the bcryptjs update', async () => {
    // Fixture generated with bcryptjs 2.4.3, never a real player's hash.
    const legacyHash = '$2a$04$zB5W0G7kmtrEbFfcgd4u3u3BBtEBERoA3JoKVWTosKOWDqiEZaP1q';
    await expect(bcrypt.compare('fixture-existing-password', legacyHash)).resolves.toBe(true);
  });

  it.each(['forgot-password', 'reset-password', 'request-delete-code', 'confirm-delete', 'delete-account', 'delete-account/request'])('keeps %s bodies and URL queries out of application logs', async (route) => {
    const path = `/api/auth/${route}`;
    const response = await request(app)
      .post(`${path}?email=query-only@example.test`)
      .send({ email: { invalid: 'body-only@example.test' }, otpCode: '042615', newPassword: 'FixtureOnlyPass1!' });
    const status = route.startsWith('delete-account') ? 401 : 400;
    expect(response.status).toBe(status);
    const entry = logger.getRecentLogs().find((log) => log.message.startsWith(`POST ${path} `));
    expect(entry?.category).toBe('AUTH');
    expect(entry?.message).toMatch(new RegExp(`^POST ${path} -> ${status} `));
    expect(JSON.stringify(entry)).not.toMatch(/query-only|body-only|042615|FixtureOnlyPass1/);
  });

  it('logs dynamic messages and textual details on one line with a literal format', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const entry = logger.warn('HTTP', 'fixture\r\nnext\u2028line %s', 'details\nnext\u001b[1m');
      expect(entry.message).toBe('fixture next line %s');
      expect(warn).toHaveBeenCalledWith('%s %s %s', expect.stringContaining('[WARN] [HTTP]'), 'fixture next line %s', 'detailsnext [1m');
    } finally {
      warn.mockRestore();
    }
  });

  it('retrieves all trivia categories including food, nature and animals', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(16);
    const categoryIds = res.body.map((c: any) => c.id);
    expect(categoryIds).toContain('geography');
    expect(categoryIds).toContain('mathematics');
    expect(categoryIds).toContain('food_gastronomy');
    expect(categoryIds).toContain('history');
  });

  it('fetches single-player practice questions safely for clients', async () => {
    const res = await request(app)
      .get('/api/questions/practice?category=geography&difficulty=easy&count=3')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(3);
    const q = res.body.questions[0];
    expect(q.text).toBeDefined();
    expect(q.options).toHaveLength(4);
  });

  it('fetches the daily challenge question set', async () => {
    const res = await request(app)
      .get('/api/questions/daily')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.date).toBeDefined();
    expect(res.body.questions.length).toBeGreaterThanOrEqual(5);
  });

  it('fetches global leaderboards', async () => {
    const res = await request(app).get('/api/social/leaderboard');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.topPlayers)).toBe(true);
  });
});
