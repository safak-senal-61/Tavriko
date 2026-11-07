import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
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
    next();
  } catch {
    res.status(401).json({ error: 'Geçersiz veya süresi dolmuş yönetici oturumu.' });
  }
}

export function requireInternalSecret(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.INTERNAL_API_SECRET;
  const supplied = req.header('x-internal-secret');
  if (!expected) {
    res.status(503).json({ error: 'İç servis kimlik doğrulaması yapılandırılmamış.' });
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
