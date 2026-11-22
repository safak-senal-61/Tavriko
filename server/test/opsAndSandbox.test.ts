import express from 'express';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/prismaClient', () => ({ db: {
  verifyToken: (token: string) => token === 'player' ? { userId: 'signed-player' } : null,
  purchaseShopProduct: vi.fn().mockResolvedValue({ user: {}, message: 'ok' }),
  rawClient: { portalSession: { findFirst: vi.fn().mockResolvedValue({ method: 'password', createdAt: new Date() }) } },
} }));
vi.mock('../src/db/supabaseClient', () => ({ supabaseService: { getClient: () => null } }));
vi.mock('../src/cache/redisClient', () => ({ cacheService: { isAvailable: () => false } }));
vi.mock('../src/services/fcmService', () => ({ getFcmStatus: vi.fn(), verifyFcmApi: vi.fn() }));
vi.mock('../src/utils/errorMonitor', () => ({ getErrorMonitorStatus: vi.fn(), sendErrorMonitorTest: vi.fn() }));
vi.mock('../src/services/inviteDelivery', () => ({ DEFAULT_REALTIME_URL: 'https://worker.invalid' }));
vi.mock('../src/services/presenceManager', () => ({ presenceManager: {} }));

import { makeOpsTelemetry, makeProbeSampler, requestFamily } from '../src/services/opsTelemetry';
import { buildPolarSandbox, sandboxConfig } from '../src/services/polarSandbox';
import { createOpsRouter } from '../src/routes/opsRoutes';
import { ADMIN_SESSION_COOKIE, issueAdminSessionToken } from '../src/middleware/auth';
import social from '../src/routes/socialRoutes';
import { db } from '../src/db/prismaClient';
import { getFcmStatus, verifyFcmApi } from '../src/services/fcmService';
import { getErrorMonitorStatus, sendErrorMonitorTest } from '../src/utils/errorMonitor';

