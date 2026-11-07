import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { db } from '../db/prismaClient';
import { supabaseService } from '../db/supabaseClient';
import { UserProfile, UserSettings } from '@trivia/shared';
import { logger } from '../utils/logger';
import { requireUser, rateLimit } from '../middleware/security';

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

export interface PendingGoogleSession {
  sessionId: string;
  status: 'pending' | 'ready' | 'error';
  user?: UserProfile;
  token?: string;
  error?: string;
  createdAt: number;
  expiresAt: number;
}

const pendingSessions = new Map<string, PendingGoogleSession>();
const GOOGLE_SESSION_TTL_MS = 5 * 60 * 1000;
const MAX_PENDING_GOOGLE_SESSIONS = 1000;

function prunePendingGoogleSessions(): void {
  const now = Date.now();
  for (const [id, session] of pendingSessions) {
    if (session.expiresAt <= now) pendingSessions.delete(id);
  }
  while (pendingSessions.size >= MAX_PENDING_GOOGLE_SESSIONS) {
    const oldestId = pendingSessions.keys().next().value;
    if (!oldestId) break;
    pendingSessions.delete(oldestId);
  }
}

export function getPendingGoogleSessions(): Array<Pick<PendingGoogleSession, 'status' | 'createdAt'>> {
  return Array.from(pendingSessions.values())
    .slice(-10)
    .map(({ status, createdAt }) => ({ status, createdAt }));
}

router.post('/google/init-session', rateLimit({ keyPrefix: 'google-init', windowMs: 15 * 60 * 1000, max: 8 }), (req: Request, res: Response): void => {
  prunePendingGoogleSessions();
  const now = Date.now();
  const sessionId = randomBytes(32).toString('base64url');
  pendingSessions.set(sessionId, {
    sessionId,
    status: 'pending',
    createdAt: now,
    expiresAt: now + GOOGLE_SESSION_TTL_MS,
  });
  logger.info('GOOGLE', 'Google oturumu başlatıldı', { clientIp: req.ip });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ sessionId });
});

router.get('/google/session-status', rateLimit({ keyPrefix: 'google-status', windowMs: 60 * 1000, max: 120 }), (req: Request, res: Response): void => {
  const { sessionId } = req.query;
  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({ error: 'sessionId zorunludur' });
    return;
  }
  const session = pendingSessions.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    pendingSessions.delete(sessionId);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'not_found' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    status: session.status,
    user: session.status === 'ready' ? session.user : undefined,
    token: session.status === 'ready' ? session.token : undefined,
    error: session.error,
  });
  // The bearer token is delivered exactly once; a second poll cannot retrieve it.
  if (session.status === 'ready' || session.status === 'error') {
    pendingSessions.delete(sessionId);
  }
});

