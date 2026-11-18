"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_SESSION_MAX_AGE_SEC = exports.ADMIN_SESSION_COOKIE = exports.isPortalConfigured = void 0;
exports.getJwtSecret = getJwtSecret;
exports.getInternalSecret = getInternalSecret;
exports.authenticatePortal = authenticatePortal;
exports.requireUserAuth = requireUserAuth;
exports.issueAdminSessionToken = issueAdminSessionToken;
exports.setAdminSessionCookie = setAdminSessionCookie;
exports.clearAdminSessionCookie = clearAdminSessionCookie;
exports.verifyAdminSessionToken = verifyAdminSessionToken;
exports.getAdminSessionFromRequest = getAdminSessionFromRequest;
exports.checkAdminCredentials = checkAdminCredentials;
exports.setTelegramAdminVerifier = setTelegramAdminVerifier;
exports.requireAdminAuth = requireAdminAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const node_crypto_1 = require("node:crypto");
const node_util_1 = require("node:util");
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
const derive = (0, node_util_1.promisify)(node_crypto_1.scrypt);
function staffDirectory() {
    const directory = new Map();
    try {
        const input = JSON.parse(process.env.PORTAL_STAFF_JSON || '[]');
        if (!Array.isArray(input) || input.length > 50)
            return directory;
        const owner = getAdminCredentials()?.email.toLowerCase();
        for (const staff of input) {
            if (!staff || typeof staff.email !== 'string' || staff.email.length > 160 ||
                !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(staff.email) ||
                !['support', 'moderator', 'approver'].includes(staff.role) ||
                typeof staff.passwordHash !== 'string' || !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(staff.passwordHash))
                return new Map();
            const email = staff.email.toLowerCase();
            if (email === owner || directory.has(email))
                return new Map();
            directory.set(email, { email, role: staff.role, passwordHash: staff.passwordHash });
        }
    }
    catch {
        return new Map();
    }
    return directory;
}
const credentialVersion = (staff) => (0, node_crypto_1.createHash)('sha256').update(staff.passwordHash).digest('hex');
const isPortalConfigured = () => Boolean(getJwtSecret() && (getAdminCredentials() || staffDirectory().size));
exports.isPortalConfigured = isPortalConfigured;
async function authenticatePortal(email, password) {
    if (typeof email !== 'string' || email.length > 160 || typeof password !== 'string' || password.length > 256)
        return null;
    const normalized = email.trim().toLowerCase();
    if (checkAdminCredentials(email, password))
        return { email: normalized, role: 'owner' };
    const staff = staffDirectory().get(normalized);
    if (!staff)
        return null;
    const [salt, hash] = staff.passwordHash.split(':');
    const actual = await derive(password, Buffer.from(salt, 'hex'), 64);
    return (0, node_crypto_1.timingSafeEqual)(actual, Buffer.from(hash, 'hex')) ? { email: staff.email, role: staff.role } : null;
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
exports.ADMIN_SESSION_COOKIE = 'tavriko_admin_session';
exports.ADMIN_SESSION_MAX_AGE_SEC = 7 * 24 * 60 * 60; // 7 gün
function readCookie(req, name) {
    const header = req.headers.cookie;
    if (!header)
        return null;
    for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx < 0)
            continue;
        if (part.slice(0, idx).trim() === name) {
            try {
                return decodeURIComponent(part.slice(idx + 1).trim());
            }
            catch {
                return null;
            }
        }
    }
    return null;
}
/** Portal yöneticisi için imzalı oturum tokeni üretir. */
function issueAdminSessionToken(email, role = 'owner') {
    const secret = getJwtSecret();
    if (!secret)
        return null;
    if (role === 'owner') {
        const owner = getAdminCredentials();
        if (!owner || email.toLowerCase() !== owner.email.toLowerCase())
            return null;
        return jsonwebtoken_1.default.sign({ email: owner.email, role: 'portal_super_admin' }, secret, { expiresIn: exports.ADMIN_SESSION_MAX_AGE_SEC });
    }
    const staff = staffDirectory().get(email);
    if (!staff || staff.role !== role)
        return null;
    return jsonwebtoken_1.default.sign({ email, role: 'portal_staff', staffRole: role, version: credentialVersion(staff) }, secret, { expiresIn: '8h' });
}
/** Tarayıcıya HttpOnly yönetici oturum çerezini yazar. */
function setAdminSessionCookie(req, res, token, role = 'owner') {
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https' || Boolean(process.env.VERCEL);
    const parts = [
        `${exports.ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${role === 'owner' ? exports.ADMIN_SESSION_MAX_AGE_SEC : 8 * 60 * 60}`,
    ];
    if (secure)
        parts.push('Secure');
    res.append('Set-Cookie', parts.join('; '));
}
function clearAdminSessionCookie(res) {
    res.append('Set-Cookie', `${exports.ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}
/** Portal JWT'sini doğrular (Bearer başlığı veya oturum çerezi). */
function verifyAdminSessionToken(token) {
    if (!token)
        return null;
    const secret = getJwtSecret();
    if (!secret)
        return null;
    try {
        const decoded = jsonwebtoken_1.default.verify(token, secret, { algorithms: ['HS256'] });
        if (typeof decoded === 'string' || typeof decoded.email !== 'string' || !decoded.email || !decoded.exp)
            return null;
        const email = decoded.email.toLowerCase();
        if (decoded.role === 'portal_super_admin') {
            return getAdminCredentials()?.email.toLowerCase() === email ? { email, role: 'owner' } : null;
        }
        if (decoded.role !== 'portal_staff')
            return null;
        const staff = staffDirectory().get(email);
        return staff && decoded.staffRole === staff.role && decoded.version === credentialVersion(staff)
            ? { email, role: staff.role } : null;
    }
    catch {
        return null;
    }
}
function getAdminSessionFromRequest(req) {
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
        const viaBearer = verifyAdminSessionToken(authHeader.slice(7));
        if (viaBearer)
            return viaBearer;
    }
    return verifyAdminSessionToken(readCookie(req, exports.ADMIN_SESSION_COOKIE));
}
function checkAdminCredentials(email, password) {
    const creds = getAdminCredentials();
    if (!creds || typeof email !== 'string' || typeof password !== 'string')
        return false;
    const expected = Buffer.from(creds.password);
    const supplied = Buffer.from(password);
    return (email.trim().toLowerCase() === creds.email.toLowerCase() &&
        supplied.length === expected.length &&
        (0, node_crypto_1.timingSafeEqual)(supplied, expected));
}
let telegramAdminVerifier = null;
function setTelegramAdminVerifier(fn) {
    telegramAdminVerifier = fn;
}
function wantsHtml(req) {
    if (req.method !== 'GET')
        return false;
    if (req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/'))
        return false;
    const accept = String(req.headers.accept || '');
    return accept.includes('text/html');
}
/**
 * Admin gate for /api/admin/* surfaces and the ops panels.
 * Accepts one of:
 *  1. x-internal-secret header matching INTERNAL_API_SECRET (service-to-service)
 *  2. HttpOnly portal session cookie (set by /api/portal/login — browser panels)
 *  3. Bearer portal JWT with role "portal_super_admin" (issued by /api/portal/login)
 *  4. HTTP Basic auth matching PORTAL_ADMIN_EMAIL / PORTAL_ADMIN_PASSWORD (curl / Prometheus)
 *  5. x-telegram-init-data from the Telegram WebApp, signed by the bot and sent by an admin
 *
 * Tarayıcıya bilerek WWW-Authenticate başlığı gönderilmez: aksi hâlde tarayıcı her
 * arka plan isteğinde kendi şifre penceresini tekrar tekrar açıyordu. Oturumu
 * olmayan tarayıcı sayfa istekleri /admin/login sayfasına yönlendirilir.
 */
async function requireAdminAuth(req, res, next) {
    try {
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
        // 2) + 3) Portal session (cookie or Bearer)
        const portal = getAdminSessionFromRequest(req);
        if (portal) {
            if (portal.role === 'owner')
                next();
            else if (wantsHtml(req))
                res.redirect(302, '/admin/kullanicilar');
            else
                res.status(403).json({ error: 'Bu alan için yönetici yetkisi gerekli.' });
            return;
        }
        // 4) HTTP Basic auth (preemptive; for curl / Prometheus scrapers)
        const authHeader = req.headers.authorization || '';
        if (authHeader.startsWith('Basic ')) {
            try {
                const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
                const idx = decoded.indexOf(':');
                if (idx > 0 && checkAdminCredentials(decoded.slice(0, idx), decoded.slice(idx + 1))) {
                    next();
                    return;
                }
            }
            catch {
                // fall through to other methods
            }
        }
        // 5) Telegram WebApp initData
        const initData = req.headers['x-telegram-init-data'];
        if (telegramAdminVerifier && typeof initData === 'string' && initData.length > 0 && initData.length < 8192) {
            if (await telegramAdminVerifier(initData)) {
                next();
                return;
            }
        }
    }
    catch {
        // fall through to rejection
    }
    if (wantsHtml(req)) {
        const nextPath = req.originalUrl && req.originalUrl.startsWith('/') ? req.originalUrl : '/admin';
        res.redirect(302, `/admin/login?next=${encodeURIComponent(nextPath)}`);
        return;
    }
    res.status(401).json({ error: 'Yetkisiz erişim' });
}
