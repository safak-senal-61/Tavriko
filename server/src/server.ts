import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import os from 'os';
import path from 'path';
import fs from 'fs';
// @ts-ignore
import QRCode from 'qrcode';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer, WebSocket as WsWebSocket } from 'ws';
import { prisma, db } from './db/prismaClient';
import { GameRoomManager } from './engine/GameRoomManager';
import { Matchmaker } from './engine/Matchmaker';
import { setupSocketHandlers } from './socket/socketHandler';
import { presenceManager } from './services/presenceManager';
import { TelegramBotService, safeEqualStrings } from './telegram/telegramBot';
import { supabaseService } from './db/supabaseClient';
import { cacheService } from './cache/redisClient';
import { logger } from './utils/logger';
import { ALL_CATEGORIES } from '@trivia/shared';
import { logRouter, renderDashboardHtml } from './routes/logRoutes';
import { FinalMatchSummary, canonicalCategoryId } from '@trivia/shared';
import authRoutes from './routes/authRoutes';
import { metricsMiddleware, metricsHandler, setSocketServer } from './utils/metrics';
import { initErrorMonitor, captureError } from './utils/errorMonitor';
import triviaRoutes from './routes/triviaRoutes';
import socialRoutes from './routes/socialRoutes';
import referralRoutes from './routes/referralRoutes';
import { requireAdminAuth, getAdminSessionFromRequest, setTelegramAdminVerifier } from './middleware/auth';
import { renderAdminLoginHtml, sanitizeNextPath } from './routes/adminLoginPage';
import { legalRouter } from './routes/legalRoutes';

function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('127.')) {
        return net.address;
      }
    }
  }
  return 'tavriko-app.vercel.app';
}

const SENSITIVE_KEYS = /pass|token|secret|authorization|otp|code|cookie/i;

// SECURITY: redact sensitive fields (passwords, tokens, OTP codes) before writing
// request payloads to logs. Logs are readable from the admin portal and must never
// contain credentials in plaintext.
function redactSensitiveBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  try {
    const clone: any = Array.isArray(body) ? [] : {};
    for (const key of Object.keys(body)) {
      const value = body[key];
      if (SENSITIVE_KEYS.test(key)) {
        clone[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        clone[key] = redactSensitiveBody(value);
      } else {
        clone[key] = value;
      }
    }
    return clone;
  } catch {
    return '[redacted]';
  }
}

function redactSensitiveQuery(query: any): any {
  if (!query || typeof query !== 'object') return query;
  try {
    const clone: any = {};
    for (const key of Object.keys(query)) {
      clone[key] = SENSITIVE_KEYS.test(key) ? '[REDACTED]' : query[key];
    }
    return clone;
  } catch {
    return '[redacted]';
  }
}

