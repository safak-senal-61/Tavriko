"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// @ts-ignore
const qrcode_1 = __importDefault(require("qrcode"));
const socket_io_1 = require("socket.io");
const prismaClient_1 = require("./db/prismaClient");
const GameRoomManager_1 = require("./engine/GameRoomManager");
const Matchmaker_1 = require("./engine/Matchmaker");
const socketHandler_1 = require("./socket/socketHandler");
const telegramBot_1 = require("./telegram/telegramBot");
const supabaseClient_1 = require("./db/supabaseClient");
const redisClient_1 = require("./cache/redisClient");
const logger_1 = require("./utils/logger");
const logRoutes_1 = require("./routes/logRoutes");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const triviaRoutes_1 = __importDefault(require("./routes/triviaRoutes"));
const socialRoutes_1 = __importDefault(require("./routes/socialRoutes"));
function getLocalIpAddress() {
    const interfaces = os_1.default.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name] || []) {
            if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('127.')) {
                return net.address;
            }
        }
    }
    return 'tavriko-app.vercel.app';
}
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    // Global HTTP Request & Error Logger Middleware
    app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            const lvl = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
            const cat = req.path.includes('/auth') ? 'AUTH' : 'HTTP';
            if (req.path === '/favicon.ico' ||
                req.path === '/api/logs' ||
                req.path === '/api/logs/stream' ||
                req.path.startsWith('/qr')) {
                return;
            }
            logger_1.logger.log(cat, lvl, `${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`, {
                ip: req.ip,
                query: Object.keys(req.query).length ? req.query : undefined,
                body: req.method !== 'GET' && Object.keys(req.body || {}).length ? req.body : undefined,
            });
        });
        next();
    });
    const httpServer = http_1.default.createServer(app);
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });
    // Wire up authoritative room manager with DB question provider
    const roomManager = new GameRoomManager_1.GameRoomManager((category, difficulty, count) => {
        return prismaClient_1.db.getQuestions(category, difficulty, count);
    });
    const matchmaker = new Matchmaker_1.Matchmaker(roomManager);
    (0, socketHandler_1.setupSocketHandlers)(io, roomManager, matchmaker);
    // Initialize Telegram Bot & Admin Approval Service
    const telegramBot = new telegramBot_1.TelegramBotService({ db: prismaClient_1.db });
    // Dynamic QR Code endpoint (Default to Cloud Web URL for 24/7 direct play)
    app.get('/qr', async (req, res) => {
        try {
            const host = req.get('host') || 'tavriko-app.vercel.app';
            const proto = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
            const defaultUrl = `${proto}://${host}/app`;
            const targetUrl = req.query.url ||
                (req.query.ip ? `exp://${req.query.ip}:8081` : defaultUrl);
            const buffer = await qrcode_1.default.toBuffer(targetUrl, {
                width: 350,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff',
                },
            });
            res.type('image/png').send(buffer);
        }
        catch (err) {
            res.status(500).send('QR code generation failed: ' + err.message);
        }
    });
    // Telegram bot status endpoint
    app.get('/api/admin/telegram/status', (req, res) => {
        res.json({
            running: telegramBot.isRunning(),
            tokenConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && !process.env.TELEGRAM_BOT_TOKEN.includes('placeholder')),
            activeToken: telegramBot.getActiveToken(),
        });
    });
    // Telegram bot live configuration endpoint
    app.post('/api/admin/telegram/config', async (req, res) => {
        try {
            const { token, adminIds } = req.body;
            if (!token || typeof token !== 'string' || token.trim().length < 15) {
                return res.status(400).json({
                    success: false,
                    message: 'Geçersiz Telegram Bot Token. Lütfen @BotFather tarafından verilen tam token değerini girin.',
                });
            }
            let parsedAdminIds;
            if (adminIds) {
                if (Array.isArray(adminIds)) {
                    parsedAdminIds = adminIds.map((id) => String(id).trim()).filter(Boolean);
                }
                else {
                    parsedAdminIds = String(adminIds)
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                }
            }
            const result = await telegramBot.configure(token.trim(), parsedAdminIds);
            return res.json(result);
        }
        catch (err) {
            return res.status(500).json({
                success: false,
                message: 'Telegram bot konfigürasyon hatası: ' + err.message,
            });
        }
    });
    // Static Web App Serving (client/dist)
    const clientDistCandidates = [
        path_1.default.resolve(__dirname, '../../client/dist'),
        path_1.default.resolve(__dirname, '../client/dist'),
        path_1.default.resolve(process.cwd(), 'client/dist'),
        path_1.default.resolve(process.cwd(), 'dist'),
    ];
    const clientDistDir = clientDistCandidates.find((dir) => fs_1.default.existsSync(path_1.default.join(dir, 'index.html')));
    if (clientDistDir) {
        // Helper to send index.html with no-cache headers so browsers NEVER get stuck on old bundle hashes
        const sendIndexHtml = (res) => {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.sendFile(path_1.default.join(clientDistDir, 'index.html'));
        };
        // 1. Dynamic fallback for any requested web JS bundle (resolves cached browser requests)
        app.get(['/_expo/static/js/web/:filename', '/app/_expo/static/js/web/:filename'], (req, res) => {
            const filename = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
            const exactPath = path_1.default.join(clientDistDir, '_expo/static/js/web', filename);
            if (fs_1.default.existsSync(exactPath)) {
                res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
                return res.sendFile(exactPath);
            }
            // If exact hash not found, serve the active bundle so cached clients still work flawlessly
            const webJsDir = path_1.default.join(clientDistDir, '_expo/static/js/web');
            if (fs_1.default.existsSync(webJsDir)) {
                const files = fs_1.default.readdirSync(webJsDir).filter((f) => f.endsWith('.js'));
                if (files.length > 0) {
                    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
                    return res.sendFile(path_1.default.join(webJsDir, files[0]));
                }
            }
            res.status(404).type('text/plain').send('Bundle not found');
        });
        // 2. Relative path fallback if browser requests /app/_expo/... or /app/assets/...
        app.use('/app/_expo', express_1.default.static(path_1.default.join(clientDistDir, '_expo')));
        app.use('/app/assets', express_1.default.static(path_1.default.join(clientDistDir, 'assets')));
        // 3. Root static assets
        app.use('/_expo', express_1.default.static(path_1.default.join(clientDistDir, '_expo')));
        app.use('/assets', express_1.default.static(path_1.default.join(clientDistDir, 'assets')));
        app.get('/favicon.ico', (req, res) => {
            res.sendFile(path_1.default.join(clientDistDir, 'favicon.ico'));
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
    }
    else {
        // Fallback if client dist is not yet available
        app.get('/', (req, res) => {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send((0, logRoutes_1.renderDashboardHtml)());
        });
    }
    // Developer & Operations Portal (Password protected via jewelkaan01@gmail.com)
    app.get(['/portal', '/dashboard', '/admin', '/ops'], (req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send((0, logRoutes_1.renderDashboardHtml)());
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
                <span id="bot-status-pill" class="badge" style="margin: 0 0 0 auto; padding: 4px 10px; font-size: 11px; ${isBotRunning ? 'background: rgba(16,185,129,0.15); color: #10B981;' : 'background: rgba(245,158,11,0.15); color: #F59E0B;'}">
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
              </form>
              <div id="msg-box"></div>
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
        </script>
      </body>
      </html>
    `);
    });
    // Health check
    app.get('/health', async (req, res) => {
        const [supabaseHealth, prismaHealth] = await Promise.all([
            supabaseClient_1.supabaseService.checkHealth(),
            prismaClient_1.prisma.checkHealth(),
        ]);
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            roomsCount: roomManager.getActiveRoomsCount(),
            stats: prismaClient_1.db.getReviewStats(),
            services: {
                upstashRedis: {
                    available: redisClient_1.cacheService.isAvailable(),
                    mode: redisClient_1.cacheService.isAvailable() ? 'upstash_rest' : 'in_memory_simulation',
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
            const result = await prismaClient_1.db.pushAllDataViaPrismaToSupabase();
            const health = await prismaClient_1.prisma.checkHealth();
            res.json({
                success: true,
                orm: 'Prisma ORM v6.19.3',
                supabaseUrl: process.env.SUPABASE_URL || 'https://rjvbgofzsfescnfohzgu.supabase.co',
                ...result,
                health,
            });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    // REST API Routes
    app.use('/api', logRoutes_1.logRouter);
    app.use('/api/auth', authRoutes_1.default);
    app.get('/auth/google/callback', (req, res) => {
        res.redirect('/api/auth/google/callback');
    });
    app.use('/api', triviaRoutes_1.default);
    app.use('/api/social', socialRoutes_1.default);
    // --- Cloudflare Durable Objects Internal Endpoints ---
    app.post('/api/internal/room-questions', (req, res) => {
        const internalSecret = process.env.INTERNAL_API_SECRET || 'tavriko_internal_secret_2026';
        const providedSecret = req.headers['x-internal-secret'];
        if (providedSecret && providedSecret !== internalSecret) {
            return res.status(403).json({ error: 'Yetkisiz erişim' });
        }
        const { categoryId, difficulty, count = 5 } = req.body || {};
        const questions = prismaClient_1.db.getQuestions(categoryId || 'general_culture', difficulty || 'medium', Math.min(20, Math.max(1, Number(count) || 5)));
        return res.json({ success: true, questions });
    });
    app.post('/api/internal/match-results', async (req, res) => {
        const internalSecret = process.env.INTERNAL_API_SECRET || 'tavriko_internal_secret_2026';
        const providedSecret = req.headers['x-internal-secret'];
        if (providedSecret && providedSecret !== internalSecret) {
            return res.status(403).json({ error: 'Yetkisiz erişim' });
        }
        try {
            const summary = req.body;
            if (!summary || !summary.roomCode || !Array.isArray(summary.rankings)) {
                return res.status(400).json({ error: 'Geçersiz maç özeti' });
            }
            // Record match history in Prisma
            await prismaClient_1.db.matchHistory.create({
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
                await prismaClient_1.db.recordGameStats(rankItem.playerId, {
                    correctAnswers: Math.round(rankItem.score / 100),
                    totalAnswers: summary.totalRounds,
                    xpEarned,
                    coinsEarned,
                    bestStreak: rankItem.streak || 0,
                    won: isWinner,
                });
            }
            logger_1.logger.info('SOCKET', `Cloudflare Durable Objects maçı kaydedildi: ${summary.roomCode}`, {
                mode: summary.mode,
                playersCount: summary.rankings.length,
                winner: summary.podium?.first?.displayName,
            });
            return res.json({ success: true });
        }
        catch (err) {
            logger_1.logger.error('SOCKET', `Maç sonucu kaydetme hatası: ${err.message}`, err);
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
        const proxy3000 = http_1.default.createServer((req, res) => {
            const localIp = getLocalIpAddress();
            res.writeHead(302, {
                Location: `http://${localIp}:4000/api/auth/google/callback`,
            });
            res.end();
        });
        proxy3000.on('error', () => { });
        proxy3000.listen(3000, () => {
            console.log('[Trivia Server] Port 3000 redirect listener active for Supabase OAuth');
        });
    }
    catch { }
}
