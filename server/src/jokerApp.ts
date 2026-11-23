import express from 'express';
import cors from 'cors';
import { makeWebCorsPolicy } from './middleware/webCors';
import jokerRoutes from './routes/jokerRoutes';

// No question bank, Redis round trip, admin routes or main server initialization
// on the latency-sensitive path. The router retains auth and rate limiting.
export function createJokerApp() {
  const app = express();
  const allowWebCors = makeWebCorsPolicy();
  app.disable('x-powered-by');
  app.use(cors((req, done) => done(null, { origin: allowWebCors(req.get('Origin'), req.path) })));
  app.use((_req, res, next) => {
    res.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Tavriko-Joker-Path': 'fast',
    });
    next();
  });
  app.use('/api', express.json({ limit: '96kb' }), jokerRoutes);
  const bodyError: express.ErrorRequestHandler = (error, _req, res, next) => {
    if (error?.type === 'entity.parse.failed' || error?.type === 'entity.too.large') {
      res.status(error.status).json({ error: 'Geçersiz joker isteği.' }); return;
    }
    next(error);
  };
  app.use(bodyError);
  return app;
}
