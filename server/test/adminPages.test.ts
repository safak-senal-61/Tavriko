import request from 'supertest';
import { Script } from 'node:vm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { adminPages } from '../src/routes/adminShell';
import { sanitizeNextPath } from '../src/routes/adminLoginPage';

describe('Tavriko admin pages', () => {
  let app: Awaited<ReturnType<typeof import('../src/server')['createApp']>>;
  let cookie: string;

  beforeAll(async () => {
    vi.stubEnv('PORTAL_ADMIN_EMAIL','admin-routes-fixture@example.test');
    vi.stubEnv('PORTAL_ADMIN_PASSWORD','fixture-routes-only');
    vi.stubEnv('JWT_SECRET','fixture-admin-routes-jwt-test-secret');
    const { createApp } = await import('../src/server');
    app = createApp();
    const login = await request(app.app).post('/api/portal/login').send({
      email:'admin-routes-fixture@example.test',password:'fixture-routes-only',
    });
    expect(login.status).toBe(200);
    cookie = login.headers['set-cookie'][0].split(';')[0];
  });

  afterAll(() => { app?.close(); vi.unstubAllEnvs(); });

  it.each(adminPages)('protects $path and renders its own title and active link', async page => {
    const guest = await request(app.app).get(page.path).set('Accept','text/html');
    expect(guest.status).toBe(302);
    expect(guest.headers.location).toBe('/admin/login?next='+encodeURIComponent(page.path));
    const result = await request(app.app).get(page.path).set('Cookie',cookie);
    expect(result.status).toBe(200);
    expect(result.headers['cache-control']).toContain('no-store');
    expect(result.headers['x-robots-tag']).toContain('noindex');
    expect(result.text).toContain('<h1>'+page.label+'</h1>');
    expect(result.text).toContain(`href="${page.path}" aria-current="page"`);
    expect(result.text.match(/aria-current="page"/g)).toHaveLength(1);
    for (const other of adminPages) expect(result.text).toContain(`href="${other.path}"`);
    for (const script of result.text.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      expect(() => new Script(script[1])).not.toThrow();
    }
    if (page.id !== 'game') expect(result.text).not.toContain('<iframe id="gameSimulatorIframe"');
    if (page.id !== 'push') expect(result.text).not.toContain('id="pushBroadcastTitle"');
  });

  it('keeps old aliases working and does not treat an unknown admin URL as a page', async () => {
    expect((await request(app.app).get('/telegram-admin')).headers.location).toBe('/admin/telegram');
    expect((await request(app.app).get('/developer')).headers.location).toBe('/admin');
    expect((await request(app.app).get('/admin/not-a-real-page').set('Cookie',cookie)).status).toBe(404);
    const portal = await request(app.app).get('/admin').set('Cookie',cookie);
    expect(portal.text).toContain('"#tab-logs":"/admin/loglar"');
  });

  it('rejects unsafe login redirect paths without losing a deep route', () => {
    expect(sanitizeNextPath('/admin/bildirimler')).toBe('/admin/bildirimler');
    expect(sanitizeNextPath('//external.example')).toBe('/admin');
    expect(sanitizeNextPath('/\\external.example')).toBe('/admin');
    expect(sanitizeNextPath('/\texternal.example')).toBe('/admin');
    expect(sanitizeNextPath('/admin/login?next=/admin')).toBe('/admin');
  });
});
