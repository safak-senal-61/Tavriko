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
      const defaultUrl = 'https://tavriko-app.vercel.app/api/telegram/webhook';
      const webhookUrl = (req.query.url as string) || defaultUrl;
      const result = await telegramBot.setWebhook(webhookUrl);
      return res.json(result);
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
                <button type="button" class="btn" id="btn-force-webhook" onclick="forceSetWebhook()" style="margin-top: 8px; background: #232B42; border: 1px solid #3B4B75;">
                  🔄 Webhook'u Tavriko Vercel'e Bağla
                </button>
                <button type="button" class="btn" id="btn-test-bot" onclick="testTelegramBot()" style="margin-top: 8px; background: rgba(255,255,255,0.08); border: 1px solid #2B3754;">
                  🧪 Bot & Webhook Bağlantısını Test Et
                </button>
              </form>
              <div id="msg-box"></div>
              <div id="bot-details-box" style="display: none; margin-top: 14px; background: rgba(0, 136, 204, 0.1); border: 1px solid rgba(0, 136, 204, 0.3); border-radius: 12px; padding: 14px; font-size: 13px;">
                <div style="font-weight: 700; color: #38BDF8; margin-bottom: 6px; font-size: 14px;" id="bot-username-display">🤖 Bot Bilgisi</div>
                <div style="color: #CBD5E1; font-size: 12px; margin-bottom: 4px;" id="bot-webhook-display">Webhook: https://tavriko-app.vercel.app/api/telegram/webhook</div>
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

          async function forceSetWebhook() {
            const btn = document.getElementById('btn-force-webhook');
            const msg = document.getElementById('msg-box');
            btn.disabled = true;
            btn.innerText = 'Webhook Kuruluyor...';
            msg.style.display = 'none';

            try {
              const res = await fetch('/api/admin/telegram/set-webhook');
              const data = await res.json();
              msg.style.display = 'block';
              if (data.success) {
                msg.style.color = '#10B981';
                msg.innerText = '✅ ' + data.message;
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
              btn.disabled = false;
              btn.innerText = '🔄 Webhook\'u Tavriko Vercel\'e Bağla';
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
