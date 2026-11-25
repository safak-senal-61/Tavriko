import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import router from '../src/routes/authRoutes';
import { logRouter } from '../src/routes/logRoutes';
import { logger } from '../src/utils/logger';

const mocks = vi.hoisted(() => ({
  getClient: vi.fn(),
  getUser: vi.fn(),
  login: vi.fn(),
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheDelete: vi.fn(),
}));
vi.mock('../src/db/supabaseClient', () => ({ supabaseService: { getClient: mocks.getClient } }));
vi.mock('../src/db/prismaClient', () => ({ db: { rawClient: {}, loginOrRegisterGoogle: mocks.login } }));
vi.mock('../src/cache/redisClient', () => ({
  cacheService: {
    getCustomValue: mocks.cacheGet,
    setCustomValue: mocks.cacheSet,
    deleteCustomValue: mocks.cacheDelete,
  },
}));

const app = express().use(express.json()).use('/api/auth', router).use('/api', logRouter);
const post = (path: string, body: Record<string, unknown>) => request(app).post(`/api/auth${path}`).send(body);
const identity = { provider: 'google', identity_data: { email_verified: true, email: 'player@example.test', full_name: 'Oyuncu' } };
const user = { id: 'supabase-verified-user', email: 'player@example.test', email_confirmed_at: '2026-01-01', identities: [identity] };
const googleProfile = { sub: 'google-subject-1', email: 'player@example.test', email_verified: true, name: 'Oyuncu', picture: 'https://img.example/a.png' };

const signState = (platform: 'web' | 'native' = 'web') =>
  jwt.sign({ purpose: 'google_oauth', platform, nonce: 'fixture' }, process.env.JWT_SECRET!, { expiresIn: '10m', issuer: 'tavriko' });

beforeEach(() => {
  process.env.JWT_SECRET = 'fixture-jwt-secret';
  process.env.GOOGLE_CLIENT_ID = 'fixture-web-client.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'fixture-client-secret';
  process.env.GOOGLE_ANDROID_CLIENT_ID = 'fixture-android-client.apps.googleusercontent.com';
  process.env.PUBLIC_APP_URL = 'https://tavriko.example';
  delete process.env.GOOGLE_WEB_CLIENT_ID;
  delete process.env.GOOGLE_OAUTH_REDIRECT_URI;

  mocks.getClient.mockReturnValue({ auth: { getUser: mocks.getUser } });
  mocks.getUser.mockResolvedValue({ data: { user }, error: null });
  mocks.login.mockResolvedValue({ user: { id: 'tavriko-player' }, token: 'fixture-app-token' });
  mocks.cacheGet.mockResolvedValue(null);
  mocks.cacheSet.mockResolvedValue(undefined);
  mocks.cacheDelete.mockResolvedValue(undefined);
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'google-access-token' }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(googleProfile), { status: 200 })));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
  vi.restoreAllMocks();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_ANDROID_CLIENT_ID;
  delete process.env.PUBLIC_APP_URL;
});

