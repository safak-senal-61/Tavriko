import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { logger, LogEntry } from '../utils/logger';
import { db } from '../db/prismaClient';
import { supabaseService } from '../db/supabaseClient';
import { getPendingGoogleSessions } from './authRoutes';
import { requirePortalAdmin, rateLimit } from '../middleware/security';

const JWT_SECRET = process.env.JWT_SECRET;
const PORTAL_ADMIN_EMAIL = process.env.PORTAL_ADMIN_EMAIL;
const PORTAL_ADMIN_PASSWORD = process.env.PORTAL_ADMIN_PASSWORD;

export const logRouter = Router();

logRouter.post('/portal/login', rateLimit({ keyPrefix: 'portal-login', windowMs: 15 * 60 * 1000, max: 5 }), (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!JWT_SECRET || !PORTAL_ADMIN_EMAIL || !PORTAL_ADMIN_PASSWORD) {
    res.status(503).json({ success: false, error: 'Yönetici girişi sunucu ortamında yapılandırılmamış.' });
    return;
  }
  if (email === PORTAL_ADMIN_EMAIL && password === PORTAL_ADMIN_PASSWORD) {
    const token = jwt.sign(
      { email: PORTAL_ADMIN_EMAIL, role: 'portal_super_admin' },
      JWT_SECRET,
      { expiresIn: '15m', algorithm: 'HS256' }
    );
    logger.success('AUTH', `Portal Yöneticisi Giriş Yaptı: ${email}`);
    res.json({ success: true, token, email: PORTAL_ADMIN_EMAIL });
  } else {
    logger.warn('AUTH', `Başarısız portal giriş denemesi: ${email}`);
    res.status(401).json({ success: false, error: 'Hatalı e-posta adresi veya yönetici şifresi!' });
  }
});

logRouter.get('/portal/verify', rateLimit({ keyPrefix: 'portal-verify', windowMs: 60 * 1000, max: 30 }), (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ success: false, error: 'Oturum tokeni eksik' });
    return;
  }
  if (!JWT_SECRET || !PORTAL_ADMIN_EMAIL) {
    res.status(503).json({ success: false, error: 'Yönetici oturumu yapılandırılmamış.' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as any;
    if (decoded && decoded.role === 'portal_super_admin' && decoded.email === PORTAL_ADMIN_EMAIL) {
      res.json({ success: true, email: decoded.email });
      return;
    }
  } catch {}
  res.status(401).json({ success: false, error: 'Geçersiz veya süresi dolmuş oturum' });
});

logRouter.get('/logs', requirePortalAdmin, (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 200;
  res.json({ logs: logger.getRecentLogs(limit) });
});

logRouter.get('/logs/stream', requirePortalAdmin, (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  logger.addSseClient(res);
  logger.info('SYSTEM', 'Yeni bir istemci SSE log akışına bağlandı');
});

logRouter.post('/logs/ingest', rateLimit({ keyPrefix: 'client-log-ingest', windowMs: 60 * 1000, max: 30 }), (req: Request, res: Response) => {
  const { level = 'INFO', category = 'CLIENT', message } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'message zorunludur' });
    return;
  }
  const allowedLevels = new Set(['INFO', 'WARN', 'ERROR', 'SUCCESS', 'DEBUG']);
  const safeLevel = (allowedLevels.has(String(level).toUpperCase()) ? String(level).toUpperCase() : 'INFO') as LogEntry['level'];
  const normalizedCategory = typeof category === 'string' ? category.toUpperCase() : 'CLIENT';
  const safeCategory = (['HTTP', 'AUTH', 'GOOGLE', 'DB', 'PRISMA', 'SOCKET', 'CLIENT', 'SYSTEM', 'TELEGRAM'].includes(normalizedCategory)
    ? normalizedCategory
    : 'CLIENT') as LogEntry['category'];
  // Client-supplied details are intentionally omitted: they can contain tokens,
  // personal data or arbitrarily large objects.
  logger.log(safeCategory, safeLevel, `[MOBİL] ${message.slice(0, 500)}`);
  res.json({ success: true });
});

logRouter.post('/logs/clear', requirePortalAdmin, (req: Request, res: Response) => {
  logger.clear();
  res.json({ success: true });
});

