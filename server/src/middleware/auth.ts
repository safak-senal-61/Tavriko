import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db } from '../db/prismaClient';

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

export function getJwtSecret(): string {
  return process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || '';
}

export function getInternalSecret(): string | undefined {
  const s = process.env.INTERNAL_API_SECRET;
  return s && s.trim() ? s.trim() : undefined;
}

function getAdminCredentials(): { email: string; password: string } | null {
  const email = process.env.PORTAL_ADMIN_EMAIL;
  const password = process.env.PORTAL_ADMIN_PASSWORD;
  if (email && email.trim() && password) {
    return { email: email.trim(), password };
  }
  return null;
}

export type AdminRole = 'owner' | 'support' | 'moderator' | 'approver';
export type AdminSession = { email: string; role: AdminRole };
type Staff = { email: string; role: Exclude<AdminRole, 'owner'>; passwordHash: string };
const derive = promisify(scrypt);

function staffDirectory(): Map<string, Staff> {
  const directory = new Map<string, Staff>();
  try {
    const input: unknown = JSON.parse(process.env.PORTAL_STAFF_JSON || '[]');
    if (!Array.isArray(input) || input.length > 50) return directory;
    const owner = getAdminCredentials()?.email.toLowerCase();
    for (const staff of input) {
      if (!staff || typeof staff.email !== 'string' || staff.email.length > 160 ||
          !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(staff.email) ||
          !['support', 'moderator', 'approver'].includes(staff.role) ||
          typeof staff.passwordHash !== 'string' || !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(staff.passwordHash)) return new Map();
      const email = staff.email.toLowerCase();
      if (email === owner || directory.has(email)) return new Map();
      directory.set(email, { email, role: staff.role, passwordHash: staff.passwordHash });
    }
  } catch { return new Map(); }
  return directory;
}

const credentialVersion = (staff: Staff) => createHash('sha256').update(staff.passwordHash).digest('hex');
export const isPortalConfigured = () => Boolean(getJwtSecret() && (getAdminCredentials() || staffDirectory().size));

export async function authenticatePortal(email: unknown, password: unknown): Promise<AdminSession | null> {
  if (typeof email !== 'string' || email.length > 160 || typeof password !== 'string' || password.length > 256) return null;
  const normalized = email.trim().toLowerCase();
  if (checkAdminCredentials(email, password)) return { email: normalized, role: 'owner' };
  const staff = staffDirectory().get(normalized);
  if (!staff) return null;
  const [salt, hash] = staff.passwordHash.split(':');
  const actual = await derive(password, Buffer.from(salt, 'hex'), 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(hash, 'hex')) ? { email: staff.email, role: staff.role } : null;
}

declare global {
  namespace Express {
    interface Request {
      authUserId?: string;
    }
  }
}

/** Requires a valid player JWT. Populates req.authUserId from the token payload. */
export function requireUserAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Yetkilendirme başlığı eksik' });
    return;
  }
  const token = authHeader.slice(7);
  const payload = db.verifyToken(token);
  if (!payload || !payload.userId) {
    res.status(401).json({ error: 'Geçersiz veya süresi dolmuş oturum' });
    return;
  }
  req.authUserId = String(payload.userId);
  next();
}

export const ADMIN_SESSION_COOKIE = 'tavriko_admin_session';
export const ADMIN_SESSION_MAX_AGE_SEC = 7 * 24 * 60 * 60; // 7 gün

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Portal yöneticisi için imzalı oturum tokeni üretir. */
export function issueAdminSessionToken(email: string, role: AdminRole = 'owner'): string | null {
  const secret = getJwtSecret();
  if (!secret) return null;
  if (role === 'owner') {
    const owner = getAdminCredentials();
    if (!owner || email.toLowerCase() !== owner.email.toLowerCase()) return null;
    return jwt.sign({ email: owner.email, role: 'portal_super_admin' }, secret, { expiresIn: ADMIN_SESSION_MAX_AGE_SEC });
  }
  const staff = staffDirectory().get(email);
  if (!staff || staff.role !== role) return null;
  return jwt.sign({ email, role: 'portal_staff', staffRole: role, version: credentialVersion(staff) }, secret, { expiresIn: '8h' });
}

