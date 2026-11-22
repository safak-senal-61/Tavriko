import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import router from '../src/routes/authRoutes';
import { logRouter } from '../src/routes/logRoutes';
import { logger } from '../src/utils/logger';

const mocks = vi.hoisted(() => ({ getClient: vi.fn(), getUser: vi.fn(), login: vi.fn() }));
vi.mock('../src/db/supabaseClient', () => ({ supabaseService: { getClient: mocks.getClient } }));
vi.mock('../src/db/prismaClient', () => ({ db: { rawClient: {}, loginOrRegisterGoogle: mocks.login } }));

const app = express().use(express.json()).use('/api/auth', router).use('/api', logRouter);
const post = (body: Record<string, unknown>) => request(app).post('/api/auth/google').send(body);
const identity = { provider: 'google', identity_data: { email_verified: true, email: 'player@example.test', full_name: 'Oyuncu' } };
const user = { id: 'supabase-verified-user', email: 'player@example.test', email_confirmed_at: '2026-01-01', identities: [identity] };

beforeEach(() => {
  mocks.getClient.mockReturnValue({ auth: { getUser: mocks.getUser } });
  mocks.getUser.mockResolvedValue({ data: { user }, error: null });
  mocks.login.mockResolvedValue({ user: { id: 'tavriko-player' }, token: 'fixture-app-token' });
});
afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe('Tavriko Google login', () => {
  it('accepts the project-authenticated Google account and ignores submitted identity', async () => {
    const response = await post({ accessToken: 'fixture', email: 'ignored@example.test', fullName: 'ignored' });
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(mocks.getUser).toHaveBeenCalledWith('fixture');
    expect(mocks.login).toHaveBeenCalledWith(expect.objectContaining({
      email: 'player@example.test', googleId: 'supabase-verified-user', fullName: 'Oyuncu',
    }));
  });

  it('rejects direct Google ID tokens and does not fall back when project verification fails', async () => {
    expect((await post({ idToken: 'fixture' })).status).toBe(401);
    expect(mocks.getUser).not.toHaveBeenCalled();
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });
    expect((await post({ accessToken: 'fixture' })).status).toBe(401);
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it.each([
    { identities: [] },
    { identities: [{ ...identity, provider: 'email' }] },
    { identities: [{ ...identity, identity_data: { ...identity.identity_data, email_verified: false } }] },
    { email: 'different@example.test' },
    { email_confirmed_at: null },
    { is_anonymous: true },
  ])('rejects an unverified or mismatched account: %o', async (change) => {
    mocks.getUser.mockResolvedValue({ data: { user: { ...user, ...change } }, error: null });
    expect((await post({ accessToken: 'fixture' })).status).toBe(401);
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('forwards only a PKCE code to the same-origin app', async () => {
    const response = await request(app).get('/api/auth/google/callback')
      .query({ code: 'fixture-code-001', next: 'https://ignored.example', access_token: 'discarded' });
    expect(response.status).toBe(303);
    expect(response.headers.location).toBe('/app#code=fixture-code-001');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect((await request(app).get('/api/auth/google/callback').query({ code: 'https://ignored.example' }))
      .headers.location).toBe('/app#error=oauth');
  });

  it('discards diagnostics from older installed clients without calling the logger', async () => {
    const log = vi.spyOn(logger, 'log');
    expect((await request(app).post('/api/logs/ingest').send({ message: 'old callback', details: { access_token: 'discarded' } })).status)
      .toBe(204);
    expect(log).not.toHaveBeenCalled();
  });
});