logRouter.get('/logs/stats', requirePortalAdmin, async (req: Request, res: Response) => {
  try {
    let pgUsers = 0;
    let recentUsers: any[] = [];
    try {
      pgUsers = await db.rawClient.user.count();
      recentUsers = await db.rawClient.user.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          displayName: true,
          friendCode: true,
          level: true,
          coins: true,
          gems: true,
          rankTitle: true,
          createdAt: true,
        },
      });
    } catch (e: any) {
      recentUsers = [];
    }

    const sessions = getPendingGoogleSessions ? getPendingGoogleSessions() : [];

    res.json({
      uptimeSeconds: Math.floor(process.uptime()),
      postgresUsersCount: pgUsers,
      recentUsers,
      activeGoogleSessions: sessions,
      supabaseConfigured: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

logRouter.post('/logs/simulate-google', requirePortalAdmin, async (req: Request, res: Response) => {
  try {
    const { email, displayName } = req.body;
    if (!email) {
      res.status(400).json({ error: 'email zorunludur' });
      return;
    }
    logger.info('GOOGLE', `Simülasyon Google girişi başlatıldı: ${email}`);
    const result = await db.loginOrRegisterGoogle({
      email,
      displayName: displayName || email.split('@')[0],
      fullName: displayName || email.split('@')[0],
      avatarUrl: 'av1',
      googleId: 'sim_' + Date.now(),
    });
    logger.success('GOOGLE', `Simülasyon başarılı, kullanıcı PostgreSQL'e yazıldı: ${result.user.email} (${result.user.displayName})`, {
      userId: result.user.id,
      friendCode: result.user.friendCode,
      level: result.user.level,
      coins: result.user.coins,
    });
    res.json({ success: true, user: result.user, token: result.token });
  } catch (err: any) {
    logger.error('GOOGLE', `Simülasyon hatası: ${err.message}`, err);
    res.status(500).json({ error: err.message });
  }
});

export function renderDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>Tavriko & TriviaVerse - Geliştirici & Canlı Operasyon Portalı</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎮</text></svg>">
  <style>
    :root {
      --bg: #0B0818;
      --card: #150F2C;
      --card-border: #2D2254;
      --card-hover: #1E153D;
      --text: #F8FAFC;
      --text-muted: #94A3B8;
      --gold: #FFC43D;
      --gold-dark: #B8860B;
      --purple: #7A3FE0;
      --purple-light: #A78BFA;
      --cyan: #06B6D4;
      --green: #10B981;
      --red: #EF4444;
      --amber: #F59E0B;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      padding: 0;
      line-height: 1.5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: rgba(21, 15, 44, 0.95);
      border-bottom: 1px solid var(--card-border);
      backdrop-filter: blur(10px);
      position: sticky;
      top: 0;
      z-index: 100;
      padding: 14px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 900;
      background: linear-gradient(135deg, #FFC43D 0%, #FF9F0A 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.5px;
    }
    .env-tag {
      font-size: 11px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: var(--green);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .pulse-dot {
      width: 7px;
      height: 7px;
      background: var(--green);
      border-radius: 50%;
      animation: pulse 1.6s infinite;
    }
    @keyframes pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.3; transform: scale(1.3); }
      100% { opacity: 1; transform: scale(1); }
    }
    .nav-tabs {
      display: flex;
      gap: 6px;
      background: #0E0A1E;
      padding: 4px;
      border-radius: 12px;
      border: 1px solid var(--card-border);
    }
    .nav-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 700;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }
    .nav-btn:hover {
      color: var(--text);
      background: rgba(255, 255, 255, 0.05);
    }
    .nav-btn.active {
      background: var(--purple);
      color: #FFFFFF;
      box-shadow: 0 4px 12px rgba(122, 63, 224, 0.35);
    }
    main {
      flex: 1;
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
    }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .btn {
      background: #251B47;
      border: 1px solid var(--card-border);
      color: var(--text);
      font-size: 13px;
      font-weight: 700;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.18s ease;
    }
    .btn:hover {
      background: #362866;
      border-color: rgba(255, 255, 255, 0.2);
    }
    .btn-gold {
      background: linear-gradient(135deg, #FFC43D 0%, #FF9F0A 100%);
      color: #0B0818;
      border: none;
      font-weight: 800;
      box-shadow: 0 2px 8px rgba(255, 196, 61, 0.25);
    }
    .btn-gold:hover { filter: brightness(1.1); transform: translateY(-1px); }
    .btn-red {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.4);
      color: #FCA5A5;
    }
    .btn-red:hover { background: rgba(239, 68, 68, 0.28); }
    .btn-cyan {
      background: rgba(6, 182, 212, 0.15);
      border-color: rgba(6, 182, 212, 0.4);
      color: var(--cyan);
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 16px 20px;
      position: relative;
      overflow: hidden;
    }
    .kpi-card::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--purple);
    }
    .kpi-card.gold::after { background: var(--gold); }
    .kpi-card.red::after { background: var(--red); }
    .kpi-card.green::after { background: var(--green); }
    .kpi-title {
      font-size: 12px;
      text-transform: uppercase;
      font-weight: 800;
      color: var(--text-muted);
      letter-spacing: 0.5px;
    }
    .kpi-val {
      font-size: 28px;
      font-weight: 900;
      color: #FFFFFF;
      margin-top: 4px;
    }

    /* Expo QR section */
    .expo-container {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 24px;
      align-items: start;
    }
    @media (max-width: 900px) {
      .expo-container { grid-template-columns: 1fr; }
    }
    .qr-card {
      background: var(--card);
      border: 1.5px solid var(--card-border);
      border-radius: 20px;
      padding: 24px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    }
    .qr-box {
      width: 280px;
      height: 280px;
      margin: 16px auto;
      border-radius: 16px;
      background: #FFFFFF;
      padding: 12px;
      box-shadow: 0 0 20px rgba(255, 196, 61, 0.25);
    }
    .qr-box img {
      width: 100%;
      height: 100%;
      display: block;
    }
    .guide-card {
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 24px;
    }
    .guide-step {
      display: flex;
      gap: 14px;
      margin-bottom: 18px;
    }
    .step-num {
      width: 32px;
      height: 32px;
      border-radius: 16px;
      background: var(--purple);
      color: #FFFFFF;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    /* Logs view */
    .logs-wrapper {
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: 18px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: calc(100vh - 280px);
      min-height: 480px;
    }
    .logs-toolbar {
      padding: 14px 18px;
      background: rgba(0, 0, 0, 0.25);
      border-bottom: 1px solid var(--card-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    .search-input {
      background: #0D081D;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 8px 14px;
      color: var(--text);
      font-size: 13px;
      width: 260px;
      outline: none;
    }
    .search-input:focus { border-color: var(--gold); }
    .filter-pills {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .pill {
      font-size: 11.5px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
      background: #1B1339;
      color: var(--text-muted);
      border: 1px solid var(--card-border);
    }
    .pill.active {
      background: var(--gold);
      color: #0B0818;
      border-color: var(--gold);
    }
    .logs-scroll {
      flex: 1;
      overflow-y: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12.5px;
    }
    .log-item {
      padding: 10px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: background 0.15s;
    }
    .log-item:hover { background: rgba(255, 255, 255, 0.03); }
    .log-header-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .tag {
      font-size: 11px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .tag-INFO { background: rgba(59, 130, 246, 0.2); color: #60A5FA; }
    .tag-SUCCESS { background: rgba(16, 185, 129, 0.2); color: #34D399; }
    .tag-WARN { background: rgba(245, 158, 11, 0.2); color: #FBBF24; }
    .tag-ERROR { background: rgba(239, 68, 68, 0.25); color: #F87171; font-weight: 900; }
    .tag-cat { background: rgba(255, 255, 255, 0.08); color: var(--gold); }
    .log-time { color: var(--text-muted); font-size: 12px; }
    .log-text { color: #FFFFFF; font-weight: 600; flex: 1; word-break: break-all; }
    .log-json {
      background: #090514;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 10px 12px;
      color: #C7D2FE;
      font-size: 11.5px;
      white-space: pre-wrap;
      max-height: 250px;
      overflow-y: auto;
    }

    /* API Docs */
    .api-endpoint-card {
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 18px;
      transition: border-color 0.2s;
    }
    .api-endpoint-card:hover { border-color: rgba(255, 196, 61, 0.4); }
    .api-header-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .method-badge {
      font-size: 12px;
      font-weight: 900;
      padding: 4px 10px;
      border-radius: 6px;
    }
    .method-POST { background: #10B981; color: #052E16; }
    .method-GET { background: #3B82F6; color: #1E3A8A; }
    .api-path {
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-size: 15px;
      font-weight: 800;
      color: #FFFFFF;
    }
    .api-desc {
      color: var(--text-muted);
      font-size: 13.5px;
      margin-bottom: 14px;
    }
    .api-box-label {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 6px;
    }
    .api-code-editor {
      width: 100%;
      background: #090514;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 10px;
      color: #A5B4FC;
      font-family: monospace;
      font-size: 12px;
      resize: vertical;
      min-height: 70px;
      margin-bottom: 12px;
    }
    .response-view {
      background: #070311;
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 8px;
      padding: 12px;
      font-family: monospace;
      font-size: 12px;
      color: #6EE7B7;
      margin-top: 10px;
      max-height: 250px;
      overflow-y: auto;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <!-- High Security Gatekeeper Authentication Overlay -->
  <div id="portalAuthOverlay" style="display: flex; position: fixed; inset: 0; background: rgba(11, 8, 24, 0.98); backdrop-filter: blur(16px); z-index: 99999; justify-content: center; align-items: center; padding: 20px;">
    <div style="background: #150F2C; border: 1.5px solid #2D2254; box-shadow: 0 25px 60px rgba(0,0,0,0.7); border-radius: 22px; max-width: 440px; width: 100%; padding: 36px 30px; text-align: center;">
      <div style="font-size: 46px; margin-bottom: 10px;">🛡️</div>
      <div style="font-size: 20px; font-weight: 900; background: linear-gradient(135deg, #FFC43D 0%, #FF9F0A 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 6px;">
        TAVRİKO DEVELOPER & OPS PORTAL
      </div>
      <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 20px;">
        Express · Prisma PostgreSQL · Supabase Cloud · Redis · Vercel
      </div>
      <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 10px; padding: 10px 14px; margin-bottom: 22px; font-size: 12px; color: #FCA5A5; display: flex; align-items: center; gap: 8px; text-align: left;">
        <span style="font-size: 16px;">🔒</span>
        <span>Bu yönetim ve log portalı yalnızca yetkili sistem yöneticilerine açıktır.</span>
      </div>
      <form id="portalLoginForm" onsubmit="handlePortalLogin(event)" style="display: flex; flex-direction: column; gap: 14px; text-align: left;">
        <div>
          <label style="font-size: 11px; font-weight: 800; color: #E2E8F0; text-transform: uppercase;">Yönetici E-Posta</label>
          <input type="email" id="portalEmailInput" required placeholder="jewelkaan01@gmail.com" style="width: 100%; margin-top: 5px; padding: 11px 14px; background: #0D081D; border: 1px solid var(--card-border); border-radius: 8px; color: #FFF; font-size: 14px; outline: none;" />
        </div>
        <div>
          <label style="font-size: 11px; font-weight: 800; color: #E2E8F0; text-transform: uppercase;">Yönetici Şifresi</label>
          <input type="password" id="portalPasswordInput" required placeholder="••••••••••••" style="width: 100%; margin-top: 5px; padding: 11px 14px; background: #0D081D; border: 1px solid var(--card-border); border-radius: 8px; color: #FFF; font-size: 14px; outline: none;" />
        </div>
        <div id="portalAuthError" style="display: none; background: rgba(239,68,68,0.2); border: 1px solid #EF4444; color: #FCA5A5; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 700;"></div>
        <button type="submit" id="portalLoginSubmitBtn" class="btn btn-gold" style="justify-content: center; padding: 13px; font-size: 14px; margin-top: 6px;">
          ⚡ SİSTEME GİRİŞ YAP
        </button>
      </form>
    </div>
  </div>

  <header>
    <div class="brand-wrap">
      <div style="font-size:26px;">🎮</div>
      <div>
        <div class="brand-title">TAVRİKO DEVELOPER & OPS PORTAL</div>
        <div style="font-size:11.5px; color:var(--text-muted);">Express · Prisma PostgreSQL · Supabase Cloud · Redis · Vercel</div>
      </div>
      <div class="env-tag"><div class="pulse-dot"></div> CANLI AKIŞ AKTİF</div>
    </div>

    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
      <div class="nav-tabs">
        <button class="nav-btn active" onclick="switchTab('tab-game')">🎮 Canlı Web Oyunu & Simülatör</button>
        <button class="nav-btn" onclick="switchTab('tab-expo')">📱 Mobil & Bulut QR Kod</button>
        <button class="nav-btn" onclick="switchTab('tab-api')">📖 API Dökümanı & Test</button>
        <button class="nav-btn" onclick="switchTab('tab-logs')">📜 Canlı Loglar & Hatalar</button>
        <button class="nav-btn" onclick="switchTab('tab-db')">👥 Kullanıcılar & Veritabanı</button>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <a href="/app" target="_blank" class="btn btn-gold" style="text-decoration:none; padding: 7px 14px; font-size: 12px; font-weight:800;">
          🚀 Tam Ekran Oyna (/app)
        </a>
        <div style="background: rgba(255,196,61,0.12); border: 1px solid rgba(255,196,61,0.3); border-radius: 999px; padding: 4px 12px; font-size: 12px; color: var(--gold); font-weight: 700;">
          👤 jewelkaan01@gmail.com
        </div>
        <button class="btn btn-red" onclick="handlePortalLogout()" style="padding: 6px 12px; font-size: 12px;">🔒 Çıkış</button>
      </div>
    </div>
  </header>

  <main>
    <!-- KPI METRICS -->
    <div class="kpi-grid">
      <div class="kpi-card gold">
        <div class="kpi-title">PostgreSQL Gerçek Kullanıcı</div>
        <div class="kpi-val" id="kpiUsers">-</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Toplam İşlem & Log</div>
        <div class="kpi-val" id="kpiTotalLogs">0</div>
      </div>
      <div class="kpi-card red">
        <div class="kpi-title">Hatalar (Errors)</div>
        <div class="kpi-val" id="kpiErrors" style="color:#F87171;">0</div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-title">Sunucu Uptime</div>
        <div class="kpi-val" id="kpiUptime">-</div>
      </div>
    </div>

    <!-- TAB 1: LIVE GAME SIMULATOR -->
    <div id="tab-game" class="tab-content active">
      <div style="display: grid; grid-template-columns: 400px 1fr; gap: 24px; align-items: start;">
        
        <!-- Mobile Phone Device Frame -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
          <div style="position: relative; width: 380px; height: 740px; background: #0B0818; border: 12px solid #231942; border-radius: 44px; box-shadow: 0 25px 60px rgba(0,0,0,0.85), 0 0 40px rgba(108,92,231,0.3); overflow: hidden;">
            <!-- Notch / Speaker bar -->
            <div style="position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 110px; height: 22px; background: #150F2C; border-radius: 20px; z-index: 20; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <div style="width: 8px; height: 8px; background: #2A1F4E; border-radius: 50%;"></div>
              <div style="width: 36px; height: 4px; background: #2A1F4E; border-radius: 2px;"></div>
            </div>
            <!-- Interactive Live Game IFrame -->
            <iframe id="gameSimulatorIframe" src="/app" style="width: 100%; height: 100%; border: none; background: #12052C;"></iframe>
          </div>

          <div style="display: flex; gap: 8px; width: 380px;">
            <button class="btn btn-gold" style="flex: 1; justify-content: center;" onclick="refreshSimulator()">
              🔄 Simülatörü Yenile
            </button>
            <a href="/app" target="_blank" class="btn btn-cyan" style="flex: 1; justify-content: center; text-decoration: none;">
              ↗️ Tam Ekranda Aç
            </a>
          </div>
        </div>

        <!-- Info & Live Features Grid -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="guide-card">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
              <span style="font-size: 28px;">🎮</span>
              <div>
                <h2 style="font-size: 19px; color: #FFFFFF; margin: 0;">Tavriko Canlı Web & Mobil Deneyimi</h2>
                <p style="font-size: 12.5px; color: var(--text-muted); margin: 0;">Tamamen bulutta (Vercel Serverless + Supabase PostgreSQL) çalışan 7/24 kesintisiz oyun motoru</p>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 14px;">
              <div style="background: #0D081D; border: 1px solid var(--card-border); border-radius: 12px; padding: 12px;">
                <div style="font-size: 11px; font-weight: 800; color: var(--gold); text-transform: uppercase;">Bulut Web Adresi</div>
                <div style="font-size: 13px; color: #5ADBB5; font-family: monospace; margin-top: 4px; word-break: break-all;" id="cloudLiveGameUrl">https://tavriko-app.vercel.app/app</div>
              </div>
              <div style="background: #0D081D; border: 1px solid var(--card-border); border-radius: 12px; padding: 12px;">
                <div style="font-size: 11px; font-weight: 800; color: var(--gold); text-transform: uppercase;">Bulut Durumu</div>
                <div style="font-size: 13px; color: #10B981; font-weight: 700; margin-top: 4px;">🟢 7/24 Kesintisiz Yayında</div>
              </div>
              <div style="background: #0D081D; border: 1px solid var(--card-border); border-radius: 12px; padding: 12px;">
                <div style="font-size: 11px; font-weight: 800; color: var(--gold); text-transform: uppercase;">Veritabanı Katmanı</div>
                <div style="font-size: 13px; color: #A78BFA; font-weight: 700; margin-top: 4px;">⚡ Supabase PostgreSQL + Prisma</div>
              </div>
              <div style="background: #0D081D; border: 1px solid var(--card-border); border-radius: 12px; padding: 12px;">
                <div style="font-size: 11px; font-weight: 800; color: var(--gold); text-transform: uppercase;">Sıfır Yerel Bağımlılık</div>
                <div style="font-size: 13px; color: #38BDF8; font-weight: 700; margin-top: 4px;">🚀 Localhost / Wi-Fi Zorunluluğu Yok</div>
              </div>
            </div>
          </div>

          <div class="guide-card">
            <h3 style="font-size: 16px; color: var(--gold); margin-bottom: 10px;">🌟 Neler Test Edebilirsiniz?</h3>
            <ul style="font-size: 13px; color: #CBD5E1; line-height: 1.7; padding-left: 20px; margin: 0;">
              <li><b>Kayıt & Giriş:</b> Yeni e-posta ile kayıt olabilir, misafir olarak giriş yapabilir veya mevcut hesabınıza erişebilirsiniz.</li>
              <li><b>1v1 Canlı Düello & Hızlı Eşleşme:</b> Çevrimiçi botlar veya diğer oyuncularla eşleşip gerçek zamanlı soru cevaplayabilirsiniz.</li>
              <li><b>Günlük Meydan Okuma & Seri (Streak):</b> Seri kazanımını artırabilir, 5 soruda 4 doğru hedefini test edebilirsiniz.</li>
              <li><b>Özel Oda:</b> 6 haneli oda kodu oluşturup arkadaşlarınızla paylaşabilirsiniz.</li>
              <li><b>Mağaza & Sanal Ödeme:</b> Altın ve elmas paketlerini seçip kredi kartı ödeme ekranını deneyimleyebilirsiniz.</li>
              <li><b>Canlı Log Senkronizasyonu:</b> Yaptığınız her işlem anlık olarak <i>"Canlı Loglar & Hatalar"</i> sekmesine işlenir.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: MOBILE & CLOUD QR CODE -->
    <div id="tab-expo" class="tab-content">
      <div class="expo-container">
        <div class="qr-card">
          <h2 style="font-size:18px; color:var(--gold); margin-bottom:4px;">Bulut Mobil QR Kodu</h2>
          <p style="font-size:12.5px; color:var(--text-muted); margin-bottom:12px;">Telefon kameranızla tarayın, kurulum yapmadan mobilde açın</p>
          
          <div class="qr-box">
            <img id="qrImg" src="/qr" alt="Tavriko Mobil QR Kodu">
          </div>

          <div style="margin-top:14px; display:flex; flex-direction:column; gap:8px;">
            <a id="openCloudWebLink" href="/app" target="_blank" class="btn btn-gold" style="justify-content:center; text-decoration:none;">
              🚀 Mobilde / Tarayıcıda Doğrudan Aç
            </a>
            <button class="btn btn-cyan" style="justify-content:center;" onclick="copyCloudGameLink()">
              📋 Bulut Bağlantısını Kopyala (<span id="btnCloudUrlText">https://tavriko-app.vercel.app/app</span>)
            </button>
          </div>

          <details style="margin-top:18px; text-align:left; background:rgba(0,0,0,0.3); border-radius:8px; padding:10px 12px; border:1px solid rgba(255,255,255,0.08);">
            <summary style="font-size:12px; font-weight:800; color:var(--gold); cursor:pointer;">⚙️ Geliştirici Expo Go Bağlantısı (Opsiyonel)</summary>
            <div style="margin-top:10px;">
              <label style="font-size:11px; font-weight:700; color:#94A3B8;">ÖZEL HOST / EXPO URL:</label>
              <div style="display:flex; gap:6px; margin-top:4px;">
                <input type="text" id="customHostInput" class="search-input" style="flex:1;" placeholder="exp://... veya ip">
                <button class="btn" onclick="updateCustomQr()">Güncelle</button>
              </div>
            </div>
          </details>
        </div>

        <div class="guide-card">
          <h2 style="font-size:20px; color:#FFFFFF; margin-bottom:14px;">Telefonunuzda Anında Başlatma Rehberi</h2>
          
          <div class="guide-step">
            <div class="step-num">1</div>
            <div>
              <h3 style="font-size:15px; color:var(--gold);">Telefon Kameranızı Açın</h3>
              <p style="font-size:13px; color:var(--text-muted);">iOS (iPhone Safari) veya Android (Google Chrome) telefonunuzun standart kamera uygulamasını açın ve soldaki QR koda tutun.</p>
            </div>
          </div>

          <div class="guide-step">
            <div class="step-num">2</div>
            <div>
              <h3 style="font-size:15px; color:var(--gold);">🌐 7/24 Kesintisiz Bulut Erişimi</h3>
              <p style="font-size:13px; color:var(--text-muted);">
                <b>Bilgisayarınızın veya yerel sunucunuzun açık kalmasına gerek yoktur!</b> Aynı Wi-Fi ağı zorunluluğu tamamen kaldırılmıştır. Tavriko, Vercel bulut mimarisi üzerinde 7 gün 24 saat tüm dünyadan erişilebilir durumdadır.
              </p>
            </div>
          </div>

          <div class="guide-step">
            <div class="step-num">3</div>
            <div>
              <h3 style="font-size:15px; color:var(--gold);">Anında Oyuna Başlayın</h3>
              <p style="font-size:13px; color:var(--text-muted);">
                Kameranın tespit ettiği bağlantıya tıkladığınızda oyun tam ekran olarak mobil cihazınızda açılır. Uygulama indirmeye gerek kalmadan tüm özellikleriyle oynanabilir.
              </p>
            </div>
          </div>

          <div class="guide-step">
            <div class="step-num">4</div>
            <div>
              <h3 style="font-size:15px; color:var(--gold);">Gerçek Zamanlı Log Takibi</h3>
              <p style="font-size:13px; color:var(--text-muted);">Telefonunuzda yaptığınız her giriş, soru yanıtı ve profil işlemi bu panelin <b>"Canlı Loglar"</b> sekmesinde anlık olarak izlenebilir.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: DETAILED API DOCUMENTATION -->
    <div id="tab-api" class="tab-content">
      <div style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <h2 style="font-size:22px; color:#FFFFFF;">Detaylı API Kullanım Dökümanı & Test Alanı</h2>
          <p style="font-size:13px; color:var(--text-muted);">Tüm REST API uç noktaları, örnek yükler ve canlı tarayıcı içi test aracı</p>
        </div>
        <div style="font-size:13px; background:#1A1333; padding:8px 14px; border-radius:8px; border:1px solid var(--card-border);">
          Base URL: <code style="color:var(--gold);" id="apiBaseUrlDisplay">https://tavriko-app.vercel.app/api</code>
        </div>
      </div>

      <!-- ENDPOINT 1: Auth Register -->
      <div class="api-endpoint-card">
        <div class="api-header-row">
          <span class="method-badge method-POST">POST</span>
          <span class="api-path">/api/auth/register</span>
          <span style="color:var(--text-muted); font-size:12px;">Yeni Kullanıcı Kaydı (PostgreSQL)</span>
        </div>
        <p class="api-desc">E-posta ve şifre ile yeni hesap oluşturur. Başlangıçta 800 Altın, 14 Elmas ve Seviye 1 tanımlanır.</p>
        <div class="api-box-label">İstek Gövdesi (JSON Payload):</div>
        <textarea id="body_register" class="api-code-editor">{
  "email": "deneme@tavriko.app",
  "username": "denemePro",
  "password": "Password123!",
  "displayName": "Deneme Oyuncu",
  "countryCode": "TR"
}</textarea>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-gold" onclick="executeApi('/api/auth/register', 'POST', 'body_register', 'res_register')">⚡ Test Et (Execute)</button>
        </div>
        <div id="res_register" class="response-view" style="display:none;"></div>
      </div>

      <!-- ENDPOINT 2: Auth Login -->
      <div class="api-endpoint-card">
        <div class="api-header-row">
          <span class="method-badge method-POST">POST</span>
          <span class="api-path">/api/auth/login</span>
          <span style="color:var(--text-muted); font-size:12px;">Giriş Yapma (PostgreSQL)</span>
        </div>
        <p class="api-desc">Kullanıcı adı veya e-posta ve şifre ile giriş yapar, JWT token ve güncel profil döndürür.</p>
        <div class="api-box-label">İstek Gövdesi (JSON Payload):</div>
        <textarea id="body_login" class="api-code-editor">{
  "identifier": "denemePro",
  "password": "Password123!"
}</textarea>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-gold" onclick="executeApi('/api/auth/login', 'POST', 'body_login', 'res_login')">⚡ Test Et (Execute)</button>
        </div>
        <div id="res_login" class="response-view" style="display:none;"></div>
      </div>

      <!-- ENDPOINT 3: Categories -->
      <div class="api-endpoint-card">
        <div class="api-header-row">
          <span class="method-badge method-GET">GET</span>
          <span class="api-path">/api/categories</span>
          <span style="color:var(--text-muted); font-size:12px;">Kategori Listesi</span>
        </div>
        <p class="api-desc">Tüm kategorileri ve PostgreSQL'de yayınlanmış gerçek soru sayılarını döndürür.</p>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-gold" onclick="executeApi('/api/categories', 'GET', null, 'res_categories')">⚡ Test Et (Execute)</button>
        </div>
        <div id="res_categories" class="response-view" style="display:none;"></div>
      </div>

      <!-- ENDPOINT 4: Practice Questions -->
      <div class="api-endpoint-card">
        <div class="api-header-row">
          <span class="method-badge method-GET">GET</span>
          <span class="api-path">/api/questions/practice?category=history&difficulty=medium&count=3</span>
          <span style="color:var(--text-muted); font-size:12px;">Pratik Soruları Çekme</span>
        </div>
        <p class="api-desc">Belirtilen kategori ve zorluk derecesinde pratik soruları getirir.</p>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-gold" onclick="executeApi('/api/questions/practice?category=history&difficulty=medium&count=3', 'GET', null, 'res_practice')">⚡ Test Et (Execute)</button>
        </div>
        <div id="res_practice" class="response-view" style="display:none;"></div>
      </div>

      <!-- ENDPOINT 5: Shop Purchase -->
      <div class="api-endpoint-card">
        <div class="api-header-row">
          <span class="method-badge method-POST">POST</span>
          <span class="api-path">/api/social/shop/purchase</span>
          <span style="color:var(--text-muted); font-size:12px;">Mağaza Satın Alımı & Bakiye Denetimi</span>
        </div>
        <p class="api-desc">Altın, Elmas veya Sandık satın alımını işler. Yetersiz bakiye durumunda detaylı eksik para uyarısı verir ve PostgreSQL'e işler.</p>
        <div class="api-box-label">İstek Gövdesi (JSON Payload):</div>
        <textarea id="body_purchase" class="api-code-editor">{
  "userId": "default",
  "packId": "gems_100",
  "cardHolder": "DENİZ YILMAZ",
  "last4": "4821"
}</textarea>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-gold" onclick="executeApi('/api/social/shop/purchase', 'POST', 'body_purchase', 'res_purchase')">⚡ Test Et (Execute)</button>
        </div>
        <div id="res_purchase" class="response-view" style="display:none;"></div>
      </div>

      <!-- ENDPOINT 6: Health -->
      <div class="api-endpoint-card">
        <div class="api-header-row">
          <span class="method-badge method-GET">GET</span>
          <span class="api-path">/health</span>
          <span style="color:var(--text-muted); font-size:12px;">Sistem Sağlık Durumu</span>
        </div>
        <p class="api-desc">Prisma ORM, Supabase Cloud, Upstash Redis ve sunucu durumunu doğrular.</p>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-gold" onclick="executeApi('/health', 'GET', null, 'res_health')">⚡ Test Et (Execute)</button>
        </div>
        <div id="res_health" class="response-view" style="display:none;"></div>
      </div>
    </div>

    <!-- TAB 3: DETAILED REAL-TIME LOGS -->
    <div id="tab-logs" class="tab-content">
      <div class="logs-wrapper">
        <div class="logs-toolbar">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <input type="text" id="logSearch" class="search-input" placeholder="🔍 Loglarda ara (URL, hata, IP...)" oninput="filterLogRows()">
            
            <div class="filter-pills">
              <span class="pill active" onclick="setLogFilter('LEVEL', 'ALL', this)">TÜMÜ</span>
              <span class="pill" style="color:#FCA5A5;" onclick="setLogFilter('LEVEL', 'ERROR', this)">❌ HATALAR (ERROR)</span>
              <span class="pill" style="color:#FCD34D;" onclick="setLogFilter('LEVEL', 'WARN', this)">⚠️ UYARILAR</span>
              <span class="pill" style="color:#6EE7B7;" onclick="setLogFilter('LEVEL', 'SUCCESS', this)">✅ BAŞARILI</span>
              <span class="pill" style="color:#93C5FD;" onclick="setLogFilter('LEVEL', 'INFO', this)">ℹ️ BİLGİ</span>
            </div>

            <div class="filter-pills">
              <span class="pill active" onclick="setLogFilter('CAT', 'ALL', this)">Kategori: Tümü</span>
              <span class="pill" onclick="setLogFilter('CAT', 'CLIENT', this)">📱 Mobil</span>
              <span class="pill" onclick="setLogFilter('CAT', 'HTTP', this)">🌐 HTTP</span>
              <span class="pill" onclick="setLogFilter('CAT', 'AUTH', this)">🔐 Auth</span>
              <span class="pill" onclick="setLogFilter('CAT', 'GOOGLE', this)">🌐 Google</span>
              <span class="pill" style="color:#38BDF8;" onclick="setLogFilter('CAT', 'TELEGRAM', this)">🤖 Telegram</span>
            </div>
          </div>

          <div style="display:flex; gap:8px; align-items:center;">
            <label style="font-size:12px; color:var(--text-muted); display:flex; align-items:center; gap:4px; cursor:pointer;">
              <input type="checkbox" id="autoScrollCheck" checked> Otomatik Kaydır
            </label>
            <button class="btn btn-cyan" onclick="exportLogsJson()">📥 JSON İndir</button>
            <button class="btn btn-red" onclick="clearAllLogs()">🗑️ Temizle</button>
          </div>
        </div>

        <div class="logs-scroll" id="logsScrollContainer">
          <!-- Live rows injected here -->
        </div>
      </div>
    </div>

    <!-- TAB 4: DATABASE & USERS -->
    <div id="tab-db" class="tab-content">
      <div style="margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h2 style="font-size:20px; color:#FFFFFF;">PostgreSQL / Supabase Kayıtlı Kullanıcılar</h2>
          <p style="font-size:13px; color:var(--text-muted);">Canlı veritabanından çekilen en güncel 10 kullanıcı hesabı</p>
        </div>
        <button class="btn btn-gold" onclick="refreshStats()">🔄 Verileri Yenile</button>
      </div>

      <div style="background:var(--card); border:1px solid var(--card-border); border-radius:16px; overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
          <thead>
            <tr style="border-bottom:1px solid var(--card-border); background:rgba(0,0,0,0.25); color:var(--gold);">
              <th style="padding:12px 16px;">Kullanıcı Adı</th>
              <th style="padding:12px 16px;">E-Posta</th>
              <th style="padding:12px 16px;">Arkadaş Kodu</th>
              <th style="padding:12px 16px;">Seviye & XP</th>
              <th style="padding:12px 16px;">Bakiye (Altın / Elmas)</th>
              <th style="padding:12px 16px;">Kayıt Tarihi</th>
            </tr>
          </thead>
          <tbody id="usersTableBody">
            <!-- Injected here -->
          </tbody>
        </table>
      </div>
    </div>
  </main>

  <script>
    let logsList = [];
    let activeLevelFilter = 'ALL';
    let activeCatFilter = 'ALL';
    let errorCounter = 0;

    function switchTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      event.target.classList.add('active');
    }

    function renderSingleLog(entry, prepend = false) {
      const container = document.getElementById('logsScrollContainer');
      const item = document.createElement('div');
      item.className = 'log-item';
      item.dataset.level = entry.level || 'INFO';
      item.dataset.category = entry.category || 'SYSTEM';

      if (entry.level === 'ERROR') {
        errorCounter++;
        document.getElementById('kpiErrors').innerText = errorCounter;
      }

      let detailsHtml = '';
      if (entry.details) {
        detailsHtml = '<div class="log-json" style="display:none;" id="det_' + entry.id + '">' +
          escapeHtml(JSON.stringify(entry.details, null, 2)) +
        '</div>';
      }

      item.innerHTML = \`
        <div class="log-header-row">
          <span class="log-time">\${entry.timestamp || ''}</span>
          <span class="tag tag-\${entry.level}">\${entry.level}</span>
          <span class="tag tag-cat">\${entry.category}</span>
          <span class="log-text">\${escapeHtml(entry.message)}</span>
          \${entry.details ? '<button class="btn" style="padding:2px 8px; font-size:11px;" onclick="toggleDetails(\\'' + entry.id + '\\')">Detay</button>' : ''}
        </div>
        \${detailsHtml}
      \`;

      if (prepend && container.firstChild) {
        container.insertBefore(item, container.firstChild);
      } else {
        container.appendChild(item);
      }

      if (document.getElementById('autoScrollCheck').checked && !prepend) {
        container.scrollTop = container.scrollHeight;
      }
    }

    function toggleDetails(id) {
      const el = document.getElementById('det_' + id);
      if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }

    function filterLogRows() {
      const q = document.getElementById('logSearch').value.toLowerCase();
      const rows = document.querySelectorAll('.log-item');
      rows.forEach(r => {
        const lvl = r.dataset.level;
        const cat = r.dataset.category;
        const txt = r.innerText.toLowerCase();

        let lvlMatch = (activeLevelFilter === 'ALL' || lvl === activeLevelFilter);
        let catMatch = (activeCatFilter === 'ALL' || cat === activeCatFilter);
        let searchMatch = !q || txt.includes(q);

        r.style.display = (lvlMatch && catMatch && searchMatch) ? 'flex' : 'none';
      });
    }

    function setLogFilter(type, val, element) {
      if (type === 'LEVEL') {
        activeLevelFilter = val;
        element.parentElement.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      } else {
        activeCatFilter = val;
        element.parentElement.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      }
      element.classList.add('active');
      filterLogRows();
    }

    function connectSSE() {
      const evt = new EventSource('/api/logs/stream');
      evt.onmessage = (e) => {
        try {
          const entry = JSON.parse(e.data);
          logsList.unshift(entry);
          document.getElementById('kpiTotalLogs').innerText = logsList.length;
          renderSingleLog(entry, true);
          filterLogRows();
        } catch (err) {}
      };
      evt.onerror = () => setTimeout(connectSSE, 4000);
    }

    function loadInitialLogs() {
      fetch('/api/logs?limit=250')
        .then(r => r.json())
        .then(data => {
          logsList = data.logs || [];
          document.getElementById('kpiTotalLogs').innerText = logsList.length;
          document.getElementById('logsScrollContainer').innerHTML = '';
          errorCounter = 0;
          for (const l of logsList) {
            renderSingleLog(l, false);
          }
          filterLogRows();
        });
    }

    function refreshStats() {
      fetch('/api/logs/stats')
        .then(r => r.json())
        .then(s => {
          document.getElementById('kpiUsers').innerText = s.postgresUsersCount ?? 0;
          const mins = Math.floor((s.uptimeSeconds || 0) / 60);
          document.getElementById('kpiUptime').innerText = mins + ' dk';

          const tbody = document.getElementById('usersTableBody');
          tbody.innerHTML = '';
          if (s.recentUsers && s.recentUsers.length > 0) {
            s.recentUsers.forEach(u => {
              const tr = document.createElement('tr');
              tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
              tr.innerHTML = \`
                <td style="padding:10px 16px; font-weight:700; color:#FFFFFF;">\${escapeHtml(u.displayName || u.username)}</td>
                <td style="padding:10px 16px; color:#A78BFA;">\${escapeHtml(u.email || '-')}</td>
                <td style="padding:10px 16px; font-weight:800; color:var(--gold);">\${escapeHtml(u.friendCode || '-')}</td>
                <td style="padding:10px 16px;">Seviye \${u.level || 1}</td>
                <td style="padding:10px 16px;">🪙 \${u.coins ?? 0} · 💎 \${u.gems ?? 0}</td>
                <td style="padding:10px 16px; color:var(--text-muted); font-size:12px;">\${u.createdAt ? new Date(u.createdAt).toLocaleDateString('tr-TR') : '-'}</td>
              \`;
              tbody.appendChild(tr);
            });
          }
        })
        .catch(() => {});
    }

    function clearAllLogs() {
      fetch('/api/logs/clear', { method: 'POST' }).then(() => {
        document.getElementById('logsScrollContainer').innerHTML = '';
        logsList = [];
        errorCounter = 0;
        document.getElementById('kpiTotalLogs').innerText = 0;
        document.getElementById('kpiErrors').innerText = 0;
      });
    }

    function exportLogsJson() {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logsList, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "tavriko-logs-" + Date.now() + ".json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }

    function refreshSimulator() {
      const iframe = document.getElementById('gameSimulatorIframe');
      if (iframe) {
        iframe.src = '/app?r=' + Date.now();
      }
    }

    function copyCloudGameLink() {
      const link = window.location.origin + '/app';
      navigator.clipboard.writeText(link).then(() => {
        alert('Tavriko 7/24 Bulut Oyun Bağlantısı panoya kopyalandı:\\n' + link);
      });
    }

    function updateCustomQr() {
      const host = document.getElementById('customHostInput').value.trim();
      let newUrl = host;
      if (host && !host.startsWith('http') && !host.startsWith('exp://')) {
        newUrl = 'exp://' + host + ':8081';
      }
      if (!newUrl) {
        newUrl = window.location.origin + '/app';
      }
      document.getElementById('qrImg').src = '/qr?url=' + encodeURIComponent(newUrl) + '&t=' + Date.now();
    }

    async function executeApi(endpoint, method, bodyElementId, resultElementId) {
      const resView = document.getElementById(resultElementId);
      resView.style.display = 'block';
      resView.innerText = 'İstek gönderiliyor...';
      const start = Date.now();
      try {
        let opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (method === 'POST' && bodyElementId) {
          opts.body = document.getElementById(bodyElementId).value;
        }
        const res = await fetch(endpoint, opts);
        const data = await res.json();
        const duration = Date.now() - start;
        resView.innerText = '// HTTP ' + res.status + ' ' + res.statusText + ' (' + duration + 'ms)\\n' + JSON.stringify(data, null, 2);
        resView.style.borderColor = res.ok ? '#10B981' : '#EF4444';
      } catch (err) {
        resView.innerText = '// İSTEK HATASI:\\n' + err.message;
        resView.style.borderColor = '#EF4444';
      }
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    let portalAuthToken = localStorage.getItem('tavriko_portal_token');

    async function checkPortalAuth() {
      if (!portalAuthToken) {
        showAuthOverlay();
        return false;
      }
      try {
        const res = await fetch('/api/portal/verify', {
          headers: { 'Authorization': 'Bearer ' + portalAuthToken }
        });
        if (res.ok) {
          hideAuthOverlay();
          return true;
        }
      } catch {}
      showAuthOverlay();
      return false;
    }

    function showAuthOverlay() {
      document.getElementById('portalAuthOverlay').style.display = 'flex';
    }

    function hideAuthOverlay() {
      document.getElementById('portalAuthOverlay').style.display = 'none';
    }

    async function handlePortalLogin(e) {
      e.preventDefault();
      const email = document.getElementById('portalEmailInput').value.trim();
      const password = document.getElementById('portalPasswordInput').value;
      const errBox = document.getElementById('portalAuthError');
      const btn = document.getElementById('portalLoginSubmitBtn');
      errBox.style.display = 'none';
      btn.disabled = true;
      btn.innerText = 'Kontrol ediliyor...';

      try {
        const res = await fetch('/api/portal/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success && data.token) {
          localStorage.setItem('tavriko_portal_token', data.token);
          portalAuthToken = data.token;
          hideAuthOverlay();
          loadInitialLogs();
          connectSSE();
          refreshStats();
        } else {
          errBox.style.display = 'block';
          errBox.innerText = data.error || 'Hatalı e-posta veya şifre!';
        }
      } catch (err) {
        errBox.style.display = 'block';
        errBox.innerText = 'Bağlantı hatası: ' + err.message;
      } finally {
        btn.disabled = false;
        btn.innerText = '⚡ SİSTEME GİRİŞ YAP';
      }
    }

    function handlePortalLogout() {
      localStorage.removeItem('tavriko_portal_token');
      portalAuthToken = null;
      showAuthOverlay();
    }

    function initCloudPortalUrls() {
      const cloudGameUrl = window.location.origin + '/app';
      const cloudApiUrl = window.location.origin + '/api';
      const elGameUrl = document.getElementById('cloudLiveGameUrl');
      if (elGameUrl) elGameUrl.innerText = cloudGameUrl;
      const elBtnText = document.getElementById('btnCloudUrlText');
      if (elBtnText) elBtnText.innerText = cloudGameUrl;
      const elOpenWeb = document.getElementById('openCloudWebLink');
      if (elOpenWeb) elOpenWeb.href = cloudGameUrl;
      const elApiDisplay = document.getElementById('apiBaseUrlDisplay');
      if (elApiDisplay) elApiDisplay.innerText = cloudApiUrl;
      const elQr = document.getElementById('qrImg');
      if (elQr) elQr.src = '/qr?url=' + encodeURIComponent(cloudGameUrl);
    }

    initCloudPortalUrls();

    checkPortalAuth().then(isAuthed => {
      if (isAuthed) {
        initCloudPortalUrls();
        loadInitialLogs();
        connectSSE();
        refreshStats();
        setInterval(refreshStats, 6000);
      }
    });
  </script>
</body>
</html>`;
}