router.post('/google/complete-session', rateLimit({ keyPrefix: 'google-complete', windowMs: 15 * 60 * 1000, max: 10 }), async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, accessToken } = req.body;
    if (!accessToken || typeof accessToken !== 'string') { res.status(401).json({ error: 'Doğrulanmış erişim tokenı gerekli.' }); return; }
    const client = supabaseService.getClient();
    if (!client) { res.status(503).json({ error: 'Kimlik sağlayıcısı yapılandırılmamış.' }); return; }
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data?.user?.email || !data.user.identities?.some((item: any) => item.provider === 'google')) { res.status(401).json({ error: 'Google kimliği doğrulanamadı.' }); return; }
    const email = data.user.email;
    const meta = data.user.user_metadata || {};
    const name = meta.full_name || meta.name || email.split('@')[0];
    const result = await db.loginOrRegisterGoogle({ email, displayName: name, fullName: name, avatarUrl: meta.avatar_url || meta.picture || 'av1', googleId: data.user.id });
    if (typeof sessionId === 'string') {
      const pending = pendingSessions.get(sessionId);
      if (pending && pending.status === 'pending' && pending.expiresAt > Date.now()) {
        pendingSessions.set(sessionId, {
          ...pending,
          status: 'ready',
          user: result.user,
          token: result.token,
        });
      }
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json(result);
  } catch { res.status(401).json({ error: 'Google oturumu tamamlanamadı.' }); }
});
router.post('/guest', rateLimit({ keyPrefix: 'guest', windowMs: 15 * 60 * 1000, max: 25 }), async (req: Request, res: Response): Promise<void> => {
  try {
    const { displayName } = req.body;
    const result = await db.createGuest(displayName);
    res.setHeader('Cache-Control', 'no-store');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', rateLimit({ keyPrefix: 'register', windowMs: 60 * 60 * 1000, max: 6 }), async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      username,
      email,
      displayName,
      fullName,
      password,
      countryCode,
      countryName,
      country,
      phone,
      phoneNumber,
      birthDate,
      gender,
      bio,
      avatarUrl,
    } = req.body;

    const resolvedUsername = (username || displayName || (email ? email.split('@')[0] : '')).trim();
    if (!resolvedUsername || !password) {
      res.status(400).json({ error: 'Kullanıcı adı, e-posta ve şifre zorunludur.' });
      return;
    }

    const result = await db.register({
      username: resolvedUsername,
      email: email || `${resolvedUsername}@tavriko.app`,
      displayName: displayName || fullName || resolvedUsername,
      fullName,
      password,
      countryCode,
      countryName: countryName || country,
      phone: phone || phoneNumber,
      birthDate,
      gender,
      bio,
      avatarUrl,
    });
    res.setHeader('Cache-Control', 'no-store');
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', rateLimit({ keyPrefix: 'login', windowMs: 15 * 60 * 1000, max: 10 }), async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, identifier, password } = req.body;
    const loginId = identifier || username || email;
    if (!loginId || !password) {
      res.status(400).json({ error: 'E-posta/kullanıcı adı ve şifre zorunludur.' });
      return;
    }
    const result = await db.login(loginId, password);
    res.setHeader('Cache-Control', 'no-store');
    res.json(result);
  } catch {
    // Avoid disclosing whether an account exists.
    res.status(401).json({ error: 'Kullanıcı adı/e-posta veya şifre hatalı.' });
  }
});