const product = '9a95b314-825f-42cd-970a-70e4c78530bf';
const id = '3479bf21-7bb2-4879-976f-a170ef8c64b9';
const config = { product, token: 'fake-sandbox-only', origin: 'https://preview.example.test' };
const email = 'admin@example.test';
const ownership = createHmac('sha256', config.token).update(`tavriko-sandbox:${email}`).digest('hex');
const json = (data: object, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const session = { id, product_id: product, url: 'https://sandbox.polar.sh/checkout/polar_c_fake', status: 'open',
  metadata: { tavriko_sandbox_owner: ownership }, amount: 500, currency: 'usd', client_secret: 'never-return-this' };
const testProduct = { id: product, visibility:'private', is_archived:false, is_recurring:false, benefits:[],
  prices:[{ is_archived:false, amount_type:'fixed', price_amount:500 }] };

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('Polar Sandbox provider', () => {
  it('defaults disabled and rejects malformed configuration', () => {
    expect(sandboxConfig({ POLAR_SANDBOX_ENABLED: 'true' })).toBeNull();
    expect(sandboxConfig({ POLAR_SANDBOX_ENABLED: 'true', POLAR_SANDBOX_ACCESS_TOKEN: 'test', POLAR_SANDBOX_PRODUCT_ID: product,
      POLAR_SANDBOX_APP_ORIGIN: 'https://preview.example.test/not-an-origin' })).toBeNull();
  });
  it('creates a sandbox-only fixed-product session and returns no provider credential', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(testProduct))
      .mockResolvedValueOnce(json(session));
    expect(await buildPolarSandbox(config, fetcher).create(email)).toEqual({ id, status: 'open', amount: 500, currency:'usd', url:session.url });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([`https://sandbox-api.polar.sh/v1/products/${product}`, 'https://sandbox-api.polar.sh/v1/checkouts/']);
    const sent = fetcher.mock.calls[1][1]!;
    expect(JSON.parse(String(sent.body))).toMatchObject({
      products: [product], success_url: config.origin + '/admin/health?checkout_id={CHECKOUT_ID}',
      return_url: config.origin + '/admin/health', metadata: { tavriko_sandbox_owner: ownership }, allow_trial: false,
    });
    expect(sent.body).not.toContain(email);
    expect(sent.redirect).toBe('error');
  });
  it.each(['https://polar.sh/checkout/live', 'https://sandbox.polar.sh.attacker.test/checkout/fake', 'https://sandbox.polar.sh/elsewhere'])(
    'rejects checkout URL %s', async (url) => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(testProduct))
        .mockResolvedValueOnce(json({ ...session, url }));
      await expect(buildPolarSandbox(config, fetcher).create(email)).rejects.toMatchObject({ status: 502 });
    });
  it('does not start recurring or archived products', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ ...testProduct, is_recurring:true }));
    await expect(buildPolarSandbox(config, fetcher).create(email)).rejects.toMatchObject({ status: 502 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('distinguishes confirmed from succeeded, requires ownership and rejects invalid ids', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ ...session, status: 'confirmed' }))
      .mockResolvedValueOnce(json({ ...session, status: 'succeeded' })).mockResolvedValueOnce(json(session));
    const polar = buildPolarSandbox(config, fetcher);
    await expect(polar.status(id, email)).resolves.toMatchObject({ status: 'confirmed' });
    await expect(polar.status(id, email)).resolves.toEqual({ id, status:'succeeded', amount:500, currency:'usd' });
    await expect(polar.status(id, 'different@example.test')).rejects.toMatchObject({ status: 404 });
    await expect(polar.status('../elsewhere', email)).rejects.toMatchObject({ status: 400 });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('converts failures to explicit statuses without returning provider body or error', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ debug: 'private marker' }, 403))
      .mockResolvedValueOnce(json({}, 429)).mockRejectedValueOnce(new Error('private marker'));
    const polar = buildPolarSandbox(config, fetcher);
    await expect(polar.status(id, email)).rejects.toMatchObject({ status: 502, message: expect.not.stringContaining('private marker') });
    await expect(polar.status(id, email)).rejects.toMatchObject({ status: 503 });
    await expect(polar.status(id, email)).rejects.toMatchObject({ status: 502, message: expect.not.stringContaining('private marker') });
  });
});

describe('Ops telemetry', () => {
  it('groups only bounded categories, counts completed statuses, computes p95 and expires buckets', () => {
    let now = 120000;
    const ops = makeOpsTelemetry(() => now);
    expect(ops.traffic()).toMatchObject({ requests:0, p95Ms:null, p95OverLimit:false });
    for (let i = 0; i < 19; i++) ops.record(requestFamily('/api/trivia/private-id'), 200, 22);
    ops.record(requestFamily('/api/unrecognized/private-id'), 503, 5100);
    ops.record('untrusted', 404, 80);
    expect(ops.traffic()).toMatchObject({ requests:21, clientErrors:1, serverErrors:1, p95Ms:100 });
    expect(ops.traffic().groups).toEqual([
      expect.objectContaining({ name:'trivia', requests:19, p95Ms:25 }),
      expect.objectContaining({ name:'api', requests:2, p95Ms:null, p95OverLimit:true }),
    ]);
    now += 300000;
    expect(ops.traffic()).toMatchObject({ requests:0, p95Ms:null });
    expect(ops.runtime()).toMatchObject({ rss: expect.any(Number), heapUsed: expect.any(Number), instance: expect.any(String) });
  });
  it('separates reachability, failure, timeout and unknown and shares probe results', async () => {
    const ok = vi.fn(async () => true);
    const timeout = vi.fn(() => new Promise<boolean>(() => {}));
    const sampler = makeProbeSampler(() => [
      { name:'up', detail:'', check:ok }, { name:'down', detail:'', check: async () => { throw new Error('private'); } },
      { name:'slow', detail:'', check:timeout }, { name:'off', detail:'' }, { name:'configured', detail:'', unset:'unknown' },
    ], 15);
    const result = await Promise.all([sampler(), sampler()]);
    expect(result[0].map((p) => p.state)).toEqual(['ok', 'failed', 'timeout', 'unconfigured', 'unknown']);
    expect(await sampler()).toEqual(result[1]);
    expect(JSON.stringify(result)).not.toContain('private');
    expect(ok).toHaveBeenCalledTimes(1);
    expect(timeout).toHaveBeenCalledTimes(1);
  });
});

