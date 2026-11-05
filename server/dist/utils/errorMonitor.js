"use strict";
/**
 * GlitchTip / Sentry uyumlu hata izleme (OPTIONAL).
 * @sentry/node paketi kurulu degilse veya SENTRY_DSN yoksa sessizce no-op calisir.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initErrorMonitor = initErrorMonitor;
exports.captureError = captureError;
let Sentry = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Sentry = require('@sentry/node');
}
catch {
    Sentry = null;
}
let initialized = false;
function initErrorMonitor() {
    const dsn = process.env.SENTRY_DSN || process.env.GLITCHTIP_DSN;
    if (!dsn || initialized || !Sentry) {
        return initialized;
    }
    try {
        Sentry.init({
            dsn,
            environment: process.env.NODE_ENV || 'development',
            serverName: 'tavriko-server',
            tracesSampleRate: 0.2,
        });
        initialized = true;
        console.log('[errorMonitor] GlitchTip/Sentry icin hata izleme aktif');
    }
    catch (err) {
        console.warn('[errorMonitor] hata izleme baslatilamadi:', err);
    }
    return initialized;
}
function captureError(err) {
    if (initialized && Sentry) {
        try {
            Sentry.captureException(err);
        }
        catch {
            // ignore
        }
    }
}
exports.default = { initErrorMonitor, captureError };
