import type { Request } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import { isIP } from 'node:net';

export const walletRateLimitOptions = {
  windowMs: 60_000,
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const forwarded = process.env.VERCEL === '1' ? req.get('x-forwarded-for')?.trim() : undefined;
    const ip = forwarded && isIP(forwarded) ? forwarded : req.ip || req.socket.remoteAddress;
    return ip && isIP(ip) ? ipKeyGenerator(ip) : 'unknown';
  },
};
