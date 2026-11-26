"use strict";
/**
 * GlitchTip / Sentry uyumlu hata izleme (OPTIONAL).
 * @sentry/node paketi kurulu degilse veya SENTRY_DSN yoksa sessizce no-op calisir.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initErrorMonitor = initErrorMonitor;
exports.getErrorMonitorStatus = getErrorMonitorStatus;
exports.captureError = captureError;
exports.sendErrorMonitorTest = sendErrorMonitorTest;
exports.addBreadcrumb = addBreadcrumb;
let Sentry = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Sentry = require('@sentry/node');
}
catch {
    Sentry = null;
}
let initialized = false;
function readDsn() {
    return process.env.SENTRY_DSN?.trim() || process.env.GLITCHTIP_DSN?.trim();
}
function initErrorMonitor() {
    const dsn = readDsn();
    if (!dsn || initialized || !Sentry) {
        return initialized;
    }
    try {
        Sentry.init({
            dsn,
            environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
            serverName: 'tavriko-server',
            dataCollection: {
                userInfo: false,
                cookies: false,
                httpHeaders: false,
                httpBodies: [],
                urlQueryParams: false,
                databaseQueryData: false,
                stackFrameVariables: false,
                frameContextLines: 0,
            },
            tracesSampleRate: 0,
            beforeSend(event) {
                // Do not export request contents, identity, app breadcrumbs or raw exception
                // messages (which can include database values or upstream payloads).
                delete event.request;
                delete event.user;
                delete event.breadcrumbs;
                delete event.extra;
                for (const error of event.exception?.values ?? []) {
                    error.value = 'Tavriko server exception';
                }
                return event;
            },
        });
        initialized = Boolean(Sentry.getClient()?.getDsn());
        if (initialized)
            console.log('[errorMonitor] Sunucu hata izleme aktif');
    }
    catch {
        console.warn('[errorMonitor] Sunucu hata izleme başlatılamadı.');
    }
    return initialized;
}
function getErrorMonitorStatus() {
    return initialized ? 'initialized' : readDsn() ? 'failed' : 'unconfigured';
}
async function captureError(err) {
    if (initialized && Sentry) {
        try {
            Sentry.captureException(err);
            // Vercel may freeze the instance after the response. Flush before replying.
            await Sentry.flush(1500);
        }
        catch {
            // ignore
        }
    }
}
async function sendErrorMonitorTest() {
    if (!initialized || !Sentry)
        return null;
    try {
        const eventId = Sentry.captureMessage('Tavriko server monitoring test', {
            level: 'info',
            tags: { ops_test: 'true' },
        });
        return await Sentry.flush(2500) ? eventId : null;
    }
    catch {
        return null;
    }
}
/**
 * Sentry breadcrumb: hata izlerinin yanında bağlantı / maç geçmişini gösterir.
 * Sentry kapalıyken veya erişilemezken sessizce no-op çalışır.
 */
function addBreadcrumb(message, category, data) {
    if (!initialized || !Sentry)
        return;
    try {
        Sentry.addBreadcrumb({
            category,
            message,
            level: 'info',
            data,
            timestamp: Date.now() / 1000,
        });
    }
    catch {
        // ignore
    }
}
exports.default = { initErrorMonitor, captureError, addBreadcrumb };
