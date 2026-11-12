import { Router, Request, Response } from 'express';
import { db } from '../db/prismaClient';
import { supabaseService } from '../db/supabaseClient';
import { UserProfile, LEGAL_VERSION, REQUIRED_LEGAL_DOCUMENTS, LegalConsentRecord } from '@trivia/shared';
import { logger } from '../utils/logger';
import { requireUserAuth } from '../middleware/auth';

const LEGAL_CONSENT_REQUIRED_ERROR =
  'Devam etmek için Kullanım Koşulları, Gizlilik Politikası ve KVKK Aydınlatma Metni’ni onaylamalısın.';

function buildLegalConsent(method: LegalConsentRecord['method']): LegalConsentRecord {
  return {
    version: LEGAL_VERSION,
    acceptedAt: new Date().toISOString(),
    documents: [...REQUIRED_LEGAL_DOCUMENTS],
    method,
  };
}

const router = Router();

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '411578437442-gs1rck2124rgr516fe9dn9tuu15ge9ig.apps.googleusercontent.com';

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
    logger.info('GOOGLE', `complete-session isteği alındı (sessionId: ${sessionId || 'yok'})`, {
      hasAccessToken: !!accessToken,
    });

    // SECURITY: the identity is resolved exclusively from the verified access token.
    // Client-supplied email/name values are intentionally ignored.
    if (!accessToken || typeof accessToken !== 'string') {
      res.status(401).json({ error: 'Google erişim tokeni zorunludur.' });
      return;
    }

    let email: string | undefined;
    let name: string | undefined;
    let avatar: string | undefined;
    let googleId: string | undefined;

    try {
      const client = supabaseService.getClient();
      if (!client) {
        res.status(503).json({ error: 'Kimlik doğrulama servisi yapılandırılmamış.' });
        return;
      }
      const { data, error } = await client.auth.getUser(accessToken);
      if (error || !data?.user) {
        logger.warn('GOOGLE', `Supabase getUser reddetti: ${error?.message || 'kullanıcı yok'}`);
        res.status(401).json({ error: 'Google oturumu doğrulanamadı.' });
        return;
      }
      email = data.user.email || undefined;
      const meta = data.user.user_metadata || {};
      name = meta.full_name || meta.name || (email ? email.split('@')[0] : 'Oyuncu');
      avatar = meta.avatar_url || meta.picture || 'av1';
      googleId = data.user.id;
      logger.info('GOOGLE', `Supabase'den Google kullanıcısı doğrulandı: ${email}`);
    } catch (err: any) {
      logger.error('GOOGLE', 'Supabase token doğrulama hatası:', err);
      res.status(401).json({ error: 'Google oturumu doğrulanamadı.' });
      return;
    }

    if (!email) {
      if (sessionId && pendingSessions.has(sessionId)) {
        pendingSessions.set(sessionId, {
          sessionId,
          status: 'error',
          error: 'E-posta bilgisi alınamadı.',
          createdAt: Date.now(),
        });
      }
      logger.error('GOOGLE', 'complete-session başarısız: E-posta bilgisi alınamadı');
      res.status(400).json({ error: 'E-posta bilgisi alınamadı.' });
      return;
    }

    const result = await db.loginOrRegisterGoogle({
      email,
      displayName: name || email.split('@')[0],
      fullName: name,
      avatarUrl: avatar || 'av1',
      googleId,
    });

    logger.success('GOOGLE', `Google kullanıcısı PostgreSQL public.users tablosuna kaydedildi: ${result.user.email}`, {
      userId: result.user.id,
      displayName: result.user.displayName,
      friendCode: result.user.friendCode,
    });

    // Match exact sessionId or fallback to the latest pending session (within 2 mins)
    let targetSessionId = sessionId;
    if (!targetSessionId || !pendingSessions.has(targetSessionId)) {
      const now = Date.now();
      let latestPending: PendingGoogleSession | undefined;
      for (const s of pendingSessions.values()) {
        if (s.status === 'pending' && (now - s.createdAt) < 120000) {
          if (!latestPending || s.createdAt > latestPending.createdAt) {
            latestPending = s;
          }
        }
      }
      if (latestPending) {
        targetSessionId = latestPending.sessionId;
      }
    }

    if (targetSessionId && pendingSessions.has(targetSessionId)) {
      pendingSessions.set(targetSessionId, {
        sessionId: targetSessionId,
        status: 'ready',
        user: result.user,
        token: result.token,
        createdAt: Date.now(),
      });
      logger.info('GOOGLE', `Oturum 'ready' durumuna getirildi: ${targetSessionId}`);
    }

    res.json({ success: true, user: result.user, token: result.token });
  } catch (err: any) {
    logger.error('GOOGLE', `complete-session sistem hatası: ${err.message}`, err);
    if (req.body.sessionId && pendingSessions.has(req.body.sessionId)) {
      pendingSessions.set(req.body.sessionId, {
        sessionId: req.body.sessionId,
        status: 'error',
        error: err.message,
        createdAt: Date.now(),
      });
    }
    res.status(500).json({ error: err.message });
  }
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
      acceptedLegalVersion,
    } = req.body;

    // Kayıt yalnızca güncel yasal metinler onaylandığında yapılır.
    if (acceptedLegalVersion !== LEGAL_VERSION) {
      res.status(400).json({ error: LEGAL_CONSENT_REQUIRED_ERROR, code: 'LEGAL_CONSENT_REQUIRED', legalVersion: LEGAL_VERSION });
      return;
    }

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
    try {
      const updatedUser = await db.updateUserSettings(result.user.id, { legalConsent: buildLegalConsent('register') });
      res.json({ ...result, user: updatedUser });
      return;
    } catch (consentErr: any) {
      logger.warn('AUTH', `Kayıt sonrası yasal onay kaydedilemedi: ${consentErr.message}`);
    }
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
    const {
      idToken,
      accessToken,
      fullName,
      countryCode,
      countryName,
      phone,
      birthDate,
    } = req.body;

    // SECURITY: identity is resolved exclusively from the verified idToken/accessToken.
    // Client-supplied email/name/avatar are never trusted as identity.
    let verifiedEmail: string | undefined;
    let verifiedName: string | undefined;
    let verifiedPicture: string | undefined;
    let googleSub: string | undefined;

    if (!idToken && !accessToken) {
      res.status(401).json({ error: 'Google kimlik tokeni (idToken veya accessToken) zorunludur.' });
      return;
    }

    // If an actual Google OAuth idToken or accessToken is passed, verify against Google API
    if (idToken) {
      try {
        const tokenRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
        );
        if (tokenRes.ok) {
          const tokenInfo: any = await tokenRes.json();
          if (tokenInfo.email) verifiedEmail = tokenInfo.email;
          if (tokenInfo.name) verifiedName = tokenInfo.name;
          if (tokenInfo.picture) verifiedPicture = tokenInfo.picture;
          googleSub = tokenInfo.sub;
        }
      } catch {
        // Fallback to provided profile fields
      }
    } else if (accessToken) {
      // 1. Check if token is a Supabase JWT
      try {
        const client = supabaseService.getClient();
        if (client) {
          const { data, error } = await client.auth.getUser(accessToken);
          if (data?.user) {
            verifiedEmail = data.user.email || verifiedEmail;
            const meta = data.user.user_metadata || {};
            verifiedName = meta.full_name || meta.name || verifiedName || verifiedEmail?.split('@')[0];
            verifiedPicture = meta.avatar_url || meta.picture || verifiedPicture || 'av1';
            googleSub = data.user.id;
          }
        }
      } catch {}

      // 2. Fallback to raw Google OAuth userinfo if not verified yet
      if (!verifiedEmail) {
        try {
          const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (userRes.ok) {
            const userInfo: any = await userRes.json();
            if (userInfo.email) verifiedEmail = userInfo.email;
            if (userInfo.name) verifiedName = userInfo.name;
            if (userInfo.picture) verifiedPicture = userInfo.picture;
            googleSub = userInfo.sub;
          }
        } catch {
          // Fallback to provided profile fields
        }
      }
    }

    if (!verifiedEmail) {
      res.status(400).json({ error: 'Google hesabından e-posta bilgisi alınamadı.' });
      return;
    }

    const result = await db.loginOrRegisterGoogle({
      email: verifiedEmail,
      displayName: verifiedName || verifiedEmail.split('@')[0],
      fullName: fullName || verifiedName,
      avatarUrl: verifiedPicture || 'av1',
      googleId: googleSub,
      countryCode,
      countryName,
      phone,
      birthDate,
    });

    // SECURITY: client-supplied wallet values (clientCoins/clientGems/clientXp/clientLevel)
    // are intentionally NOT synced into the account. The server is authoritative for
    // economy state; merging client values would allow wallet forgery on every login.

    res.json({
      ...result,
      googleClientId: GOOGLE_CLIENT_ID,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// SECURITY: account deletion requires the account owner's verified session token.
router.post('/delete-account', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Kullanıcı oturumu doğrulanamadı.' });
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

    // SECURITY: the one-time code is delivered out-of-band (email), NEVER returned in
    // the HTTP response. A generic response is sent whether or not the account exists
    // to prevent user enumeration.
    await db.requestPasswordReset(target).catch(() => undefined);
    res.json({
      success: true,
      message: 'Şifre sıfırlama kodu kayıtlı e-posta adresinize gönderildi.',
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
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

// SECURITY: profile updates are bound to the verified session identity. The old
// implementation fell back to the body-supplied userId when the token was missing
// or invalid, which allowed targeting any account.
router.put('/profile', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
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

// Yasal metin onayı (Google ile giriş, metin güncellemesi sonrası yeniden onay vb.)
router.post('/legal-consent', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Kullanıcı oturumu doğrulanamadı.' });
      return;
    }
    const { version, method } = req.body || {};
    if (version !== LEGAL_VERSION) {
      res.status(409).json({ error: 'Yasal metinler güncellendi, lütfen güncel metni onaylayın.', legalVersion: LEGAL_VERSION });
      return;
    }
    const safeMethod: LegalConsentRecord['method'] = method === 'google' || method === 'register' ? method : 'in_app';
    const updated = await db.updateUserSettings(userId, { legalConsent: buildLegalConsent(safeMethod) });
    logger.info('AUTH', `Yasal metin onayı kaydedildi (${safeMethod}, ${LEGAL_VERSION}): ${userId}`);
    res.json({ success: true, user: updated, legalVersion: LEGAL_VERSION });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// SECURITY: settings updates are bound to the verified session identity.
router.post('/settings', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Kullanıcı oturumu doğrulanamadı.' });
      return;
    }

    const { settings } = req.body;
    // legalConsent yalnızca /legal-consent ucu tarafından sunucu saatiyle yazılır.
    const safeSettings = settings && typeof settings === 'object' ? { ...settings } : {};
    delete (safeSettings as any).legalConsent;
    const updated = await db.updateUserSettings(userId, safeSettings);
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

// SECURITY: game stats are recorded against the verified session identity only.
router.post('/stats', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Kullanıcı oturumu doğrulanamadı.' });
      return;
    }
    const { correctAnswers = 0, totalAnswers = 0, bestStreak = 0, roomCode, category, mode, difficulty } = req.body;

    // ÇOK OYUNCULU maç: galibiyet, doğru sayısı ve dereceli olup olmadığı yalnızca
    // gerçek zamanlı sunucunun bildirdiği nihai özetten gelir (recordFinalMatch).
    // İstemci bu alanları bildiremez; yalnızca sunucudaki kaydı okuyabilir.
    if (mode !== 'solo') {
      const code = typeof roomCode === 'string' ? roomCode.trim() : '';
      if (!code) {
        res.status(400).json({ error: 'Çok oyunculu maç için oda kodu gereklidir.' });
        return;
      }
      const recorded = await db.getRecordedMatchRewards(userId, code);
      if (!recorded) {
        // Sunucu henüz maç özetini işlemedi; istemci kısa süre sonra tekrar sorar
        res.json({ success: true, pending: true, user: null, rewards: null });
        return;
      }
      res.json({ success: true, user: recorded.user, rewards: recorded.rewards });
      return;
    }

    // TEK KİŞİLİK pratik: galibiyet sunucuda kurala göre hesaplanır (doğruların en az yarısı);
    // pratik hiçbir zaman dereceli değildir, dolayısıyla LP değişmez.
    const validDifficulty = ['easy', 'medium', 'hard', 'expert'].includes(difficulty) ? difficulty : undefined;
    const soloTotal = Math.max(1, Math.min(20, Math.round(Number(totalAnswers) || 5)));
    const soloCorrect = Math.max(0, Math.min(soloTotal, Math.round(Number(correctAnswers) || 0)));
    const result = await db.recordMatchResult(userId, {
      correctAnswers: soloCorrect,
      totalAnswers: soloTotal,
      bestStreak,
      won: soloCorrect >= Math.ceil(soloTotal / 2),
      mode: 'solo',
      difficulty: validDifficulty,
      ranked: false,
      category: typeof category === 'string' && category.trim() ? category.trim() : undefined,
    });
    // rewards: hesaba GERÇEKTEN yazılan XP/altın (istemci bunu aynen göstermelidir)
    res.json({ success: true, user: result?.user ?? null, rewards: result?.rewards ?? null });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// SECURITY: wallet sync is bound to the verified session identity; the token user
// is the only account whose wallet may be read. Bu uç artık SALT OKUNURDUR:
// istemciden gelen cüzdan değerleri yok sayılır, sunucudaki yetkili kayıt döndürülür.
router.post('/sync-wallet', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Kullanıcı oturumu doğrulanamadı.' });
      return;
    }
    const updatedUser = await db.syncWallet(userId);
    res.json({ success: true, user: updatedUser });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
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