describe('Admin and storefront routes', () => {
  beforeEach(() => {
    vi.stubEnv('PORTAL_ADMIN_EMAIL', email);
    vi.stubEnv('PORTAL_ADMIN_PASSWORD', 'fixture');
    vi.stubEnv('INTERNAL_API_SECRET', 'ops-fixture');
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('DIRECT_URL', '');
    vi.stubEnv('POLAR_SANDBOX_ENABLED', 'false');
    vi.mocked(getFcmStatus).mockReturnValue({ enabled:false, reason:'' });
    vi.mocked(getErrorMonitorStatus).mockReturnValue('unconfigured');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ status:'ok', service:'Tavriko Real-time Multiplayer Gateway' })));
  });
  const cookie = () => `${ADMIN_SESSION_COOKIE}=${issueAdminSessionToken(email, 'owner', false, 'c82b0f7a-0fa9-4ce0-ac11-8849b26c34a9')}`;
  it('protects the HTML and JSON, and keeps snapshots private', async () => {
    const ops = makeOpsTelemetry();
    ops.record('api', 500, 40);
    const app = express().use(createOpsRouter(ops));
    const anon = await request(app).get('/admin/health').set('Accept', 'text/html');
    expect(anon.status).toBe(302);
    expect(anon.headers.location).toMatch(/^\/admin\/login/);
    expect((await request(app).get('/api/admin/ops/snapshot').set('Authorization','Bearer player')).status).toBe(401);
    expect((await request(app).get('/admin/health').set('Cookie', cookie())).text).toContain('Site Sağlığı');
    const snapshot = await request(app).get('/api/admin/ops/snapshot').set('Cookie', cookie());
    expect(snapshot.status).toBe(200);
    expect(snapshot.headers['cache-control']).toContain('no-store');
    expect(snapshot.body).toMatchObject({ status:'warning', traffic: { serverErrors:1 }, sandboxEnabled:false });
  });
  it('distinguishes FCM API reachability, Sentry SDK startup and disabled Polar', async () => {
    vi.mocked(getFcmStatus).mockReturnValue({ enabled: true, reason:'' });
    vi.mocked(verifyFcmApi).mockResolvedValue(true);
    vi.mocked(getErrorMonitorStatus).mockReturnValue('initialized');
    const app = express().use(createOpsRouter(makeOpsTelemetry()));
    const { body } = await request(app).get('/api/admin/ops/snapshot').set('Cookie', cookie());
    expect(body.sentryTestEnabled).toBe(true);
    expect(body.services).toEqual(expect.arrayContaining([
      expect.objectContaining({ name:'Firebase FCM API', state:'ok' }),
      expect.objectContaining({ name:'Sentry / GlitchTip (sunucu)', state:'initialized' }),
      expect.objectContaining({ name:'Polar Sandbox', state:'unconfigured', optional:true }),
    ]));
    expect(verifyFcmApi).toHaveBeenCalledOnce();
    expect(sendErrorMonitorTest).not.toHaveBeenCalled();
  });

  it('restricts Sentry test events to a same-origin owner session and throttles repeats', async () => {
    vi.mocked(getErrorMonitorStatus).mockReturnValue('initialized');
    const eventId = 'ab'.repeat(16);
    vi.mocked(sendErrorMonitorTest).mockResolvedValue(eventId);
    const app = express().use(express.json()).use(createOpsRouter(makeOpsTelemetry()));
    const send = () => request(app).post('/api/admin/ops/sentry/test').set('Host', 'example.test');
    expect((await send().set('Origin', 'https://example.test').send({})).status).toBe(401);
    expect((await send().set('x-internal-secret', 'ops-fixture').set('Origin', 'https://example.test').send({})).status).toBe(403);
    expect((await send().set('Cookie', cookie()).set('Origin', 'https://other.test').send({})).status).toBe(403);
    expect((await send().set('Cookie', cookie()).set('Origin', 'https://example.test').send({})).body).toEqual({ eventId });
    expect((await send().set('Cookie', cookie()).set('Origin', 'https://example.test').send({})).status).toBe(429);
    expect(sendErrorMonitorTest).toHaveBeenCalledOnce();
  });
  it('enforces portal session, configured origin and checkout rate limit', async () => {
    vi.stubEnv('POLAR_SANDBOX_ENABLED','true');
    vi.stubEnv('POLAR_SANDBOX_PRODUCT_ID', product);
    vi.stubEnv('POLAR_SANDBOX_ACCESS_TOKEN', config.token);
    vi.stubEnv('POLAR_SANDBOX_APP_ORIGIN', config.origin);
    const create = vi.fn().mockResolvedValue({ id, status:'open' });
    const make = vi.fn(() => ({ create, status:vi.fn(), productAvailable:vi.fn() }));
    const app = express().use(express.json()).use(createOpsRouter(makeOpsTelemetry(), make));
    const path = '/api/admin/ops/polar/checkout';
    expect((await request(app).post(path).set('x-internal-secret', 'ops-fixture').set('Origin', config.origin).send({})).status).toBe(401);
    expect((await request(app).post(path).set('Cookie', cookie()).set('Origin', 'https://wrong.test').send({})).status).toBe(403);
    expect((await request(app).post(path).set('Cookie', cookie()).set('Origin', config.origin).send({ product: 'ignored' })).status).toBe(200);
    expect((await request(app).post(path).set('Cookie', cookie()).set('Origin', config.origin).send({})).status).toBe(429);
    expect(create).toHaveBeenCalledExactlyOnceWith(email);
  });
  it('blocks TRY products and legacy client-defined grants but keeps game currency purchases', async () => {
    const app = express().use(express.json()).use(social);
    const purchase = (body: object) => request(app).post('/shop/purchase').set('Authorization','Bearer player').send(body);
    expect((await purchase({ packId:'gems_100' })).status).toBe(409);
    expect((await purchase({ packId:'starter_pack' })).status).toBe(409);
    expect((await purchase({ gemsDelta:500000, itemId:'anything' })).status).toBe(400);
    expect(db.purchaseShopProduct).not.toHaveBeenCalled();
    expect((await purchase({ userId:'not-the-buyer', productId:'coins_1000', paymentMethod:'try' })).status).toBe(200);
    expect(db.purchaseShopProduct).toHaveBeenCalledWith('signed-player', 'coins_1000', 'gems', undefined);
  });
  it('serves the new frame listings and uses the signed account for frame rentals', async () => {
    const app = express().use(express.json()).use(social);
    const catalog = await request(app).get('/shop/catalog');
    expect(catalog.status).toBe(200);
    expect(catalog.body.catalog).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'frame_dragon_phoenix', category: 'frames', currency: 'gems' }),
      expect.objectContaining({ id: 'frame_steampunk', category: 'frames', currency: 'gems' }),
    ]));
    const rental = await request(app).post('/shop/purchase').set('Authorization', 'Bearer player')
      .send({ userId: 'not-the-buyer', productId: 'frame_steampunk', durationId: '1d' });
    expect(rental.status).toBe(200);
    expect(db.purchaseShopProduct).toHaveBeenCalledExactlyOnceWith('signed-player', 'frame_steampunk', 'gems', '1d');
  });
});