/** Tarayıcıya HttpOnly yönetici oturum çerezini yazar. */
export function setAdminSessionCookie(req: Request, res: Response, token: string, role: AdminRole = 'owner'): void {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https' || Boolean(process.env.VERCEL);
  const parts = [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${role === 'owner' ? ADMIN_SESSION_MAX_AGE_SEC : 8 * 60 * 60}`,
  ];
  if (secure) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

export function clearAdminSessionCookie(res: Response): void {
  res.append('Set-Cookie', `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/** Portal JWT'sini doğrular (Bearer başlığı veya oturum çerezi). */
export function verifyAdminSessionToken(token: string | null | undefined): AdminSession | null {
  if (!token) return null;
  const secret = getJwtSecret();
  if (!secret) return null;
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (typeof decoded === 'string' || typeof decoded.email !== 'string' || !decoded.email || !decoded.exp) return null;
    const email = decoded.email.toLowerCase();
    if (decoded.role === 'portal_super_admin') {
      return getAdminCredentials()?.email.toLowerCase() === email ? { email, role: 'owner' } : null;
    }
    if (decoded.role !== 'portal_staff') return null;
    const staff = staffDirectory().get(email);
    return staff && decoded.staffRole === staff.role && decoded.version === credentialVersion(staff)
      ? { email, role: staff.role } : null;
  } catch {
    return null;
  }
}

export function getAdminSessionFromRequest(req: Request): AdminSession | null {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const viaBearer = verifyAdminSessionToken(authHeader.slice(7));
    if (viaBearer) return viaBearer;
  }
  return verifyAdminSessionToken(readCookie(req, ADMIN_SESSION_COOKIE));
}

export function checkAdminCredentials(email: unknown, password: unknown): boolean {
  const creds = getAdminCredentials();
  if (!creds || typeof email !== 'string' || typeof password !== 'string') return false;
  const expected = Buffer.from(creds.password);
  const supplied = Buffer.from(password);
  return (
    email.trim().toLowerCase() === creds.email.toLowerCase() &&
    supplied.length === expected.length &&
    timingSafeEqual(supplied, expected)
  );
}

/**
 * Telegram WebApp (bot menüsündeki panel) için yönetici doğrulayıcısı.
 * TelegramBotService başlatıldığında kaydedilir; initData imzasını bot tokeni ile
 * doğrular ve kullanıcının yönetici listesinde olup olmadığını kontrol eder.
 */
type TelegramAdminVerifier = (initData: string) => Promise<boolean>;
let telegramAdminVerifier: TelegramAdminVerifier | null = null;
export function setTelegramAdminVerifier(fn: TelegramAdminVerifier | null): void {
  telegramAdminVerifier = fn;
}

function wantsHtml(req: Request): boolean {
  if (req.method !== 'GET') return false;
  if (req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/')) return false;
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
export async function requireAdminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 1) Service-to-service internal secret
    const internalSecret = getInternalSecret();
    const providedInternal = req.headers['x-internal-secret'];
    if (
      internalSecret &&
      typeof providedInternal === 'string' &&
      providedInternal.length === internalSecret.length &&
      providedInternal === internalSecret
    ) {
      next();
      return;
    }

    // 2) + 3) Portal session (cookie or Bearer)
    const portal = getAdminSessionFromRequest(req);
    if (portal) {
      if (portal.role === 'owner') next();
      else if (wantsHtml(req)) res.redirect(302, '/admin/kullanicilar');
      else res.status(403).json({ error: 'Bu alan için yönetici yetkisi gerekli.' });
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
      } catch {
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
  } catch {
    // fall through to rejection
  }

  if (wantsHtml(req)) {
    const nextPath = req.originalUrl && req.originalUrl.startsWith('/') ? req.originalUrl : '/admin';
    res.redirect(302, `/admin/login?next=${encodeURIComponent(nextPath)}`);
    return;
  }
  res.status(401).json({ error: 'Yetkisiz erişim' });
}
