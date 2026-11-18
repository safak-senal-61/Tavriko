"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFleetRouter = createFleetRouter;
const express_1 = __importStar(require("express"));
const fleetTelemetry_1 = require("../services/fleetTelemetry");
const auth_1 = require("../middleware/auth");
function createFleetRouter(store) {
    const router = (0, express_1.Router)();
    const endpoint = '/api/observability';
    const privatePaths = [endpoint, '/api/admin/ops/fleet'];
    router.use(privatePaths, (_req, res, next) => {
        res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
        next();
    });
    router.post(endpoint + '/browser', express_1.default.json({ limit: '1kb' }), async (req, res) => {
        if (!store) {
            res.sendStatus(204);
            return;
        }
        const origin = process.env.OPS_SITE_ORIGIN || 'https://tavriko-app.vercel.app';
        if (req.get('origin') !== origin || (req.get('sec-fetch-site') && req.get('sec-fetch-site') !== 'same-origin')) {
            res.sendStatus(403);
            return;
        }
        const kind = req.body?.kind;
        if (!fleetTelemetry_1.browserKinds.includes(kind) || Object.keys(req.body).length !== 1) {
            res.sendStatus(400);
            return;
        }
        try {
            const accepted = await store.write([{ at: Date.now(), browser: true, counts: { 'browser.total': 1, [`browser.${kind}`]: 1 } }]);
            res.sendStatus(accepted ? 204 : 429);
        }
        catch {
            res.sendStatus(503);
        }
    });
    router.post(endpoint + '/vercel', express_1.default.raw({ limit: '2mb', type: 'application/json' }), async (req, res) => {
        const project = process.env.OPS_VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_ID;
        const secret = process.env.OPS_VERCEL_DRAIN_SECRET;
        if (!store || !project || !secret || process.env.VERCEL_ENV === 'preview') {
            res.sendStatus(503);
            return;
        }
        const signature = req.get('x-vercel-signature') || '';
        const verify = req.get('x-vercel-verify');
        // Vercel's unsigned installation challenge may only echo its configured project code; it cannot ingest data.
        if (!signature && verify && verify === process.env.OPS_VERCEL_VERIFY_TOKEN) {
            res.set('x-vercel-verify', verify).sendStatus(200);
            return;
        }
        if (!Buffer.isBuffer(req.body) || !(0, fleetTelemetry_1.validSignature)(req.body, signature, secret)) {
            res.sendStatus(403);
            return;
        }
        try {
            let raw;
            try {
                raw = JSON.parse(req.body.toString('utf8'));
            }
            catch {
                res.sendStatus(400);
                return;
            }
            if (!Array.isArray(raw) || raw.length > 2000) {
                res.sendStatus(400);
                return;
            }
            await store.write((0, fleetTelemetry_1.parseDrain)(raw, project));
            res.sendStatus(200);
        }
        catch {
            res.sendStatus(503);
        }
    });
    // Deterministic no-DB endpoint for the independent uptime worker.
    router.get(endpoint + '/ping', (_req, res) => { res.json({ service: 'tavriko', status: 'ok' }); });
    let last;
    let pending;
    async function snapshot() {
        const [fleet, cdn] = await Promise.all([store ? store.read().catch(() => null) : null, (0, fleetTelemetry_1.readCdnTraffic)()]);
        const counts = fleet?.counts || {};
        const probeTargets = ['web', 'api', 'cdn', 'realtime'];
        const uptime = probeTargets.map(name => {
            const prefix = `probe.${name}`;
            const total = counts[`${prefix}.total`] || 0;
            const failed = counts[`${prefix}.failed`] || 0;
            let lastAt = null;
            let lastOK = null;
            // The worker stores a monotonic timestamp encoded together with state.
            const lastSignal = counts[`${prefix}.last.max`];
            if (lastSignal) {
                lastAt = Math.floor(lastSignal / 2) * 1000;
                lastOK = lastSignal % 2 === 1;
            }
            return { name, total, failed, lastAt, lastOK, stale: !lastAt || Date.now() - lastAt > 16 * 60_000 };
        });
        return { observedAt: new Date().toISOString(), store: !store ? 'unconfigured' : fleet ? 'connected' : 'unavailable',
            drainConfigured: Boolean((process.env.OPS_VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_ID) && process.env.OPS_VERCEL_DRAIN_SECRET),
            fleet, cdn, uptime };
    }
    router.get('/api/admin/ops/fleet', auth_1.requireAdminAuth, async (_req, res, next) => {
        try {
            if (last && Date.now() - last.at < 30_000) {
                res.json(last.value);
                return;
            }
            pending ||= snapshot().then(value => {
                last = { value, at: Date.now() };
                return value;
            }).finally(() => { pending = undefined; });
            res.json(await pending);
        }
        catch (e) {
            next(e);
        }
    });
    return router;
}
