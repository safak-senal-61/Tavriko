"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJwtSecret = getJwtSecret;
exports.getInternalSecret = getInternalSecret;
exports.requireUserAuth = requireUserAuth;
exports.requireAdminAuth = requireAdminAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prismaClient_1 = require("../db/prismaClient");
/**
 * Shared authentication middleware.
 *
 * requireUserAuth  -> authenticated player (JWT issued by /api/auth/login|register|guest)
 * requireAdminAuth -> admin surface (HTTP Basic for browser panels, portal JWT, or x-internal-secret)
 *
 * SECURITY NOTES:
 * - No hardcoded secrets or credentials. Everything comes from environment variables.
 * - userId is ALWAYS taken from the verified token, never from the request body.
 */
function getJwtSecret() {
    return process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || '';
}
function getInternalSecret() {
    const s = process.env.INTERNAL_API_SECRET;
    return s && s.trim() ? s.trim() : undefined;
}
function getAdminCredentials() {
    const email = process.env.PORTAL_ADMIN_EMAIL;
    const password = process.env.PORTAL_ADMIN_PASSWORD;
    if (email && email.trim() && password) {
        return { email: email.trim(), password };
    }
    return null;
}
/** Requires a valid player JWT. Populates req.authUserId from the token payload. */
function requireUserAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Yetkilendirme başlığı eksik' });
        return;
    }
    const token = authHeader.slice(7);
    const payload = prismaClient_1.db.verifyToken(token);
    if (!payload || !payload.userId) {
        res.status(401).json({ error: 'Geçersiz veya süresi dolmuş oturum' });
        return;
    }
    req.authUserId = String(payload.userId);
    next();
}
/**
 * Admin gate for /api/admin/* surfaces and the ops panels.
 * Accepts one of:
 *  1. x-internal-secret header matching INTERNAL_API_SECRET (service-to-service)
 *  2. HTTP Basic auth matching PORTAL_ADMIN_EMAIL / PORTAL_ADMIN_PASSWORD (browser panels)
 *  3. Bearer portal JWT with role "portal_super_admin" (issued by /api/portal/login)
 */
function requireAdminAuth(req, res, next) {
    // 1) Service-to-service internal secret
    const internalSecret = getInternalSecret();
    const providedInternal = req.headers['x-internal-secret'];
    if (internalSecret &&
        typeof providedInternal === 'string' &&
        providedInternal.length === internalSecret.length &&
        providedInternal === internalSecret) {
        next();
        return;
    }
    const authHeader = req.headers.authorization || '';
    const creds = getAdminCredentials();
    // 2) HTTP Basic auth (browsers prompt natively and re-send for same-origin requests)
    if (creds && authHeader.startsWith('Basic ')) {
        try {
            const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
            const idx = decoded.indexOf(':');
            if (idx > 0) {
                const email = decoded.slice(0, idx);
                const password = decoded.slice(idx + 1);
                if (email === creds.email && password.length === creds.password.length && password === creds.password) {
                    next();
                    return;
                }
            }
        }
        catch {
            // fall through to other methods
        }
    }
    // 3) Portal super-admin JWT
    if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const secret = getJwtSecret();
        if (secret) {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, secret);
                if (decoded && decoded.role === 'portal_super_admin') {
                    next();
                    return;
                }
            }
            catch {
                // invalid token -> fall through
            }
        }
    }
    if (creds) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Tavriko Admin", charset="UTF-8"');
    }
    res.status(401).json({ error: 'Yetkisiz erişim' });
}