router.get('/google/callback', (req: Request, res: Response): void => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>Tavriko - Google ile Giriş Başarılı</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #12052C;
      color: #FFFFFF;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      text-align: center;
    }
    .card {
      background: rgba(28, 12, 62, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 24px;
      padding: 32px 24px;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid rgba(255, 196, 61, 0.2);
      border-top-color: #FFC43D;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 20px; font-weight: 800; color: #FFC43D; margin-bottom: 10px; }
    p { font-size: 14px; color: #D9CDF5; line-height: 1.5; margin-bottom: 24px; }
    .btn {
      display: block;
      width: 100%;
      background: linear-gradient(135deg, #FFC43D, #FF9F0A);
      color: #12052C;
      font-weight: 800;
      font-size: 16px;
      padding: 14px;
      border-radius: 14px;
      text-decoration: none;
      box-shadow: 0 6px 16px rgba(255, 196, 61, 0.35);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h1>Google Hesabı Onaylandı!</h1>
    <p id="msg">Oturumunuz doğrulandı, Tavriko uygulamasına aktarılıyorsunuz...</p>
    <a id="appBtn" class="btn" href="#">Uygulamaya Dön</a>
  </div>
  <script>
    const hash = window.location.hash.substring(1);
    const search = window.location.search.substring(1);
    const payload = hash || search;

    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(search);
    const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
    const sessionId = searchParams.get('sessionId') || hashParams.get('sessionId') || searchParams.get('state') || hashParams.get('state');

    function navigateToApp(user, token) {
      if (window.opener && window.opener !== window) {
        try {
          window.opener.postMessage({ type: 'TAVRIKO_GOOGLE_AUTH', user: user, token: token, payload: window.location.href }, window.location.origin);
        } catch (e) {}
        setTimeout(function() { window.close(); }, 500);
        return;
      }

      const activeHost = window.location.hostname || 'tavriko-app.vercel.app';
      const webTarget = '/app#' + payload;
      const isExpoClient = /Expo/i.test(navigator.userAgent);
      const btn = document.getElementById('appBtn');

      if (btn) {
        btn.href = isExpoClient ? 'exp://' + activeHost + ':8081/--/auth-callback?' + payload : webTarget;
      }

      if (isExpoClient) {
        try { window.location.href = 'exp://' + activeHost + ':8081/--/auth-callback?' + payload; } catch(e) {}
        setTimeout(function() {
          try { window.location.href = 'tavriko://auth-callback?' + payload; } catch(e) {}
        }, 1000);
      } else {
        // Web browser: Redirect straight to Tavriko web application!
        window.location.href = webTarget;
      }
    }

    // Automatically complete server session and persist to Supabase PostgreSQL public.users
    if (accessToken) {
      fetch('/api/auth/google/complete-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: accessToken, sessionId: sessionId })
      })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d && d.user) {
          document.getElementById('msg').innerText = 'Hoş geldin ' + d.user.displayName + '! Tavriko açılıyor...';
          setTimeout(function() {
            navigateToApp(d.user, d.token);
          }, 350);
        } else {
          navigateToApp(null, null);
        }
      })
      .catch(function(e) {
        console.error('Error completing session:', e);
        navigateToApp(null, null);
      });
    } else {
      navigateToApp(null, null);
    }
  </script>
</body>
</html>`);
});

router.post('/google', rateLimit({ keyPrefix: 'google-login', windowMs: 15 * 60 * 1000, max: 10 }), async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken, accessToken, countryCode, countryName, phone, birthDate } = req.body || {};
    let verifiedEmail: string | undefined, verifiedName: string | undefined, verifiedPicture: string | undefined, googleSub: string | undefined;
    if (idToken && typeof idToken === 'string') {
      const response = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
      if (!response.ok) { res.status(401).json({ error: 'Google tokenı doğrulanamadı.' }); return; }
      const info: any = await response.json();
      if (!GOOGLE_CLIENT_ID || info.aud !== GOOGLE_CLIENT_ID || info.email_verified !== 'true' || !info.sub || !info.email) { res.status(401).json({ error: 'Google kimliği geçerli değil.' }); return; }
      verifiedEmail = info.email; verifiedName = info.name; verifiedPicture = info.picture; googleSub = info.sub;
    } else if (accessToken && typeof accessToken === 'string') {
      const client = supabaseService.getClient();
      if (client) {
        const result = await client.auth.getUser(accessToken);
        if (!result.error && result.data?.user?.email && result.data.user.identities?.some((item: any) => item.provider === 'google')) {
          verifiedEmail = result.data.user.email; const meta = result.data.user.user_metadata || {}; verifiedName = meta.full_name || meta.name; verifiedPicture = meta.avatar_url || meta.picture; googleSub = result.data.user.id;
        }
      }
      if (!verifiedEmail) {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + accessToken } });
        if (response.ok) { const info: any = await response.json(); if (info.email && info.email_verified === true && info.sub) { verifiedEmail = info.email; verifiedName = info.name; verifiedPicture = info.picture; googleSub = info.sub; } }
      }
    }
    if (!verifiedEmail || !googleSub) { res.status(401).json({ error: 'Geçerli Google kimlik doğrulaması gerekli.' }); return; }
    const result = await db.loginOrRegisterGoogle({ email: verifiedEmail, displayName: verifiedName || verifiedEmail.split('@')[0], fullName: verifiedName, avatarUrl: verifiedPicture || 'av1', googleId: googleSub, countryCode, countryName, phone, birthDate });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ...result, googleClientId: GOOGLE_CLIENT_ID || undefined });
  } catch { res.status(401).json({ error: 'Google kimlik doğrulaması başarısız.' }); }
});
router.post('/delete-account', requireUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'userId zorunludur' });
      return;
    }
    const result = await db.deleteAccount(userId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/forgot-password', rateLimit({ keyPrefix: 'forgot-password', windowMs: 60 * 60 * 1000, max: 3 }), async (req: Request, res: Response): Promise<void> => {
  // The current demo reset flow returns the OTP to the caller instead of
  // delivering it through a verified email channel. Never expose that code
  // in production; keep the demo behavior limited to non-production builds.
  if (process.env.NODE_ENV === 'production') {
    res.status(503).json({
      error: 'Şifre sıfırlama e-posta hizmeti henüz yapılandırılmadı. Lütfen destek ekibiyle iletişime geçin.',
    });
    return;
  }

  try {
    const { identifier, email } = req.body;
    const target = identifier || email;
    if (!target) {
      res.status(400).json({ error: 'Lütfen kayıtlı e-posta adresinizi veya kullanıcı adınızı girin.' });
      return;
    }
    const result = await db.requestPasswordReset(target);
    res.json({
      success: result.success,
      message: result.message,
      resetCodeDemo: result.demoResetCode,
      emailMasked: result.emailMasked,
    });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/reset-password', rateLimit({ keyPrefix: 'reset-password', windowMs: 15 * 60 * 1000, max: 5 }), async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    res.status(503).json({ error: 'Şifre sıfırlama e-posta hizmeti henüz yapılandırılmadı.' });
    return;
  }
  try {
    const { identifier, email, otpCode, code, newPassword } = req.body;
    const target = identifier || email;
    const finalCode = otpCode || code;
    if (!target || !finalCode || !newPassword) {
      res.status(400).json({ error: 'Tüm alanların doldurulması zorunludur.' });
      return;
    }
    const result = await db.confirmPasswordReset(target, finalCode, newPassword);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/profile', requireUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).authUserId as string;
    const body = req.body || {};
    const updates: Partial<{
      displayName: string;
      fullName: string;
      countryCode: string;
      countryName: string;
      phone: string;
      birthDate: string;
      gender: string;
      bio: string;
      avatarUrl: string;
    }> = {};

    const stringFields: Array<[keyof typeof updates, number]> = [
      ['displayName', 32],
      ['fullName', 100],
      ['countryCode', 2],
      ['countryName', 80],
      ['phone', 32],
      ['birthDate', 10],
      ['gender', 12],
      ['bio', 180],
      ['avatarUrl', 2048],
    ];
    for (const [field, maxLength] of stringFields) {
      if (body[field] === undefined) continue;
      if (typeof body[field] !== 'string' || body[field].length > maxLength) {
        res.status(400).json({ error: `Geçersiz profil alanı: ${field}` });
        return;
      }
      updates[field] = body[field].trim();
    }

    if (updates.gender && !['Kadın', 'Erkek', 'Diğer'].includes(updates.gender)) {
      res.status(400).json({ error: 'Geçersiz cinsiyet değeri.' });
      return;
    }
    if (updates.countryCode && !/^[A-Z]{2}$/.test(updates.countryCode.toUpperCase())) {
      res.status(400).json({ error: 'Geçersiz ülke kodu.' });
      return;
    }
    if (updates.avatarUrl) {
      const isPreset = /^(av_?\d+|custom)$/i.test(updates.avatarUrl);
      let isHttpsUrl = false;
      try { isHttpsUrl = new URL(updates.avatarUrl).protocol === 'https:'; } catch {}
      if (!isPreset && !isHttpsUrl) {
        res.status(400).json({ error: 'Avatar yalnızca hazır avatar veya HTTPS adresi olabilir.' });
        return;
      }
    }

    const updated = await db.updateUserProfile(userId, updates);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/settings', rateLimit({ keyPrefix: 'user-settings', windowMs: 60 * 1000, max: 20 }), requireUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).authUserId as string;
    const settings = req.body?.settings;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      res.status(400).json({ error: 'Geçerli ayar nesnesi gerekli.' });
      return;
    }

    const booleanKeys = [
      'sfxEnabled', 'musicEnabled', 'hapticsEnabled', 'timerAlertSound', 'victoryMelody',
      'smoothAnimations', 'batterySaver', 'ambientGlow', 'buttonSpring', 'penaltyForWrong',
      'autoNextQuestion', 'doubleTapProtection', 'notifsEnabled', 'duelInvitesAllowed',
      'roomInvitesAllowed', 'onlineStatusVisible', 'profilePublic', 'friendRequestsAllowed',
      'dailyReminder', 'seasonAlerts', 'friendActivity',
    ];
    const enumValues: Record<string, string[]> = {
      sfxVolume: ['25', '50', '75', '100'],
      musicVolume: ['25', '50', '75', '100'],
      hapticIntensity: ['light', 'medium', 'strong'],
      textSize: ['normal', 'large'],
      defaultDifficulty: ['easy', 'medium', 'hard'],
      themeMode: ['dark', 'vibrant', 'midnight'],
    };
    const allowedKeys = new Set([
      ...booleanKeys,
      ...Object.keys(enumValues),
      'questionCount',
      'questionTimeSec',
      'equippedTitle',
    ]);
    const validated: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(settings)) {
      if (!allowedKeys.has(key)) {
        res.status(400).json({ error: `Desteklenmeyen ayar: ${key}` });
        return;
      }
      if (booleanKeys.includes(key)) {
        if (typeof value !== 'boolean') {
          res.status(400).json({ error: `Geçersiz ayar: ${key}` });
          return;
        }
        validated[key] = value;
      } else if (enumValues[key]) {
        if (typeof value !== 'string' || !enumValues[key].includes(value)) {
          res.status(400).json({ error: `Geçersiz ayar: ${key}` });
          return;
        }
        validated[key] = value;
      } else if (key === 'questionCount' || key === 'questionTimeSec') {
        const numberValue = Number(value);
        const min = key === 'questionCount' ? 1 : 5;
        const max = key === 'questionCount' ? 20 : 60;
        if (!Number.isInteger(numberValue) || numberValue < min || numberValue > max) {
          res.status(400).json({ error: `Geçersiz ayar: ${key}` });
          return;
        }
        validated[key] = numberValue;
      } else if (key === 'equippedTitle') {
        if (typeof value !== 'string' || value.length > 32) {
          res.status(400).json({ error: 'Geçersiz oyuncu unvanı.' });
          return;
        }
        validated[key] = value.trim();
      }
    }

    const updated = await db.updateUserSettings(userId, validated as Partial<UserSettings>);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/change-password', async (req: Request, res: Response): Promise<void> => {
  try {
    // Security: password changes REQUIRE a verified session token (body userId is ignored)
    const authHeader = req.headers.authorization;
    let userId: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = db.verifyToken(token);
      if (payload) userId = payload.userId;
    }

    if (!userId) {
      res.status(401).json({ error: 'Kullanıcı oturumu doğrulanamadı.' });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    if (!newPassword) {
      res.status(400).json({ error: 'Yeni şifre alanı zorunludur.' });
      return;
    }

    const result = await db.changeUserPassword(userId, currentPassword || '', newPassword);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/stats', requireUser, (_req: Request, res: Response): void => {
  res.status(410).json({ error: 'Bu işlem istemci tarafından değiştirilemez; sunucu tarafından doğrulanmış maç/ödül akışı kullanılmalıdır.' });
});

router.post('/sync-wallet', requireUser, (_req: Request, res: Response): void => {
  res.status(410).json({ error: 'Bu işlem istemci tarafından değiştirilemez; sunucu tarafından doğrulanmış maç/ödül akışı kullanılmalıdır.' });
});

router.get('/me', (req: Request, res: Response): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Yetkilendirme başlığı eksik' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const payload = db.verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Geçersiz veya süresi dolmuş oturum' });
    return;
  }

  const profile = db.getUserProfile(payload.userId);
  if (!profile) {
    res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    return;
  }

  res.json(profile);
});

export default router;
