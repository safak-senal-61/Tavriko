"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOpsRouter = createOpsRouter;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prismaClient_1 = require("../db/prismaClient");
const supabaseClient_1 = require("../db/supabaseClient");
const redisClient_1 = require("../cache/redisClient");
const fcmService_1 = require("../services/fcmService");
const errorMonitor_1 = require("../utils/errorMonitor");
const inviteDelivery_1 = require("../services/inviteDelivery");
const opsTelemetry_1 = require("../services/opsTelemetry");
const posthogHealth_1 = require("../services/posthogHealth");
const polarSandbox_1 = require("../services/polarSandbox");
const opsPage_1 = require("./opsPage");
function createOpsRouter(telemetry, makePolar = polarSandbox_1.buildPolarSandbox) {
    const router = (0, express_1.Router)();
    const probes = (0, opsTelemetry_1.makeProbeSampler)(() => {
        const supabase = supabaseClient_1.supabaseService.getClient();
        const polar = (0, polarSandbox_1.sandboxConfig)();
        const fcm = (0, fcmService_1.getFcmStatus)().enabled;
        const sentry = (0, errorMonitor_1.getErrorMonitorStatus)();
        return [
            {
                name: 'PostgreSQL / Prisma', detail: 'Gerçek bağlantı: salt okunur SELECT 1. Şema ve replikasyon ölçülmez.',
                check: (process.env.DATABASE_URL || process.env.DIRECT_URL)
                    ? async () => (await prismaClient_1.db.rawClient.$queryRaw `SELECT 1`).length === 1 : undefined,
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
                check: redisClient_1.cacheService.isAvailable() ? () => redisClient_1.cacheService.ping() : undefined,
            },
            {
                name: 'Cloudflare Realtime', detail: 'Worker /health HTTP yanıtı. WebSocket, oyun odası ve Durable Objects test edilmez.',
                check: async () => {
                    const url = new URL('/health', process.env.REALTIME_HTTP_URL || inviteDelivery_1.DEFAULT_REALTIME_URL);
                    if (url.protocol !== 'https:')
                        return false;
                    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(2800) });
                    if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
                        return false;
                    const body = await response.json();
                    return body?.service === 'Tavriko Real-time Multiplayer Gateway' && body.status === 'ok';
                },
            },
            {
                name: 'Polar Sandbox', detail: 'Sabit test ürünü okunur. Bu denetim ödeme yapmaz ve kart kabulünü test etmez.',
                check: polar ? () => makePolar(polar).productAvailable() : undefined, optional: process.env.POLAR_SANDBOX_ENABLED !== 'true',
            },
            {
                name: 'Firebase FCM API', detail: 'Google API kimlik doğrulaması ve deneme isteği. Cihaza bildirim gönderilmez.',
                check: fcm ? fcmService_1.verifyFcmApi : undefined, optional: !fcm,
            },
            {
                name: 'Sentry / GlitchTip (sunucu)', detail: 'Sunucu SDK durumu. Mobil Sentry ayrıdır; olay alımı Sentry’den doğrulanır.',
                unset: sentry, optional: sentry !== 'failed',
            },
            (0, posthogHealth_1.posthogHealthProbe)(),
        ];
    });
    const privateHeaders = (_req, res, next) => {
        res.set({ 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' });
        next();
    };
    router.use(['/admin/health', '/api/admin/ops'], privateHeaders, auth_1.requireAdminAuth);
    router.get('/admin/health', (_req, res) => { res.type('html').send((0, opsPage_1.renderOpsPage)()); });
    router.get('/api/admin/ops/snapshot', async (_req, res, next) => {
        try {
            const services = await probes();
            const traffic = telemetry.traffic();
            const warning = traffic.serverErrors > 0 || services.some((p) => !p.optional && p.state !== 'ok') ||
                traffic.groups.some((g) => g.requests >= 20 && (g.p95OverLimit || (g.p95Ms ?? 0) > 1000));
            res.json({
                observedAt: new Date().toISOString(), runtime: telemetry.runtime(), traffic, services,
                status: warning ? 'warning' : traffic.requests > 0 ? 'observed' : 'no-traffic',
                sandboxEnabled: Boolean((0, polarSandbox_1.sandboxConfig)()),
                sentryTestEnabled: (0, errorMonitor_1.getErrorMonitorStatus)() === 'initialized',
            });
        }
        catch (error) {
            next(error);
        }
    });
    let lastSentryTest = -Infinity;
    router.post('/api/admin/ops/sentry/test', async (req, res, next) => {
        try {
            const session = await (0, auth_1.getAdminSessionFromRequest)(req, prismaClient_1.db.rawClient, true);
            if (session?.role !== 'owner') {
                res.status(403).json({ error: 'Sahip oturumu gerekli.' });
                return;
            }
            const host = req.get('host');
            const origin = req.get('origin');
            const loopback = /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(host || '');
            if (!host || (origin !== `https://${host}` && !(loopback && origin === `http://${host}`)) || !req.is('application/json')) {
                res.status(403).json({ error: 'Test yalnızca aynı yönetim sayfasından başlatılabilir.' });
                return;
            }
            if ((0, errorMonitor_1.getErrorMonitorStatus)() !== 'initialized') {
                res.status(503).json({ error: 'Sunucu hata izleme hazır değil.' });
                return;
            }
            if (Date.now() - lastSentryTest < 60_000) {
                res.status(429).json({ error: 'Yeni test için bir dakika bekleyin.' });
                return;
            }
            lastSentryTest = Date.now();
            const eventId = await (0, errorMonitor_1.sendErrorMonitorTest)();
            if (!eventId) {
                res.status(502).json({ error: 'Test olayı gönderilemedi.' });
                return;
            }
            res.json({ eventId });
        }
        catch (error) {
            next(error);
        }
    });
    // One bounded, instance-local guard for this portal's single-admin checkout action.
    let lastCheckout = -Infinity;
    function checkoutRoute(handler) {
        return async (req, res) => {
            const admin = await (0, auth_1.getAdminSessionFromRequest)(req);
            if (!admin?.email) {
                res.status(401).json({ error: 'Yönetici oturumu gerekli.' });
                return;
            }
            const config = (0, polarSandbox_1.sandboxConfig)();
            if (!config) {
                res.status(503).json({ error: 'Polar Sandbox etkin değil veya yapılandırması eksik.' });
                return;
            }
            try {
                res.json(await handler(req, admin.email, makePolar(config)));
            }
            catch (error) {
                res.status(error instanceof polarSandbox_1.PolarSandboxError ? error.status : 502)
                    .json({ error: error instanceof polarSandbox_1.PolarSandboxError ? error.message : 'Polar Sandbox isteği tamamlanamadı.' });
            }
        };
    }
    router.post('/api/admin/ops/polar/checkout', checkoutRoute(async (req, email, polar) => {
        if (req.get('origin') !== (0, polarSandbox_1.sandboxConfig)()?.origin || !req.is('application/json')) {
            throw new polarSandbox_1.PolarSandboxError(403, 'Test işlemi yalnızca yapılandırılan yönetici sayfasından başlatılabilir.');
        }
        if (Date.now() - lastCheckout < 5000)
            throw new polarSandbox_1.PolarSandboxError(429, 'Yeni test oturumu için birkaç saniye bekleyin.');
        lastCheckout = Date.now();
        return polar.create(email);
    }));
    router.get('/api/admin/ops/polar/checkout/:id', checkoutRoute(async (req, email, polar) => polar.status(String(req.params.id), email)));
    return router;
}
