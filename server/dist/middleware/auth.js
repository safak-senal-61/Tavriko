"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_SESSION_MAX_AGE_SEC = exports.ADMIN_SESSION_COOKIE = exports.isPortalConfigured = void 0;
exports.getJwtSecret = getJwtSecret;
exports.getInternalSecret = getInternalSecret;
exports.portalAssignees = portalAssignees;
exports.portalAccount = portalAccount;
exports.sameOrigin = sameOrigin;
exports.portalFactor = portalFactor;
exports.authenticatePortal = authenticatePortal;
exports.requireUserAuth = requireUserAuth;
exports.issueAdminSessionToken = issueAdminSessionToken;
exports.setAdminSessionCookie = setAdminSessionCookie;
exports.clearAdminSessionCookie = clearAdminSessionCookie;
exports.portalTokenClaims = portalTokenClaims;
exports.getAdminSessionFromRequest = getAdminSessionFromRequest;
exports.checkAdminCredentials = checkAdminCredentials;
exports.setTelegramAdminVerifier = setTelegramAdminVerifier;
exports.requireAdminAuth = requireAdminAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const node_crypto_1 = require("node:crypto");
const node_util_1 = require("node:util");
const prismaClient_1 = require("../db/prismaClient");
const portalOtp_1 = require("../services/portalOtp");
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
const ownerVersion = (password, secret) => (0, node_crypto_1.createHmac)('sha256', secret).update(`portal-owner-v1:${password}`).digest('hex');
const isPortalConfigured = () => Boolean(getJwtSecret() && (getAdminCredentials() || staffDirectory().size));
exports.isPortalConfigured = isPortalConfigured;
function portalAssignees() {
    const owner = getAdminCredentials()?.email.toLowerCase();
    return [...(owner ? [{ email: owner, role: 'owner' }] : []), ...[...staffDirectory().values()].map(({ email, role }) => ({ email, role }))];
}
function portalAccount(email) {
    return portalAssignees().find(entry => entry.email === email);
}
function sameOrigin(req) {
    try {
        const origin = req.get('origin') || '';
        const url = new URL(origin);
        const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        return origin === url.origin && url.host === req.get('host') &&
            (url.protocol === 'https:' || (local && url.protocol === 'http:')) &&
            (!req.get('sec-fetch-site') || req.get('sec-fetch-site') === 'same-origin');
    }
    catch {
        return false;
    }
}
function portalFactor(email) {
    const raw = process.env.PORTAL_TOTP_SECRETS_JSON;
    if (raw) {
        try {
            const entries = JSON.parse(raw);
            if (!entries || typeof entries !== 'object' || Array.isArray(entries))
                return 'unavailable';
            if (Object.hasOwn(entries, email))
                return (0, portalOtp_1.parseOtpSecret)(entries[email]) ?? 'unavailable';
        }
        catch {
            return 'unavailable';
        }
    }
    return process.env.PORTAL_TOTP_REQUIRED === 'true' ? 'unavailable' : null;
}
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
function issueAdminSessionToken(email, role, otpVerified, id) {
    const secret = getJwtSecret();
    if (!secret)
        return null;
    const factor = portalFactor(email.toLowerCase());
    if (factor === 'unavailable' || (factor && !otpVerified))
        return null;
    const mfa = factor ? { mfa: (0, portalOtp_1.otpFingerprint)(factor) } : {};
    if (role === 'owner') {
        const owner = getAdminCredentials();
        if (!owner || email.toLowerCase() !== owner.email.toLowerCase())
            return null;
        const version = ownerVersion(owner.password, secret);
        return jsonwebtoken_1.default.sign({ email: owner.email, role: 'portal_super_admin', version, ...mfa }, secret, { expiresIn: exports.ADMIN_SESSION_MAX_AGE_SEC, jwtid: id });
    }
    const staff = staffDirectory().get(email);
    if (!staff || staff.role !== role)
        return null;
    return jsonwebtoken_1.default.sign({ email, role: 'portal_staff', staffRole: role, version: credentialVersion(staff), ...mfa }, secret, { expiresIn: '8h', jwtid: id });
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
        if (typeof decoded === 'string' || typeof decoded.email !== 'string' || !decoded.email || !decoded.exp ||
            typeof decoded.jti !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(decoded.jti))
            return null;
        const email = decoded.email.toLowerCase();
        const factor = portalFactor(email);
        if (factor === 'unavailable' || (factor ? decoded.mfa !== (0, portalOtp_1.otpFingerprint)(factor) : decoded.mfa !== undefined))
            return null;
        if (decoded.role === 'portal_super_admin') {
            const owner = getAdminCredentials();
            return owner?.email.toLowerCase() === email && decoded.version === ownerVersion(owner.password, secret)
                ? { email, role: 'owner', id: decoded.jti } : null;
        }
        if (decoded.role !== 'portal_staff')
            return null;
        const staff = staffDirectory().get(email);
        return staff && decoded.staffRole === staff.role && decoded.version === credentialVersion(staff)
            ? { email, role: staff.role, id: decoded.jti } : null;
    }
    catch {
        return null;
    }
}
function portalTokenClaims(req, cookieOnly = false) {
    const authHeader = req.headers.authorization || '';
    const token = !cookieOnly && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : readCookie(req, exports.ADMIN_SESSION_COOKIE);
    return verifyAdminSessionToken(token);
}
async function getAdminSessionFromRequest(req, client = prismaClient_1.db.rawClient, cookieOnly = false) {
    const decoded = portalTokenClaims(req, cookieOnly);
    if (!decoded)
        return null;
    try {
        const row = await client.portalSession.findFirst({ where: { id: decoded.id, email: decoded.email, revokedAt: null, expiresAt: { gt: new Date() } },
            select: { method: true, createdAt: true } });
        return row ? { ...decoded, ...row } : null;
    }
    catch {
        return null;
    }
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
async function requireAdminAuth(req, res, next, client = prismaClient_1.db.rawClient) {
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
        const portal = await getAdminSessionFromRequest(req, client);
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
        const ownerEmail = getAdminCredentials()?.email.toLowerCase();
        if (authHeader.startsWith('Basic ') && ownerEmail && portalFactor(ownerEmail) === null) {
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
