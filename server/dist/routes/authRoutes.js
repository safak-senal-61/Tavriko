"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPendingGoogleSessions = getPendingGoogleSessions;
const express_1 = require("express");
const prismaClient_1 = require("../db/prismaClient");
const supabaseClient_1 = require("../db/supabaseClient");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ||
    '411578437442-gs1rck2124rgr516fe9dn9tuu15ge9ig.apps.googleusercontent.com';
const pendingSessions = new Map();
function getPendingGoogleSessions() {
    return Array.from(pendingSessions.values()).slice(-10);
}
router.post('/google/init-session', (req, res) => {
    const sessionId = 'gs_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    pendingSessions.set(sessionId, {
        sessionId,
        status: 'pending',
        createdAt: Date.now(),
    });
    logger_1.logger.info('GOOGLE', `Google oturumu başlatıldı: ${sessionId}`, { clientIp: req.ip });
    res.json({ sessionId });
});
router.get('/google/session-status', (req, res) => {
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
router.post('/google/complete-session', async (req, res) => {
    try {
        const { sessionId, accessToken, userEmail, userName, userAvatar } = req.body;
        logger_1.logger.info('GOOGLE', `complete-session isteği alındı (sessionId: ${sessionId || 'yok'})`, {
            hasAccessToken: !!accessToken,
            userEmail,
        });
        let email = userEmail;
        let name = userName;
        let avatar = userAvatar;
        let googleId = undefined;
        if (accessToken) {
            try {
                const client = supabaseClient_1.supabaseService.getClient();
                if (client) {
                    const { data, error } = await client.auth.getUser(accessToken);
                    if (error) {
                        logger_1.logger.warn('GOOGLE', `Supabase getUser uyarısı: ${error.message}`);
                    }
                    if (data?.user) {
                        email = data.user.email || email;
                        const meta = data.user.user_metadata || {};
                        name = meta.full_name || meta.name || name || email?.split('@')[0];
                        avatar = meta.avatar_url || meta.picture || avatar || 'av1';
                        googleId = data.user.id;
                        logger_1.logger.info('GOOGLE', `Supabase'den Google kullanıcısı alındı: ${email} (${name})`);
                    }
                }
            }
            catch (err) {
                logger_1.logger.error('GOOGLE', 'Supabase token doğrulama hatası:', err);
            }
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
            logger_1.logger.error('GOOGLE', 'complete-session başarısız: E-posta bilgisi alınamadı');
            res.status(400).json({ error: 'E-posta bilgisi alınamadı.' });
            return;
        }
        const result = await prismaClient_1.db.loginOrRegisterGoogle({
            email,
            displayName: name || email.split('@')[0],
            fullName: name,
            avatarUrl: avatar || 'av1',
            googleId,
        });
        logger_1.logger.success('GOOGLE', `Google kullanıcısı PostgreSQL public.users tablosuna kaydedildi: ${result.user.email}`, {
            userId: result.user.id,
            displayName: result.user.displayName,
            friendCode: result.user.friendCode,
        });
        // Match exact sessionId or fallback to the latest pending session (within 2 mins)
        let targetSessionId = sessionId;
        if (!targetSessionId || !pendingSessions.has(targetSessionId)) {
            const now = Date.now();
            let latestPending;
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
            logger_1.logger.info('GOOGLE', `Oturum 'ready' durumuna getirildi: ${targetSessionId}`);
        }
        res.json({ success: true, user: result.user, token: result.token });
    }
    catch (err) {
        logger_1.logger.error('GOOGLE', `complete-session sistem hatası: ${err.message}`, err);
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
router.post('/guest', async (req, res) => {
    try {
        const { displayName } = req.body;
        const result = await prismaClient_1.db.createGuest(displayName);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/register', async (req, res) => {
    try {
        const { username, email, displayName, fullName, password, countryCode, countryName, country, phone, phoneNumber, birthDate, gender, bio, avatarUrl, } = req.body;
        const resolvedUsername = (username || displayName || (email ? email.split('@')[0] : '')).trim();
        if (!resolvedUsername || !password) {
            res.status(400).json({ error: 'Kullanıcı adı, e-posta ve şifre zorunludur.' });
            return;
        }
        const result = await prismaClient_1.db.register({
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
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/login', async (req, res) => {
    try {
        const { username, email, identifier, password } = req.body;
        const loginId = identifier || username || email;
        if (!loginId || !password) {
            res.status(400).json({ error: 'E-posta/kullanıcı adı ve şifre zorunludur.' });
            return;
        }
        const result = await prismaClient_1.db.login(loginId, password);
        res.json(result);
    }
    catch (err) {
        res.status(401).json({ error: err.message });
    }
});
router.get('/google/callback', (req, res) => {
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
router.post('/google', async (req, res) => {
    try {
        const { idToken, accessToken, email, displayName, fullName, avatarUrl, countryCode, countryName, phone, birthDate, clientCoins, clientGems, clientXp, clientLevel, } = req.body;
        let verifiedEmail = email;
        let verifiedName = displayName || fullName;
        let verifiedPicture = avatarUrl;
        let googleSub = undefined;
        // If an actual Google OAuth idToken or accessToken is passed, verify against Google API
        if (idToken) {
            try {
                const tokenRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
                if (tokenRes.ok) {
                    const tokenInfo = await tokenRes.json();
                    if (tokenInfo.email)
                        verifiedEmail = tokenInfo.email;
                    if (tokenInfo.name)
                        verifiedName = tokenInfo.name;
                    if (tokenInfo.picture)
                        verifiedPicture = tokenInfo.picture;
                    googleSub = tokenInfo.sub;
                }
            }
            catch {
                // Fallback to provided profile fields
            }
        }
        else if (accessToken) {
            // 1. Check if token is a Supabase JWT
            try {
                const client = supabaseClient_1.supabaseService.getClient();
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
            }
            catch { }
            // 2. Fallback to raw Google OAuth userinfo if not verified yet
            if (!verifiedEmail) {
                try {
                    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                        headers: { Authorization: `Bearer ${accessToken}` },
                    });
                    if (userRes.ok) {
                        const userInfo = await userRes.json();
                        if (userInfo.email)
                            verifiedEmail = userInfo.email;
                        if (userInfo.name)
                            verifiedName = userInfo.name;
                        if (userInfo.picture)
                            verifiedPicture = userInfo.picture;
                        googleSub = userInfo.sub;
                    }
                }
                catch {
                    // Fallback to provided profile fields
                }
            }
        }
        if (!verifiedEmail) {
            res.status(400).json({ error: 'Google hesabından e-posta bilgisi alınamadı.' });
            return;
        }
        const result = await prismaClient_1.db.loginOrRegisterGoogle({
            email: verifiedEmail,
            displayName: verifiedName || verifiedEmail.split('@')[0],
            fullName: fullName || verifiedName,
            avatarUrl: verifiedPicture,
            googleId: googleSub,
            countryCode,
            countryName,
            phone,
            birthDate,
        });
        if ((typeof clientCoins === 'number' && clientCoins > (result.user.coins ?? 0)) ||
            (typeof clientGems === 'number' && clientGems > (result.user.gems ?? 0)) ||
            (typeof clientXp === 'number' && clientXp > (result.user.xp ?? 0)) ||
            (typeof clientLevel === 'number' && clientLevel > (result.user.level ?? 1))) {
            const synced = await prismaClient_1.db.syncWallet(result.user.id, {
                coins: clientCoins,
                gems: clientGems,
                xp: clientXp,
                level: clientLevel,
            });
            if (synced) {
                result.user = synced;
            }
        }
        res.json({
            ...result,
            googleClientId: GOOGLE_CLIENT_ID,
        });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/delete-account', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            res.status(400).json({ error: 'userId zorunludur' });
            return;
        }
        const result = await prismaClient_1.db.deleteAccount(userId);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/forgot-password', async (req, res) => {
    try {
        const { identifier, email } = req.body;
        const target = identifier || email;
        if (!target) {
            res.status(400).json({ error: 'Lütfen kayıtlı e-posta adresinizi veya kullanıcı adınızı girin.' });
            return;
        }
        const result = await prismaClient_1.db.requestPasswordReset(target);
        res.json({
            ...result,
            resetCodeDemo: result.demoResetCode,
        });
    }
    catch (err) {
        res.status(404).json({ error: err.message });
    }
});
router.post('/reset-password', async (req, res) => {
    try {
        const { identifier, email, otpCode, code, newPassword } = req.body;
        const target = identifier || email;
        const finalCode = otpCode || code;
        if (!target || !finalCode || !newPassword) {
            res.status(400).json({ error: 'Tüm alanların doldurulması zorunludur.' });
            return;
        }
        const result = await prismaClient_1.db.confirmPasswordReset(target, finalCode, newPassword);
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.put('/profile', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let userId = req.body.userId;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const payload = prismaClient_1.db.verifyToken(token);
            if (payload)
                userId = payload.userId;
        }
        if (!userId) {
            res.status(401).json({ error: 'Kullanıcı oturumu doğrulanamadı.' });
            return;
        }
        logger_1.logger.info('AUTH', `Profil güncelleme isteği: userId=${userId}, avatarUrl=${req.body.avatarUrl || 'değişmedi'}, displayName=${req.body.displayName || 'değişmedi'}`);
        const updated = await prismaClient_1.db.updateUserProfile(userId, req.body);
        logger_1.logger.success('AUTH', `Profil başarıyla güncellendi ve veritabanına işlendi: ${userId} -> avatar: ${updated.avatarUrl}`);
        res.json({ success: true, user: updated });
    }
    catch (err) {
        logger_1.logger.error('AUTH', `Profil güncelleme hatası: ${err.message}`);
        res.status(400).json({ error: err.message });
    }
});
router.post('/settings', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let userId = req.body.userId;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const payload = prismaClient_1.db.verifyToken(token);
            if (payload)
                userId = payload.userId;
        }
        if (!userId) {
            res.status(401).json({ error: 'Kullanıcı oturumu doğrulanamadı.' });
            return;
        }
        const { settings } = req.body;
        const updated = await prismaClient_1.db.updateUserSettings(userId, settings || {});
        res.json({ success: true, user: updated });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/change-password', async (req, res) => {
    try {
        // Security: password changes REQUIRE a verified session token (body userId is ignored)
        const authHeader = req.headers.authorization;
        let userId;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const payload = prismaClient_1.db.verifyToken(token);
            if (payload)
                userId = payload.userId;
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
        const result = await prismaClient_1.db.changeUserPassword(userId, currentPassword || '', newPassword);
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/stats', async (req, res) => {
    try {
        const { userId, correctAnswers = 0, totalAnswers = 0, xpEarned = 0, coinsEarned = 0, bestStreak = 0, won = false, roomCode, category } = req.body;
        if (!userId) {
            res.status(400).json({ error: 'userId gerekli' });
            return;
        }
        const updated = await prismaClient_1.db.recordGameStats(userId, {
            correctAnswers,
            totalAnswers,
            xpEarned,
            coinsEarned,
            bestStreak,
            won,
            roomCode: typeof roomCode === 'string' && roomCode.trim() ? roomCode.trim() : undefined,
            category: typeof category === 'string' && category.trim() ? category.trim() : undefined,
        });
        res.json({ success: true, user: updated });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/sync-wallet', async (req, res) => {
    try {
        const { userId, coins, gems, xp, level } = req.body;
        if (!userId) {
            res.status(400).json({ error: 'userId gereklidir' });
            return;
        }
        const updatedUser = await prismaClient_1.db.syncWallet(userId, { coins, gems, xp, level });
        res.json({ success: true, user: updatedUser });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get('/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Yetkilendirme başlığı eksik' });
        return;
    }
    const token = authHeader.split(' ')[1];
    const payload = prismaClient_1.db.verifyToken(token);
    if (!payload) {
        res.status(401).json({ error: 'Geçersiz veya süresi dolmuş oturum' });
        return;
    }
    const profile = prismaClient_1.db.getUserProfile(payload.userId);
    if (!profile) {
        res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        return;
    }
    res.json(profile);
});
exports.default = router;
