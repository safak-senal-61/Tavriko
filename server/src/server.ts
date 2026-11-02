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
import { prisma, db } from './db/prismaClient';
import { GameRoomManager } from './engine/GameRoomManager';
import { Matchmaker } from './engine/Matchmaker';
import { setupSocketHandlers } from './socket/socketHandler';
import { TelegramBotService } from './telegram/telegramBot';
import { supabaseService } from './db/supabaseClient';
import { cacheService } from './cache/redisClient';
import { logger } from './utils/logger';
import { logRouter, renderDashboardHtml } from './routes/logRoutes';
import { FinalMatchSummary } from '@trivia/shared';
import authRoutes from './routes/authRoutes';
import triviaRoutes from './routes/triviaRoutes';
import socialRoutes from './routes/socialRoutes';

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

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

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
          query: Object.keys(req.query).length ? req.query : undefined,
          body: req.method !== 'GET' && Object.keys(req.body || {}).length ? req.body : undefined,
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

  // Wire up authoritative room manager with DB question provider
  const roomManager = new GameRoomManager((category, difficulty, count) => {
    return db.getQuestions(category, difficulty, count);
  });

  const matchmaker = new Matchmaker(roomManager);

  setupSocketHandlers(io, roomManager, matchmaker);

  // Initialize Telegram Bot & Admin Approval Service
  const telegramBot = new TelegramBotService({ db, roomManager });

  // Telegram Webhook endpoint (Essential for Vercel Serverless execution)
  app.post(['/api/telegram/webhook', '/telegram/webhook'], async (req, res) => {
    try {
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
  app.get(['/api/admin/telegram/set-webhook', '/admin/telegram/set-webhook'], async (req, res) => {
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
  app.get(['/api/admin/telegram/webhook-info', '/admin/telegram/webhook-info'], async (req, res) => {
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
  app.get('/api/admin/telegram/status', async (req, res) => {
    const webhookInfo = await telegramBot.getWebhookInfo();
    res.json({
      running: telegramBot.isRunning(),
      tokenConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && !process.env.TELEGRAM_BOT_TOKEN.includes('placeholder')),
      activeToken: telegramBot.getActiveToken(),
      webhookInfo,
    });
  });

  // Telegram bot live configuration endpoint
  app.post(['/api/admin/telegram/config', '/admin/telegram/config'], async (req, res) => {
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
  app.get(['/api/admin/telegram/test', '/admin/telegram/test'], async (req, res) => {
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

  // Developer & Operations Portal (Password protected via jewelkaan01@gmail.com)
  app.get(['/portal', '/dashboard', '/admin', '/ops', '/developer', '/dev', '/developer-portal', '/gelistirici'], (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderDashboardHtml());
  });

  // Telegram Admin dashboard
  app.get('/telegram-admin', (req, res) => {
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

          <!-- Alt Kısım: Servis Durumları ve Hızlı Linkler -->
          <div class="card">
            <h2>🔗 Hızlı Erişim ve Servisler</h2>
            <div class="links-row">
              <a class="chip" href="/health" target="_blank">🩺 /health (Servis Sağlığı)</a>
              <a class="chip" href="/api/categories" target="_blank">📚 16 Oyun Kategorisi</a>
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
          });
        </script>
      </body>
      </html>
    `);
  });

  // Telegram Mini App / Web App Portal
  app.get('/telegram-webapp', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <title>Tavriko Telegram Portalı</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
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
                  <option value="geography">🌍 Coğrafya & Ülkeler</option>
                  <option value="history">🏛️ Tarih & Medeniyetler</option>
                  <option value="science_tech">🔬 Bilim & Teknoloji</option>
                  <option value="sports">⚽ Spor & Rekorlar</option>
                  <option value="music">🎵 Müzik & Enstrümanlar</option>
                  <option value="cinema_tv">🎬 Sinema & Dizi</option>
                  <option value="art_culture">🎨 Sanat & Kültür</option>
                  <option value="literature">📚 Edebiyat & Romanlar</option>
                  <option value="food_drink">🍕 Mutfak & Gastronomi</option>
                  <option value="nature_animals">🌿 Doğa & Canlılar</option>
                  <option value="mythology">⚡ Mitoloji & Efsaneler</option>
                  <option value="gaming">🎮 Video Oyunları</option>
                  <option value="logic_puzzles">🧩 Mantık & Zeka</option>
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
              <h2 class="card-title">📥 Manuel & JSON Soru Ekle</h2>
              <p class="card-desc">Kendi hazırladığınız soruları JSON formatında doğrudan yapıştırın veya <code>.json</code> dosyasını sürükleyip bırakın.</p>

              <div class="form-group">
                <label class="form-label">JSON Dosyası Yükle</label>
                <div class="dropzone" id="dropzone" onclick="document.getElementById('file-input').click()">
                  <div style="font-size: 28px; margin-bottom: 6px;">📁</div>
                  <div style="font-weight: 700; font-size: 14px;">.json dosyasını buraya sürükleyin</div>
                  <div style="color: var(--text-secondary); font-size: 12px; margin-top: 4px;">veya dosya seçmek için dokunun</div>
                  <input type="file" id="file-input" accept=".json,application/json" style="display: none;" onchange="handleFileSelect(event)">
                </div>
              </div>

              <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <label class="form-label" style="margin-bottom: 0;">JSON Verisi</label>
                  <div>
                    <button class="btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="pasteSampleJson()">📋 Örnek Şablon</button>
                    <button class="btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="clearJsonText()">🧹 Temizle</button>
                  </div>
                </div>
                <textarea id="json-textarea" rows="8" placeholder='[&#10;  {&#10;    "text": "Soru metni...",&#10;    "options": ["A", "B", "C", "D"],&#10;    "correctAnswerIndex": 0,&#10;    "categoryId": "geography",&#10;    "difficulty": "medium"&#10;  }&#10;]'></textarea>
              </div>

              <div class="form-group">
                <label class="form-label">Varsayılan Hedef Havuz</label>
                <select id="json-pool">
                  <option value="standard" selected>🏆 Normal Kategori Havuzu</option>
                  <option value="daily_challenge">📅 Günlük Meydan Okuma Havuzu</option>
                  <option value="custom_room">⚔️ Özel Oda / Arkadaş Düellosu</option>
                </select>
              </div>

              <div class="form-group" style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="json-autopublish" checked style="width: 18px; height: 18px; accent-color: var(--accent-primary);">
                <label for="json-autopublish" style="font-size: 13px; font-weight: 600; cursor: pointer;">Doğrudan yayınla (Onay kuyruğunu atla)</label>
              </div>

              <button class="btn-primary" id="btn-import-json" onclick="importJsonQuestions()">
                <span>🚀 Soruları Havuza Aktar</span>
              </button>

              <div class="alert-box" id="json-alert"></div>
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

          <!-- TAB 4: HAVUZ & İSTATİSTİKLER -->
          <div id="pane-stats" class="tab-pane">
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

            <div class="card">
              <h2 class="card-title">📊 Kategori Dağılımı</h2>
              <p class="card-desc">Soru havuzunun 18 kategoriye göre güncel dağılımı</p>
              <div id="categories-breakdown-list"></div>
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
            <span>Havuz</span>
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

          // Tab 2: JSON Importer
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
              "kategori": "science_tech",
              "zorluk": "orta",
              "aciklama": "Altın elementinin simgesi Latince 'Aurum'dan gelen Au'dur.",
              "havuz": "daily_challenge"
            }
          ], null, 2);

          function pasteSampleJson() {
            triggerHaptic('light');
            document.getElementById('json-textarea').value = SAMPLE_JSON_TEMPLATE;
          }

          function clearJsonText() {
            triggerHaptic('light');
            document.getElementById('json-textarea').value = '';
          }

          function handleFileSelect(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
              document.getElementById('json-textarea').value = event.target.result;
              triggerHaptic('success');
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

            if (!content) {
              alertBox.className = 'alert-box error';
              alertBox.style.display = 'block';
              alertBox.innerText = '⚠️ Lütfen JSON soru verisi girin veya dosya yükleyin.';
              return;
            }

            alertBox.style.display = 'none';

            try {
              const res = await fetch('/api/admin/questions/import-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonContent: content,
                  defaultTargetPool: pool,
                  autoPublish: autoPublish
                })
              });
              const data = await res.json();
              if (data.success && data.importedCount > 0) {
                triggerHaptic('success');
                alertBox.className = 'alert-box success';
                alertBox.style.display = 'block';
                let msg = '🎉 ' + data.importedCount + ' adet soru havuza başarıyla aktarıldı!';
                if (data.duplicateCount > 0) msg += ' (' + data.duplicateCount + ' mükerrer atlandı)';
                alertBox.innerText = msg;
                textarea.value = '';
              } else {
                throw new Error((data.errors && data.errors[0]) || 'Hiçbir geçerli soru içe aktarılamadı.');
              }
            } catch (err) {
              triggerHaptic('error');
              alertBox.className = 'alert-box error';
              alertBox.style.display = 'block';
              alertBox.innerText = '❌ Hata: ' + err.message;
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

          // Tab 4: Pool Stats
          async function loadStats() {
            try {
              const res = await fetch('/api/admin/questions/stats');
              const stats = await res.json();
              
              document.getElementById('stat-total').innerText = stats.totalQuestions || 0;
              document.getElementById('stat-published').innerText = stats.published || 0;
              document.getElementById('stat-pending').innerText = stats.pendingReview || 0;
              
              let dailyCount = 0;
              if (stats.pools) {
                dailyCount = (stats.pools.daily_challenge || 0) + (stats.pools.custom_room || 0);
              }
              document.getElementById('stat-daily').innerText = dailyCount;

              const breakdownContainer = document.getElementById('categories-breakdown-list');
              if (breakdownContainer && stats.categories) {
                const entries = Object.entries(stats.categories);
                entries.sort((a, b) => b[1] - a[1]);
                breakdownContainer.innerHTML = entries.map(([cat, cnt]) => \`
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                    <span style="font-size: 13px; font-weight: 600;">\${cat}</span>
                    <span class="tag-pill mint">\${cnt} soru</span>
                  </div>
                \`).join('');
              }
            } catch (err) {
              console.warn('Stats error:', err);
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
          activeToken: telegramBot.getActiveToken(),
        },
      },
    });
  });

  // Public Rooms API: Herkese Açık Aktif Odalar (Tavriko UI Kit Odaya Katıl ile tam uyumlu)
  app.get(['/api/trivia/rooms/public', '/api/rooms/public'], async (req, res) => {
    try {
      let rooms = roomManager.getPublicRooms();

      // Canlı oyuncu odaları yoksa veya liste az ise, UI Kit ile birebir eşleşen
      // popüler açık arena odaları sun (Kullanıcılar her an girip test edebilsin)
      if (rooms.length === 0) {
        rooms = [
          {
            code: 'T4R9A1',
            name: 'DenizPro Odası',
            hostName: 'DenizPro',
            category: 'bilim',
            categoryName: 'Bilim & Evren',
            playerCount: 1,
            maxPlayers: 4,
            questionTimeSec: 20,
            totalRounds: 7,
            penaltyForWrong: true,
            status: 'lobby',
            createdAt: Date.now() - 45000,
          },
          {
            code: 'EGE992',
            name: 'Ece Arenası',
            hostName: 'Ece',
            category: 'tarih',
            categoryName: 'Tarih & Medeniyet',
            playerCount: 2,
            maxPlayers: 4,
            questionTimeSec: 20,
            totalRounds: 14,
            penaltyForWrong: false,
            status: 'lobby',
            createdAt: Date.now() - 120000,
          },
          {
            code: 'BUR771',
            name: 'Burak Challenge',
            hostName: 'Burak',
            category: 'spor',
            categoryName: 'Spor & Rekabet',
            playerCount: 3,
            maxPlayers: 4,
            questionTimeSec: 15,
            totalRounds: 7,
            penaltyForWrong: true,
            status: 'lobby',
            createdAt: Date.now() - 30000,
          },
          {
            code: 'GLX883',
            name: 'Galaksi Turu',
            hostName: 'KaptanAstronot',
            category: 'uzay',
            categoryName: 'Uzay & Astronomi',
            playerCount: 1,
            maxPlayers: 6,
            questionTimeSec: 20,
            totalRounds: 14,
            penaltyForWrong: false,
            status: 'lobby',
            createdAt: Date.now() - 90000,
          },
        ];
      }

      res.json({
        success: true,
        count: rooms.length,
        rooms,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message, rooms: [] });
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

  // REST API Routes
  app.use('/api', logRouter);
  app.use('/api/auth', authRoutes);
  app.get('/auth/google/callback', (req, res) => {
    res.redirect('/api/auth/google/callback');
  });
  app.use('/api', triviaRoutes);
  app.use('/api/social', socialRoutes);

  // --- Cloudflare Durable Objects Internal Endpoints ---
  app.post('/api/internal/room-questions', (req, res) => {
    const internalSecret = process.env.INTERNAL_API_SECRET || 'tavriko_internal_secret_2026';
    const providedSecret = req.headers['x-internal-secret'];
    if (providedSecret && providedSecret !== internalSecret) {
      return res.status(403).json({ error: 'Yetkisiz erişim' });
    }

    const { categoryId, difficulty, count = 5 } = req.body || {};
    const questions = db.getQuestions(
      categoryId || 'general_culture',
      difficulty || 'medium',
      Math.min(20, Math.max(1, Number(count) || 5))
    );

    return res.json({ success: true, questions });
  });

  app.post('/api/internal/match-results', async (req, res) => {
    const internalSecret = process.env.INTERNAL_API_SECRET || 'tavriko_internal_secret_2026';
    const providedSecret = req.headers['x-internal-secret'];
    if (providedSecret && providedSecret !== internalSecret) {
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

      // Update XP and coins for participating registered users
      for (const rankItem of summary.rankings) {
        if (!rankItem.playerId || rankItem.playerId.startsWith('bot_') || rankItem.playerId.startsWith('guest_')) {
          continue;
        }

        const isWinner = rankItem.rank === 1;
        const xpEarned = isWinner ? 150 : Math.max(30, Math.round(rankItem.score / 10));
        const coinsEarned = isWinner ? 50 : 15;

        await db.recordGameStats(rankItem.playerId, {
          correctAnswers: Math.round(rankItem.score / 100),
          totalAnswers: summary.totalRounds,
          xpEarned,
          coinsEarned,
          bestStreak: rankItem.streak || 0,
          won: isWinner,
        });
      }

      logger.info('SOCKET', `Cloudflare Durable Objects maçı kaydedildi: ${summary.roomCode}`, {
        mode: summary.mode,
        playersCount: summary.rankings.length,
        winner: summary.podium?.first?.displayName,
      });

      return res.json({ success: true });
    } catch (err: any) {
      logger.error('SOCKET', `Maç sonucu kaydetme hatası: ${err.message}`, err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  const close = () => {
    matchmaker.destroy();
    roomManager.cleanupAll();
  };

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
