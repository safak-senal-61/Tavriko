import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Redis } from '@upstash/redis';
import { db } from '../db/prismaClient';

export interface AuthenticatedRequest extends Request {
  authUserId?: string;
}

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Oturum doğrulaması gerekli.' });
    return;
  }

  const payload = db.verifyToken(token);
  if (!payload?.userId) {
    res.status(401).json({ error: 'Geçersiz veya süresi dolmuş oturum.' });
    return;
  }

  (req as AuthenticatedRequest).authUserId = payload.userId;
  req.body = { ...(req.body || {}), userId: payload.userId };
  next();
}

export function requirePortalAdmin(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.JWT_SECRET;
  const adminEmail = process.env.PORTAL_ADMIN_EMAIL;
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!secret || !adminEmail || !token) {
    res.status(503).json({ error: 'Yönetici erişimi yapılandırılmamış.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    if (decoded.role !== 'portal_super_admin' || decoded.email !== adminEmail) {
      res.status(403).json({ error: 'Yönetici yetkisi gerekli.' });
      return;
    }
    (req as any).portalAdminEmail = adminEmail;
    next();
  } catch {
    res.status(401).json({ error: 'Geçersiz veya süresi dolmuş yönetici oturumu.' });
  }
}

export function requireInternalSecret(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.INTERNAL_API_SECRET;
  const supplied = req.header('x-internal-secret');
  if (!expected || expected.length < 32) {
    res.status(503).json({ error: 'İç servis kimlik doğrulaması en az 32 karakterlik bir sır gerektirir.' });
    return;
  }
  if (!supplied || supplied.length !== expected.length) {
    res.status(403).json({ error: 'Yetkisiz erişim.' });
    return;
  }

  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  if (mismatch !== 0) {
    res.status(403).json({ error: 'Yetkisiz erişim.' });
    return;
  }
  next();
}

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
};

const rateLimitRedis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const localRateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Fixed-window rate limiting backed by Upstash in deployed environments.
 * Production fails closed when Redis is unavailable; local/test environments
 * use an in-memory fallback so automated tests remain deterministic.
 */
export function rateLimit(options: RateLimitOptions) {
  const windowSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `tavriko:ratelimit:${options.keyPrefix}:${ip}`;

    if (rateLimitRedis) {
      try {
        const count = await rateLimitRedis.incr(key);
        let ttl = await rateLimitRedis.ttl(key);
        if (ttl < 0) {
          await rateLimitRedis.expire(key, windowSeconds);
          ttl = windowSeconds;
        }
        if (count > options.max) {
          res.setHeader('Retry-After', String(Math.max(1, ttl)));
          res.status(429).json({ error: 'Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.' });
          return;
        }
        next();
        return;
      } catch {
        if (process.env.NODE_ENV === 'production') {
          res.status(503).json({ error: 'İstek güvenliği servisi geçici olarak kullanılamıyor.' });
          return;
        }
      }
    } else if (process.env.NODE_ENV === 'production') {
      res.status(503).json({ error: 'İstek güvenliği servisi yapılandırılmamış.' });
      return;
    }

    const now = Date.now();
    if (localRateLimitBuckets.size > 10000) {
      for (const [bucketKey, bucket] of localRateLimitBuckets) {
        if (bucket.resetAt <= now) localRateLimitBuckets.delete(bucketKey);
      }
    }
    const bucket = localRateLimitBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      localRateLimitBuckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }
    bucket.count += 1;
    if (bucket.count > options.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.' });
      return;
    }
    next();
  };
}
