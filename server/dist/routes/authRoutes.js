"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const node_net_1 = require("node:net");
const express_rate_limit_1 = require("express-rate-limit");
const functions_1 = require("@vercel/functions");
const prismaClient_1 = require("../db/prismaClient");
const supabaseClient_1 = require("../db/supabaseClient");
const shared_1 = require("@trivia/shared");
const logger_1 = require("../utils/logger");
const auth_1 = require("../middleware/auth");
const oneSignalEmail_1 = require("../services/oneSignalEmail");
const passwordReset_1 = require("../services/passwordReset");
const accountRemoval_1 = require("../services/accountRemoval");
const LEGAL_CONSENT_REQUIRED_ERROR = 'Devam etmek için Kullanım Koşulları, Gizlilik Politikası ve KVKK Aydınlatma Metni’ni onaylamalısın.';
function buildLegalConsent(method) {
    return {
        version: shared_1.LEGAL_VERSION,
        acceptedAt: new Date().toISOString(),
        documents: [...shared_1.REQUIRED_LEGAL_DOCUMENTS],
        method,
    };
}
const router = (0, express_1.Router)();
// Vercel overwrites this header at its edge. Do not trust a client-supplied
// forwarding header on standalone servers, or change Express trust globally.
const rateLimitKey = (req) => {
    const forwarded = process.env.VERCEL === '1' ? req.get('x-forwarded-for')?.trim() : undefined;
    const ip = forwarded && (0, node_net_1.isIP)(forwarded) ? forwarded : req.ip || req.socket.remoteAddress;
    return ip && (0, node_net_1.isIP)(ip) ? (0, express_rate_limit_1.ipKeyGenerator)(ip) : 'unknown';
};
const rateLimitOptions = {
    keyGenerator: rateLimitKey,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Çok fazla istek. Lütfen birkaç dakika sonra tekrar deneyin.' },
};
const signedRemovalRequestLimit = (0, express_rate_limit_1.rateLimit)({ ...rateLimitOptions, windowMs: 5 * 60_000, limit: 15 });
const publicRemovalRequestLimit = (0, express_rate_limit_1.rateLimit)({ ...rateLimitOptions, windowMs: 5 * 60_000, limit: 15 });
const signedRemovalConfirmLimit = (0, express_rate_limit_1.rateLimit)({ ...rateLimitOptions, windowMs: 5 * 60_000, limit: 15 });
const publicRemovalConfirmLimit = (0, express_rate_limit_1.rateLimit)({ ...rateLimitOptions, windowMs: 5 * 60_000, limit: 15 });
const sessionProfileLimit = (0, express_rate_limit_1.rateLimit)({ ...rateLimitOptions, windowMs: 60_000, limit: 120 });
router.post('/guest', async (req, res) => {
    try {
        const { displayName } = req.body;
        const result = await prismaClient_1.db.createGuest(displayName);
        res.json(result);
    }
    catch (err) {
        logger_1.logger.error('AUTH', 'Misafir oturumu oluşturulamadı', { error: err instanceof Error ? err.name : 'unknown' });
        res.status(500).json({ error: 'Misafir oturumu oluşturulamadı.' });
    }
});
router.post('/register', async (req, res) => {
    try {
        const { username, email, displayName, fullName, password, countryCode, countryName, country, phone, phoneNumber, birthDate, gender, bio, avatarUrl, acceptedLegalVersion, } = req.body;
        // Kayıt yalnızca güncel yasal metinler onaylandığında yapılır.
        if (acceptedLegalVersion !== shared_1.LEGAL_VERSION) {
            res.status(400).json({ error: LEGAL_CONSENT_REQUIRED_ERROR, code: 'LEGAL_CONSENT_REQUIRED', legalVersion: shared_1.LEGAL_VERSION });
            return;
        }
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
            legalConsent: buildLegalConsent('register'),
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
// Only the Tavriko Supabase project can issue an accepted session. Raw Google
// access/ID tokens are not credentials for this endpoint.
const googleLoginLimit = (0, express_rate_limit_1.rateLimit)({ ...rateLimitOptions, windowMs: 60_000, limit: 30 });
router.get('/google/callback', (req, res) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    const code = req.query.code;
    // Forward only the short-lived PKCE code, never arbitrary callback parameters
    // or a redirect destination supplied by the browser.
    const fragment = typeof code === 'string' && /^[a-zA-Z0-9_-]{8,128}$/.test(code)
        ? `code=${encodeURIComponent(code)}`
        : 'error=oauth';
    res.redirect(303, `/app#${fragment}`);
});
router.post('/google', googleLoginLimit, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const token = req.body?.accessToken;
    if (typeof token !== 'string' || !token || token.length > 8192 || req.body.idToken != null) {
        res.status(401).json({ error: 'Geçerli Tavriko Google oturumu gerekli.' });
        return;
    }
    const client = supabaseClient_1.supabaseService.getClient();
    if (!client) {
        res.status(503).json({ error: 'Kimlik doğrulama servisi kullanılamıyor.' });
        return;
    }
    try {
        const { data, error } = await client.auth.getUser(token);
        const user = data?.user;
        const email = user?.email?.trim().toLowerCase();
        const google = user?.identities?.find(identity => {
            const claims = identity.identity_data;
            return identity.provider === 'google' &&
                (claims?.email_verified === true || claims?.email_verified === 'true') &&
                typeof claims.email === 'string' && claims.email.trim().toLowerCase() === email;
        });
        if (error || !user?.id || user.is_anonymous || !user.email_confirmed_at || !email || !google) {
            res.status(401).json({ error: 'Google hesabı doğrulanamadı.' });
            return;
        }
        const claims = google.identity_data;
        const name = typeof claims?.full_name === 'string' ? claims.full_name :
            typeof claims?.name === 'string' ? claims.name : undefined;
        const picture = typeof claims?.picture === 'string' && claims.picture.startsWith('https://')
            ? claims.picture : 'av1';
        const result = await prismaClient_1.db.loginOrRegisterGoogle({
            email,
            displayName: name || email.split('@')[0],
            fullName: name,
            avatarUrl: picture,
            googleId: user.id,
        });
        res.json(result);
    }
    catch {
        logger_1.logger.error('AUTH', 'Google oturumu tamamlanamadı.');
        res.status(503).json({ error: 'Google girişi şu anda kullanılamıyor.' });
    }
});
const REMOVAL_UNAVAILABLE = 'Hesap silme doğrulaması şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.';
const REMOVAL_ACCEPTED = 'Bu adres bir Tavriko hesabına bağlıysa doğrulama kodu e-postayla gönderilir. Gelen kutunuzu ve spam klasörünüzü kontrol edin.';
const INVALID_REMOVAL_CODE = 'Kod geçersiz, kullanılmış veya süresi dolmuş. Gerekirse yeni bir kod isteyin.';
router.post('/delete-account/request', signedRemovalRequestLimit, auth_1.requireUserAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const config = (0, oneSignalEmail_1.getOneSignalEmailConfig)();
    const secret = (0, passwordReset_1.getPasswordResetSecret)();
    if (!config || !secret) {
        res.status(503).json({ error: REMOVAL_UNAVAILABLE });
        return;
    }
    try {
        // Ignore all client-supplied destinations and use the authenticated account.
        const result = await (0, accountRemoval_1.issueAccountRemoval)(prismaClient_1.db.rawClient, { id: req.authUserId }, secret);
        if (result.status === 'unavailable') {
            res.status(400).json({ error: 'Doğrulama kodu için hesabınıza kayıtlı bir e-posta adresi olmalıdır.' });
            return;
        }
        if (result.status === 'cooldown') {
            res.json({ success: true, delivery: 'previous-request', resendAfterSeconds: result.remaining });
            return;
        }
        if (!await (0, oneSignalEmail_1.sendOneSignalAccountRemovalEmail)(config, result)) {
            res.status(503).json({ delivery: 'unconfirmed', resendAfterSeconds: accountRemoval_1.REMOVAL_RESEND_SECONDS });
            return;
        }
        res.json({ success: true, delivery: 'accepted', resendAfterSeconds: accountRemoval_1.REMOVAL_RESEND_SECONDS });
    }
    catch {
        logger_1.logger.error('AUTH', 'Hesap silme kodu hazırlanamadı.');
        res.status(503).json({ error: REMOVAL_UNAVAILABLE });
    }
});
// Public account removal does not disclose whether the address is registered.
router.post('/request-delete-code', publicRemovalRequestLimit, (req, res) => {
    res.set('Cache-Control', 'no-store');
    const email = (0, accountRemoval_1.accountRemovalEmail)(req.body?.email);
    if (!email) {
        res.status(400).json({ error: 'Geçerli bir e-posta adresi girin.' });
        return;
    }
    const config = (0, oneSignalEmail_1.getOneSignalEmailConfig)();
    const secret = (0, passwordReset_1.getPasswordResetSecret)();
    if (!config || !secret) {
        res.status(503).json({ error: REMOVAL_UNAVAILABLE });
        return;
    }
    const delivery = Promise.resolve().then(async () => {
        const removal = await (0, accountRemoval_1.issueAccountRemoval)(prismaClient_1.db.rawClient, { email }, secret);
        if (removal.status === 'issued')
            await (0, oneSignalEmail_1.sendOneSignalAccountRemovalEmail)(config, removal);
    }).catch(() => { logger_1.logger.error('AUTH', 'Hesap silme kodu hazırlanamadı.'); });
    if (process.env.VERCEL)
        (0, functions_1.waitUntil)(delivery);
    res.json({ success: true, message: REMOVAL_ACCEPTED, resendAfterSeconds: accountRemoval_1.REMOVAL_RESEND_SECONDS });
});
async function finishAccountRemoval(req, res, target) {
    res.set('Cache-Control', 'no-store');
    const code = req.body?.code;
    if (typeof code !== 'string' || !/^[0-9]{6}$/.test(code.trim())) {
        res.status(400).json({ error: 'E-postanızdaki 6 haneli doğrulama kodunu girin.' });
        return;
    }
    const secret = (0, passwordReset_1.getPasswordResetSecret)();
    if (!secret) {
        res.status(503).json({ error: REMOVAL_UNAVAILABLE });
        return;
    }
    try {
        const removed = await (0, accountRemoval_1.confirmAccountRemoval)(prismaClient_1.db.rawClient, target, code.trim(), secret);
        if (!removed) {
            res.status(400).json({ error: INVALID_REMOVAL_CODE });
            return;
        }
        prismaClient_1.db.forgetDeletedAccount(removed.id);
        res.json({ success: true, message: 'Tavriko hesabınız kalıcı olarak silindi.' });
    }
    catch {
        logger_1.logger.error('AUTH', 'Hesap silme doğrulaması tamamlanamadı.');
        res.status(503).json({ error: REMOVAL_UNAVAILABLE });
    }
}
router.post('/delete-account', signedRemovalConfirmLimit, auth_1.requireUserAuth, async (req, res) => {
    await finishAccountRemoval(req, res, { id: req.authUserId });
});
router.post('/confirm-delete', publicRemovalConfirmLimit, async (req, res) => {
    const email = (0, accountRemoval_1.accountRemovalEmail)(req.body?.email);
    if (!email) {
        res.set('Cache-Control', 'no-store').status(400).json({ error: 'Geçerli bir e-posta adresi girin.' });
        return;
    }
    await finishAccountRemoval(req, res, { email });
});
const RESET_UNAVAILABLE = 'Şifre sıfırlama şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.';
const RESET_ACCEPTED = 'Bu e-posta bir şifreli hesaba bağlıysa doğrulama kodu gönderilir. Gelen kutunuzu ve spam klasörünüzü kontrol edin.';
function readResetIdentifier(body) {
    const value = body?.identifier ?? body?.email;
    if (typeof value !== 'string')
        return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized.length > 254)
        return null;
    return normalized;
}
router.post('/forgot-password', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const target = readResetIdentifier(req.body);
    if (!target) {
        res.status(400).json({ error: 'Lütfen kayıtlı e-posta adresinizi veya kullanıcı adınızı girin.' });
        return;
    }
    const config = (0, oneSignalEmail_1.getOneSignalEmailConfig)();
    const secret = (0, passwordReset_1.getPasswordResetSecret)();
    if (!config || !secret) {
        res.status(503).json({ error: RESET_UNAVAILABLE });
        return;
    }
    // Keep account lookup, the expensive OTP derivation and delivery out of the
    // public response path, so eligibility is not revealed by processing time.
    const delivery = Promise.resolve().then(async () => {
        const reset = await (0, passwordReset_1.issuePasswordReset)(prismaClient_1.db.rawClient, target, secret);
        if (reset)
            await (0, oneSignalEmail_1.sendOneSignalPasswordResetEmail)(config, reset);
    }).catch(() => {
        logger_1.logger.error('AUTH', 'Şifre sıfırlama kodu hazırlanamadı.');
    });
    if (process.env.VERCEL)
        (0, functions_1.waitUntil)(delivery);
    res.json({
        success: true,
        message: RESET_ACCEPTED,
        resendAfterSeconds: passwordReset_1.PASSWORD_RESET_RESEND_SECONDS,
    });
});
router.post('/reset-password', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const target = readResetIdentifier(req.body);
    const { otpCode, code, newPassword } = req.body || {};
    const finalCode = otpCode ?? code;
    if (!target || typeof finalCode !== 'string' || !/^\d{6}$/.test(finalCode.trim())) {
        res.status(400).json({ error: '6 haneli doğrulama kodunu eksiksiz girin.' });
        return;
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8 || Buffer.byteLength(newPassword) > 72) {
        res.status(400).json({ error: 'Yeni şifre en az 8 karakter olmalı ve 72 baytı aşmamalıdır.' });
        return;
    }
    const secret = (0, passwordReset_1.getPasswordResetSecret)();
    if (!secret) {
        res.status(503).json({ error: RESET_UNAVAILABLE });
        return;
    }
    try {
        const confirmed = await (0, passwordReset_1.confirmPasswordReset)(prismaClient_1.db.rawClient, {
            identifier: target, code: finalCode.trim(), password: newPassword,
        }, secret);
        if (!confirmed) {
            res.status(400).json({ error: 'Kod geçersiz, kullanılmış veya süresi dolmuş. Gerekirse yeni kod isteyin.' });
            return;
        }
        res.json({ success: true, message: 'Şifreniz başarıyla yenilendi!' });
    }
    catch {
        logger_1.logger.error('AUTH', 'Şifre sıfırlama doğrulaması tamamlanamadı.');
        res.status(503).json({ error: RESET_UNAVAILABLE });
    }
});
// SECURITY: profile updates are bound to the verified session identity. The old
// implementation fell back to the body-supplied userId when the token was missing
// or invalid, which allowed targeting any account.
router.put('/profile', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        if (!userId) {
            res.status(401).json({ error: 'Kullanıcı oturumu doğrulanamadı.' });
            return;
        }
        // The mailbox is the second factor for password reset and account removal.
        // Profile editing must not let a session silently change that destination.
        if (req.body?.email !== undefined) {
            res.status(400).json({ error: 'Kayıtlı e-posta adresi profil düzenleme ekranından değiştirilemez.' });
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
// Yasal metin onayı (Google ile giriş, metin güncellemesi sonrası yeniden onay vb.)
router.post('/legal-consent', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        if (!userId) {
            res.status(401).json({ error: 'Kullanıcı oturumu doğrulanamadı.' });
            return;
        }
        const { version, method } = req.body || {};
        if (version !== shared_1.LEGAL_VERSION) {
            res.status(409).json({ error: 'Yasal metinler güncellendi, lütfen güncel metni onaylayın.', legalVersion: shared_1.LEGAL_VERSION });
            return;
        }
        const safeMethod = method === 'google' || method === 'register' ? method : 'in_app';
        const updated = await prismaClient_1.db.updateUserSettings(userId, { legalConsent: buildLegalConsent(safeMethod) });
        logger_1.logger.info('AUTH', `Yasal metin onayı kaydedildi (${safeMethod}, ${shared_1.LEGAL_VERSION}): ${userId}`);
        res.json({ success: true, user: updated, legalVersion: shared_1.LEGAL_VERSION });
    }
    catch {
        logger_1.logger.warn('AUTH', 'Yasal metin onayı kalıcı olarak kaydedilemedi.');
        res.status(503).json({ error: 'Onay kaydedilemedi. Lütfen tekrar dene.' });
    }
});
// SECURITY: settings updates are bound to the verified session identity.
router.post('/settings', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        if (!userId) {
            res.status(401).json({ error: 'Kullanıcı oturumu doğrulanamadı.' });
            return;
        }
        const { settings } = req.body;
        // legalConsent yalnızca /legal-consent ucu tarafından sunucu saatiyle yazılır.
        const safeSettings = settings && typeof settings === 'object' ? { ...settings } : {};
        delete safeSettings.legalConsent;
        // Bekleyen kozmetik süreleri yalnızca sunucu tarafından yazılır.
        delete safeSettings.cosmeticStash;
        const updated = await prismaClient_1.db.updateUserSettings(userId, safeSettings);
        res.json({ success: true, user: updated });
    }
    catch {
        res.status(503).json({ error: 'Ayarlar kaydedilemedi. Lütfen tekrar dene.' });
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
// SECURITY: game stats are recorded against the verified session identity only.
router.post('/stats', auth_1.requireUserAuth, async (req, res) => {
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
            const recorded = await prismaClient_1.db.getRecordedMatchRewards(userId, code);
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
        const result = await prismaClient_1.db.recordMatchResult(userId, {
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
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// SECURITY: wallet sync is bound to the verified session identity; the token user
// is the only account whose wallet may be read. Bu uç artık SALT OKUNURDUR:
// istemciden gelen cüzdan değerleri yok sayılır, sunucudaki yetkili kayıt döndürülür.
router.post('/sync-wallet', auth_1.requireUserAuth, async (req, res) => {
    try {
        const userId = req.authUserId;
        if (!userId) {
            res.status(401).json({ error: 'Kullanıcı oturumu doğrulanamadı.' });
            return;
        }
        const updatedUser = await prismaClient_1.db.syncWallet(userId);
        res.json({ success: true, user: updatedUser });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get('/me', sessionProfileLimit, async (req, res) => {
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
    const profile = await prismaClient_1.db.getUserProfileAsync(payload.userId);
    if (!profile) {
        res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        return;
    }
    res.json(profile);
});
exports.default = router;
