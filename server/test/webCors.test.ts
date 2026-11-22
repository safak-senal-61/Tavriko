import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/server';
import { makeWebCorsPolicy } from '../src/middleware/webCors';

const preview = 'https://preview.tavriko-web.pages.dev';
const policy = makeWebCorsPolicy(` ${preview}/, https://*.pages.dev, http://insecure.example, https://bad.example/path `);
const playerPaths = ['/api/auth/login', '/api/categories', '/api/social/rooms/active', '/api/player/duel-funnel'];
const privatePaths = ['/api/admin/questions', '/api/internal/player-access', '/api/cron/reengage-push', '/api/portal/security', '/admin'];

describe('web CORS allowlist', () => {
  it.each(playerPaths)('allows the exact Pages origin on %s', (path) => {
    expect(policy(preview, path)).toBe(true);
  });

  it.each(privatePaths)('does not extend the Pages origin to %s', (path) => {
    expect(policy(preview, path)).toBe(false);
  });

  it.each(['https://other.pages.dev', `${preview}.example`, 'https://bad.example', 'http://insecure.example', 'null'])(
    'does not trust %s', (origin) => {
      expect(policy(origin, '/api/auth/login')).toBe(false);
    },
  );

  it('preserves same-site and native requests without configuring new origins', () => {
    const unconfigured = makeWebCorsPolicy('');
    expect(unconfigured(preview, '/api/auth/login')).toBe(false);
    expect(unconfigured('https://tavriko-app.vercel.app', '/admin')).toBe(true);
    expect(unconfigured('http://localhost:3000', '/api/auth/login')).toBe(true);
    expect(unconfigured(undefined, '/api/auth/login')).toBe(true);
  });
});

describe('Express player CORS preflight', () => {
  let app: ReturnType<typeof createApp>;
  beforeAll(() => {
    vi.stubEnv('TAVRIKO_WEB_ORIGINS', preview);
    app = createApp();
  });
  afterAll(() => {
    app.close();
    vi.unstubAllEnvs();
  });

  const options = (path: string, origin: string) => request(app.app)
    .options(path)
    .set('Origin', origin)
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'content-type,authorization');

  it('allows player JSON and bearer-token requests without sharing cookies', async () => {
    const res = await options('/api/auth/login', preview);
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(preview);
    expect(res.headers['access-control-allow-headers']).toBe('content-type,authorization');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    expect(res.headers.vary).toContain('Origin');
  });

  it('omits CORS headers on admin paths and for other origins', async () => {
    expect((await options('/api/admin/questions', preview)).headers['access-control-allow-origin']).toBeUndefined();
    expect((await options('/api/auth/login', 'https://other.pages.dev')).headers['access-control-allow-origin']).toBeUndefined();
  });
});
