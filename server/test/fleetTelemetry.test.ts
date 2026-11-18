import express from 'express';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFleetRouter } from '../src/routes/fleetRoutes';
import { createFleetStore, fleetMiddleware, parseDrain, validSignature } from '../src/services/fleetTelemetry';
import type { FleetStore } from '../src/services/fleetTelemetry';

const projectId = 'prj_tavriko_test';
const secret = 'example-not-a-real-drain-secret';
const origin = 'https://example.test';
const signed = (payload: string) => createHmac('sha1',secret).update(payload).digest('hex');
const entry = (fields = {}) => ({
  projectId, environment:'production', source:'lambda', path:'/api/social', id:'log-id',
  requestId:'request-id', timestamp:Date.now(), statusCode:503, message:'Sensitive raw contents', ...fields,
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Distributed site diagnostics', () => {
  it('reads numeric counters via the Upstash REST pipeline and keeps hourly writes in one Redis slot', async () => {
    vi.stubEnv('OPS_REDIS_REST_URL','https://redis.example.test');
    vi.stubEnv('OPS_REDIS_REST_TOKEN','fixture-only');
    vi.stubEnv('VERCEL_ENV','production');
    const at = Date.UTC(2026,0,1,18);
    const redisRest = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      if (body[0]?.[0] === 'eval') {
        expect(body[0][2]).toBe(4);
        expect(body[0].slice(3,7).every((k: string) => k.startsWith('tavriko:ops:v1:{production}:'))).toBe(true);
        return Response.json([{result:2}]);
      }
      expect(body).toHaveLength(24);
      expect(body[23]).toEqual(['hgetall',`tavriko:ops:v1:{production}:${at/3600000}`]);
      return Response.json(body.map((_:unknown,i:number) => ({result:i < 22 ? [] : [
        'app.total', '5', 'app.latency.1', '5', 'app.rss.max', i === 22 ? '120' : '100',
      ]})));
    });
    vi.stubGlobal('fetch',redisRest);
    const store = createFleetStore()!;
    expect(await store.write([{at,counts:{'app.total':1}},{at:at-3600000,counts:{'app.total':1}}])).toBe(2);
    const snapshot = await store.read(at);
    expect(snapshot.counts).toMatchObject({'app.total':10,'app.rss.max':120});
    expect(snapshot.p95Ms).toBe(50);
    expect(snapshot.history.at(-1)?.requests).toBe(5);
  });
  it('authenticates the exact raw bytes and restricts logs to the intended project and environment', () => {
    expect(validSignature(Buffer.from('[]'),signed('[]'),secret)).toBe(true);
    expect(validSignature(Buffer.from('[ ]'),signed('[]'),secret)).toBe(false);
    expect(validSignature(Buffer.from('[]'),'nope',secret)).toBe(false);
    const normalized = parseDrain([
      entry(), entry({projectId:'other'}), entry({environment:'preview'}),
      entry({path:'/api/observability/vercel'}), entry({timestamp:0}),
      entry({source:'static',requestId:'static-id',proxy:{statusCode:200,vercelCache:'HIT'}})
    ],projectId);
    expect(normalized).toHaveLength(2);
    expect(normalized[0].counts).toMatchObject({'vercel.5xx':1,'vercel.lambda':1});
    expect(normalized[1].counts).toMatchObject({'vercel.cacheHit':1,'vercel.static':1});
    expect(JSON.stringify(normalized)).not.toMatch(/raw contents|request-id|\/api\/social/);
    expect(parseDrain([entry()],projectId)[0].unique).toBe(normalized[0].unique);
  });
  it('requires signature, scopes browser input, and protects the admin snapshot', async () => {
    vi.stubEnv('OPS_VERCEL_PROJECT_ID',projectId);
    vi.stubEnv('OPS_VERCEL_DRAIN_SECRET',secret);
    vi.stubEnv('OPS_SITE_ORIGIN',origin);
    vi.stubEnv('VERCEL_ENV','production');
    const write = vi.fn<FleetStore['write']>().mockResolvedValue(1);
    const store: FleetStore = {write,read:vi.fn()};
    const app = express().use(createFleetRouter(store)).use(express.json());
    const drain = (body: string) => request(app).post('/api/observability/vercel').set('Content-Type','application/json').send(body);
    const payload = JSON.stringify([entry()]);
    expect((await drain(payload)).status).toBe(403);
    expect((await drain(payload).set('x-vercel-signature',signed(payload))).status).toBe(200);
    const browser = () => request(app).post('/api/observability/browser').set('Origin',origin);
    expect((await browser().set('Sec-Fetch-Site','cross-site').send({kind:'js'})).status).toBe(403);
    expect((await browser().send({kind:'js', private:'x'})).status).toBe(400);
    expect((await browser().set('Sec-Fetch-Site','same-origin').send({kind:'promise'})).status).toBe(204);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1][0][0].counts).toEqual({'browser.total':1,'browser.promise':1});
    expect((await request(app).get('/api/admin/ops/fleet')).status).toBe(401);
  });
  it('keeps production telemetry aggregate and does not instrument its own endpoints', async () => {
    vi.stubEnv('VERCEL','');
    const write = vi.fn<FleetStore['write']>().mockResolvedValue(1);
    const app = express().use(fleetMiddleware({write,read:vi.fn()}));
    app.get('/api/social/:token',(_req,res) => { res.sendStatus(503); });
    app.get('/api/admin/fleet',(_req,res) => { res.sendStatus(200); });
    await request(app).get('/api/social/private123?name=private');
    await request(app).get('/api/admin/fleet');
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0][0].counts).toMatchObject({'app.total':1,'app.5xx':1,'route.social.5xx':1});
    expect(JSON.stringify(write.mock.calls)).not.toContain('private');
  });
});