export function createApp() {
  initErrorMonitor();
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // SECURITY: baseline security headers on every response
  app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
    next();
  });

  // SECURITY: lightweight in-memory rate limiter for sensitive auth endpoints.
  // Sliding window per IP; on Vercel each warm lambda instance keeps its own
  // window, which still slows brute-force attacks significantly.
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();
  const RATE_LIMIT_MAX = 15;
  const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
  const rateLimitAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = `rl:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > RATE_LIMIT_MAX) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      res.status(429).json({ error: 'Çok fazla istek. Lütfen birkaç dakika sonra tekrar deneyin.' });
      return;
    }
    next();
  };
  // Periodic cleanup so the map never grows unbounded
  const cleanupRateBuckets = () => {
    const now = Date.now();
    for (const [k, b] of rateBuckets) if (b.resetAt <= now) rateBuckets.delete(k);
    setTimeout(cleanupRateBuckets, 10 * 60 * 1000).unref?.();
  };
  cleanupRateBuckets();
  app.use(
    [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/auth/google/complete-session',
      '/api/portal/login',
    ],
    rateLimitAuth
  );

  // Prometheus metrik aracisi (tavriko_http_* metrikleri)
  app.use(metricsMiddleware);

  // Global HTTP Request & Error Logger Middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const lvl = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
      const cat = req.path.includes('/auth') ? 'AUTH' : 'HTTP';
      if (
        req.path === '/favicon.ico' ||
        req.path === '/api/logs' ||
        req.path === '/api/logs/stream' ||
        req.path.startsWith('/qr')
      ) {
        return;
      }
      logger.log(
        cat,
        lvl,
        `${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`,
        {
          ip: req.ip,
          query: Object.keys(req.query).length ? redactSensitiveQuery(req.query) : undefined,
          body: req.method !== 'GET' && Object.keys(req.body || {}).length ? redactSensitiveBody(req.body) : undefined,
        }
      );
    });
    next();
  });

  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Prometheus'a canli istemci sayisini bildir
  setSocketServer(io);

  // Wire up authoritative room manager with DB question provider
  const roomManager = new GameRoomManager((category, difficulty, count) => {
    return db.getQuestions(category, difficulty, count);
  });

  const matchmaker = new Matchmaker(roomManager);

  setupSocketHandlers(io, roomManager, matchmaker);

  // Native WebSocket server for /ws connections (real-time presence & notifications)
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/ws')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WsWebSocket, request: http.IncomingMessage) => {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    const playerId = url.searchParams.get('playerId');
    const roomCode = url.searchParams.get('roomCode');

    if (playerId) {
      presenceManager.registerSocket(playerId, ws);
      if (roomCode) {
        presenceManager.setUserRoom(playerId, roomCode);
      }
      ws.send(
        JSON.stringify({
          event: 'presence:sync',
          payload: { presences: presenceManager.getAllPresences() },
          timestamp: Date.now(),
        })
      );
    }

    ws.on('message', (data) => {
      try {
        const text = data.toString();
        const msg = JSON.parse(text);
        if (msg.event === 'ping') {
          ws.send(JSON.stringify({ event: 'pong', timestamp: Date.now() }));
        } else if (msg.event === 'presence:ping' && msg.payload?.playerId) {
          presenceManager.touchUser(msg.payload.playerId);
        } else if (msg.event === 'presence:register' && msg.payload?.playerId) {
          presenceManager.registerSocket(msg.payload.playerId, ws);
          ws.send(
            JSON.stringify({
              event: 'presence:sync',
              payload: { presences: presenceManager.getAllPresences() },
              timestamp: Date.now(),
            })
          );
        }
      } catch {}
    });

    ws.on('close', () => {
      if (playerId) {
        presenceManager.unregisterSocket(playerId, ws);
      }
    });
  });

  // Initialize Telegram Bot & Admin Approval Service
  const telegramBot = new TelegramBotService({ db, roomManager });
  // Telegram menüsündeki WebApp paneli, /api/admin/* uçlarına Telegram'ın imzaladığı
  // initData ile erişir (tarayıcı şifresi gerekmez).
  setTelegramAdminVerifier((initData) => telegramBot.verifyWebAppInitData(initData));

  // Telegram Webhook endpoint (Essential for Vercel Serverless execution)
  app.post(['/api/telegram/webhook', '/telegram/webhook'], async (req, res) => {
    try {
      // SECURITY: verify Telegram's webhook secret token. Without this check anyone
      // could POST forged Telegram updates (impersonating admins in the approval bot).
      // Anahtar TELEGRAM_WEBHOOK_SECRET'tan (yoksa bot tokeninden) türetilir ve
      // setWebhook çağrılarında Telegram'a secret_token olarak verilir.
      const webhookSecret = await telegramBot.getWebhookSecret();
      if (!webhookSecret) {
        logger.error('TELEGRAM', 'Webhook reddedildi: Telegram bot tokeni yapılandırılmamış.');
        return res.status(503).send('Bot not configured');
      }
      const providedSecret = req.headers['x-telegram-bot-api-secret-token'];
      if (typeof providedSecret !== 'string' || !safeEqualStrings(providedSecret, webhookSecret)) {
        logger.warn('TELEGRAM', 'Webhook reddedildi: gizli token doğrulaması başarısız. Webhook kaydı onarılıyor.');
        // Telegram'daki kayıt eski/anahtarsızsa doğru anahtarla yeniden kur (kısıtlı sıklıkta).
        await telegramBot.repairWebhook().catch(() => false);
        return res.status(401).send('Unauthorized');
      }

      const update = req.body;
      const sender =
        update?.message?.from?.username ||
        update?.callback_query?.from?.username ||
        update?.message?.from?.id ||
        'Bilinmiyor';
      const text =
        update?.message?.text ||
        (update?.callback_query ? `[Callback: ${update.callback_query.data}]` : '(medya/diğer)');

      logger.info('TELEGRAM', `Webhook isteği alındı (@${sender}): ${text}`, {
        updateId: update?.update_id,
        chatId: update?.message?.chat?.id || update?.callback_query?.message?.chat?.id,
      });

      if (!req.body || typeof req.body !== 'object') {
        return res.status(200).send('OK');
      }
      await telegramBot.handleWebhookUpdate(req.body);
      return res.status(200).send('OK');
    } catch (err: any) {
      logger.error('TELEGRAM', `Telegram Webhook Hatası: ${err.message}`, { stack: err.stack });
      console.error('[Telegram Webhook Error]:', err.message);
      return res.status(200).send('OK');
    }
  });

  // Telegram set webhook endpoint
  app.get(['/api/admin/telegram/set-webhook', '/admin/telegram/set-webhook'], requireAdminAuth, async (req, res) => {
    try {
      const cfGatewayUrl = 'https://tavriko-realtime.uncertainidentity8.workers.dev/telegram/webhook';
      const vercelUrl = 'https://tavriko-app.vercel.app/api/telegram/webhook';
      let webhookUrl = cfGatewayUrl;
      if (req.query.url === 'vercel') {
        webhookUrl = vercelUrl;
      } else if (req.query.url && typeof req.query.url === 'string' && req.query.url.startsWith('http')) {
        webhookUrl = req.query.url;
      }
      const result = await telegramBot.setWebhook(webhookUrl);
      return res.json({ ...result, configured_url: webhookUrl });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Telegram webhook info
  app.get(['/api/admin/telegram/webhook-info', '/admin/telegram/webhook-info'], requireAdminAuth, async (req, res) => {
    try {
      const info = await telegramBot.getWebhookInfo();
      return res.json({ success: true, info });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Dynamic QR Code endpoint (Default to Cloud Web URL for 24/7 direct play)
  app.get('/qr', async (req, res) => {
    try {
      const host = req.get('host') || 'tavriko-app.vercel.app';
      const proto = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const defaultUrl = `${proto}://${host}/app`;
      const targetUrl =
        (req.query.url as string) ||
        (req.query.ip ? `exp://${req.query.ip}:8081` : defaultUrl);
      const buffer = await QRCode.toBuffer(targetUrl, {
        width: 350,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      res.type('image/png').send(buffer);
    } catch (err: any) {
      res.status(500).send('QR code generation failed: ' + err.message);
    }
  });

  // Telegram bot status endpoint
  // SECURITY: the bot token is never returned in API responses (previously leaked
  // via activeToken).
  app.get('/api/admin/telegram/status', requireAdminAuth, async (req, res) => {
    const webhookInfo = await telegramBot.getWebhookInfo();
    res.json({
      running: telegramBot.isRunning(),
      tokenConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && !process.env.TELEGRAM_BOT_TOKEN.includes('placeholder')),
      webhookInfo,
    });
  });

  // Telegram bot live configuration endpoint
  app.post(['/api/admin/telegram/config', '/admin/telegram/config'], requireAdminAuth, async (req, res) => {
    try {
      const { token, adminIds } = req.body;
      if (!token || typeof token !== 'string' || token.trim().length < 15) {
        return res.status(400).json({
          success: false,
          message: 'Geçersiz Telegram Bot Token. Lütfen @BotFather tarafından verilen tam token değerini girin.',
        });
      }

      let parsedAdminIds: string[] | undefined;
      if (adminIds) {
        if (Array.isArray(adminIds)) {
          parsedAdminIds = adminIds.map((id) => String(id).trim()).filter(Boolean);
        } else {
          parsedAdminIds = String(adminIds)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }

      const result = await telegramBot.configure(token.trim(), parsedAdminIds);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: 'Telegram bot konfigürasyon hatası: ' + err.message,
      });
    }
  });

  // Telegram test & status check endpoint
  app.get(['/api/admin/telegram/test', '/admin/telegram/test'], requireAdminAuth, async (req, res) => {
    try {
      const info = await telegramBot.getBotInfo();
      return res.json(info);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Static Web App Serving (client/dist)
  const clientDistCandidates = [
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(__dirname, '../client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
    path.resolve(process.cwd(), 'dist'),
  ];
  const clientDistDir = clientDistCandidates.find((dir) => fs.existsSync(path.join(dir, 'index.html')));

  if (clientDistDir) {
    // Helper to send index.html with no-cache headers so browsers NEVER get stuck on old bundle hashes
    const sendIndexHtml = (res: express.Response) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.sendFile(path.join(clientDistDir!, 'index.html'));
    };

    // 1. Dynamic fallback for any requested web JS bundle (resolves cached browser requests)
    app.get(['/_expo/static/js/web/:filename', '/app/_expo/static/js/web/:filename'], (req, res) => {
      const filename = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
      const exactPath = path.join(clientDistDir!, '_expo/static/js/web', filename);
      if (fs.existsSync(exactPath)) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        return res.sendFile(exactPath);
      }
      // If exact hash not found, serve the active bundle so cached clients still work flawlessly
      const webJsDir = path.join(clientDistDir!, '_expo/static/js/web');
      if (fs.existsSync(webJsDir)) {
        const files = fs.readdirSync(webJsDir).filter((f) => f.endsWith('.js'));
        if (files.length > 0) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          return res.sendFile(path.join(webJsDir, files[0]));
        }
      }
      res.status(404).type('text/plain').send('Bundle not found');
    });

    // 2. Relative path fallback if browser requests /app/_expo/... or /app/assets/...
    app.use('/app/_expo', express.static(path.join(clientDistDir, '_expo')));
    app.use('/app/assets', express.static(path.join(clientDistDir, 'assets')));

    // 3. Root static assets
    app.use('/_expo', express.static(path.join(clientDistDir, '_expo')));
    app.use('/assets', express.static(path.join(clientDistDir, 'assets')));
    app.get('/favicon.ico', (req, res) => {
      res.sendFile(path.join(clientDistDir!, 'favicon.ico'));
    });

    // 4. Playable Web App at /app
    app.get(['/app', '/app/'], (req, res) => {
      sendIndexHtml(res);
    });

    // Handle deep client-side routes under /app/* (never return index.html for static assets with extensions)
    app.get('/app/*', (req, res, next) => {
      if (req.path.includes('.')) {
        return res.status(404).type('text/plain').send('Asset not found');
      }
      sendIndexHtml(res);
    });

    // Short URLs redirect to /app
    app.get(['/play', '/game'], (req, res) => {
      res.redirect('/app');
    });

    // Main website entry point '/' serves the playable Tavriko web game directly!
    app.get('/', (req, res) => {
      sendIndexHtml(res);
    });
  } else {
    // Fallback if client dist is not yet available
    app.get('/', (req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(renderDashboardHtml());
    });
  }

  // Yönetici giriş sayfası: tarayıcının yerel şifre penceresi yerine kalıcı oturum çerezi.
  app.get('/admin/login', (req, res) => {
    const nextPath = sanitizeNextPath(req.query.next);
    if (getAdminSessionFromRequest(req)) {
      return res.redirect(302, nextPath);
    }
    const configured = Boolean(
      process.env.PORTAL_ADMIN_EMAIL && process.env.PORTAL_ADMIN_PASSWORD && (process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET)
    );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(renderAdminLoginHtml(nextPath, configured));
  });

  // Admin & Operations Portal — birincil adres /admin (oturum çereziyle korunur)
  app.get(['/admin', '/portal', '/dashboard', '/ops', '/dev', '/developer-portal', '/gelistirici'], requireAdminAuth, (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderDashboardHtml());
  });
  // Eski /developer adresi artık /admin'e yönlendirir
  app.get(['/developer', '/developer/'], requireAdminAuth, (req, res) => {
    res.redirect(301, '/admin');
  });

  // Telegram Admin dashboard
  app.get('/telegram-admin', requireAdminAuth, (req, res) => {
    const isBotRunning = telegramBot.isRunning();
    const tokenSet = !!(process.env.TELEGRAM_BOT_TOKEN && !process.env.TELEGRAM_BOT_TOKEN.includes('placeholder'));

    res.send(`
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <title>TriviaVerse Sunucu ve Yönetim Paneli</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { box-sizing: border-box; }
          body { 
            background: #0B0E17; 
            color: #F8FAFC; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            min-height: 100vh; 
            margin: 0; 
            padding: 24px;
          }
          .container { 
            width: 100%; 
            max-width: 760px; 
            background: #151A29; 
            border: 1px solid #232B42; 
            border-radius: 24px; 
            padding: 32px; 
            box-shadow: 0 20px 50px rgba(0,0,0,0.6); 
          }
          .header { text-align: center; margin-bottom: 28px; }
          .badge { 
            display: inline-flex; 
            align-items: center; 
            gap: 8px; 
            background: rgba(16, 185, 129, 0.12); 
            color: #10B981; 
            font-weight: 700; 
            font-size: 13px; 
            padding: 6px 16px; 
            border-radius: 999px; 
            border: 1px solid rgba(16, 185, 129, 0.3);
            margin-bottom: 14px;
          }
          h1 { margin: 0 0 8px 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
          .subtitle { color: #94A3B8; font-size: 15px; margin: 0; }
          
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
          @media (max-width: 680px) { .grid { grid-template-columns: 1fr; } }
          
          .card { 
            background: #1B2236; 
            border: 1px solid #273352; 
            border-radius: 18px; 
            padding: 20px; 
          }
          .card h2 { margin: 0 0 12px 0; font-size: 18px; display: flex; align-items: center; gap: 8px; }
          
          .qr-box { 
            background: #ffffff; 
            padding: 12px; 
            border-radius: 14px; 
            display: inline-block; 
            margin: 10px 0; 
            box-shadow: 0 8px 20px rgba(0,0,0,0.3); 
          }
          .qr-box img { width: 190px; height: 190px; display: block; border-radius: 6px; }
          
          .status-indicator { 
            display: inline-block; 
            width: 10px; 
            height: 10px; 
            border-radius: 50%; 
            margin-right: 6px; 
          }
          .status-on { background: #10B981; box-shadow: 0 0 8px #10B981; }
          .status-warn { background: #F59E0B; box-shadow: 0 0 8px #F59E0B; }
          
          .form-group { margin-bottom: 12px; text-align: left; }
          .form-group label { display: block; font-size: 12px; font-weight: 600; color: #94A3B8; margin-bottom: 6px; }
          .form-control { 
            width: 100%; 
            background: #0E1321; 
            border: 1px solid #2B3754; 
            color: #F8FAFC; 
            padding: 10px 14px; 
            border-radius: 10px; 
            font-size: 13px; 
            outline: none;
            transition: 0.2s;
          }
          .form-control:focus { border-color: #6366F1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2); }
          
          .btn { 
            display: block; 
            width: 100%; 
            background: #6366F1; 
            color: white; 
            text-decoration: none; 
            padding: 12px; 
            border-radius: 10px; 
            font-weight: 700; 
            font-size: 14px; 
            text-align: center; 
            border: none; 
            cursor: pointer; 
            transition: 0.2s; 
          }
          .btn:hover { background: #4F46E5; }
          .btn-telegram { background: #0088cc; }
          .btn-telegram:hover { background: #0077b3; }
          
          .links-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
          .chip { 
            background: #232B42; 
            color: #CBD5E1; 
            text-decoration: none; 
            padding: 8px 14px; 
            border-radius: 8px; 
            font-size: 13px; 
            border: 1px solid #2C3754; 
            transition: 0.2s; 
          }
          .chip:hover { background: #2F3B5C; color: #ffffff; }
          
          .notice { 
            background: rgba(99, 102, 241, 0.08); 
            border: 1px solid rgba(99, 102, 241, 0.25); 
            border-radius: 12px; 
            padding: 14px; 
            font-size: 13px; 
            color: #C7D2FE; 
            margin-top: 20px; 
            line-height: 1.5; 
          }
          #msg-box { margin-top: 10px; font-size: 13px; font-weight: 600; display: none; }
          .stat-box { background: #0E1321; border: 1px solid #2B3754; border-radius: 14px; padding: 14px; text-align: center; }
          .stat-val { font-size: 26px; font-weight: 800; color: #F8FAFC; }
          .stat-lbl { font-size: 11px; color: #94A3B8; font-weight: 600; margin-top: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="badge">
              <span class="status-indicator status-on"></span>
              PORT 4000 ONLINE & SUNUCU HAZIR
            </div>
            <h1>⚡ TriviaVerse Kontrol Paneli</h1>
            <p class="subtitle">Multiplayer Soru Yarışması, Evren GLM-5.3 LLM & Telegram Onay Sistemi</p>
          </div>

          <div class="grid">
            <!-- Sol Kart: Mobil Oyun Bağlantısı -->
            <div class="card" style="text-align: center;">
              <h2>📱 Mobil & Web Oyun (7/24 Bulut)</h2>
              <p style="color: #94A3B8; font-size: 13px; margin: 4px 0 10px;">
                Telefon kameranızla QR kodu okutun veya tarayıcıda doğrudan oynayın:
              </p>
              <div class="qr-box">
                <img src="/qr" alt="Tavriko Mobil QR Kodu" />
              </div>
              <div style="font-family: monospace; font-size: 12px; color: #818CF8; margin-top: 6px; word-break: break-all;">
                https://${req.get('host') || 'tavriko-app.vercel.app'}/app
              </div>
              <a href="/app" target="_blank" class="btn" style="margin-top: 14px; text-decoration: none;">
                🌐 Oyunu Tarayıcıda Doğrudan Aç (/app)
              </a>
            </div>

            <!-- Sağ Kart: Telegram Bot Yönetimi -->
            <div class="card">
              <h2>
                🤖 Telegram Onay Botu
                <span id="bot-status-pill" class="badge" style="margin: 0 0 0 auto; padding: 4px 10px; font-size: 11px; ${
                  isBotRunning ? 'background: rgba(16,185,129,0.15); color: #10B981;' : 'background: rgba(245,158,11,0.15); color: #F59E0B;'
                }">
                  ${isBotRunning ? '● AKTİF' : '○ TOKEN BEKLENİYOR'}
                </span>
              </h2>
              <p style="color: #94A3B8; font-size: 12px; margin: 0 0 14px;">
                Telegram botunuzu bağlayarak AI üretilen soruları <b>/soru_uret</b> ile üretip anında <b>[Onayla]</b> veya <b>[Reddet]</b> butonlarıyla yönetin.
              </p>

              <form id="tg-form" onsubmit="saveTelegramConfig(event)">
                <div class="form-group">
                  <label>TELEGRAM BOT TOKEN (@BotFather)</label>
                  <input type="text" id="tg-token" class="form-control" placeholder="123456789:ABCdefGhIJKlmNoPQR..." required />
                </div>
                <div class="form-group">
                  <label>ADMIN USER / CHAT ID (İsteğe bağlı, virgülle ayrılmış)</label>
                  <input type="text" id="tg-admins" class="form-control" placeholder="Örn: 987654321" />
                </div>
                <button type="submit" class="btn btn-telegram" id="btn-save-bot">
                  🚀 Botu Bağla ve Başlat
                </button>
                <button type="button" class="btn" id="btn-cf-webhook" onclick="forceSetWebhook('cloudflare')" style="margin-top: 8px; background: linear-gradient(135deg, #F6821F 0%, #D86300 100%); color: white; font-weight: 800;">
                  ⚡ Webhook'u Cloudflare Edge Gateway'e Bağla (Önerilen)
                </button>
                <button type="button" class="btn" id="btn-vercel-webhook" onclick="forceSetWebhook('vercel')" style="margin-top: 8px; background: #232B42; border: 1px solid #3B4B75;">
                  🔄 Webhook'u Doğrudan Vercel'e Bağla
                </button>
                <button type="button" class="btn" id="btn-test-bot" onclick="testTelegramBot()" style="margin-top: 8px; background: rgba(255,255,255,0.08); border: 1px solid #2B3754;">
                  🧪 Bot & Webhook Bağlantısını Test Et
                </button>
              </form>
              <div id="msg-box"></div>
              <div id="bot-details-box" style="display: none; margin-top: 14px; background: rgba(0, 136, 204, 0.1); border: 1px solid rgba(0, 136, 204, 0.3); border-radius: 12px; padding: 14px; font-size: 13px;">
                <div style="font-weight: 700; color: #38BDF8; margin-bottom: 6px; font-size: 14px;" id="bot-username-display">🤖 Bot Bilgisi</div>
                <div style="color: #CBD5E1; font-size: 12px; margin-bottom: 4px;" id="bot-webhook-display">Webhook: https://tavriko-realtime.uncertainidentity8.workers.dev/telegram/webhook</div>
                <div style="color: #94A3B8; font-size: 11px; margin-bottom: 6px;" id="bot-pending-display">Bekleyen Güncellemeler: 0</div>
                <div style="color: #EF4444; font-size: 12px; font-weight: 600; display: none;" id="bot-error-display"></div>
                <a id="bot-link-btn" href="#" target="_blank" style="display: inline-block; margin-top: 8px; background: #0088cc; color: #fff; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 13px;">📲 Telegram'da Botu Aç</a>
              </div>
            </div>
          </div>

          <!-- SORU YÜKLEME MERKEZİ (Supabase senkron) -->
          <div class="card" id="upload-center">
            <h2>📥 Soru Yükleme Merkezi <span class="badge" style="margin:0 0 0 auto; padding:4px 10px; font-size:11px; background:rgba(99,102,241,0.15); color:#818CF8;">SUPABASE SENKRON</span></h2>
            <p style="color:#94A3B8; font-size:13px; margin:0 0 16px; line-height:1.55;">
              Buraya yüklediğiniz sorular Supabase kalıcı deposuna yazılır ve oyunda anında görünür.
              JSON metni yapıştırın veya <b>.json</b> dosyası seçin. Telegram botuna <b>/soru_ekle</b> komutuyla
              gönderdiğiniz sorular da aynı havuza düşer.
            </p>

            <div class="form-group">
              <label>HEDEF HAVUZ</label>
              <select id="upload-pool" class="form-control">
                <option value="standard" selected>🏆 Tek Kişilik Mod (Keşfet kategorileri)</option>
                <option value="custom_room">⚔️ Özel Oda & 1v1 Düellolar</option>
                <option value="daily_challenge">📅 Günlük Meydan Okuma</option>
              </select>
            </div>

            <div class="form-group">
              <label>JSON SORU VERİSİ</label>
              <textarea id="upload-json" class="form-control" rows="8" placeholder='[{"text":"Soru metni...","options":["A","B","C","D"],"correctAnswerIndex":0,"categoryId":"history","difficulty":"medium","explanation":"Açıklama..."}]' oninput="updateUploadLive()"></textarea>
              <div id="upload-live" style="margin-top:8px; font-size:12px; color:#94A3B8; font-weight:600;">ℹ️ Henüz soru girilmedi.</div>
            </div>

            <div class="form-group">
              <input type="file" id="upload-file" class="form-control" accept=".json,application/json" onchange="handleUploadFile(event)" />
            </div>

            <div class="form-group" style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" id="upload-autopublish" checked style="width:16px; height:16px; accent-color:#6366F1;" />
              <label for="upload-autopublish" style="margin:0; font-size:13px; color:#CBD5E1; cursor:pointer;">Doğrudan yayınla (onay kuyruğunu atla)</label>
            </div>

            <button type="button" class="btn" onclick="uploadQuestions()" id="btn-upload-q">🚀 Soruları Havuza Aktar</button>
            <button type="button" class="btn" style="background:#232B42; border:1px solid #3B4B75; margin-top:8px;" onclick="fillSampleTemplate()">📋 Örnek Şablonu Doldur</button>
            <div id="upload-result" style="display:none; margin-top:14px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.3); border-radius:12px; padding:14px; font-size:13px; line-height:1.6;"></div>
          </div>

          <!-- HAVUZ İSTATİSTİKLERİ -->
          <div class="card">
            <h2>📊 Soru Havuzu Durumu <button type="button" class="btn" style="width:auto; margin-left:auto; padding:6px 14px; font-size:12px;" onclick="loadPoolStats()">🔄 Yenile</button></h2>
            <div class="stats-grid" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-bottom:14px;">
              <div class="stat-box"><div class="stat-val" id="stat-total">-</div><div class="stat-lbl">Toplam Soru</div></div>
              <div class="stat-box"><div class="stat-val" style="color:#10B981;" id="stat-published">-</div><div class="stat-lbl">Yayında</div></div>
              <div class="stat-box"><div class="stat-val" style="color:#F59E0B;" id="stat-pending">-</div><div class="stat-lbl">Onay Bekleyen</div></div>
            </div>
            <div id="stat-categories" style="font-size:12px; color:#CBD5E1; line-height:1.8;">Yükleniyor...</div>
          </div>

          <!-- SORU GEZGİNİ -->
          <div class="card">
            <h2>🔎 Havuzda Ara</h2>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <input type="text" id="search-term" class="form-control" style="flex:1; min-width:160px;" placeholder="Soru metninde ara..." onkeydown="if(event.key==='Enter'){searchQuestions();}" />
              <button type="button" class="btn" style="width:auto; padding:10px 18px;" onclick="searchQuestions()">Ara</button>
            </div>
            <div id="search-results" style="margin-top:14px;"></div>
          </div>

          <!-- ONAY KUYRUĞU -->
          <div class="card">
            <h2>⏳ Onay Bekleyen Sorular <button type="button" class="btn" style="width:auto; margin-left:auto; padding:6px 14px; font-size:12px;" onclick="loadPendingQuestions()">🔄 Yenile</button></h2>
            <div id="pending-list" style="margin-top:8px; font-size:13px; color:#94A3B8;">Yükleniyor...</div>
          </div>

          <!-- Alt Kısım: Servis Durumları ve Hızlı Linkler -->
          <div class="card">
            <h2>🔗 Hızlı Erişim ve Servisler</h2>
            <div class="links-row">
              <a class="chip" href="/health" target="_blank">🩺 /health (Servis Sağlığı)</a>
              <a class="chip" href="/api/categories" target="_blank">📚 Tüm Oyun Kategorileri</a>
              <a class="chip" href="/api/admin/questions/stats" target="_blank">📊 Soru Havuzu İstatistikleri</a>
              <a class="chip" href="/api/admin/questions/review" target="_blank">⏳ Onay Bekleyen Sorular</a>
              <a class="chip" href="/telegram-webapp" target="_blank" style="background: rgba(98, 54, 255, 0.25); border-color: #6236FF; color: #E0E7FF; font-weight: 700;">🎮 /telegram-webapp (Telegram Web App)</a>
            </div>
            <div class="notice">
              💡 <b>Expo SDK 58 Bilgilendirmesi:</b> Telefonunuzdaki Expo Go SDK 58 ile tam uyumlu hale getirilmiştir. QR kodu telefonunuzdaki Expo Go ile okutarak doğrudan oyuna bağlanabilirsiniz.
            </div>
          </div>
        </div>

        <script>
          async function saveTelegramConfig(e) {
            e.preventDefault();
            const token = document.getElementById('tg-token').value.trim();
            const adminIds = document.getElementById('tg-admins').value.trim();
            const btn = document.getElementById('btn-save-bot');
            const msg = document.getElementById('msg-box');

            btn.disabled = true;
            btn.innerText = 'Bağlanıyor...';
            msg.style.display = 'none';

            try {
              const res = await fetch('/api/admin/telegram/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, adminIds }),
              });
              const data = await res.json();
              msg.style.display = 'block';
              if (data.success) {
                msg.style.color = '#10B981';
                msg.innerText = '✅ ' + data.message;
                const pill = document.getElementById('bot-status-pill');
                pill.style.background = 'rgba(16,185,129,0.15)';
                pill.style.color = '#10B981';
                pill.innerText = '● AKTİF';
              } else {
                msg.style.color = '#EF4444';
                msg.innerText = '❌ ' + (data.message || data.error);
              }
            } catch (err) {
              msg.style.display = 'block';
              msg.style.color = '#EF4444';
              msg.innerText = '❌ Bağlantı hatası: ' + err.message;
            } finally {
              btn.disabled = false;
              btn.innerText = '🚀 Botu Bağla ve Başlat';
            }
          }

          async function forceSetWebhook(target) {
            const btnCf = document.getElementById('btn-cf-webhook');
            const btnVercel = document.getElementById('btn-vercel-webhook');
            const msg = document.getElementById('msg-box');
            if (btnCf) btnCf.disabled = true;
            if (btnVercel) btnVercel.disabled = true;
            msg.style.display = 'none';

            try {
              const query = target ? ('?url=' + encodeURIComponent(target)) : '';
              const res = await fetch('/api/admin/telegram/set-webhook' + query);
              const data = await res.json();
              msg.style.display = 'block';
              if (data.success) {
                msg.style.color = '#10B981';
                msg.innerText = '✅ ' + (data.message || 'Webhook başarıyla bağlandı!') + (data.configured_url ? ' -> ' + data.configured_url : '');
                testTelegramBot();
              } else {
                msg.style.color = '#EF4444';
                msg.innerText = '❌ Webhook kurulamadı: ' + (data.message || data.error);
              }
            } catch (err) {
              msg.style.display = 'block';
              msg.style.color = '#EF4444';
              msg.innerText = '❌ İstek hatası: ' + err.message;
            } finally {
              if (btnCf) {
                btnCf.disabled = false;
                btnCf.innerText = "⚡ Webhook'u Cloudflare Edge Gateway'e Bağla (Önerilen)";
              }
              if (btnVercel) {
                btnVercel.disabled = false;
                btnVercel.innerText = "🔄 Webhook'u Doğrudan Vercel'e Bağla";
              }
            }
          }

          async function testTelegramBot() {
            const btn = document.getElementById('btn-test-bot');
            const msg = document.getElementById('msg-box');
            const detailsBox = document.getElementById('bot-details-box');
            const usernameEl = document.getElementById('bot-username-display');
            const webhookEl = document.getElementById('bot-webhook-display');
            const pendingEl = document.getElementById('bot-pending-display');
            const errorEl = document.getElementById('bot-error-display');
            const linkBtn = document.getElementById('bot-link-btn');

            btn.disabled = true;
            btn.innerText = 'Test ediliyor...';
            msg.style.display = 'none';

            try {
              const res = await fetch('/api/admin/telegram/test');
              const data = await res.json();
              msg.style.display = 'block';
              if (data.success && data.bot) {
                msg.style.color = '#10B981';
                msg.innerText = '✅ Telegram Bot Aktif: @' + (data.bot.username || data.bot.first_name);
                detailsBox.style.display = 'block';
                usernameEl.innerText = '🤖 @' + data.bot.username + ' (' + (data.bot.first_name || 'Tavriko Bot') + ')';
                webhookEl.innerText = 'Webhook: ' + (data.webhook?.url || 'Kurulu değil (Polling)');
                if (pendingEl) pendingEl.innerText = 'Bekleyen Güncellemeler: ' + (data.webhook?.pending_update_count ?? 0);
                if (errorEl) {
                  if (data.webhook?.last_error_message) {
                    errorEl.style.display = 'block';
                    errorEl.innerText = '⚠️ Telegram Uyarısı: ' + data.webhook.last_error_message;
                  } else {
                    errorEl.style.display = 'none';
                  }
                }
                if (data.bot.username) {
                  linkBtn.href = 'https://t.me/' + data.bot.username;
                  linkBtn.style.display = 'inline-block';
                }
                const pill = document.getElementById('bot-status-pill');
                pill.style.background = 'rgba(16,185,129,0.15)';
                pill.style.color = '#10B981';
                pill.innerText = '● AKTİF';
              } else {
                msg.style.color = '#EF4444';
                msg.innerText = '❌ ' + (data.error || 'Bot başlatılmamış.');
                detailsBox.style.display = 'none';
              }
            } catch (err) {
              msg.style.display = 'block';
              msg.style.color = '#EF4444';
              msg.innerText = '❌ Test hatası: ' + err.message;
            } finally {
              btn.disabled = false;
              btn.innerText = '🧪 Bot & Webhook Bağlantısını Test Et';
            }
          }

          // Otomatik mevcut bot durumunu sorgula
          window.addEventListener('DOMContentLoaded', () => {
            fetch('/api/admin/telegram/test').then(r => r.json()).then(data => {
              if (data.success && data.bot) {
                const pill = document.getElementById('bot-status-pill');
                if (pill) {
                  pill.style.background = 'rgba(16,185,129,0.15)';
                  pill.style.color = '#10B981';
                  pill.innerText = '● AKTİF (@' + data.bot.username + ')';
                }
                const detailsBox = document.getElementById('bot-details-box');
                const usernameEl = document.getElementById('bot-username-display');
                const webhookEl = document.getElementById('bot-webhook-display');
                const linkBtn = document.getElementById('bot-link-btn');
                if (detailsBox && usernameEl && webhookEl && linkBtn) {
                  detailsBox.style.display = 'block';
                  usernameEl.innerText = '🤖 @' + data.bot.username + ' (' + (data.bot.first_name || 'Tavriko Bot') + ')';
                  webhookEl.innerText = 'Webhook: ' + (data.webhook?.url || 'https://tavriko-app.vercel.app/api/telegram/webhook');
                  if (data.bot.username) {
                    linkBtn.href = 'https://t.me/' + data.bot.username;
                  }
                }
              }
            }).catch(() => {});

            // Soru merkezi otomatik yükleme
            loadPoolStats();
            loadPendingQuestions();
          });

          // ================= SORU YÜKLEME MERKEZİ =================
          function parseUploadJson() {
            const raw = (document.getElementById('upload-json').value || '').trim();
            if (!raw) return { list: null, error: null };
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) return { list: parsed, error: null };
              if (parsed && typeof parsed === 'object') return { list: [parsed], error: null };
              return { list: null, error: 'JSON bir dizi (list) veya soru objesi olmalı.' };
            } catch (e) {
              return { list: null, error: 'Geçersiz JSON: ' + e.message };
            }
          }

          function updateUploadLive() {
            const live = document.getElementById('upload-live');
            const res = parseUploadJson();
            if (res.error) {
              live.style.color = '#EF4444';
              live.innerText = '❌ ' + res.error;
            } else if (!res.list) {
              live.style.color = '#94A3B8';
              live.innerText = 'ℹ️ Henüz soru girilmedi.';
            } else {
              const cats = {};
              res.list.forEach(function (q) { const c = q.categoryId || q.kategori || 'general_culture'; cats[c] = (cats[c] || 0) + 1; });
              const catText = Object.keys(cats).map(function (k) { return k + ':' + cats[k]; }).join(' · ');
              live.style.color = '#10B981';
              live.innerText = '✅ ' + res.list.length + ' soru algılandı (' + catText + ')';
            }
          }

          function handleUploadFile(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function () {
              document.getElementById('upload-json').value = String(reader.result || '');
              updateUploadLive();
            };
            reader.readAsText(file);
          }

          function fillSampleTemplate() {
            document.getElementById('upload-json').value = JSON.stringify([
              { text: 'Osmanlı Devleti hangi yıl kuruldu?', options: ['1299', '1453', '1071', '1492'], correctAnswerIndex: 0, categoryId: 'history', difficulty: 'medium', targetPool: document.getElementById('upload-pool').value, explanation: 'Osmanlı Devleti 1299 yılında Osman Bey tarafından kuruldu.' },
              { text: 'Türkiye cumhuriyetinin başkenti neresidir?', options: ['İstanbul', 'Ankara', 'İzmir', 'Bursa'], correctAnswerIndex: 1, categoryId: 'geography', difficulty: 'easy', targetPool: document.getElementById('upload-pool').value, explanation: 'Türkiye Cumhuriyetinin başkenti Ankara dır.' }
            ], null, 2);
            updateUploadLive();
          }

          async function uploadQuestions() {
            const btn = document.getElementById('btn-upload-q');
            const resultBox = document.getElementById('upload-result');
            const res = parseUploadJson();
            if (res.error || !res.list) {
              resultBox.style.display = 'block';
              resultBox.style.background = 'rgba(239,68,68,0.08)';
              resultBox.style.borderColor = 'rgba(239,68,68,0.3)';
              resultBox.innerText = '❌ Lütfen geçerli JSON girin.';
              return;
            }
            btn.disabled = true;
            btn.innerText = 'Yükleniyor...';
            try {
              const apiRes = await fetch('/api/admin/questions/import-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  input: res.list,
                  publishDirectly: document.getElementById('upload-autopublish').checked,
                  defaultTargetPool: document.getElementById('upload-pool').value,
                  addedBy: 'Telegram Admin Panel'
                })
              });
              const data = await apiRes.json();
              resultBox.style.display = 'block';
              if (data.importedCount > 0 || data.success) {
                resultBox.style.background = 'rgba(16,185,129,0.08)';
                resultBox.style.borderColor = 'rgba(16,185,129,0.3)';
                let html = '✅ <b>' + (data.importedCount || 0) + ' soru havuza eklendi.</b> ';
                if (data.duplicateCount) html += '🔁 ' + data.duplicateCount + ' mükerrer atlandı. ';
                if (data.errorCount) html += '⚠️ ' + data.errorCount + ' hatalı soru.';
                if (data.errors && data.errors.length) {
                  html += '<div style="margin-top:8px; color:#F59E0B; font-size:12px;">' + data.errors.slice(0, 5).join('<br>') + '</div>';
                }
                resultBox.innerHTML = html;
                document.getElementById('upload-json').value = '';
                updateUploadLive();
              } else {
                resultBox.style.background = 'rgba(239,68,68,0.08)';
                resultBox.style.borderColor = 'rgba(239,68,68,0.3)';
                resultBox.innerText = '❌ Hiç soru eklenmedi. ' + ((data.errors && data.errors[0]) || '');
              }
              loadPoolStats();
              loadPendingQuestions();
            } catch (err) {
              resultBox.style.display = 'block';
              resultBox.style.background = 'rgba(239,68,68,0.08)';
              resultBox.style.borderColor = 'rgba(239,68,68,0.3)';
              resultBox.innerText = '❌ Yükleme hatası: ' + err.message;
            } finally {
              btn.disabled = false;
              btn.innerText = '🚀 Soruları Havuza Aktar';
            }
          }

          async function loadPoolStats() {
            try {
              const res = await fetch('/api/admin/questions/stats');
              const data = await res.json();
              document.getElementById('stat-total').innerText = String(data.total || 0);
              document.getElementById('stat-published').innerText = String(data.published || 0);
              document.getElementById('stat-pending').innerText = String(data.pending || 0);
              const catBox = document.getElementById('stat-categories');
              if (data.byCategory && Object.keys(data.byCategory).length) {
                const entries = Object.entries(data.byCategory).sort(function (a, b) { return b[1] - a[1]; });
                catBox.innerHTML = '<b style="color:#818CF8;">Kategori Dağılımı:</b><br>' +
                  entries.map(function (e) { return '• ' + e[0] + ': <b>' + e[1] + '</b>'; }).join('<br>');
              } else {
                catBox.innerText = 'Kategori verisi bulunamadı.';
              }
            } catch (err) {
              document.getElementById('stat-categories').innerText = 'İstatistikler yüklenemedi: ' + err.message;
            }
          }

          function questionCardHtml(q, withActions) {
            let html = '<div style="background:#0E1321; border:1px solid #2B3754; border-radius:12px; padding:12px; margin-bottom:10px;">';
            html += '<div style="font-weight:700; font-size:13px; margin-bottom:4px;">' + (q.text || '').slice(0, 140) + '</div>';
            html += '<div style="font-size:11px; color:#94A3B8;">';
            html += '📂 ' + (q.categoryId || q.category_id || '-') + ' · ';
            html += '🎚 ' + (q.difficulty || '-') + ' · ';
            html += '📌 ' + (q.reviewStatus || q.review_status || '-') + ' · ';
            html += '🎯 ' + (q.targetPool || 'standard');
            html += '</div>';
            if (q.options && q.options.length) {
              const opts = q.options.map(function (o) { return typeof o === 'string' ? o : (o && o.text) || ''; });
              html += '<div style="font-size:11px; color:#CBD5E1; margin-top:6px;">A) ' + opts[0] + '  B) ' + opts[1] + '  C) ' + opts[2] + '  D) ' + opts[3] + '</div>';
            }
            if (withActions) {
              html += '<div style="display:flex; gap:8px; margin-top:10px;">';
              html += '<button type="button" class="btn" style="width:auto; padding:6px 14px; font-size:12px; background:#10B981;" onclick="approveQ(\\'' + q.id + '\\')">✅ Onayla</button>';
              html += '<button type="button" class="btn" style="width:auto; padding:6px 14px; font-size:12px; background:#EF4444;" onclick="rejectQ(\\'' + q.id + '\\')">❌ Reddet</button>';
              html += '</div>';
            }
            html += '</div>';
            return html;
          }

          async function searchQuestions() {
            const term = (document.getElementById('search-term').value || '').trim();
            const box = document.getElementById('search-results');
            box.innerHTML = '<div style="color:#94A3B8;">Aranıyor...</div>';
            try {
              const url = '/api/admin/questions/list?limit=20' + (term ? '&search=' + encodeURIComponent(term) : '');
              const res = await fetch(url);
              const data = await res.json();
              if (!data.questions || data.questions.length === 0) {
                box.innerHTML = '<div style="color:#94A3B8;">Sonuç bulunamadı.</div>';
                return;
              }
              box.innerHTML = '<div style="font-size:12px; color:#818CF8; margin-bottom:8px;">' + (data.filteredCount || data.questions.length) + ' sonuç bulundu (ilk ' + data.questions.length + ' gösteriliyor)</div>' +
                data.questions.map(function (q) { return questionCardHtml(q, false); }).join('');
            } catch (err) {
              box.innerHTML = '<div style="color:#EF4444;">Arama hatası: ' + err.message + '</div>';
            }
          }

          async function loadPendingQuestions() {
            const box = document.getElementById('pending-list');
            try {
              const res = await fetch('/api/admin/questions/review?limit=20');
              const data = await res.json();
              if (!data.questions || data.questions.length === 0) {
                box.innerHTML = '<div style="color:#10B981;">✅ Onay bekleyen soru yok. Her şey yayında.</div>';
                return;
              }
              box.innerHTML = data.questions.map(function (q) { return questionCardHtml(q, true); }).join('');
            } catch (err) {
              box.innerText = 'Yüklenemedi: ' + err.message;
            }
          }

          async function approveQ(id) {
            await fetch('/api/admin/questions/' + id + '/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetPool: 'standard', reviewedBy: 'Telegram Admin Panel' }) });
            loadPendingQuestions();
            loadPoolStats();
          }

          async function rejectQ(id) {
            await fetch('/api/admin/questions/' + id + '/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewedBy: 'Telegram Admin Panel' }) });
            loadPendingQuestions();
            loadPoolStats();
          }
        </script>
      </body>
      </html>
    `);
  });

  // Portal alt kategori haritası: oyunun Keşfet ekranındaki kartların aynısı.
  // Kaynak: shared/src/categories.ts (ALL_CATEGORIES) — tek yerden beslenir.
  const PORTAL_SUBCATEGORY_MAP: Record<string, Array<{ n: string; e: string }>> = {};
  for (const cat of ALL_CATEGORIES) {
    if (cat.id !== 'mixed' && cat.subCategories && cat.subCategories.length > 0) {
      PORTAL_SUBCATEGORY_MAP[cat.id] = cat.subCategories.map((s) => ({
        n: s.name,
        e: s.emoji || '🏷️',
      }));
    }
  }
  const portalSubcategoryMapJson = JSON.stringify(PORTAL_SUBCATEGORY_MAP);

  // Telegram Mini App / Web App Portal
  app.get('/telegram-webapp', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Telegram WebApp tarayıcısı sayfayı agresif önbelleğe alıyor ve eski sürüm
    // gösteriliyor; her ziyarette güncel HTML'in çekilmesini garanti et.
    res.setHeader('Cache-Control', 'no-store');
    res.send(`
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <title>Tavriko Telegram Portalı</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <script>
          // Yönetici uçlarına Telegram'ın imzaladığı initData ile kimlik doğrulaması:
          // tarayıcı şifre penceresi Telegram içinde açılamadığı için butonlar 401 alıyordu.
          (function () {
            var originalFetch = window.fetch.bind(window);
            window.fetch = function (input, init) {
              try {
                var url = typeof input === 'string' ? input : (input && input.url) || '';
                var sameOrigin = url.charAt(0) === '/' || url.indexOf(window.location.origin) === 0;
                var initData = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData;
                if (sameOrigin && initData) {
                  init = init || {};
                  var headers = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {});
                  if (!headers.has('X-Telegram-Init-Data')) headers.set('X-Telegram-Init-Data', initData);
                  init.headers = headers;
                  init.credentials = init.credentials || 'same-origin';
                }
              } catch (e) {}
              return originalFetch(input, init);
            };
          })();
        </script>
        <style>
          :root {
            --bg-color: #0B0818;
            --surface-1: #150F2C;
            --surface-2: #1F173D;
            --surface-3: #2A1F52;
            --accent-primary: #6236FF;
            --accent-gradient: linear-gradient(135deg, #6236FF 0%, #8C52FF 100%);
            --accent-gold: #FFC43D;
            --accent-mint: #5ADBB5;
            --accent-danger: #FF5964;
            --text-primary: #FFFFFF;
            --text-secondary: #94A3B8;
            --border-color: #2D2258;
            --radius-sm: 8px;
            --radius-md: 14px;
            --radius-lg: 20px;
          }
          * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
          body {
            background: var(--bg-color);
            color: var(--text-primary);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            padding-bottom: 90px;
            min-height: 100vh;
            overflow-x: hidden;
          }
          .header {
            position: sticky;
            top: 0;
            z-index: 100;
            background: rgba(11, 8, 24, 0.92);
            backdrop-filter: blur(16px);
            border-bottom: 1px solid var(--border-color);
            padding: 14px 18px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .brand {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .brand-logo {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            background: var(--accent-gradient);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 19px;
            box-shadow: 0 4px 12px rgba(98, 54, 255, 0.4);
          }
          .brand-text h1 {
            margin: 0;
            font-size: 17px;
            font-weight: 800;
            letter-spacing: -0.3px;
          }
          .brand-text p {
            margin: 0;
            font-size: 11px;
            color: var(--text-secondary);
          }
          .user-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            background: rgba(255, 196, 61, 0.12);
            border: 1px solid rgba(255, 196, 61, 0.3);
            color: var(--accent-gold);
            font-size: 12px;
            font-weight: 700;
            padding: 5px 12px;
            border-radius: 999px;
          }
          .content-container {
            max-width: 680px;
            margin: 0 auto;
            padding: 18px 16px;
          }
          .nav-tabs {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 100;
            background: rgba(21, 15, 44, 0.96);
            backdrop-filter: blur(20px);
            border-top: 1px solid var(--border-color);
            display: flex;
            justify-content: space-around;
            padding: 8px 6px calc(env(safe-area-inset-bottom, 8px) + 6px);
          }
          .nav-tab-btn {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            font-size: 10px;
            font-weight: 700;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            cursor: pointer;
            padding: 6px 10px;
            border-radius: 12px;
            transition: all 0.2s ease;
            position: relative;
          }
          .nav-tab-btn .tab-icon {
            font-size: 19px;
          }
          .nav-tab-btn.active {
            color: var(--accent-gold);
            background: rgba(255, 196, 61, 0.1);
          }
          .nav-tab-btn .badge-dot {
            position: absolute;
            top: 4px;
            right: 8px;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--accent-danger);
            display: none;
          }
          .tab-pane {
            display: none;
            animation: fadeIn 0.25s ease-out;
          }
          .tab-pane.active {
            display: block;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .card {
            background: var(--surface-1);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            padding: 20px;
            margin-bottom: 16px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
          }
          .card-title {
            margin: 0 0 6px 0;
            font-size: 16px;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .card-desc {
            color: var(--text-secondary);
            font-size: 13px;
            margin: 0 0 16px 0;
            line-height: 1.4;
          }
          .form-group {
            margin-bottom: 14px;
          }
          .form-label {
            display: block;
            font-size: 12px;
            font-weight: 700;
            color: var(--text-secondary);
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          select, textarea, input[type="text"] {
            width: 100%;
            background: var(--surface-2);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            padding: 12px 14px;
            color: var(--text-primary);
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
            font-family: inherit;
          }
          select:focus, textarea:focus, input[type="text"]:focus {
            border-color: var(--accent-primary);
          }
          .segmented-control {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(70px, 1fr));
            gap: 6px;
          }
          .seg-btn {
            background: var(--surface-2);
            border: 1px solid var(--border-color);
            color: var(--text-secondary);
            padding: 9px 8px;
            border-radius: var(--radius-md);
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            text-align: center;
            transition: all 0.2s;
          }
          .seg-btn.active {
            background: var(--accent-gradient);
            color: #fff;
            border-color: var(--accent-primary);
            box-shadow: 0 4px 12px rgba(98, 54, 255, 0.35);
          }
          .btn-primary {
            width: 100%;
            background: var(--accent-gradient);
            color: #fff;
            border: none;
            border-radius: var(--radius-md);
            padding: 14px;
            font-size: 14px;
            font-weight: 800;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            box-shadow: 0 6px 18px rgba(98, 54, 255, 0.4);
            transition: transform 0.15s, opacity 0.15s;
          }
          .btn-primary:active {
            transform: scale(0.98);
          }
          .btn-secondary {
            background: var(--surface-2);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            border-radius: var(--radius-md);
            padding: 10px 14px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .dropzone {
            border: 2px dashed var(--border-color);
            background: rgba(31, 23, 61, 0.4);
            border-radius: var(--radius-md);
            padding: 24px 16px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
          }
          .dropzone:hover, .dropzone.dragover {
            border-color: var(--accent-gold);
            background: rgba(255, 196, 61, 0.08);
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-bottom: 16px;
          }
          .stat-card {
            background: var(--surface-2);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            padding: 14px;
            text-align: center;
          }
          .stat-val {
            font-size: 24px;
            font-weight: 900;
            color: var(--accent-gold);
            margin-bottom: 2px;
          }
          .stat-lbl {
            font-size: 11px;
            color: var(--text-secondary);
            font-weight: 600;
            text-transform: uppercase;
          }
          .question-item {
            background: var(--surface-2);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            padding: 14px;
            margin-bottom: 12px;
          }
          .question-item-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
            gap: 8px;
          }
          .tag-pill {
            display: inline-block;
            font-size: 11px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 6px;
            background: var(--surface-3);
            color: var(--text-secondary);
          }
          .tag-pill.gold { background: rgba(255, 196, 61, 0.15); color: var(--accent-gold); }
          .tag-pill.mint { background: rgba(90, 219, 181, 0.15); color: var(--accent-mint); }
          .question-text {
            font-size: 14px;
            font-weight: 700;
            line-height: 1.4;
            margin-bottom: 10px;
          }
          .option-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            padding: 6px 10px;
            border-radius: 8px;
            background: var(--surface-1);
            margin-bottom: 5px;
            border: 1px solid transparent;
          }
          .option-row.correct {
            border-color: var(--accent-mint);
            background: rgba(90, 219, 181, 0.12);
            font-weight: 700;
            color: var(--accent-mint);
          }
          .q-actions {
            display: flex;
            gap: 6px;
            margin-top: 10px;
            flex-wrap: wrap;
          }
          .btn-action {
            flex: 1;
            min-width: 90px;
            border: none;
            border-radius: var(--radius-sm);
            padding: 8px 10px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.15s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
          }
          .btn-action.approve-std { background: #10B981; color: white; }
          .btn-action.approve-daily { background: #F59E0B; color: white; }
          .btn-action.approve-custom { background: #8B5CF6; color: white; }
          .btn-action.reject { background: #EF4444; color: white; }
          .alert-box {
            padding: 12px 14px;
            border-radius: var(--radius-md);
            font-size: 13px;
            margin-top: 12px;
            display: none;
            line-height: 1.4;
          }
          .alert-box.success { background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #10B981; }
          .alert-box.error { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #EF4444; }
          .tag-pill.diff-easy { background: rgba(16, 185, 129, 0.18); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); }
          .tag-pill.diff-medium { background: rgba(59, 130, 246, 0.18); color: #60A5FA; border: 1px solid rgba(59, 130, 246, 0.3); }
          .tag-pill.diff-hard { background: rgba(245, 158, 11, 0.18); color: #FBBF24; border: 1px solid rgba(245, 158, 11, 0.3); }
          .tag-pill.diff-expert { background: rgba(239, 68, 68, 0.18); color: #F87171; border: 1px solid rgba(239, 68, 68, 0.3); }
          .tag-pill.pool-std { background: rgba(98, 54, 255, 0.18); color: #C4B5FD; }
          .tag-pill.pool-daily { background: rgba(245, 158, 11, 0.18); color: #FBBF24; }
          .tag-pill.pool-custom { background: rgba(236, 72, 153, 0.18); color: #F472B6; }
          .category-matrix-card { background: var(--surface-2); border-radius: var(--radius-md); padding: 12px; margin-bottom: 8px; border: 1px solid var(--border-color); cursor: pointer; transition: background 0.15s; }
          .category-matrix-card:hover { background: rgba(98, 54, 255, 0.15); border-color: var(--accent-primary); }
          .matrix-diff-pills { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
          .matrix-diff-pills span { font-size: 11px; padding: 2px 7px; border-radius: 4px; font-weight: 700; }
          .duplicate-box { background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md); padding: 14px; margin-bottom: 14px; }
          .duplicate-group-header { font-size: 13px; font-weight: 800; color: #F87171; margin-bottom: 8px; }
          .duplicate-item { background: var(--surface-1); border-radius: 8px; padding: 10px; margin-top: 8px; border: 1px solid rgba(255,255,255,0.06); }
          .browser-filters-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
          @media (max-width: 480px) {
            .browser-filters-grid { grid-template-columns: 1fr; }
          }
          .pool-choice-card {
            background: var(--surface-2);
            border: 2px solid var(--border-color);
            border-radius: var(--radius-md);
            padding: 12px;
            cursor: pointer;
            transition: all 0.2s;
          }
          .pool-choice-card:hover {
            border-color: rgba(98, 54, 255, 0.6);
            background: rgba(98, 54, 255, 0.1);
          }
          .pool-choice-card.active {
            border-color: var(--accent-primary);
            background: rgba(98, 54, 255, 0.2);
            box-shadow: 0 4px 16px rgba(98, 54, 255, 0.3);
          }
          .category-squircle-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
            gap: 8px;
            margin-top: 8px;
            min-width: 0;
          }
          @media (max-width: 480px) {
            .category-squircle-grid {
              grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
              gap: 6px;
            }
          }
          .category-squircle-card {
            background: var(--surface-2);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 8px 4px;
            text-align: center;
            cursor: pointer;
            transition: all 0.15s;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
          }
          .category-squircle-card:hover {
            transform: translateY(-2px);
            border-color: var(--accent-gold);
            background: rgba(255, 196, 61, 0.12);
          }
          .category-squircle-card.active {
            border-color: var(--accent-mint);
            background: rgba(90, 219, 181, 0.2);
            box-shadow: 0 2px 10px rgba(90, 219, 181, 0.3);
          }
          .cat-card-icon {
            font-size: 20px;
          }
          .cat-card-title {
            font-size: 11px;
            font-weight: 800;
            color: var(--text-primary);
            line-height: 1.1;
            overflow-wrap: anywhere;
          }
          .cat-card-id {
            font-size: 9px;
            color: var(--text-secondary);
            font-family: monospace;
            word-break: break-all;
            overflow-wrap: anywhere;
          }
          .loader {
            display: inline-block;
            width: 18px;
            height: 18px;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <!-- Header -->
        <header class="header">
          <div class="brand">
            <div class="brand-logo">⚡</div>
            <div class="brand-text">
              <h1>Tavriko Portal</h1>
              <p>GLM-5.3 & Soru Yönetim Merkezi</p>
            </div>
          </div>
          <div class="user-badge" id="user-display">
            <span>●</span>
            <span id="user-name">Telegram Admin</span>
          </div>
        </header>

        <!-- Main Body Content -->
        <main class="content-container">

          <!-- TAB 1: AI SORU ÜRETİCİ -->
          <div id="pane-ai" class="tab-pane active">
            <div class="card">
              <h2 class="card-title">🤖 EVREN GLM-5.3 Soru Üretici</h2>
              <p class="card-desc">T.C. SSB EVREN yapay zekâ modeli ile tek dokunuşla özgün, mükerrersiz ve yarışmaya hazır sorular üretin.</p>

              <div class="form-group">
                <label class="form-label">Yarışma Kategorisi</label>
                <select id="ai-cat">
                  <option value="geography">🌍 Coğrafya</option>
                  <option value="history">🏛️ Tarih</option>
                  <option value="science_tech">🔬 Bilim & Teknoloji</option>
                  <option value="sports">⚽ Spor</option>
                  <option value="music">🎵 Müzik</option>
                  <option value="cinema_tv">🎬 Sinema & Dizi</option>
                  <option value="art_culture">🎨 Sanat & Kültür</option>
                  <option value="literature">📚 Edebiyat</option>
                  <option value="physics_chemistry">🧪 Fizik & Kimya</option>
                  <option value="biology">🧬 Biyoloji</option>
                  <option value="mathematics">🔢 Matematik</option>
                  <option value="logic_puzzles">🧩 Mantık & Zeka</option>
                  <option value="language_vocab">📝 Dil & Kelime</option>
                  <option value="space_astronomy">🚀 Uzay & Astronomi</option>
                  <option value="nature_ecology">🌿 Doğa & Ekoloji</option>
                  <option value="food_gastronomy">🍲 Yemek & Gastronomi</option>
                  <option value="animals_wildlife">🐾 Hayvanlar</option>
                  <option value="gaming_videogames">🎮 Video Oyunları</option>
                  <option value="anime_manga">🍥 Anime & Manga</option>
                  <option value="cartoons_animation">🎠 Çizgi Film</option>
                  <option value="comics_superheroes">🦸 Çizgi Roman</option>
                  <option value="fantasy_fiction">🐉 Fantastik</option>
                  <option value="social_internet">📱 Sosyal Medya</option>
                  <option value="mythology_ancient">⚡ Mitoloji</option>
                  <option value="hobbies_leisure">🎣 Hobiler</option>
                  <option value="daily_life">👨‍👩‍👧 Günlük Hayat</option>
                  <option value="turkey_special">🇹🇷 Türkiye</option>
                  <option value="general_culture" selected>🌟 Genel Kültür</option>
                  <option value="mixed">🔀 Karışık Tüm Kategoriler</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Zorluk Derecesi</label>
                <div class="segmented-control" id="diff-seg">
                  <div class="seg-btn" data-diff="easy" onclick="setDiff('easy')">🟢 Kolay</div>
                  <div class="seg-btn active" data-diff="medium" onclick="setDiff('medium')">🟡 Orta</div>
                  <div class="seg-btn" data-diff="hard" onclick="setDiff('hard')">🔴 Zor</div>
                  <div class="seg-btn" data-diff="expert" onclick="setDiff('expert')">🔥 Uzman</div>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Hedef Soru Havuzu</label>
                <select id="ai-pool">
                  <option value="standard" selected>🏆 Normal Kategori Havuzu</option>
                  <option value="daily_challenge">📅 Günlük Meydan Okuma Havuzu</option>
                  <option value="custom_room">⚔️ Özel Oda / Arkadaş Düelloları</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Üretilecek Soru Adedi</label>
                <div class="segmented-control" id="count-seg">
                  <div class="seg-btn" data-cnt="1" onclick="setCount(1)">1 Soru</div>
                  <div class="seg-btn active" data-cnt="3" onclick="setCount(3)">3 Soru</div>
                  <div class="seg-btn" data-cnt="5" onclick="setCount(5)">5 Soru</div>
                </div>
              </div>

              <button class="btn-primary" id="btn-ai-gen" onclick="generateAiQuestions()">
                <span id="ai-btn-text">🚀 Soruları Yapay Zekâ İle Üret</span>
              </button>

              <div class="alert-box" id="ai-alert"></div>
            </div>

            <!-- Sonuç Kartları -->
            <div id="ai-results-container"></div>
          </div>

          <!-- TAB 2: MANUEL & JSON SORU YÜKLE -->
          <div id="pane-json" class="tab-pane">
            <div class="card">
              <h2 class="card-title">📥 Soru Yükleme & Kategori Merkezi</h2>
              <p class="card-desc">Sorularınızı ister Keşfet ekranındaki tüm tek kişilik kategorilere, ister arkadaşınızla yarışacağınız Özel Oda moduna yükleyin. Aşağıdan oyun modunu ve kategoriyi seçtiğinizde şablon otomatik doldurulur.</p>

              <!-- 1. HEDEF OYUN MODU & HAVUZ SEÇİCİ -->
              <div class="form-group">
                <label class="form-label">🎮 1. Adım: Hedef Oyun Modu & Havuz Seçin</label>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px;">
                  
                  <div class="pool-choice-card active" id="pool-card-standard" data-pool="standard" onclick="selectPoolMode(this.dataset.pool)">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                      <span style="font-weight: 800; font-size: 13px; color: var(--accent-gold);">🏆 Tek Kişilik Mod</span>
                      <span class="tag-pill gold">standard</span>
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.3;">
                      Uygulama Keşfet ekranındaki <b>tüm ana kategorilere</b> gider. Tek başına antrenman & yarış.
                    </div>
                  </div>

                  <div class="pool-choice-card" id="pool-card-custom_room" data-pool="custom_room" onclick="selectPoolMode(this.dataset.pool)">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                      <span style="font-weight: 800; font-size: 13px; color: #C084FC;">⚔️ Arkadaşla Özel Oda</span>
                      <span class="tag-pill" style="background: rgba(192,132,252,0.2); color: #C084FC;">custom_room</span>
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.3;">
                      Arkadaşla kurulan <b>Özel Odalarda</b>, 1v1 düellolarda ve tematik odalarda çıkar.
                    </div>
                  </div>

                  <div class="pool-choice-card" id="pool-card-daily_challenge" data-pool="daily_challenge" onclick="selectPoolMode(this.dataset.pool)">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                      <span style="font-weight: 800; font-size: 13px; color: var(--accent-mint);">📅 Günlük Meydan Okuma</span>
                      <span class="tag-pill mint">daily_challenge</span>
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.3;">
                      Tüm kullanıcılara her gün çıkan <b>Günün Özel Sorusu</b> havuzuna eklenir.
                    </div>
                  </div>

                </div>
                <input type="hidden" id="json-pool" value="standard">
              </div>

              <!-- 2. GÖRSEL KATEGORİ REHBERİ VE TEK TIKLA ŞABLON -->
              <div class="form-group" style="margin-top: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <label class="form-label" style="margin-bottom: 0;">🏷️ 2. Adım: Kategori Seç (Tüm Oyun Kategorileri)</label>
                  <span style="font-size: 11px; color: var(--accent-gold); font-weight: 700;">👆 Dokunarak Şablonu Al</span>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px;">
                  Aşağıdaki kategorilerden birine dokunduğunuzda, o kategoriye ait hazır ve eksiksiz JSON taslağı otomatik oluşur ve seçtiğiniz kategorinin oyun Keşfet ekranındaki alt kategori kartları (soru sayılarıyla) altta açılır. Bir alt kategoriye dokunursanız sorular doğrudan o karta yüklenir.
                </div>

                <!-- TÜM KATEGORİ SQUIRCLE GRID -->
                <div class="category-squircle-grid" id="main-16-cat-grid"></div>

                <!-- ÖZEL ODA TEMATİK PAKETLERİ -->
                <details style="margin-top: 10px; background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-sm); padding: 8px 12px; border: 1px solid rgba(255, 255, 255, 0.08);">
                  <summary style="cursor: pointer; font-size: 12px; font-weight: 700; color: #C084FC; outline: none;">
                    ⚔️ Arkadaşla Özel Oda Paketleri (Tıkla ve Gör)
                  </summary>
                  <div style="margin-top: 8px;" class="category-squircle-grid" id="special-cat-grid"></div>
                </details>

                <!-- ALT KATEGORİ KARTLARI (oyun Keşfet ekranıyla birebir) -->
                <div id="sub-cat-section" style="display: none; margin-top: 12px; background: rgba(21, 15, 44, 0.6); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <label class="form-label" style="margin-bottom: 0;">🎯 Alt Kategori Kartları</label>
                    <span id="sub-cat-count-label" style="font-size: 11px; color: var(--accent-gold); font-weight: 700;"></span>
                  </div>
                  <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; line-height: 1.4;">
                    Yukarıdaki kategorinin oyun Keşfet ekranındaki kartlarının aynısı. Bir karta dokunursanız yüklediğiniz sorular o alt kategoriye eklenir; tekrar dokunursanız seçim kalkar ve sorular kategori genelinde tutulur. Kartlarda o alt kategorideki mevcut soru sayısı görünür.
                  </div>
                  <div class="category-squircle-grid" id="sub-cat-grid"></div>
                </div>
              </div>

                <!-- SEÇİLİ KATEGORİ İÇİN ÖRNEK JSON ÖNİZLEME -->
                <div id="example-json-section" style="display: none; margin-top: 12px; background: rgba(21, 15, 44, 0.6); border: 1px solid var(--accent-primary, #6236FF); border-radius: var(--radius-lg); padding: 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 6px;">
                    <label class="form-label" style="margin-bottom: 0;">📋 Seçili Kategori İçin Örnek JSON Kodu</label>
                    <button type="button" class="btn" style="width: auto; padding: 6px 12px; font-size: 12px;" onclick="copyExampleJson()">📄 Kopyala</button>
                  </div>
                  <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; line-height: 1.4;">
                    Bu örnek kodu kopyalayıp aşağıdaki JSON alanına yapıştırın; kendi sorularınızı yazıp "Soruları Havuza Aktar" ile yükleyin. Alt kategoriye dokunduysanız <b>subCategory</b> satırı seçtiğiniz kartı içerir.
                  </div>
                  <pre id="example-json-pre" style="background: rgba(11, 8, 24, 0.9); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px; font-size: 11px; line-height: 1.5; overflow-x: auto; margin: 0; white-space: pre-wrap; word-break: break-word; max-height: 260px; overflow-y: auto; color: #C9B8FF;"></pre>
                </div>

              <!-- 3. MANUEL TEK SORU EKLEME FORMU -->
              <div class="form-group" style="margin-top: 16px;">
                <label class="form-label">✍️ 3. Adım: Hızlı Soru Ekleme Formu (Manuel)</label>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px;">
                  JSON yazmadan formu doldurarak tek tek soru ekleyin. Kategori listesi oyunun tüm kategorilerini içerir; hedef havuz yukarıdaki 1. Adım'dan seçilir.
                </div>

                <div style="background: var(--surface-2); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px;">
                  <div class="form-group">
                    <label class="form-label">Soru Metni</label>
                    <textarea id="mq-text" rows="2" placeholder="Örn: Türkiye'nin başkenti neresidir?"></textarea>
                  </div>

                  <div class="form-group">
                    <label class="form-label">Şıklar (A, B, C, D)</label>
                    <input type="text" id="mq-opt-0" placeholder="A şıkkı" style="margin-bottom: 6px;">
                    <input type="text" id="mq-opt-1" placeholder="B şıkkı" style="margin-bottom: 6px;">
                    <input type="text" id="mq-opt-2" placeholder="C şıkkı" style="margin-bottom: 6px;">
                    <input type="text" id="mq-opt-3" placeholder="D şıkkı">
                  </div>

                  <div class="form-group">
                    <label class="form-label">Doğru Cevap</label>
                    <div class="segmented-control" style="grid-template-columns: repeat(4, 1fr);" id="mq-correct-seg">
                      <div class="seg-btn" data-idx="0" onclick="setMqCorrect(0)">A</div>
                      <div class="seg-btn" data-idx="1" onclick="setMqCorrect(1)">B</div>
                      <div class="seg-btn" data-idx="2" onclick="setMqCorrect(2)">C</div>
                      <div class="seg-btn" data-idx="3" onclick="setMqCorrect(3)">D</div>
                    </div>
                  </div>

                  <div class="form-group">
                    <label class="form-label">Kategori (Tüm Oyun Kategorileri)</label>
                    <select id="mq-category" onchange="renderManualSubOptions()"></select>
                  </div>

                  <div class="form-group">
                    <label class="form-label">Alt Kategori (İsteğe Bağlı — Seçili kategorinin Keşfet kartları)</label>
                    <select id="mq-subcategory"></select>
                  </div>

                  <div class="form-group">
                    <label class="form-label">Zorluk</label>
                    <div class="segmented-control" style="grid-template-columns: repeat(4, 1fr);" id="mq-diff-seg">
                      <div class="seg-btn" data-diff="easy" onclick="setMqDiff('easy')">🟢 Kolay</div>
                      <div class="seg-btn active" data-diff="medium" onclick="setMqDiff('medium')">🔵 Orta</div>
                      <div class="seg-btn" data-diff="hard" onclick="setMqDiff('hard')">🟡 Zor</div>
                      <div class="seg-btn" data-diff="expert" onclick="setMqDiff('expert')">🔴 Uzman</div>
                    </div>
                  </div>

                  <div class="form-group">
                    <label class="form-label">Açıklama (İsteğe Bağlı)</label>
                    <input type="text" id="mq-explanation" placeholder="Soru çözüldükten sonra gösterilecek bilgi notu">
                  </div>

                  <div class="form-group" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                    <input type="checkbox" id="mq-autopublish" checked style="width: 18px; height: 18px; accent-color: var(--accent-primary);">
                    <label for="mq-autopublish" style="font-size: 13px; font-weight: 600; cursor: pointer;">Doğrudan yayınla (Onay kuyruğunu atla ve havuza ekle)</label>
                  </div>

                  <button class="btn-primary" id="btn-mq-add" onclick="addManualQuestion()">
                    <span>➕ Soruyu Ekle</span>
                  </button>
                  <div class="alert-box" id="mq-alert"></div>
                </div>
              </div>

              <!-- 4. JSON METİN ALANI VE CANLI ALGILAMA BARI -->
              <div class="form-group" style="margin-top: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <label class="form-label" style="margin-bottom: 0;">📝 4. Adım: Toplu Soru Yükleme (JSON Verisi)</label>
                  <div>
                    <button class="btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="pasteSampleJson()">📋 Varsayılan Şablon</button>
                    <button class="btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="clearJsonText()">🧹 Temizle</button>
                  </div>
                </div>

                <!-- CANLI ALGILAMA & DOĞRULAMA ÇUBUĞU -->
                <div id="live-parser-bar" style="margin-bottom: 8px; background: rgba(21, 15, 44, 0.8); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 12px; font-size: 12px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                  <div id="live-parser-status" style="font-weight: 700; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
                    <span>ℹ️</span> <span>Henüz soru girilmedi. Yukarıdan bir kategoriye dokunarak şablonu alabilirsiniz.</span>
                  </div>
                  <div id="live-parser-tags" style="display: flex; gap: 4px; flex-wrap: wrap;"></div>
                </div>

                <textarea id="json-textarea" rows="10" placeholder='[&#10;  {&#10;    "text": "Soru metnini buraya yazın...",&#10;    "options": ["A", "B", "C", "D"],&#10;    "correctAnswerIndex": 0,&#10;    "categoryId": "geography",&#10;    "difficulty": "medium",&#10;    "explanation": "Detaylı açıklama...",&#10;    "targetPool": "standard"&#10;  }&#10;]' oninput="updateLiveDetection()"></textarea>

                <!-- DOSYA YÜKLEME KUTUSU (İSTEĞE BAĞLI) -->
                <div style="margin-top: 8px;">
                  <div class="dropzone" id="dropzone" style="padding: 12px;" onclick="document.getElementById('file-input').click()">
                    <span style="font-size: 18px; vertical-align: middle; margin-right: 6px;">📁</span>
                    <span style="font-size: 12px; font-weight: 700;">Hazır .json dosyanız varsa buraya sürükleyin veya seçin</span>
                    <input type="file" id="file-input" accept=".json,application/json" style="display: none;" onchange="handleFileSelect(event)">
                  </div>
                </div>

                <details style="margin-top: 8px; background: rgba(255, 255, 255, 0.04); border-radius: 8px; padding: 8px 12px; font-size: 12px; color: var(--text-secondary); border: 1px solid rgba(255, 255, 255, 0.08);">
                  <summary style="cursor: pointer; font-weight: 700; color: var(--accent-mint); outline: none;">📖 Desteklenen Tüm JSON Alanları & Eşleme Tablosu</summary>
                  <div style="margin-top: 8px; line-height: 1.6;">
                    <div>• <b>text / soru / question:</b> Soru metni (Zorunlu, min 5 karakter)</div>
                    <div>• <b>options / secenekler:</b> Tam 4 adet seçenek <code>["A", "B", "C", "D"]</code> (Zorunlu)</div>
                    <div>• <b>correctAnswerIndex / dogruCevap:</b> <code>0</code>, <code>1</code>, <code>2</code>, <code>3</code> (veya doğru cevabın birebir metni)</div>
                    <div>• <b>categoryId / kategori:</b> <code>bilim</code>, <code>tarih</code>, <code>cografya</code>, <code>spor</code>, <code>sinema</code>, <code>muzik</code>, <code>sanat</code>, <code>teknoloji</code>, <code>doga</code>, <code>yemek</code>, <code>edebiyat</code>, <code>uzay</code>, <code>hayvanlar</code>, <code>matematik</code>, <code>oyun</code>, <code>genel_kultur</code></div>
                    <div>• <b>difficulty / zorluk:</b> <code>kolay</code> (easy), <code>orta</code> (medium), <code>zor</code> (hard), <code>uzman</code> (expert)</div>
                    <div>• <b>targetPool / havuz:</b> <code>standard</code> (Tek Kişilik/Keşfet), <code>custom_room</code> (Arkadaşla Özel Oda), <code>daily_challenge</code> (Günün Sorusu)</div>
                    <div>• <b>explanation / aciklama:</b> Soru çözüldükten sonra oyuncuya gösterilen bilgi notu.</div>
                  </div>
                </details>
              </div>

              <!-- DOĞRUDAN YAYINLA SEÇENEĞİ -->
              <div class="form-group" style="display: flex; align-items: center; gap: 8px; margin-top: 10px;">
                <input type="checkbox" id="json-autopublish" checked style="width: 18px; height: 18px; accent-color: var(--accent-primary);">
                <label for="json-autopublish" style="font-size: 13px; font-weight: 600; cursor: pointer;">Doğrudan yayınla (Onay kuyruğunu atla ve havuza ekle)</label>
              </div>

              <!-- AKTAR BUTONU -->
              <button class="btn-primary" id="btn-import-json" onclick="importJsonQuestions()">
                <span>🚀 Soruları Havuza Aktar</span>
              </button>

              <div class="alert-box" id="json-alert"></div>
              <div id="json-result-details" style="display: none; margin-top: 16px;"></div>
            </div>
          </div>

          <!-- TAB 3: ONAY BEKLEYENLER -->
          <div id="pane-review" class="tab-pane">
            <div class="card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div>
                  <h2 class="card-title" style="margin: 0;">⏳ Onay Bekleyen Sorular</h2>
                  <p class="card-desc" style="margin: 0;">İncelenmeyi bekleyen soru kuyruğu</p>
                </div>
                <button class="btn-secondary" onclick="loadPendingQuestions()">🔄 Yenile</button>
              </div>
              <div id="pending-list-container">
                <div style="text-align: center; padding: 24px; color: var(--text-secondary);">Yükleniyor...</div>
              </div>
            </div>
          </div>

          <!-- TAB 4: HAVUZ & SORU GEZGİNİ -->
          <div id="pane-stats" class="tab-pane">
            <!-- 1. Genel İstatistik Sayaçları -->
            <div class="stats-grid" id="stats-summary-grid">
              <div class="stat-card">
                <div class="stat-val" id="stat-total">-</div>
                <div class="stat-lbl">Toplam Soru</div>
              </div>
              <div class="stat-card">
                <div class="stat-val" id="stat-published" style="color: var(--accent-mint);">-</div>
                <div class="stat-lbl">Yayında</div>
              </div>
              <div class="stat-card">
                <div class="stat-val" id="stat-pending" style="color: var(--accent-gold);">-</div>
                <div class="stat-lbl">Onay Bekleyen</div>
              </div>
              <div class="stat-card">
                <div class="stat-val" id="stat-daily" style="color: #A78BFA;">-</div>
                <div class="stat-lbl">Günlük & Özel</div>
              </div>
            </div>

            <!-- 2. Mükerrer (Aynı) Soru Tarama Aracı -->
            <div class="card" style="border-color: rgba(245, 158, 11, 0.4);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div>
                  <h2 class="card-title" style="margin: 0; color: var(--accent-gold);">🔍 Mükerrer (Aynı) Soru Tarayıcısı</h2>
                  <p class="card-desc" style="margin: 0;">Havuzdaki aynı metne veya şıklara sahip mükerrer soruları denetleyin</p>
                </div>
                <button class="btn-secondary" onclick="scanDuplicates()" id="btn-scan-dup">⚡ Taramayı Başlat</button>
              </div>
              <div id="duplicate-results-container" style="display: none; margin-top: 12px;"></div>
            </div>

            <!-- 3. Kategori & Zorluk Analiz Matrisi -->
            <div class="card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div>
                  <h2 class="card-title" style="margin: 0;">📊 Kategori & Zorluk Dağılımı</h2>
                  <p class="card-desc" style="margin: 0;">Tüm kategorilerin zorluk (Kolay, Orta, Zor, Uzman) oranları</p>
                </div>
                <button class="btn-secondary" onclick="loadStats()">🔄 Yenile</button>
              </div>
              <div id="categories-breakdown-list">
                <div style="text-align: center; padding: 20px; color: var(--text-secondary);"><span class="loader"></span> Yükleniyor...</div>
              </div>
            </div>

            <!-- 4. Canlı Soru Gezgini (Arama, Filtreleme ve İnceleme) -->
            <div class="card">
              <h2 class="card-title">🔎 Soru Gezgini & Arama</h2>
              <p class="card-desc">Havuzdaki soruları doğrudan arayın, filtreleyin ve inceleyin.</p>

              <div class="form-group">
                <input type="text" id="browser-search" placeholder="🔍 Soru metni veya şık ara..." oninput="debounceBrowserSearch()" />
              </div>

              <div class="browser-filters-grid">
                <div>
                  <label class="form-label">Kategori</label>
                  <select id="browser-category" onchange="loadQuestionsBrowser(0)">
                    <option value="all">Tüm Kategoriler (Hepsi)</option>
                    <option value="science_tech">🔬 Bilim & Teknoloji</option>
                    <option value="history">🏛️ Tarih</option>
                    <option value="geography">🌍 Coğrafya</option>
                    <option value="sports">🏀 Spor</option>
                    <option value="cinema_tv">🎬 Sinema & Dizi</option>
                    <option value="music">🎵 Müzik</option>
                    <option value="art_culture">🎨 Sanat & Kültür</option>
                    <option value="nature_ecology">🌿 Doğa & Ekoloji</option>
                    <option value="food_gastronomy">🍲 Yemek & Mutfak</option>
                    <option value="literature">📚 Edebiyat</option>
                    <option value="space_astronomy">🚀 Uzay & Astronomi</option>
                    <option value="animals_wildlife">🐾 Hayvanlar Alemi</option>
                    <option value="biology">🧬 Biyoloji</option>
                    <option value="mathematics">➗ Matematik</option>
                    <option value="logic_puzzles">🎮 Mantık & Zeka</option>
                    <option value="language_vocab">📝 Dil & Kelime</option>
                    <option value="general_culture">💡 Genel Kültür</option>
                    <option value="physics_chemistry">⚛️ Fizik & Kimya</option>
                    <option value="gaming_videogames">🎮 Video Oyunları</option>
                    <option value="anime_manga">🍥 Anime & Manga</option>
                    <option value="cartoons_animation">🎠 Çizgi Film & Animasyon</option>
                    <option value="comics_superheroes">🦸 Çizgi Roman & Süper Kahramanlar</option>
                    <option value="fantasy_fiction">🐉 Fantastik & Kurgu</option>
                    <option value="social_internet">📱 Sosyal Medya & İnternet</option>
                    <option value="mythology_ancient">⚡ Mitoloji & Efsaneler</option>
                    <option value="hobbies_leisure">🎣 Eğlence & Hobiler</option>
                    <option value="daily_life">👨‍👩‍👧 Günlük Hayat & Toplum</option>
                    <option value="turkey_special">🇹🇷 Türkiye'ye Özel</option>
                  </select>
                </div>
                <div>
                  <label class="form-label">Zorluk Seviyesi</label>
                  <select id="browser-difficulty" onchange="loadQuestionsBrowser(0)">
                    <option value="all">Tüm Zorluklar (Hepsi)</option>
                    <option value="easy">🟢 Kolay (Easy)</option>
                    <option value="medium">🔵 Orta (Medium)</option>
                    <option value="hard">🟡 Zor (Hard)</option>
                    <option value="expert">🔴 Uzman (Expert)</option>
                  </select>
                </div>
                <div>
                  <label class="form-label">Hedef Havuz</label>
                  <select id="browser-pool" onchange="loadQuestionsBrowser(0)">
                    <option value="all">Tüm Havuzlar</option>
                    <option value="standard">🏆 Normal Havuz</option>
                    <option value="daily_challenge">📅 Günlük Meydan Okuma</option>
                    <option value="custom_room">⚔️ Özel Oda</option>
                  </select>
                </div>
                <div>
                  <label class="form-label">Durum</label>
                  <select id="browser-status" onchange="loadQuestionsBrowser(0)">
                    <option value="published" selected>✅ Yayında</option>
                    <option value="pending_review">⏳ Onay Bekleyen</option>
                    <option value="rejected">❌ Reddedilen</option>
                    <option value="all">Tüm Durumlar</option>
                  </select>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin: 12px 0 8px 0;">
                <span id="browser-count-label" style="font-size: 12px; font-weight: 700; color: var(--text-secondary);">Sorular yükleniyor...</span>
                <button class="btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="loadQuestionsBrowser(0)">🔄 Yenile</button>
              </div>

              <div id="browser-questions-list"></div>
              <div id="browser-pagination" style="display: flex; justify-content: center; gap: 8px; margin-top: 14px;"></div>
            </div>
          </div>

          <!-- TAB 5: CANLI OYUN & ODA -->
          <div id="pane-play" class="tab-pane">
            <div class="card">
              <h2 class="card-title">🎮 Canlı Yarışma & Özel Oda</h2>
              <p class="card-desc">Doğrudan Tavriko oyununu başlatın veya arkadaşlarınızla yarışmak için anında özel oda oluşturun.</p>
              
              <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 14px;">
                <a href="/" target="_blank" class="btn-primary" style="text-decoration: none;">
                  🚀 Tavriko Oyununu Aç
                </a>
                <button class="btn-secondary" style="justify-content: center; padding: 14px; font-weight: 800;" onclick="createQuickRoom()">
                  ⚡ Hızlı Özel Oda Kodu Üret
                </button>
              </div>

              <div id="quick-room-box" style="display: none; margin-top: 16px; background: var(--surface-2); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; text-align: center;">
                <div style="font-size: 12px; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">Özel Oda Kodunuz</div>
                <div id="quick-room-code" style="font-size: 32px; font-weight: 900; color: var(--accent-gold); letter-spacing: 4px; margin: 8px 0;">TAV123</div>
                <div style="display: flex; gap: 8px; justify-content: center;">
                  <button class="btn-secondary" onclick="copyRoomCode()">📋 Kodu Kopyala</button>
                  <button class="btn-secondary" onclick="shareRoomToTelegram()">📲 Telegram'da Paylaş</button>
                </div>
              </div>
            </div>
          </div>

        </main>

        <!-- Bottom Tab Navigation Bar -->
        <nav class="nav-tabs">
          <button class="nav-tab-btn active" onclick="switchTab('ai')">
            <span class="tab-icon">🤖</span>
            <span>AI Üret</span>
          </button>
          <button class="nav-tab-btn" onclick="switchTab('json')">
            <span class="tab-icon">📥</span>
            <span>JSON Yükle</span>
          </button>
          <button class="nav-tab-btn" onclick="switchTab('review')">
            <span class="tab-icon">⏳</span>
            <span>Onay Sırası</span>
            <span class="badge-dot" id="pending-dot"></span>
          </button>
          <button class="nav-tab-btn" onclick="switchTab('stats')">
            <span class="tab-icon">📊</span>
            <span>Havuz & Gezgin</span>
          </button>
          <button class="nav-tab-btn" onclick="switchTab('play')">
            <span class="tab-icon">🎮</span>
            <span>Oyna</span>
          </button>
        </nav>

        <script>
          const tg = window.Telegram?.WebApp;
          let selectedDiff = 'medium';
          let selectedCount = 3;

          // Initialize Telegram WebApp
          if (tg) {
            tg.ready();
            tg.expand();
            try {
              tg.setHeaderColor('#0B0818');
              tg.setBackgroundColor('#0B0818');
            } catch(e) {}
            
            const user = tg.initDataUnsafe?.user;
            if (user && user.first_name) {
              const displayName = user.username ? '@' + user.username : user.first_name;
              document.getElementById('user-name').innerText = displayName;
            }
          }

          function triggerHaptic(type = 'light') {
            try {
              if (tg?.HapticFeedback) {
                if (type === 'success' || type === 'error' || type === 'warning') {
                  tg.HapticFeedback.notificationOccurred(type);
                } else {
                  tg.HapticFeedback.impactOccurred(type);
                }
              }
            } catch (e) {}
          }

          function switchTab(tabId) {
            triggerHaptic('light');
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
            
            const targetPane = document.getElementById('pane-' + tabId);
            if (targetPane) targetPane.classList.add('active');

            const btnIdx = { 'ai': 0, 'json': 1, 'review': 2, 'stats': 3, 'play': 4 }[tabId];
            const buttons = document.querySelectorAll('.nav-tab-btn');
            if (buttons[btnIdx]) buttons[btnIdx].classList.add('active');

            if (tabId === 'review') loadPendingQuestions();
            if (tabId === 'stats') loadStats();
          }

          function setDiff(diff) {
            triggerHaptic('light');
            selectedDiff = diff;
            document.querySelectorAll('#diff-seg .seg-btn').forEach(b => {
              b.classList.toggle('active', b.getAttribute('data-diff') === diff);
            });
          }

          function setCount(cnt) {
            triggerHaptic('light');
            selectedCount = cnt;
            document.querySelectorAll('#count-seg .seg-btn').forEach(b => {
              b.classList.toggle('active', parseInt(b.getAttribute('data-cnt'), 10) === cnt);
            });
          }

          // Tab 1: AI Question Generator
          async function generateAiQuestions() {
            triggerHaptic('medium');
            const btn = document.getElementById('btn-ai-gen');
            const btnText = document.getElementById('ai-btn-text');
            const alertBox = document.getElementById('ai-alert');
            const container = document.getElementById('ai-results-container');
            const categoryId = document.getElementById('ai-cat').value;
            const targetPool = document.getElementById('ai-pool').value;

            btn.disabled = true;
            btnText.innerHTML = '<span class="loader"></span> GLM-5.3 Hazırlıyor...';
            alertBox.style.display = 'none';

            try {
              const res = await fetch('/api/admin/questions/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  categoryId,
                  difficulty: selectedDiff,
                  count: selectedCount
                })
              });
              const data = await res.json();
              if (data.success && data.questions) {
                triggerHaptic('success');
                alertBox.className = 'alert-box success';
                alertBox.style.display = 'block';
                alertBox.innerText = '✨ ' + data.validCount + ' adet soru üretildi ve onay kuyruğuna alındı!';
                renderQuestionCards(data.questions, container, targetPool);
              } else {
                throw new Error(data.error || 'Soru üretilemedi.');
              }
            } catch (err) {
              triggerHaptic('error');
              alertBox.className = 'alert-box error';
              alertBox.style.display = 'block';
              alertBox.innerText = '❌ Hata: ' + err.message;
            } finally {
              btn.disabled = false;
              btnText.innerText = '🚀 Soruları Yapay Zekâ İle Üret';
            }
          }

          function renderQuestionCards(questions, container, defaultPool = 'standard') {
            container.innerHTML = questions.map((q, idx) => {
              const correctIdx = q.options.findIndex(o => o.id === q.correctOptionId);
              return \`
                <div class="question-item" id="q-card-\${q.id}">
                  <div class="question-item-header">
                    <div>
                      <span class="tag-pill gold">\${q.categoryId}</span>
                      <span class="tag-pill mint">\${q.difficulty}</span>
                    </div>
                    <span class="tag-pill">#\${idx + 1}</span>
                  </div>
                  <div class="question-text">\${escapeHtml(q.text)}</div>
                  <div class="options-list">
                    \${q.options.map((opt, oIdx) => \`
                      <div class="option-row \${oIdx === correctIdx ? 'correct' : ''}">
                        <span>\${['A', 'B', 'C', 'D'][oIdx]})</span>
                        <span>\${escapeHtml(opt.text)}</span>
                        \${oIdx === correctIdx ? '<span style="margin-left: auto;">✓</span>' : ''}
                      </div>
                    \`).join('')}
                  </div>
                  \${q.explanation ? \`<div style="font-size: 12px; color: var(--text-secondary); margin-top: 6px; font-style: italic;">💡 \${escapeHtml(q.explanation)}</div>\` : ''}
                  <div class="q-actions">
                    <button class="btn-action approve-std" onclick="approveQuestion('\${q.id}', 'standard')">✅ Kategoriye Al</button>
                    <button class="btn-action approve-daily" onclick="approveQuestion('\${q.id}', 'daily_challenge')">📅 Günlük</button>
                    <button class="btn-action approve-custom" onclick="approveQuestion('\${q.id}', 'custom_room')">⚔️ Özel Oda</button>
                    <button class="btn-action reject" onclick="rejectQuestion('\${q.id}')">❌ Reddet</button>
                  </div>
                </div>
              \`;
            }).join('');
          }

          async function approveQuestion(id, pool) {
            triggerHaptic('medium');
            try {
              const res = await fetch(\`/api/admin/questions/\${id}/approve\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pool, targetPool: pool, reviewedBy: 'Telegram WebApp' })
              });
              const data = await res.json();
              if (data.success) {
                triggerHaptic('success');
                const card = document.getElementById('q-card-' + id);
                if (card) {
                  card.style.transition = 'all 0.3s ease';
                  card.style.opacity = '0';
                  card.style.transform = 'scale(0.95)';
                  setTimeout(() => card.remove(), 300);
                }
              }
            } catch (err) {
              triggerHaptic('error');
              alert('Onaylama hatası: ' + err.message);
            }
          }

          async function rejectQuestion(id) {
            triggerHaptic('warning');
            try {
              const res = await fetch(\`/api/admin/questions/\${id}/reject\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: 'Telegram WebApp Reddi', reviewedBy: 'Telegram WebApp' })
              });
              const data = await res.json();
              if (data.success) {
                triggerHaptic('light');
                const card = document.getElementById('q-card-' + id);
                if (card) {
                  card.style.transition = 'all 0.3s ease';
                  card.style.opacity = '0';
                  card.style.transform = 'scale(0.95)';
                  setTimeout(() => card.remove(), 300);
                }
              }
            } catch (err) {
              triggerHaptic('error');
              alert('Reddetme hatası: ' + err.message);
            }
          }

          // Tab 2: JSON Importer & 16 Kategori Tanımları
          const APP_16_CATEGORIES = [
            { id: 'science_tech', name: 'Bilim', icon: '⚛️', trKeys: ['bilim', 'science', 'science_tech'] },
            { id: 'history', name: 'Tarih', icon: '🏛️', trKeys: ['tarih', 'history'] },
            { id: 'geography', name: 'Coğrafya', icon: '🌍', trKeys: ['cografya', 'coğrafya', 'geography'] },
            { id: 'sports', name: 'Spor', icon: '🏀', trKeys: ['spor', 'sports'] },
            { id: 'cinema_tv', name: 'Sinema', icon: '🎬', trKeys: ['sinema', 'cinema_tv', 'dizi'] },
            { id: 'music', name: 'Müzik', icon: '🎵', trKeys: ['muzik', 'müzik', 'music'] },
            { id: 'art_culture', name: 'Sanat', icon: '🎨', trKeys: ['sanat', 'art_culture', 'kultur', 'kültür'] },
            { id: 'physics_chemistry', name: 'Teknoloji', icon: '💻', trKeys: ['teknoloji', 'technology', 'tech', 'fizik', 'kimya'] },
            { id: 'nature_ecology', name: 'Doğa', icon: '🌿', trKeys: ['doga', 'doğa', 'nature', 'nature_ecology'] },
            { id: 'food_gastronomy', name: 'Yemek', icon: '🍲', trKeys: ['yemek', 'food', 'food_gastronomy', 'mutfak'] },
            { id: 'literature', name: 'Edebiyat', icon: '📚', trKeys: ['edebiyat', 'literature'] },
            { id: 'space_astronomy', name: 'Uzay', icon: '🚀', trKeys: ['uzay', 'space', 'space_astronomy'] },
            { id: 'animals_wildlife', name: 'Hayvanlar', icon: '🐾', trKeys: ['hayvanlar', 'animals', 'animals_wildlife'] },
            { id: 'biology', name: 'Biyoloji', icon: '🧬', trKeys: ['biyoloji', 'biology'] },
            { id: 'mathematics', name: 'Matematik', icon: '🔢', trKeys: ['matematik', 'mathematics', 'math'] },
            { id: 'language_vocab', name: 'Dil & Kelime', icon: '📝', trKeys: ['dil', 'kelime', 'language_vocab'] },
            { id: 'logic_puzzles', name: 'Oyun & Zeka', icon: '🎮', trKeys: ['oyun', 'gaming', 'logic_puzzles', 'zeka'] },
            { id: 'general_culture', name: 'Genel Kültür', icon: '💡', trKeys: ['genel', 'genel_kultur', 'general_culture'] },
            { id: 'gaming_videogames', name: 'Video Oyunları', icon: '🎮', trKeys: ['gaming', 'video_oyunlari', 'oyunlar', 'video_games'] },
            { id: 'anime_manga', name: 'Anime & Manga', icon: '🍥', trKeys: ['anime', 'manga', 'anime_manga'] },
            { id: 'cartoons_animation', name: 'Çizgi Film', icon: '🎠', trKeys: ['cartoons', 'cizgifilm', 'cizgi_film', 'animasyon'] },
            { id: 'comics_superheroes', name: 'Çizgi Roman', icon: '🦸', trKeys: ['comics', 'cizgiroman', 'cizgi_roman', 'super_kahramanlar'] },
            { id: 'fantasy_fiction', name: 'Fantastik', icon: '🐉', trKeys: ['fantasy', 'fantastik', 'kurgusal_dunyalar'] },
            { id: 'social_internet', name: 'Sosyal Medya', icon: '📱', trKeys: ['social', 'sosyal_medya', 'internet_kulturu'] },
            { id: 'mythology_ancient', name: 'Mitoloji', icon: '⚡', trKeys: ['mythology', 'mitoloji', 'efsaneler'] },
            { id: 'hobbies_leisure', name: 'Hobiler', icon: '🎣', trKeys: ['hobbies', 'hobiler', 'eglence_hobiler'] },
            { id: 'daily_life', name: 'Günlük Hayat', icon: '👨‍👩‍👧', trKeys: ['daily_life', 'gunluk_hayat', 'toplum'] },
            { id: 'mixed', name: 'Karma Mod', icon: '🎲', trKeys: ['mixed', 'karma', 'karisik'] },
            { id: 'turkey_special', name: 'Türkiye', icon: '🇹🇷', trKeys: ['turkey', 'turkiye', 'turkiyeye_ozel'] }
          ];

          const SPECIAL_ROOM_CATEGORIES = [
            { id: 'yesilcam', name: 'Yeşilçam', icon: '⭐', desc: 'Yeşilçam Sineması özel' },
            { id: 'turkish_pop_90s', name: "90'lar Pop", icon: '⭐', desc: 'Nostalji müzik' },
            { id: 'ottoman_history', name: 'Osmanlı', icon: '⭐', desc: 'Tarih tematik oda' },
            { id: 'super_lig_legends', name: 'Süper Lig', icon: '⭐', desc: 'Futbol özel oda' },
            { id: 'world_capitals', name: 'Başkentler', icon: '⭐', desc: 'Coğrafya başkentler' }
          ];

          function renderCategoryPickers() {
            const grid16 = document.getElementById('main-16-cat-grid');
            if (grid16) {
              grid16.innerHTML = APP_16_CATEGORIES.map(c => {
                return '<div class="category-squircle-card" data-cat-id="' + c.id + '" onclick="selectCategoryTemplate(this.dataset.catId)">' +
                  '<div class="cat-card-icon">' + c.icon + '</div>' +
                  '<div class="cat-card-title">' + c.name + '</div>' +
                  '<div class="cat-card-id">' + c.id + '</div>' +
                '</div>';
              }).join('');
            }

            const gridSpecial = document.getElementById('special-cat-grid');
            if (gridSpecial) {
              gridSpecial.innerHTML = SPECIAL_ROOM_CATEGORIES.map(c => {
                return '<div class="category-squircle-card" data-cat-id="' + c.id + '" onclick="selectCategoryTemplate(this.dataset.catId)">' +
                  '<div class="cat-card-icon">' + c.icon + '</div>' +
                  '<div class="cat-card-title">' + c.name + '</div>' +
                  '<div class="cat-card-id">' + c.id + '</div>' +
                '</div>';
              }).join('');
            }
          }

          // Portal alt kategori haritası: oyun Keşfet kartları (server.ts'ten enjekte edilir)
          const SUBCATEGORY_MAP = ${portalSubcategoryMapJson};

          // Manuel soru ekleme formu (Tüm kategoriler)
          let mqCorrectIdx = -1;
          let mqDiff = 'medium';

          function setMqCorrect(idx) {
            triggerHaptic('light');
            mqCorrectIdx = idx;
            document.querySelectorAll('#mq-correct-seg .seg-btn').forEach(b => {
              b.classList.toggle('active', parseInt(b.getAttribute('data-idx'), 10) === idx);
            });
          }

          function setMqDiff(d) {
            triggerHaptic('light');
            mqDiff = d;
            document.querySelectorAll('#mq-diff-seg .seg-btn').forEach(b => {
              b.classList.toggle('active', b.getAttribute('data-diff') === d);
            });
          }

          function renderManualCategoryOptions() {
            const sel = document.getElementById('mq-category');
            if (!sel) return;
            const all = APP_16_CATEGORIES.concat(SPECIAL_ROOM_CATEGORIES);
            sel.innerHTML = all.map(c => {
              return '<option value="' + c.id + '">' + c.icon + ' ' + c.name + ' (' + c.id + ')</option>';
            }).join('');
            renderManualSubOptions();
          }

          function renderManualSubOptions() {
            const catSel = document.getElementById('mq-category');
            const subSel = document.getElementById('mq-subcategory');
            if (!subSel) return;
            const catId = catSel ? catSel.value : null;
            const subs = (catId && SUBCATEGORY_MAP[catId]) || [];
            let html = '<option value="">— Alt kategorisiz (kategori geneli) —</option>';
            for (const s of subs) {
              html += '<option value="' + s.n.replace(/"/g, '"') + '">' + s.e + ' ' + s.n + '</option>';
            }
            subSel.innerHTML = html;
          }

          function resetManualForm() {
            const t = document.getElementById('mq-text');
            if (t) t.value = '';
            for (let i = 0; i < 4; i++) {
              const o = document.getElementById('mq-opt-' + i);
              if (o) o.value = '';
            }
            const e = document.getElementById('mq-explanation');
            if (e) e.value = '';
            mqCorrectIdx = -1;
            document.querySelectorAll('#mq-correct-seg .seg-btn').forEach(b => b.classList.remove('active'));
            setMqDiff('medium');
          }

          async function addManualQuestion() {
            triggerHaptic('medium');
            const alertBox = document.getElementById('mq-alert');
            const text = (document.getElementById('mq-text').value || '').trim();
            const opts = [0, 1, 2, 3].map(i => (document.getElementById('mq-opt-' + i).value || '').trim());
            const catId = document.getElementById('mq-category').value || 'general_culture';
            const subCategory = (document.getElementById('mq-subcategory') ? document.getElementById('mq-subcategory').value : '') || '';
            const explanation = (document.getElementById('mq-explanation').value || '').trim();
            const pool = document.getElementById('json-pool').value || 'standard';
            const autoPublish = document.getElementById('mq-autopublish').checked;

            const showError = (msg) => {
              if (alertBox) {
                alertBox.className = 'alert-box error';
                alertBox.style.display = 'block';
                alertBox.innerText = '⚠️ ' + msg;
              }
              triggerHaptic('error');
            };

            if (text.length < 5) {
              showError('Soru metni en az 5 karakter olmalıdır.');
              return;
            }
            if (opts.some(o => o.length < 1)) {
              showError('Dört şıkkın hepsi de doldurulmalıdır.');
              return;
            }
            if (mqCorrectIdx < 0) {
              showError('Doğru cevabın hangi şık olduğunu seçin (A, B, C veya D).');
              return;
            }

            const q = {
              text: text,
              options: opts,
              correctAnswerIndex: mqCorrectIdx,
              categoryId: catId,
              difficulty: mqDiff,
              targetPool: pool,
              explanation: explanation,
              subCategory: subCategory || undefined
            };

            const btn = document.getElementById('btn-mq-add');
            if (btn) btn.disabled = true;
            if (alertBox) alertBox.style.display = 'none';

            try {
              const payload = {
                input: [q],
                publishDirectly: autoPublish,
                defaultTargetPool: pool,
                addedBy: 'Telegram WebApp'
              };
              const res = await fetch('/api/admin/questions/import-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              const data = await res.json();

              if (data && data.success && data.importedCount > 0) {
                triggerHaptic('success');
                if (alertBox) {
                  alertBox.className = 'alert-box success';
                  alertBox.style.display = 'block';
                  let msg = '🎉 Soru havuza başarıyla eklendi! Kategori: ' + catId + ' · Havuz: ' + pool;
                  if (data.duplicateCount > 0) msg += ' (' + data.duplicateCount + ' mükerrer atlandı)';
                  alertBox.innerText = msg;
                }
                resetManualForm();
                // Alt kategori sayaçlarını güncelle
                subCounts = null;
                renderSubGrid();
              } else {
                let msg = 'Soru eklenemedi.';
                if (data && data.importedCount === 0 && data.duplicateCount > 0) {
                  msg = 'Bu soru havuzda zaten mevcut (mükerrer). Farklı bir soru deneyin.';
                } else if (data && (data.error || data.message)) {
                  msg = data.error || data.message;
                }
                showError(msg);
              }
            } catch (err) {
              showError('Bağlantı hatası: ' + err.message);
            }
            if (btn) btn.disabled = false;
          }

          function selectPoolMode(pool) {
            triggerHaptic('light');
            const poolInput = document.getElementById('json-pool');
            if (poolInput) poolInput.value = pool;
            document.querySelectorAll('.pool-choice-card').forEach(c => {
              c.classList.toggle('active', c.getAttribute('data-pool') === pool);
            });
            updateLiveDetection();
          }

          // ---- Alt kategori seçim durumu ve sayaçlar ----
          let selectedCatId = null;
          let selectedSubName = null;
          let subCounts = null; // { "catId||subName": sayi }

          function refreshSubCounts() {
            // Tüm soruları sayfalar halinde çekip alt kategori bazında sayar
            const fetchPage = (offset) =>
              fetch('/api/admin/questions/list?limit=200&offset=' + offset)
                .then(r => r.json())
                .catch(() => null);
            return (async () => {
              const counts = {};
              let offset = 0;
              for (let page = 0; page < 10; page++) {
                const d = await fetchPage(offset);
                if (!d || !Array.isArray(d.questions) || d.questions.length === 0) break;
                for (const q of d.questions) {
                  const cat = (q.categoryId || '').toString();
                  const sub = (q.subCategory || '').toString().trim();
                  if (cat && sub) {
                    const key = cat.toLowerCase() + '||' + sub.toLowerCase();
                    counts[key] = (counts[key] || 0) + 1;
                  }
                }
                if (d.questions.length < 200) break;
                offset += 200;
              }
              return counts;
            })();
          }

          function renderSubGrid() {
            const section = document.getElementById('sub-cat-section');
            const grid = document.getElementById('sub-cat-grid');
            const countLabel = document.getElementById('sub-cat-count-label');
            if (!section || !grid) return;
            const subs = (selectedCatId && SUBCATEGORY_MAP[selectedCatId]) || null;
            if (!subs || subs.length === 0) {
              section.style.display = 'none';
              grid.innerHTML = '';
              if (countLabel) countLabel.textContent = '';
              return;
            }
            section.style.display = 'block';
            if (countLabel) countLabel.textContent = selectedCatId + ' · ' + subs.length + ' kart';
            grid.innerHTML = subs.map(s => {
              const key = selectedCatId.toLowerCase() + '||' + s.n.toLowerCase();
              const cnt = (subCounts && subCounts[key]) || 0;
              const active = selectedSubName === s.n;
              return '<div class="category-squircle-card' + (active ? ' active' : '') + '" data-sub-name="' + s.n.replace(/"/g, '"') + '" onclick="selectSubTemplate(this.dataset.subName)">' +
                '<div class="cat-card-icon">' + s.e + '</div>' +
                '<div class="cat-card-title">' + s.n + '</div>' +
                '<div class="cat-card-id">' + cnt + ' soru</div>' +
              '</div>';
            }).join('');
            // Sayaçlar henüz yüklenmediyse arka planda çek ve yenile
            if (!subCounts) {
              refreshSubCounts().then(c => {
                subCounts = c;
                if (selectedCatId) renderSubGrid();
              });
            }
          }

          function selectSubTemplate(name) {
            triggerHaptic('light');
            selectedSubName = selectedSubName === name ? null : name;
            renderSubGrid();
            if (selectedCatId) buildCategoryTemplate(selectedCatId);
          }

          function buildCategoryTemplate(catId) {
            const currentPool = document.getElementById('json-pool').value || 'standard';
            const catObj = APP_16_CATEGORIES.find(c => c.id === catId) || SPECIAL_ROOM_CATEGORIES.find(c => c.id === catId) || { name: catId, icon: '🏷️' };
            const sample = [
              {
                "text": catObj.name + " kategorisi için soru metnini buraya yazın...",
                "options": [
                  "A seçeneği (Doğru cevap örneği)",
                  "B seçeneği",
                  "C seçeneği",
                  "D seçeneği"
                ],
                "correctAnswerIndex": 0,
                "categoryId": catId,
                "difficulty": "medium",
                "explanation": "Bu soruya ait detaylı açıklama metni...",
                "targetPool": currentPool
              }
            ];
            if (selectedSubName) {
              sample[0].subCategory = selectedSubName;
            }
            const sampleJson = JSON.stringify(sample, null, 2);
            document.getElementById('json-textarea').value = sampleJson;
            // Seçili kategori için örnek JSON önizleme paneli
            const exSection = document.getElementById('example-json-section');
            const exPre = document.getElementById('example-json-pre');
            if (exSection && exPre) {
              exSection.style.display = 'block';
              exPre.textContent = sampleJson;
            }
            updateLiveDetection();
          }

          function copyExampleJson() {
            triggerHaptic('light');
            const exPre = document.getElementById('example-json-pre');
            if (!exPre) return;
            const text = exPre.textContent || '';
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(text).then(() => {
                alert('Örnek JSON kopyalandı! Aşağıdaki JSON alanına yapıştırabilirsiniz.');
              }).catch(() => fallbackCopyExampleJson(text));
            } else {
              fallbackCopyExampleJson(text);
            }
          }

          function fallbackCopyExampleJson(text) {
            const tmp = document.createElement('textarea');
            tmp.value = text;
            tmp.style.position = 'fixed';
            tmp.style.opacity = '0';
            document.body.appendChild(tmp);
            tmp.select();
            try {
              document.execCommand('copy');
              alert('Örnek JSON kopyalandı! Aşağıdaki JSON alanına yapıştırabilirsiniz.');
            } catch (e) {
              alert('Kopyalanamadı — kodu elle seçip kopyalayın.');
            }
            document.body.removeChild(tmp);
          }

          function selectCategoryTemplate(catId) {
            triggerHaptic('light');
            document.querySelectorAll('.category-squircle-card[data-cat-id]').forEach(c => {
              c.classList.toggle('active', c.getAttribute('data-cat-id') === catId);
            });
            if (selectedCatId !== catId) {
              selectedSubName = null;
            }
            selectedCatId = catId;
            renderSubGrid();
            buildCategoryTemplate(catId);
          }

          function updateLiveDetection() {
            const textarea = document.getElementById('json-textarea');
            if (!textarea) return;
            const content = textarea.value.trim();
            const statusEl = document.getElementById('live-parser-status');
            const tagsEl = document.getElementById('live-parser-tags');
            if (!statusEl || !tagsEl) return;

            if (!content) {
              statusEl.innerHTML = '<span>ℹ️</span> <span>Henüz soru girilmedi. Yukarıdaki kategorilerden birine dokunarak şablon alabilirsiniz.</span>';
              tagsEl.innerHTML = '';
              return;
            }

            try {
              let cleaned = content.trim();
              const tick3 = String.fromCharCode(96, 96, 96);
              if (cleaned.indexOf(tick3) === 0) {
                cleaned = cleaned.slice(3).replace(/^json\s*/i, '');
                const lastIdx = cleaned.lastIndexOf(tick3);
                if (lastIdx !== -1) cleaned = cleaned.slice(0, lastIdx);
                cleaned = cleaned.trim();
              }

              // Akıllı tırnak ve trailing comma temizliği
              cleaned = cleaned
                .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
                .replace(/[\u2018\u2019\u201A\u201B]/g, "'");

              let parsed = null;
              try {
                parsed = JSON.parse(cleaned);
              } catch (e1) {
                try {
                  // Trailing comma ve yorum temizliği
                  let sanitized = cleaned
                    .replace(new RegExp('//.*$', 'gm'), '')
                    .replace(new RegExp('/\\*[\\s\\S]*?\\*/', 'g'), '')
                    .replace(new RegExp(',\\s*([}\\]])', 'g'), '$1');
                  parsed = JSON.parse(sanitized);
                } catch (e2) {
                  // Parçalı regex nesne çıkarma
                  const extracted = [];
                  const objRegex = new RegExp('\\{[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\}', 'g');
                  let m;
                  while ((m = objRegex.exec(cleaned)) !== null) {
                    try {
                      const o = JSON.parse(m[0].replace(new RegExp(',\\s*}', 'g'), '}'));
                      if (o && (o.text || o.soru || o.question)) extracted.push(o);
                    } catch (e3) {}
                  }
                  if (extracted.length > 0) parsed = extracted;
                }
              }

              if (!parsed) {
                throw new Error("JSON sözdizimi ayrıştırılamadı");
              }

              if (!Array.isArray(parsed)) {
                if (typeof parsed === 'object' && parsed !== null) {
                  if (Array.isArray(parsed.questions)) parsed = parsed.questions;
                  else if (Array.isArray(parsed.sorular)) parsed = parsed.sorular;
                  else parsed = [parsed];
                } else {
                  parsed = [];
                }
              }

              if (parsed.length === 0) {
                statusEl.innerHTML = '<span style="color: #F87171;">⚠️ Dizi içinde soru objesi bulunamadı.</span>';
                tagsEl.innerHTML = '';
                return;
              }

              const catCounts = {};
              const diffCounts = {};
              const poolCounts = {};

              parsed.forEach(q => {
                const rawC = (q.categoryId || q.kategori || q.category || 'general_culture').toString().toLowerCase().trim();
                const rawD = (q.difficulty || q.zorluk || 'medium').toString().toLowerCase().trim();
                const rawP = (q.targetPool || q.havuz || document.getElementById('json-pool').value || 'standard').toString().toLowerCase().trim();

                const matchedCat = APP_16_CATEGORIES.find(c => c.id === rawC || c.trKeys.includes(rawC)) || 
                                   SPECIAL_ROOM_CATEGORIES.find(c => c.id === rawC) || 
                                   { name: rawC, icon: '🏷️' };
                const catLabel = matchedCat.icon + ' ' + matchedCat.name;
                catCounts[catLabel] = (catCounts[catLabel] || 0) + 1;
                diffCounts[rawD] = (diffCounts[rawD] || 0) + 1;
                poolCounts[rawP] = (poolCounts[rawP] || 0) + 1;
              });

              statusEl.innerHTML = '<span style="color: var(--accent-mint); font-weight: 800;">✅ ' + parsed.length + ' Soru Algılandı</span>';

              let tagsHtml = '';
              Object.keys(catCounts).forEach(c => {
                tagsHtml += '<span class="tag-pill gold">' + c + ' (' + catCounts[c] + ')</span>';
              });
              Object.keys(poolCounts).forEach(p => {
                const poolLabel = p === 'custom_room' ? '⚔️ Arkadaşla Özel Oda' : p === 'daily_challenge' ? '📅 Günlük Meydan Okuma' : '🏆 Tek Kişilik Mod';
                tagsHtml += '<span class="tag-pill" style="background: rgba(192,132,252,0.25); color: #C084FC; font-weight: 800;">' + poolLabel + '</span>';
              });
              tagsEl.innerHTML = tagsHtml;
            } catch (syntaxErr) {
              const lines = content.split('\\n');
              let lineInfo = ' (Tırnak veya virgülleri kontrol edin)';
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('{') && !lines[i].includes('}')) {
                  lineInfo = ' (Satır ' + (i + 1) + ' kontrol edilebilir)';
                  break;
                }
              }
              statusEl.innerHTML = '<span style="color: #F87171;">⚠️ JSON sözdizimi henüz tamamlanmadı' + lineInfo + '</span>';
              tagsEl.innerHTML = '';
            }
          }

          const SAMPLE_JSON_TEMPLATE = JSON.stringify([
            {
              "text": "Türkiye'nin başkenti neresidir?",
              "options": ["İstanbul", "Ankara", "İzmir", "Bursa"],
              "correctAnswerIndex": 1,
              "categoryId": "geography",
              "difficulty": "easy",
              "explanation": "Türkiye Cumhuriyeti'nin başkenti 13 Ekim 1923'te Ankara olmuştur.",
              "targetPool": "standard"
            },
            {
              "soru": "Periyodik tabloda 'Au' simgesi hangi elementi temsil eder?",
              "secenekler": ["Gümüş", "Altın", "Bakır", "Platin"],
              "dogruCevap": "B",
              "kategori": "bilim",
              "zorluk": "orta",
              "aciklama": "Altın elementinin simgesi Latince 'Aurum'dan gelen Au'dur.",
              "havuz": "daily_challenge"
            },
            {
              "text": "Fatih Sultan Mehmet İstanbul'u kaç yılında fethetmiştir?",
              "options": ["1453", "1071", "1299", "1923"],
              "correctAnswerIndex": 0,
              "categoryId": "history",
              "difficulty": "easy",
              "explanation": "İstanbul 29 Mayıs 1453 tarihinde fethedilmiştir.",
              "targetPool": "standard"
            }
          ], null, 2);

          function pasteSampleJson() {
            triggerHaptic('light');
            document.getElementById('json-textarea').value = SAMPLE_JSON_TEMPLATE;
            console.log("📋 [Telegram WebApp] Örnek JSON şablonu alana yerleştirildi.");
            updateLiveDetection();
          }

          function clearJsonText() {
            triggerHaptic('light');
            document.getElementById('json-textarea').value = '';
            const alertBox = document.getElementById('json-alert');
            if (alertBox) alertBox.style.display = 'none';
            document.querySelectorAll('.category-squircle-card').forEach(c => c.classList.remove('active'));
            selectedCatId = null;
            selectedSubName = null;
            const subSection = document.getElementById('sub-cat-section');
            if (subSection) subSection.style.display = 'none';
            const exSection = document.getElementById('example-json-section');
            if (exSection) exSection.style.display = 'none';
            console.log("🧹 [Telegram WebApp] JSON textarea ve uyarı kutusu temizlendi.");
            updateLiveDetection();
          }

          function handleFileSelect(e) {
            const file = e.target.files[0];
            if (!file) return;
            console.log("📁 [Telegram WebApp] Dosya seçildi: " + file.name + " (" + file.size + " bayt)");
            const reader = new FileReader();
            reader.onload = (event) => {
              document.getElementById('json-textarea').value = event.target.result;
              triggerHaptic('success');
              console.log("✅ [Telegram WebApp] Dosya içeriği başarıyla okundu.");
              updateLiveDetection();
            };
            reader.readAsText(file);
          }

          async function importJsonQuestions() {
            triggerHaptic('medium');
            const textarea = document.getElementById('json-textarea');
            const alertBox = document.getElementById('json-alert');
            const pool = document.getElementById('json-pool').value;
            const autoPublish = document.getElementById('json-autopublish').checked;
            const content = textarea.value.trim();

            console.group('🚀 [Telegram WebApp] JSON Soru İçe Aktarımı');
            console.log('📋 İçerik karakter uzunluğu:', content.length);
            console.log('🎯 Hedef Havuz:', pool);
            console.log('⚡ Doğrudan Yayınla (Onaysız):', autoPublish);

            if (!content) {
              alertBox.className = 'alert-box error';
              alertBox.style.display = 'block';
              alertBox.innerText = '⚠️ Lütfen JSON soru verisi girin veya dosya yükleyin.';
              console.warn('⚠️ [Telegram WebApp] İçerik boş olduğundan istek gönderilmedi.');
              console.groupEnd();
              return;
            }

            // Yerel sözdizim kontrolü (Konsola ayrıntılı bilgi basmak için)
            try {
              const tick3 = String.fromCharCode(96, 96, 96);
              let localCleaned = content;
              if (localCleaned.indexOf(tick3) === 0) {
                localCleaned = localCleaned.slice(3).replace(/^json\s*/i, '');
                const lastIdx = localCleaned.lastIndexOf(tick3);
                if (lastIdx !== -1) localCleaned = localCleaned.slice(0, lastIdx);
                localCleaned = localCleaned.trim();
              }
              const localParsed = JSON.parse(localCleaned);
              console.log('✅ [Telegram WebApp] Yerel JSON sözdizim kontrolü başarılı!');
              console.log('📦 Ayrıştırılan veri:', localParsed);
            } catch (syntaxErr) {
              console.warn('⚠️ [Telegram WebApp] Yerel JSON.parse uyarısı (Sunucu esnek regex çözümlemesi deneyecek):', syntaxErr.message);
            }

            alertBox.style.display = 'none';
            const btn = document.getElementById('btn-import-json');
            if (btn) btn.disabled = true;

            try {
              const payload = {
                jsonContent: content,
                json: content,
                defaultTargetPool: pool,
                publishDirectly: autoPublish,
                autoPublish: autoPublish,
                addedBy: 'Telegram WebApp'
              };

              console.log('📡 [Telegram WebApp] POST /api/admin/questions/import-json gönderiliyor...');
              const res = await fetch('/api/admin/questions/import-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });

              console.log('📥 [Telegram WebApp] Sunucu HTTP Durum Kodu:', res.status);
              const data = await res.json();
              console.log('📊 [Telegram WebApp] Sunucu Yanıtı:', data);

              if (data.success && data.importedCount > 0) {
                triggerHaptic('success');
                alertBox.className = 'alert-box success';
                alertBox.style.display = 'block';
                let msg = '🎉 ' + data.importedCount + ' adet soru havuza başarıyla aktarıldı!';
                if (data.duplicateCount > 0) msg += ' (' + data.duplicateCount + ' mükerrer atlandı)';
                if (data.errorCount > 0) msg += ' (' + data.errorCount + ' hatalı soru atlandı)';
                alertBox.innerText = msg;
                textarea.value = '';
                console.log('🎉 [Telegram WebApp] Sorular başarıyla eklendi:', data.importedCount);
                // Alt kategori sayaçlarını güncelle
                subCounts = null;
                renderSubGrid();

                const detailBox = document.getElementById('json-result-details');
                if (detailBox) {
                  let detailHtml = '<div style="background: var(--surface-2); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px;">';
                  detailHtml += '<div style="font-weight: 800; font-size: 14px; margin-bottom: 8px; color: var(--accent-mint);">📊 Eklenen Soru Detay Raporu</div>';

                  if (data.categoryBreakdown) {
                    detailHtml += '<div style="margin-bottom: 8px;"><div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">KATEGORİ DAĞILIMI:</div><div style="display: flex; gap: 6px; flex-wrap: wrap;">';
                    for (const [cat, cnt] of Object.entries(data.categoryBreakdown)) {
                      detailHtml += '<span class="tag-pill gold">' + cat + ': ' + cnt + '</span>';
                    }
                    detailHtml += '</div></div>';
                  }

                  if (data.difficultyBreakdown) {
                    detailHtml += '<div style="margin-bottom: 8px;"><div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">ZORLUK DAĞILIMI:</div><div style="display: flex; gap: 6px; flex-wrap: wrap;">';
                    for (const [diff, cnt] of Object.entries(data.difficultyBreakdown)) {
                      detailHtml += '<span class="tag-pill diff-' + diff + '">' + diff + ': ' + cnt + '</span>';
                    }
                    detailHtml += '</div></div>';
                  }

                  if (data.importedDetails && data.importedDetails.length > 0) {
                    detailHtml += '<details style="margin-top: 10px;" open><summary style="cursor: pointer; font-size: 12px; font-weight: 700; color: var(--accent-primary);">📋 Eklenen Tüm Sorular (' + data.importedDetails.length + ' Soru)</summary><div style="margin-top: 8px;">';
                    data.importedDetails.forEach((q, idx) => {
                      detailHtml += '<div style="background: var(--surface-1); padding: 8px 10px; border-radius: 6px; margin-bottom: 6px; border: 1px solid rgba(255,255,255,0.06); font-size: 12px;">';
                      detailHtml += '<div style="font-weight: 700;">' + (idx + 1) + '. ' + escapeHtml(q.text) + '</div>';
                      detailHtml += '<div style="display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap;">';
                      detailHtml += '<span class="tag-pill">' + (q.categoryIcon || '❓') + ' ' + (q.categoryName || q.categoryId) + '</span>';
                      detailHtml += '<span class="tag-pill diff-' + q.difficulty + '">' + (q.difficultyName || q.difficulty) + '</span>';
                      detailHtml += '<span class="tag-pill">' + (q.poolName || q.targetPool) + '</span>';
                      detailHtml += '<span class="tag-pill mint">✓ ' + escapeHtml(q.correctAnswer) + '</span>';
                      detailHtml += '</div></div>';
                    });
                    detailHtml += '</div></details>';
                  }

                  if (data.skippedDuplicates && data.skippedDuplicates.length > 0) {
                    detailHtml += '<div style="margin-top: 10px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 6px; padding: 8px 10px;">';
                    detailHtml += '<div style="font-weight: 700; color: #F87171; font-size: 12px;">🔁 Mükerrer Olduğu İçin Atlanan Sorular (' + data.skippedDuplicates.length + ')</div>';
                    data.skippedDuplicates.forEach((dup) => {
                      detailHtml += '<div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">• ' + escapeHtml(dup.text) + '</div>';
                    });
                    detailHtml += '</div>';
                  }

                  detailHtml += '</div>';
                  detailBox.innerHTML = detailHtml;
                  detailBox.style.display = 'block';
                }
              } else {
                const errList = data.errors && data.errors.length > 0
                  ? data.errors.join('<br>• ')
                  : (data.error || 'Hiçbir geçerli soru içe aktarılamadı.');
                console.error('❌ [Telegram WebApp] İçe aktarma başarısız: ' + errList);
                throw new Error(errList);
              }
            } catch (err) {
              triggerHaptic('error');
              alertBox.className = 'alert-box error';
              alertBox.style.display = 'block';
              alertBox.innerText = '❌ Hata: ' + err.message;
              console.error('❌ [Telegram WebApp] İstek hatası:', err);
            } finally {
              if (btn) btn.disabled = false;
              console.groupEnd();
            }
          }

          // Tab 3: Pending Review List
          async function loadPendingQuestions() {
            const container = document.getElementById('pending-list-container');
            container.innerHTML = '<div style="text-align: center; padding: 24px; color: var(--text-secondary);"><span class="loader"></span> Kuyruk sorgulanıyor...</div>';
            
            try {
              const res = await fetch('/api/admin/questions/review?limit=25');
              const data = await res.json();
              const questions = data.questions || [];
              
              const dot = document.getElementById('pending-dot');
              if (dot) dot.style.display = questions.length > 0 ? 'block' : 'none';

              if (questions.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 32px; color: var(--accent-mint); font-weight: 700;">🎉 Onay bekleyen soru yok! Tüm sorular incelendi.</div>';
                return;
              }

              renderQuestionCards(questions, container);
            } catch (err) {
              container.innerHTML = '<div style="text-align: center; padding: 24px; color: var(--accent-danger);">Kuyruk yüklenemedi: ' + err.message + '</div>';
            }
          }

          // Tab 4: Pool Stats, Category Matrix & Question Browser
          let currentBrowserPage = 0;
          let browserSearchTimeout = null;

          async function loadStats() {
            try {
              const res = await fetch('/api/admin/questions/stats');
              const stats = await res.json();
              
              if (document.getElementById('stat-total')) document.getElementById('stat-total').innerText = stats.total || 0;
              if (document.getElementById('stat-published')) document.getElementById('stat-published').innerText = stats.published || 0;
              if (document.getElementById('stat-pending')) document.getElementById('stat-pending').innerText = stats.pending || 0;
              
              let dailyCount = 0;
              if (stats.pools) {
                dailyCount = (stats.pools.daily_challenge || 0) + (stats.pools.custom_room || 0);
              }
              if (document.getElementById('stat-daily')) document.getElementById('stat-daily').innerText = dailyCount;

              const breakdownContainer = document.getElementById('categories-breakdown-list');
              if (breakdownContainer && stats.categoriesDetail && stats.categoriesDetail.length > 0) {
                breakdownContainer.innerHTML = stats.categoriesDetail.map((c) => {
                  return '<div class="category-matrix-card" data-cat-id="' + c.id + '" onclick="filterBrowserCategory(this.dataset.catId)">' +
                    '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                      '<span style="font-size: 14px; font-weight: 800;">' + c.icon + ' ' + escapeHtml(c.name) + ' <span style="font-size: 11px; color: var(--text-secondary); font-weight: normal;">(' + c.id + ')</span></span>' +
                      '<span class="tag-pill gold" style="font-size: 12px;">' + c.total + ' soru</span>' +
                    '</div>' +
                    '<div class="matrix-diff-pills">' +
                      '<span class="tag-pill diff-easy">🟢 Kolay: ' + c.easy + '</span>' +
                      '<span class="tag-pill diff-medium">🔵 Orta: ' + c.medium + '</span>' +
                      '<span class="tag-pill diff-hard">🟡 Zor: ' + c.hard + '</span>' +
                      '<span class="tag-pill diff-expert">🔴 Uzman: ' + c.expert + '</span>' +
                    '</div>' +
                  '</div>';
                }).join('');
              }

              loadQuestionsBrowser(0);
            } catch (err) {
              console.warn('Stats error:', err);
            }
          }

          function filterBrowserCategory(catId) {
            triggerHaptic('light');
            const sel = document.getElementById('browser-category');
            if (sel) sel.value = catId;
            loadQuestionsBrowser(0);
            const target = document.getElementById('browser-category');
            if (target) target.scrollIntoView({ behavior: 'smooth' });
          }

          function debounceBrowserSearch() {
            clearTimeout(browserSearchTimeout);
            browserSearchTimeout = setTimeout(() => {
              loadQuestionsBrowser(0);
            }, 300);
          }

          async function scanDuplicates() {
            triggerHaptic('medium');
            const btn = document.getElementById('btn-scan-dup');
            const container = document.getElementById('duplicate-results-container');
            if (!container) return;

            container.style.display = 'block';
            container.innerHTML = '<div style="text-align: center; padding: 16px; color: var(--text-secondary);"><span class="loader"></span> Havuzdaki tüm sorular taranıyor...</div>';
            if (btn) btn.disabled = true;

            try {
              const res = await fetch('/api/admin/questions/duplicates');
              const data = await res.json();
              console.log('🔍 [Duplicates Scan]:', data);

              if (data.duplicateGroupsCount === 0) {
                container.innerHTML = '<div style="padding: 14px; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); border-radius: 8px; color: #10B981; font-weight: 700; text-align: center;">' +
                  '✨ Tebrikler! Havuzda hiçbir mükerrer (aynı metne sahip) soru bulunamadı. Toplam ' + data.totalQuestions + ' soru denetlendi.' +
                '</div>';
              } else {
                let html = '<div style="padding: 12px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; margin-bottom: 12px; color: #F87171; font-weight: 700;">' +
                  '⚠️ Dikkat! ' + data.duplicateGroupsCount + ' farklı grupta toplam ' + data.duplicateQuestionsCount + ' adet mükerrer soru tespit edildi:' +
                '</div>';

                data.groups.forEach((grp, gIdx) => {
                  html += '<div class="duplicate-box">';
                  html += '<div class="duplicate-group-header">Grup #' + (gIdx + 1) + ' (' + grp.count + ' Adet Aynı Soru):</div>';
                  html += '<div style="font-weight: 700; font-size: 13px; margin-bottom: 6px;">"' + escapeHtml(grp.questions[0].text) + '"</div>';

                  grp.questions.forEach((q, qIdx) => {
                    html += '<div class="duplicate-item" id="dup-card-' + q.id + '">';
                    html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">';
                    html += '<span style="font-size: 11px; color: var(--text-secondary);">Kopya #' + (qIdx + 1) + ' · ID: ' + q.id + ' · ' + (q.reviewStatus || 'published') + '</span>';
                    html += '<button class="btn-action reject" style="max-width: 130px; padding: 4px 8px; font-size: 11px;" data-id="' + q.id + '" onclick="deleteQuestionFromPool(this.dataset.id, true)">🗑️ Bu Kopyayı Sil</button>';
                    html += '</div>';
                    html += '<div style="font-size: 12px; color: var(--text-secondary);">Kategori: <b>' + q.categoryId + '</b> · Zorluk: <b>' + q.difficulty + '</b> · Havuz: <b>' + (q.targetPool || 'standard') + '</b></div>';
                    html += '</div>';
                  });

                  html += '</div>';
                });

                container.innerHTML = html;
              }
            } catch (err) {
              container.innerHTML = '<div style="color: #EF4444; padding: 12px;">Tarama hatası: ' + err.message + '</div>';
            } finally {
              if (btn) btn.disabled = false;
            }
          }

          async function loadQuestionsBrowser(page) {
            currentBrowserPage = page || 0;
            const listContainer = document.getElementById('browser-questions-list');
            const countLabel = document.getElementById('browser-count-label');
            const paginationContainer = document.getElementById('browser-pagination');
            if (!listContainer) return;

            listContainer.innerHTML = '<div style="text-align: center; padding: 24px; color: var(--text-secondary);"><span class="loader"></span> Sorular yükleniyor...</div>';

            const search = document.getElementById('browser-search')?.value || '';
            const categoryId = document.getElementById('browser-category')?.value || 'all';
            const difficulty = document.getElementById('browser-difficulty')?.value || 'all';
            const targetPool = document.getElementById('browser-pool')?.value || 'all';
            const reviewStatus = document.getElementById('browser-status')?.value || 'published';

            const limit = 25;
            const offset = currentBrowserPage * limit;

            try {
              const params = new URLSearchParams({
                search,
                categoryId,
                difficulty,
                targetPool,
                reviewStatus,
                limit: String(limit),
                offset: String(offset)
              });

              const res = await fetch('/api/admin/questions/list?' + params.toString());
              const data = await res.json();
              console.log('🔎 [Questions Browser]:', data);

              const questions = data.questions || [];
              if (countLabel) {
                countLabel.innerText = 'Filtrelenen: ' + (data.filteredCount || 0) + ' / Toplam: ' + (data.total || 0) + ' soru (Sayfa ' + (currentBrowserPage + 1) + ')';
              }

              if (questions.length === 0) {
                listContainer.innerHTML = '<div style="text-align: center; padding: 32px; color: var(--text-secondary);">Seçilen filtrelere uygun soru bulunamadı.</div>';
                if (paginationContainer) paginationContainer.innerHTML = '';
                return;
              }

              listContainer.innerHTML = questions.map((q, idx) => {
                const correctIdx = q.options.findIndex(o => o.id === q.correctOptionId);
                const poolLabel = q.targetPool === 'daily_challenge' || q.isDailyChallenge
                  ? '📅 Günlük Meydan Okuma'
                  : q.targetPool === 'custom_room' || q.isCustomRoomOnly
                  ? '⚔️ Özel Oda'
                  : '🏆 Normal Havuz';

                return '<div class="question-item" id="pool-card-' + q.id + '">' +
                  '<div class="question-item-header">' +
                    '<div>' +
                      '<span class="tag-pill gold">' + q.categoryId + '</span> ' +
                      '<span class="tag-pill diff-' + q.difficulty + '">' + q.difficulty + '</span> ' +
                      '<span class="tag-pill">' + poolLabel + '</span>' +
                    '</div>' +
                    '<span class="tag-pill" style="font-size: 10px;">#' + (offset + idx + 1) + '</span>' +
                  '</div>' +
                  '<div class="question-text">' + escapeHtml(q.text) + '</div>' +
                  '<div class="options-list">' +
                    q.options.map((opt, oIdx) => {
                      const isCorrect = oIdx === correctIdx;
                      return '<div class="option-row ' + (isCorrect ? 'correct' : '') + '">' +
                        '<span>' + ['A', 'B', 'C', 'D'][oIdx] + ')</span>' +
                        '<span>' + escapeHtml(opt.text) + '</span>' +
                        (isCorrect ? '<span style="margin-left: auto; font-weight: 900;">✓ Doğru</span>' : '') +
                      '</div>';
                    }).join('') +
                  '</div>' +
                  (q.explanation ? '<div style="font-size: 12px; color: var(--text-secondary); margin-top: 6px; font-style: italic;">💡 ' + escapeHtml(q.explanation) + '</div>' : '') +
                  '<div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px;">' +
                    '<span style="font-size: 11px; color: var(--text-secondary);">ID: ' + q.id + '</span>' +
                    '<button class="btn-action reject" style="max-width: 120px; padding: 6px 10px;" data-id="' + q.id + '" onclick="deleteQuestionFromPool(this.dataset.id)">🗑️ Soruyu Sil</button>' +
                  '</div>' +
                '</div>';
              }).join('');

              // Pagination
              if (paginationContainer) {
                let pageHtml = '';
                if (currentBrowserPage > 0) {
                  pageHtml += '<button class="btn-secondary" onclick="loadQuestionsBrowser(' + (currentBrowserPage - 1) + ')">◀ Önceki Sayfa</button> ';
                }
                if ((offset + questions.length) < data.filteredCount) {
                  pageHtml += '<button class="btn-secondary" onclick="loadQuestionsBrowser(' + (currentBrowserPage + 1) + ')">Sonraki Sayfa ▶</button>';
                }
                paginationContainer.innerHTML = pageHtml;
              }
            } catch (err) {
              listContainer.innerHTML = '<div style="color: #EF4444; padding: 14px;">Sorular yüklenirken hata oluştu: ' + err.message + '</div>';
            }
          }

          async function deleteQuestionFromPool(id, isDuplicateScan) {
            if (!confirm('Bu soruyu kalıcı olarak silmek istediğinizden emin misiniz?')) {
              return;
            }

            triggerHaptic('warning');
            try {
              const res = await fetch('/api/admin/questions/' + id, { method: 'DELETE' });
              const data = await res.json();
              if (data.success) {
                triggerHaptic('success');
                const poolCard = document.getElementById('pool-card-' + id);
                if (poolCard) {
                  poolCard.style.transition = 'all 0.3s ease';
                  poolCard.style.opacity = '0';
                  poolCard.style.transform = 'scale(0.95)';
                  setTimeout(() => poolCard.remove(), 300);
                }
                const dupCard = document.getElementById('dup-card-' + id);
                if (dupCard) dupCard.remove();

                if (isDuplicateScan) {
                  scanDuplicates();
                }
                // Refresh stats
                fetch('/api/admin/questions/stats').then(r => r.json()).then(stats => {
                  if (document.getElementById('stat-total')) document.getElementById('stat-total').innerText = stats.total || 0;
                  if (document.getElementById('stat-published')) document.getElementById('stat-published').innerText = stats.published || 0;
                }).catch(() => {});
              } else {
                alert('Silme başarısız: ' + (data.error || 'Bilinmeyen hata'));
              }
            } catch (err) {
              alert('İstek hatası: ' + err.message);
            }
          }

          // Tab 5: Quick Room Generator
          let generatedRoomCode = 'TAV' + Math.floor(100 + Math.random() * 900);
          function createQuickRoom() {
            triggerHaptic('medium');
            generatedRoomCode = 'TAV' + Math.floor(100 + Math.random() * 900);
            document.getElementById('quick-room-code').innerText = generatedRoomCode;
            document.getElementById('quick-room-box').style.display = 'block';
          }

          function copyRoomCode() {
            triggerHaptic('light');
            navigator.clipboard.writeText(generatedRoomCode).then(() => {
              triggerHaptic('success');
              alert('Oda kodu kopyalandı: ' + generatedRoomCode);
            }).catch(() => {});
          }

          function shareRoomToTelegram() {
            triggerHaptic('light');
            const text = encodeURIComponent('🎮 Tavriko Özel Oda Meydan Okuması!\\n\\nOda Kodu: ' + generatedRoomCode + '\\nHemen katıl: https://tavriko-app.vercel.app');
            if (tg && tg.openTelegramLink) {
              tg.openTelegramLink('https://t.me/share/url?url=' + text);
            } else {
              window.open('https://t.me/share/url?url=' + text, '_blank');
            }
          }

          function escapeHtml(str) {
            if (!str) return '';
            return String(str)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
          }

          // Initial load
          window.addEventListener('DOMContentLoaded', () => {
            renderCategoryPickers();
            renderManualCategoryOptions();
            updateLiveDetection();
            fetch('/api/admin/questions/review?limit=1').then(r => r.json()).then(d => {
              const dot = document.getElementById('pending-dot');
              if (dot && d.count > 0) dot.style.display = 'block';
            }).catch(() => {});
          });
        </script>
      </body>
      </html>
    `);
  });

  // Health check
  app.get(['/health', '/api/health'], async (req, res) => {
    const [supabaseHealth, prismaHealth] = await Promise.all([
      supabaseService.checkHealth(),
      prisma.checkHealth(),
    ]);
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      roomsCount: roomManager.getActiveRoomsCount(),
      stats: db.getReviewStats(),
      services: {
        upstashRedis: {
          available: cacheService.isAvailable(),
          mode: cacheService.isAvailable() ? 'upstash_rest' : 'in_memory_simulation',
        },
        supabase: supabaseHealth,
        prisma: prismaHealth,
        evrenLLM: {
          configured: !!process.env.EVREN_LLM_API_KEY,
          model: process.env.EVREN_LLM_MODEL || 'evren/glm-5.3-fp8',
          baseUrl: process.env.EVREN_LLM_BASE_URL || 'https://llmtr.com/v1',
        },
        telegramBot: {
          configured: telegramBot.isRunning(),
          tokenSet: !!(process.env.TELEGRAM_BOT_TOKEN && !process.env.TELEGRAM_BOT_TOKEN.includes('placeholder')),
        },
      },
    });
  });

  // Public Rooms API: Yalnızca Gerçek ve Aktif Herkese Açık Odalar (Mock/Sahte odalar kaldırıldı)
  app.get(['/api/trivia/rooms/public', '/api/rooms/public'], async (req, res) => {
    try {
      const localRooms = roomManager
        .getPublicRooms()
        .filter((r: any) => r && r.status === 'lobby' && (r.playerCount || r.players || 0) > 0 && (r.playerCount || r.players || 0) < (r.maxPlayers || 4));
      const syncedRooms = db.getActivePublicRooms();

      const mergedByCode = new Map<string, any>();
      for (const r of localRooms) {
        mergedByCode.set(r.code, {
          code: r.code,
          name: r.name || `${r.hostName || 'Oyuncu'} Odası`,
          host: r.hostName || 'Oyuncu',
          hostName: r.hostName || 'Oyuncu',
          category: r.categoryName || r.category || 'Genel Kültür',
          categoryName: r.categoryName || r.category || 'Genel Kültür',
          players: r.playerCount || 1,
          playerCount: r.playerCount || 1,
          maxPlayers: r.maxPlayers || 4,
          rounds: r.totalRounds || 5,
          totalRounds: r.totalRounds || 5,
          timeSec: r.questionTimeSec || 15,
          questionTimeSec: r.questionTimeSec || 15,
          status: 'waiting',
        });
      }
      for (const r of syncedRooms) {
        if (!mergedByCode.has(r.code)) {
          mergedByCode.set(r.code, {
            code: r.code,
            name: r.name,
            host: r.host,
            hostName: r.host,
            category: r.category,
            categoryName: r.category,
            players: r.players,
            playerCount: r.players,
            maxPlayers: r.maxPlayers,
            rounds: r.rounds,
            totalRounds: r.rounds,
            timeSec: r.timeSec,
            questionTimeSec: r.timeSec,
            status: 'waiting',
          });
        }
      }

      const rooms = Array.from(mergedByCode.values());
      res.json({
        success: true,
        count: rooms.length,
        rooms,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message, rooms: [] });
    }
  });

  app.get('/api/trivia/leaderboard', async (req, res) => {
    try {
      const topPlayers = await db.getLeaderboardAsync(30);
      res.json({
        season: 'Sezon 1: Bilgi Çağı',
        endsInDays: 45,
        topPlayers,
        leaders: topPlayers,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Prisma ORM <-> Supabase Sync Endpoint
  app.all('/api/admin/prisma-sync', async (req, res) => {
    try {
      const result = await db.pushAllDataViaPrismaToSupabase();
      const health = await prisma.checkHealth();
      res.json({
        success: true,
        orm: 'Prisma ORM v6.19.3',
        supabaseUrl: process.env.SUPABASE_URL || 'https://rjvbgofzsfescnfohzgu.supabase.co',
        ...result,
        health,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Prometheus scrape endpoint — SECURITY: admin authentication required so
  // internal process/request metrics are not publicly exposed.
  app.get('/metrics', requireAdminAuth, metricsHandler);

  // REST API Routes
  app.use('/api', logRouter);
  app.use('/api/auth', authRoutes);
  app.get('/auth/google/callback', (req, res) => {
    res.redirect('/api/auth/google/callback');
  });
  app.use('/api', triviaRoutes);
  app.use('/api/social', socialRoutes);
  app.use('/api/referrals', referralRoutes);
  app.use(legalRouter);

  // --- Cloudflare Durable Objects Internal Endpoints ---
  app.post('/api/internal/room-questions', async (req, res) => {
    // SECURITY: internal endpoints are service-to-service only. The secret header is
    // REQUIRED; previously a missing header bypassed the check entirely.
    const internalSecret = process.env.INTERNAL_API_SECRET;
    const providedSecret = req.headers['x-internal-secret'];
    if (!internalSecret || typeof providedSecret !== 'string' || providedSecret !== internalSecret) {
      return res.status(403).json({ error: 'Yetkisiz erişim' });
    }

    // Sunucusuz ortamda kalıcı soru havuzunun (Telegram soruları dahil) hazır olmasını bekle
    await db.ensureQuestionsRestored();

    const { categoryId, difficulty, count = 5 } = req.body || {};
    const safeCount = Math.min(50, Math.max(1, Number(count) || 5));
    const resolvedCat = canonicalCategoryId(categoryId || 'general_culture');
    const questions = db.getQuestions(
      resolvedCat,
      difficulty || 'medium',
      safeCount
    );

    return res.json({ success: true, questions });
  });

  app.post('/api/internal/match-results', async (req, res) => {
    // SECURITY: internal endpoints are service-to-service only. The secret header is
    // REQUIRED; previously a missing header bypassed the check entirely.
    const internalSecret = process.env.INTERNAL_API_SECRET;
    const providedSecret = req.headers['x-internal-secret'];
    if (!internalSecret || typeof providedSecret !== 'string' || providedSecret !== internalSecret) {
      return res.status(403).json({ error: 'Yetkisiz erişim' });
    }

    try {
      const summary = req.body as FinalMatchSummary;
      if (!summary || !summary.roomCode || !Array.isArray(summary.rankings)) {
        return res.status(400).json({ error: 'Geçersiz maç özeti' });
      }

      // Record match history in Prisma
      await db.matchHistory.create({
        data: {
          roomCode: summary.roomCode,
          mode: summary.mode,
          categoryId: summary.mode,
          winnerId: summary.podium?.first?.playerId || null,
          totalQuestions: summary.totalRounds,
          rankingsJson: summary.rankings,
        },
      });

      db.removePublicRoom(summary.roomCode);

      // Update XP and coins for participating registered users
      for (const rankItem of summary.rankings) {
        if (!rankItem.playerId || rankItem.playerId.startsWith('bot_') || rankItem.playerId.startsWith('guest_')) {
          continue;
        }

        const isWinner = rankItem.rank === 1;
        const totalRounds = Math.max(1, Number(summary.totalRounds) || 5);
        const rawCorrect =
          typeof (rankItem as any).correctAnswersCount === 'number'
            ? (rankItem as any).correctAnswersCount
            : Math.min(totalRounds, Math.round((rankItem.score || 0) / 140));
        const safeCorrect = Math.max(0, Math.min(totalRounds, rawCorrect));

        // Sıfır doğru cevap veya oyundan erken ayrılmada 0 coin ve 0 xp
        const isZero = safeCorrect === 0;
        const coinsEarned = isZero
          ? 0
          : isWinner
          ? Math.min(15, safeCorrect * 2 + 5)
          : Math.min(6, safeCorrect * 1);
        const xpEarned = isZero
          ? 0
          : isWinner
          ? Math.min(35, safeCorrect * 5 + 10)
          : Math.min(15, safeCorrect * 3);

        await db.recordGameStats(rankItem.playerId, {
          correctAnswers: safeCorrect,
          totalAnswers: totalRounds,
          xpEarned,
          coinsEarned,
          bestStreak: Math.min(safeCorrect, rankItem.streak || 0),
          won: isWinner,
          roomCode: summary.roomCode,
        });
      }

      logger.info('SOCKET', `Cloudflare Durable Objects maçı kaydedildi: ${summary.roomCode}`, {
        mode: summary.mode,
        playersCount: summary.rankings.length,
        winner: summary.podium?.first?.displayName,
      });

      return res.json({ success: true });
    } catch (err: any) {
      captureError(err);
      logger.error('SOCKET', `Maç sonucu kaydetme hatası: ${err.message}`, err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  const close = () => {
    matchmaker.destroy();
    roomManager.cleanupAll();
  };

  // ============================================================================
  // Animated 404 page — final catch-all for unmatched routes.
  // API paths get a JSON 404; browser requests get a styled animated page.
  // ============================================================================
  const renderNotFoundHtml = (): string => `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>404 — Sayfa Bulunamadı | Tavriko</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        body {
          background: radial-gradient(circle at 20% 20%, #1e1b4b 0%, #0f172a 45%, #020617 100%);
          color: #f8fafc;
          font-family: 'Lilita One', 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          overflow: hidden;
          position: relative;
        }
        .stars, .stars2, .stars3 {
          position: absolute; inset: 0; width: 100%; height: 100%;
          background: transparent;
        }
        .stars { animation: drift 90s linear infinite; }
        .stars2 { animation: drift 140s linear infinite; animation-delay: -45s; }
        .stars3 { animation: drift 200s linear infinite; animation-delay: -100s; }
        .stars span, .stars2 span, .stars3 span {
          position: absolute; border-radius: 50%;
          background: #fff; opacity: 0.8;
          box-shadow: 0 0 6px 1px rgba(255,255,255,0.6);
        }
        @keyframes drift {
          from { transform: translateY(0); }
          to { transform: translateY(-2000px); }
        }
        .glow {
          position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.35;
          animation: pulse 6s ease-in-out infinite;
        }
        .glow-1 { width: 420px; height: 420px; background: #7c3aed; top: -120px; left: -120px; }
        .glow-2 { width: 380px; height: 380px; background: #06b6d4; bottom: -140px; right: -100px; animation-delay: -3s; }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.15); opacity: 0.5; }
        }
        .content { position: relative; z-index: 2; text-align: center; padding: 24px; }
        .code {
          font-size: clamp(96px, 22vw, 220px);
          line-height: 1;
          font-weight: 900;
          letter-spacing: 0.04em;
          background: linear-gradient(135deg, #a78bfa 0%, #22d3ee 50%, #f472b6 100%);
          background-size: 200% 200%;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent; color: transparent;
          animation: gradientShift 5s ease infinite, floatY 3.5s ease-in-out infinite;
          text-shadow: 0 0 80px rgba(124, 58, 237, 0.35);
        }
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes floatY {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }
        .title {
          font-size: clamp(22px, 4.5vw, 38px);
          margin-top: 8px;
          animation: fadeUp 0.8s ease both 0.2s;
        }
        .subtitle {
          font-family: 'Nunito', sans-serif;
          color: #94a3b8; font-size: clamp(14px, 2.5vw, 18px);
          margin-top: 12px; max-width: 460px;
          animation: fadeUp 0.8s ease both 0.45s;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .btn {
          display: inline-block; margin-top: 34px;
          padding: 16px 40px; font-size: 17px; font-weight: 700;
          color: #fff; text-decoration: none;
          background: linear-gradient(135deg, #7c3aed, #06b6d4);
          border-radius: 999px;
          box-shadow: 0 10px 30px rgba(124, 58, 237, 0.45);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          animation: fadeUp 0.8s ease both 0.7s;
        }
        .btn:hover { transform: translateY(-3px) scale(1.04); box-shadow: 0 16px 40px rgba(6, 182, 212, 0.5); }
        .coin {
          position: absolute; z-index: 1; font-size: 26px;
          animation: coinFall linear infinite;
          opacity: 0.85;
        }
        @keyframes coinFall {
          0% { transform: translateY(-10vh) rotate(0deg); }
          100% { transform: translateY(110vh) rotate(360deg); }
        }
        footer { position: absolute; bottom: 18px; width: 100%; text-align: center; color: #475569; font-size: 12px; font-family: 'Nunito', sans-serif; z-index: 2; }
      </style>
    </head>
    <body>
      <div class="stars"></div><div class="stars2"></div><div class="stars3"></div>
      <div class="glow glow-1"></div><div class="glow glow-2"></div>
      <div class="content">
        <div class="code">404</div>
        <div class="title">Sayfa Bulunamadı</div>
        <div class="subtitle">Aradığın sayfa galiba başka bir evrende kayboldu. Merak etme, Tavriko evreninde hâlâ çok şey keşfedilecek.</div>
        <a class="btn" href="/app">🎮 Oyuna Dön</a>
      </div>
      <footer>Tavriko — Trivia Evreni</footer>
      <script>
        (function () {
          // Star field
          var layers = document.querySelectorAll('.stars, .stars2, .stars3');
          var counts = [60, 40, 25];
          layers.forEach(function (layer, li) {
            for (var i = 0; i < counts[li]; i++) {
              var s = document.createElement('span');
              var size = Math.random() * 2.4 + 0.6;
              s.style.width = size + 'px';
              s.style.height = size + 'px';
              s.style.left = Math.random() * 100 + '%';
              s.style.top = Math.random() * 100 + '%';
              if (li === 2) s.style.opacity = '0.4';
              layer.appendChild(s);
            }
          });
          // Falling coins
          var emojis = ['🪙', '💎', '⭐', '🪙', '🎯'];
          for (var i = 0; i < 14; i++) {
            var c = document.createElement('div');
            c.className = 'coin';
            c.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            c.style.left = Math.random() * 100 + '%';
            c.style.animationDuration = (Math.random() * 7 + 6) + 's';
            c.style.animationDelay = '-' + (Math.random() * 12) + 's';
            c.style.fontSize = (Math.random() * 16 + 16) + 'px';
            document.body.appendChild(c);
          }
        })();
      </script>
    </body>
    </html>`;

  app.use((req: express.Request, res: express.Response) => {
    // API paths keep a machine-readable JSON 404
    if (req.path.startsWith('/api/') || req.path.startsWith('/api')) {
      res.status(404).json({ error: 'Endpoint bulunamadı' });
      return;
    }
    // Static-like asset requests get a plain 404
    if (req.method !== 'GET' || /\.[a-zA-Z0-9]+$/.test(req.path.split('?')[0])) {
      res.status(404).type('text/plain').send('Not found');
      return;
    }
    // Browser navigation gets the animated page
    res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderNotFoundHtml());
  });

  return { app, httpServer, io, roomManager, matchmaker, telegramBot, close };
}

if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  const { httpServer } = createApp();
  httpServer.listen(PORT, () => {
    console.log(`[Trivia Server] Online on port ${PORT}`);
  });

  // Fallback redirect on port 3000 to catch any default Supabase Site URL redirects
  try {
    const proxy3000 = http.createServer((req, res) => {
      const localIp = getLocalIpAddress();
      res.writeHead(302, {
        Location: `http://${localIp}:4000/api/auth/google/callback`,
      });
      res.end();
    });
    proxy3000.on('error', () => {});
    proxy3000.listen(3000, () => {
      console.log('[Trivia Server] Port 3000 redirect listener active for Supabase OAuth');
    });
  } catch {}
}