describe('Tavriko Google login (own client)', () => {
  it('starts the flow on Google with Tavriko client id and callback', async () => {
    const response = await request(app).get('/api/auth/google/start').query({ platform: 'native' });
    expect(response.status).toBe(303);
    const location = new URL(response.headers.location);
    expect(location.origin + location.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(location.searchParams.get('client_id')).toBe('fixture-web-client.apps.googleusercontent.com');
    expect(location.searchParams.get('redirect_uri')).toBe('https://tavriko.example/api/auth/google/callback');
    expect(location.searchParams.get('scope')).toContain('openid');
    const state = jwt.verify(location.searchParams.get('state')!, process.env.JWT_SECRET!) as jwt.JwtPayload;
    expect(state.purpose).toBe('google_oauth');
    expect(state.platform).toBe('native');
  });

  it('refuses to start when the Tavriko client is not configured', async () => {
    delete process.env.GOOGLE_CLIENT_SECRET;
    const response = await request(app).get('/api/auth/google/start');
    expect(response.status).toBe(503);
  });

  it('exchanges the Google code server-side and hands a one-time code to the app', async () => {
    const response = await request(app).get('/api/auth/google/callback')
      .query({ code: 'google-auth-code-001', state: signState('web') });
    expect(response.status).toBe(303);
    expect(response.headers.location).toMatch(/^\/app#code=[A-Za-z0-9_-]{20,}$/);
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(mocks.login).toHaveBeenCalledWith(expect.objectContaining({
      email: 'player@example.test', googleId: 'google-subject-1', fullName: 'Oyuncu',
    }));
    const stored = mocks.cacheSet.mock.calls[0];
    expect(stored[0]).toMatch(/^auth:google:handoff:/);
    expect(stored[1]).toEqual({ token: 'fixture-app-token', user: { id: 'tavriko-player' } });
    expect(stored[2]).toBe(120);
  });

  it('still forwards legacy Supabase PKCE codes for installed app versions', async () => {
    const response = await request(app).get('/api/auth/google/callback')
      .query({ code: 'legacy-pkce-code-001', next: 'https://ignored.example', access_token: 'discarded' });
    expect(response.status).toBe(303);
    expect(response.headers.location).toBe('/app#code=legacy-pkce-code-001');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect((await request(app).get('/api/auth/google/callback').query({ code: 'https://ignored.example' }))
      .headers.location).toBe('/app#error=oauth');
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('returns native results on the app scheme', async () => {
    const response = await request(app).get('/api/auth/google/callback')
      .query({ code: 'google-auth-code-002', state: signState('native') });
    expect(response.status).toBe(303);
    expect(response.headers.location).toMatch(/^tavriko:\/\/auth-callback#code=/);
  });

  it('rejects missing, forged or error callbacks without issuing a session', async () => {
    expect((await request(app).get('/api/auth/google/callback')).headers.location).toBe('/app#error=oauth');
    expect((await request(app).get('/api/auth/google/callback').query({ code: 'google-auth-code-004', state: 'forged' }))
      .headers.location).toBe('/app#error=oauth');
    expect((await request(app).get('/api/auth/google/callback').query({ error: 'access_denied', state: signState() }))
      .headers.location).toBe('/app#error=oauth');
    expect(mocks.login).not.toHaveBeenCalled();
    expect(mocks.cacheSet).not.toHaveBeenCalled();
  });

  it('rejects a Google profile whose e-mail is not verified', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'google-access-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...googleProfile, email_verified: false }), { status: 200 })));
    const response = await request(app).get('/api/auth/google/callback')
      .query({ code: 'google-auth-code-005', state: signState() });
    expect(response.headers.location).toBe('/app#error=oauth');
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('redeems a one-time handoff code exactly once', async () => {
    mocks.cacheGet.mockResolvedValue({ token: 'fixture-app-token', user: { id: 'tavriko-player' } });
    const response = await post('/google/exchange', { code: 'a'.repeat(32) });
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ token: 'fixture-app-token', user: { id: 'tavriko-player' } });
    expect(mocks.cacheDelete).toHaveBeenCalledWith(`auth:google:handoff:${'a'.repeat(32)}`);
  });

  it('rejects handoff codes that are malformed or already spent', async () => {
    expect((await post('/google/exchange', { code: 'short' })).status).toBe(401);
    expect((await post('/google/exchange', { code: 'b'.repeat(32) })).status).toBe(401);
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('accepts a native Google ID token issued for the Tavriko Android client', async () => {
    const claims = {
      aud: 'fixture-android-client.apps.googleusercontent.com',
      iss: 'https://accounts.google.com',
      sub: 'google-subject-2',
      email: 'native@example.test',
      email_verified: 'true',
      name: 'Yerel Oyuncu',
      exp: String(Math.floor(Date.now() / 1000) + 600),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(claims), { status: 200 })));
    const response = await post('/google/id-token', { idToken: 'x'.repeat(64) });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user: { id: 'tavriko-player' }, token: 'fixture-app-token' });
    expect(mocks.login).toHaveBeenCalledWith(expect.objectContaining({ email: 'native@example.test', googleId: 'google-subject-2' }));
  });

  it('rejects ID tokens for other Google clients, unverified e-mails and expired tokens', async () => {
    const base = {
      aud: 'someone-else.apps.googleusercontent.com',
      iss: 'accounts.google.com',
      sub: 'google-subject-3',
      email: 'other@example.test',
      email_verified: 'true',
      exp: String(Math.floor(Date.now() / 1000) + 600),
    };
    for (const claims of [
      base,
      { ...base, aud: 'fixture-android-client.apps.googleusercontent.com', email_verified: 'false' },
      { ...base, aud: 'fixture-android-client.apps.googleusercontent.com', exp: '1' },
    ]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(claims), { status: 200 })));
      expect((await post('/google/id-token', { idToken: 'y'.repeat(64) })).status).toBe(401);
    }
    expect(mocks.login).not.toHaveBeenCalled();
  });
});

describe('Tavriko Google login (legacy Supabase sessions)', () => {
  it('accepts the project-authenticated Google account and ignores submitted identity', async () => {
    const response = await post('/google', { accessToken: 'fixture', email: 'ignored@example.test', fullName: 'ignored' });
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(mocks.getUser).toHaveBeenCalledWith('fixture');
    expect(mocks.login).toHaveBeenCalledWith(expect.objectContaining({
      email: 'player@example.test', googleId: 'supabase-verified-user', fullName: 'Oyuncu',
    }));
  });

  it('rejects direct Google ID tokens and does not fall back when project verification fails', async () => {
    expect((await post('/google', { idToken: 'fixture' })).status).toBe(401);
    expect(mocks.getUser).not.toHaveBeenCalled();
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });
    expect((await post('/google', { accessToken: 'fixture' })).status).toBe(401);
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
    expect((await post('/google', { accessToken: 'fixture' })).status).toBe(401);
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('discards diagnostics from older installed clients without calling the logger', async () => {
    const log = vi.spyOn(logger, 'log');
    expect((await request(app).post('/api/logs/ingest').send({ message: 'old callback', details: { access_token: 'discarded' } })).status)
      .toBe(204);
    expect(log).not.toHaveBeenCalled();
  });
});
