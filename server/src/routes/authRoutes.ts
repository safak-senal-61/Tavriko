import { Router, Request, Response } from 'express';
import { db } from '../db/prismaClient';
import { supabaseService } from '../db/supabaseClient';
import { UserProfile } from '@trivia/shared';
import { logger } from '../utils/logger';
import { requireUser } from '../middleware/security';

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

export interface PendingGoogleSession {
  sessionId: string;
  status: 'pending' | 'ready' | 'error';
  user?: UserProfile;
  token?: string;
  error?: string;
  createdAt: number;
}

const pendingSessions = new Map<string, PendingGoogleSession>();

export function getPendingGoogleSessions(): PendingGoogleSession[] {
  return Array.from(pendingSessions.values()).slice(-10);
}

router.post('/google/init-session', (req: Request, res: Response): void => {
  const sessionId = 'gs_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  pendingSessions.set(sessionId, {
    sessionId,
    status: 'pending',
    createdAt: Date.now(),
  });
  logger.info('GOOGLE', `Google oturumu başlatıldı: ${sessionId}`, { clientIp: req.ip });
  res.json({ sessionId });
});

router.get('/google/session-status', (req: Request, res: Response): void => {
  const { sessionId } = req.query;
  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({ error: 'sessionId zorunludur' });
    return;
  }
  const session = pendingSessions.get(sessionId);
  if (!session) {
    res.json({ status: 'not_found' });
    return;
  }
  res.json({
    status: session.status,
    user: session.user,
    token: session.token,
    error: session.error,
  });
});

router.post('/google/complete-session', async (req: Request, res: Response): Promise<void> => {
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
    if (sessionId && pendingSessions.has(sessionId)) pendingSessions.set(sessionId, { sessionId, status: 'ready', user: result.user, token: result.token, createdAt: Date.now() });
    res.json(result);
  } catch { res.status(401).json({ error: 'Google oturumu tamamlanamadı.' }); }
});
router.post('/guest', async (req: Request, res: Response): Promise<void> => {
  try {
    const { displayName } = req.body;
    const result = await db.createGuest(displayName);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', async (req: Request, res: Response): Promise<void> => {
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
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, identifier, password } = req.body;
    const loginId = identifier || username || email;
    if (!loginId || !password) {
      res.status(400).json({ error: 'E-posta/kullanıcı adı ve şifre zorunludur.' });
      return;
    }
    const result = await db.login(loginId, password);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

router.get('/google/callback', (req: Request, res: Response): void => {
  const currentHost = (req.headers.host || 'tavriko-app.vercel.app').split(':')[0];
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
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
          window.opener.postMessage({ type: 'TAVRIKO_GOOGLE_AUTH', user: user, token: token, payload: payload }, '*');
        } catch (e) {}
        setTimeout(function() { window.close(); }, 500);
        return;
      }

      const activeHost = window.location.hostname || '${currentHost}';
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

router.post('/google', async (req: Request, res: Response): Promise<void> => {
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

router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, email } = req.body;
    const target = identifier || email;
    if (!target) {
      res.status(400).json({ error: 'Lütfen kayıtlı e-posta adresinizi veya kullanıcı adınızı girin.' });
      return;
    }
    const result = await db.requestPasswordReset(target);
    res.json({
      ...result,
      resetCodeDemo: result.demoResetCode,
    });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
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
    const authHeader = req.headers.authorization;
    let userId = req.body.userId;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = db.verifyToken(token);
      if (payload) userId = payload.userId;
    }

    if (!userId) {
      res.status(401).json({ error: 'Kullanıcı oturumu doğrulanamadı.' });
      return;
    }

    logger.info('AUTH', `Profil güncelleme isteği: userId=${userId}, avatarUrl=${req.body.avatarUrl || 'değişmedi'}, displayName=${req.body.displayName || 'değişmedi'}`);
    const updated = await db.updateUserProfile(userId, req.body);
    logger.success('AUTH', `Profil başarıyla güncellendi ve veritabanına işlendi: ${userId} -> avatar: ${updated.avatarUrl}`);
    res.json({ success: true, user: updated });
  } catch (err: any) {
    logger.error('AUTH', `Profil güncelleme hatası: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

router.post('/settings', requireUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    let userId = req.body.userId;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = db.verifyToken(token);
      if (payload) userId = payload.userId;
    }

    if (!userId) {
      res.status(401).json({ error: 'Kullanıcı oturumu doğrulanamadı.' });
      return;
    }

    const { settings } = req.body;
    const updated = await db.updateUserSettings(userId, settings || {});
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
