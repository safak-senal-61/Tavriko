import { Router, RequestHandler } from 'express';
import { getAdminSessionFromRequest, requireAdminAuth } from '../middleware/auth';
import { db } from '../db/prismaClient';
import { supabaseService } from '../db/supabaseClient';
import { cacheService } from '../cache/redisClient';
import { getFcmStatus } from '../services/fcmService';
import { DEFAULT_REALTIME_URL } from '../services/inviteDelivery';
import { makeOpsTelemetry, makeProbeSampler } from '../services/opsTelemetry';
import { buildPolarSandbox, PolarSandboxError, sandboxConfig } from '../services/polarSandbox';
import { renderOpsPage } from './opsPage';

export function createOpsRouter(telemetry: ReturnType<typeof makeOpsTelemetry>, makePolar = buildPolarSandbox) {
  const router = Router();
  const probes = makeProbeSampler(() => {
    const supabase = supabaseService.getClient();
    const polar = sandboxConfig();
    return [
      {
        name: 'PostgreSQL / Prisma', detail: 'Gerçek bağlantı: salt okunur SELECT 1. Şema ve replikasyon ölçülmez.',
        check: (process.env.DATABASE_URL || process.env.DIRECT_URL)
          ? async () => (await db.rawClient.$queryRaw<unknown[]>`SELECT 1`).length === 1 : undefined,
      },
      {
        name: 'Supabase REST', detail: 'Kategori tablosuna salt okunur erişim. Auth ve Storage test edilmez.',
        check: supabase ? async () => {
          const { error } = await supabase.from('categories').select('id').limit(1).abortSignal(AbortSignal.timeout(2800));
          return !error;
        } : undefined,
      },
      {
        name: 'Upstash Redis', detail: 'Salt okunur PING. Bağlantı yoksa yerel bellek kullanımı küresel önbellek değildir.',
        check: cacheService.isAvailable() ? () => cacheService.ping() : undefined,
      },
      {
        name: 'Cloudflare Realtime', detail: 'Worker /health HTTP yanıtı. WebSocket, oyun odası ve Durable Objects test edilmez.',
        check: async () => {
          const url = new URL('/health', process.env.REALTIME_HTTP_URL || DEFAULT_REALTIME_URL);
          if (url.protocol !== 'https:') return false;
          const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(2800) });
          if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return false;
          const body = await response.json() as { service?: string; status?: string } | null;
          return body?.service === 'Tavriko Real-time Multiplayer Gateway' && body.status === 'ok';
        },
      },
      {
        name: 'Polar Sandbox', detail: 'Sabit test ürünü okunur. Bu denetim ödeme yapmaz ve kart kabulünü test etmez.',
        check: polar ? () => makePolar(polar).productAvailable() : undefined, optional: process.env.POLAR_SANDBOX_ENABLED !== 'true',
      },
      {
        name: 'Firebase FCM', detail: 'Yalnızca uygulama yapılandırması. Cihaza teslimat doğrulanmaz.',
        unset: getFcmStatus().enabled ? 'unknown' as const : 'unconfigured' as const, optional: true,
      },
      {
        name: 'Sentry / GlitchTip', detail: 'Yalnızca DSN yapılandırması. Hata alımı ve saklama doğrulanmaz.',
        unset: (process.env.SENTRY_DSN || process.env.GLITCHTIP_DSN) ? 'unknown' as const : 'unconfigured' as const, optional: true,
      },
    ];
  });

  const privateHeaders: RequestHandler = (_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' });
    next();
  };
  router.use(['/admin/health', '/api/admin/ops'], privateHeaders, requireAdminAuth);
  router.get('/admin/health', (_req, res) => { res.type('html').send(renderOpsPage()); });
  router.get('/api/admin/ops/snapshot', async (_req, res, next) => {
    try {
      const services = await probes();
      const traffic = telemetry.traffic();
      const warning = traffic.serverErrors > 0 || services.some((p) => !p.optional && p.state !== 'ok') ||
        traffic.groups.some((g) => g.requests >= 20 && (g.p95OverLimit || (g.p95Ms ?? 0) > 1000));
      res.json({
        observedAt: new Date().toISOString(), runtime: telemetry.runtime(), traffic, services,
        status: warning ? 'warning' : traffic.requests > 0 ? 'observed' : 'no-traffic',
        sandboxEnabled: Boolean(sandboxConfig()),
      });
    } catch (error) { next(error); }
  });

  // One bounded, instance-local guard for this portal's single-admin checkout action.
  let lastCheckout = -Infinity;
  function checkoutRoute(handler: (req: Parameters<RequestHandler>[0], email: string, polar: ReturnType<typeof buildPolarSandbox>) => Promise<object>): RequestHandler {
    return async (req, res) => {
      const admin = getAdminSessionFromRequest(req);
      if (!admin?.email) { res.status(401).json({ error: 'Yönetici oturumu gerekli.' }); return; }
      const config = sandboxConfig();
      if (!config) { res.status(503).json({ error: 'Polar Sandbox etkin değil veya yapılandırması eksik.' }); return; }
      try {
        res.json(await handler(req, admin.email, makePolar(config)));
      } catch (error) {
        res.status(error instanceof PolarSandboxError ? error.status : 502)
          .json({ error: error instanceof PolarSandboxError ? error.message : 'Polar Sandbox isteği tamamlanamadı.' });
      }
    };
  }
  router.post('/api/admin/ops/polar/checkout', checkoutRoute(async (req, email, polar) => {
    if (req.get('origin') !== sandboxConfig()?.origin || !req.is('application/json')) {
      throw new PolarSandboxError(403, 'Test işlemi yalnızca yapılandırılan yönetici sayfasından başlatılabilir.');
    }
    if (Date.now() - lastCheckout < 5000) throw new PolarSandboxError(429, 'Yeni test oturumu için birkaç saniye bekleyin.');
    lastCheckout = Date.now();
    return polar.create(email);
  }));
  router.get('/api/admin/ops/polar/checkout/:id', checkoutRoute(async (req, email, polar) => polar.status(String(req.params.id), email)));
  return router;
}
