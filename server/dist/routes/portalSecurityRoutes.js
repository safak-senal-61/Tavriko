"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.portalLogout = void 0;
exports.createManagedSession = createManagedSession;
exports.portalPasskeyConfig = portalPasskeyConfig;
exports.createPortalSecurityRouter = createPortalSecurityRouter;
const node_crypto_1 = require("node:crypto");
const express_1 = require("express");
const server_1 = require("@simplewebauthn/server");
const prismaClient_1 = require("../db/prismaClient");
const auth_1 = require("../middleware/auth");
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const credentialId = /^[A-Za-z0-9_-]{1,1024}$/;
const freshMs = 5 * 60_000;
function deviceLabel(agent) {
    const platform = /iPhone|iPad/.test(agent) ? 'iOS' : /Android/.test(agent) ? 'Android' : /Windows/.test(agent) ? 'Windows'
        : /Macintosh/.test(agent) ? 'macOS' : /Linux|X11/.test(agent) ? 'Linux' : 'Bilinmeyen cihaz';
    const browser = /Edg\//.test(agent) ? 'Edge' : /OPR\//.test(agent) ? 'Opera' : /Firefox\/|FxiOS\//.test(agent) ? 'Firefox'
        : /Chrome\/|CriOS\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : '';
    return [platform, browser].filter(Boolean).join(' · ');
}
async function createManagedSession(writer, req, account, method, passkeyId) {
    const id = (0, node_crypto_1.randomUUID)();
    const token = (0, auth_1.issueAdminSessionToken)(account.email, account.role, method !== 'password', id);
    if (!token)
        throw new Error('Portal session configuration');
    await writer.portalSession.create({ data: {
            id, email: account.email, method, device: deviceLabel(req.get('user-agent') || ''),
            expiresAt: new Date(Date.now() + (account.role === 'owner' ? auth_1.ADMIN_SESSION_MAX_AGE_SEC : 8 * 3600) * 1000), passkeyId,
        } });
    return token;
}
function portalPasskeyConfig() {
    try {
        const origin = new URL(process.env.PORTAL_WEBAUTHN_ORIGIN || '');
        if (origin.origin !== process.env.PORTAL_WEBAUTHN_ORIGIN ||
            (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && origin.hostname === 'localhost')))
            return null;
        return { origin: origin.origin, rpID: origin.hostname };
    }
    catch {
        return null;
    }
}
const portalLogout = (client = prismaClient_1.db.rawClient) => async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!(0, auth_1.sameOrigin)(req)) {
        res.status(403).json({ error: 'İşlemi yönetim panelinden başlatın.' });
        return;
    }
    const session = (0, auth_1.portalTokenClaims)(req, true);
    try {
        if (session)
            await client.portalSession.updateMany({ where: { id: session.id, revokedAt: null },
                data: { revokedAt: new Date(), revokedBy: session.email } });
        (0, auth_1.clearAdminSessionCookie)(res);
        res.json({ success: true });
    }
    catch {
        res.status(503).json({ error: 'Oturum kapatılamadı. Tekrar deneyin.' });
    }
};
exports.portalLogout = portalLogout;
function createPortalSecurityRouter(client = prismaClient_1.db.rawClient) {
    const router = (0, express_1.Router)();
    router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    router.use((req, res, next) => {
        if (req.method === 'POST' && (!(0, auth_1.sameOrigin)(req) || !req.is('application/json'))) {
            return res.status(403).json({ error: 'İşlemi Tavriko yönetim panelinden başlatın.' });
        }
        next();
    });
    async function saveChallenge(challenge, purpose, binding) {
        await client.portalWebAuthnChallenge.deleteMany({ where: { expiresAt: { lte: new Date() } } });
        return client.portalWebAuthnChallenge.create({ data: { id: (0, node_crypto_1.randomUUID)(), challenge, purpose, binding, expiresAt: new Date(Date.now() + 120_000) } });
    }
    async function consumeChallenge(id, purpose, binding) {
        if (typeof id !== 'string' || !uuid.test(id))
            return null;
        const where = { id, purpose, binding, expiresAt: { gt: new Date() } };
        const attempt = await client.portalWebAuthnChallenge.findFirst({ where });
        return attempt && (await client.portalWebAuthnChallenge.deleteMany({ where })).count === 1 ? attempt.challenge : null;
    }
    const expired = (res) => res.status(400).json({ error: 'Doğrulama isteği geçersiz veya süresi dolmuş.' });
    const denied = (res) => res.status(401).json({ error: 'Geçiş anahtarı doğrulanamadı.' });
    const unavailable = (res) => res.status(503).json({ error: 'Personel güvenliği işlemi şu anda tamamlanamıyor.' });
    function rp(req, res) {
        const config = portalPasskeyConfig();
        if (!config || req.get('origin') !== config.origin) {
            res.status(404).json({ error: 'Bu adreste geçiş anahtarı etkin değil.' });
            return null;
        }
        return config;
    }
    router.post('/passkeys/login/start', async (req, res) => {
        const config = rp(req, res);
        if (!config)
            return;
        try {
            const browserBinding = (0, node_crypto_1.randomUUID)();
            const options = await (0, server_1.generateAuthenticationOptions)({ rpID: config.rpID, userVerification: 'required', timeout: 120_000 });
            const attempt = await saveChallenge(options.challenge, 'login', browserBinding);
            res.cookie('tavriko_passkey_attempt', browserBinding, { path: '/api/portal/security/passkeys/login', httpOnly: true,
                sameSite: 'strict', secure: config.origin.startsWith('https:'), maxAge: 120_000 });
            res.json({ id: attempt.id, options });
        }
        catch {
            unavailable(res);
        }
    });
    router.post('/passkeys/login/finish', async (req, res) => {
        const config = rp(req, res);
        if (!config)
            return;
        const { id, response } = (req.body || {});
        const bound = (req.get('cookie') || '').match(/(?:^|;\s*)tavriko_passkey_attempt=([a-f0-9-]{36})(?:;|$)/i)?.[1];
        if (!bound || !response || typeof response.id !== 'string' || !credentialId.test(response.id))
            return denied(res);
        try {
            const challenge = await consumeChallenge(id, 'login', bound);
            if (!challenge)
                return expired(res);
            const key = await client.portalPasskey.findUnique({ where: { id: response.id } });
            const account = key && (0, auth_1.portalAccount)(key.email);
            if (!account || !key || (0, auth_1.portalFactor)(account.email) === 'unavailable')
                return denied(res);
            const result = await (0, server_1.verifyAuthenticationResponse)({ response, expectedChallenge: challenge, expectedOrigin: config.origin, expectedRPID: config.rpID,
                requireUserVerification: true, credential: { id: key.id, publicKey: new Uint8Array(key.publicKey), counter: Number(key.counter) } }).catch(() => null);
            if (!result?.verified)
                return denied(res);
            const token = await client.$transaction(async (tx) => {
                const updated = await tx.portalPasskey.updateMany({ where: { id: key.id, counter: key.counter },
                    data: { counter: BigInt(result.authenticationInfo.newCounter) } });
                return updated.count ? createManagedSession(tx, req, account, 'passkey', key.id) : null;
            });
            if (!token)
                return denied(res);
            (0, auth_1.setAdminSessionCookie)(req, res, token, account.role);
            res.json({ success: true, role: account.role });
        }
        catch {
            unavailable(res);
        }
    });
    router.use(async (req, res, next) => {
        const session = await (0, auth_1.getAdminSessionFromRequest)(req, client, true);
        if (!session) {
            res.status(401).json({ error: 'Portal oturumu gerekli.' });
            return;
        }
        res.locals.securitySession = session;
        next();
    });
    router.get('/sessions', async (req, res) => {
        const actor = res.locals.securitySession;
        const team = req.query.scope === 'team';
        if (team && actor.role !== 'owner')
            return res.status(403).json({ error: 'Ekip oturumları yalnız portal sahibine açıktır.' });
        try {
            const now = new Date();
            const recent = await client.portalSession.findMany({ where: { ...(team ? { email: { not: actor.email } } : { email: actor.email }),
                    revokedAt: null, expiresAt: { gt: now } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 101,
                select: { id: true, email: true, device: true, method: true, createdAt: true, expiresAt: true } });
            // Expired sessions never authorize requests, even before cleanup.
            await client.portalSession.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 30 * 86_400_000) } } });
            const config = portalPasskeyConfig();
            res.json({ items: recent.slice(0, 100), more: recent.length > 100, current: actor.id,
                keysEnabled: Boolean(config && new URL(config.origin).host === req.get('host')),
                canEnroll: actor.method === 'totp' && Date.now() - actor.createdAt.getTime() < freshMs });
        }
        catch {
            unavailable(res);
        }
    });
    router.post('/sessions/:id/revoke', async (req, res) => {
        const actor = res.locals.securitySession;
        const id = req.params.id;
        if (typeof id !== 'string' || !uuid.test(id))
            return res.status(404).json({ error: 'Oturum bulunamadı.' });
        try {
            const result = await client.portalSession.updateMany({ where: { id, ...(actor.role === 'owner' ? {} : { email: actor.email }),
                    revokedAt: null, expiresAt: { gt: new Date() } }, data: { revokedAt: new Date(), revokedBy: actor.email } });
            if (!result.count)
                return res.status(404).json({ error: 'Oturum bulunamadı veya zaten kapatıldı.' });
            if (actor.id === id)
                (0, auth_1.clearAdminSessionCookie)(res);
            res.json({ success: true, current: actor.id === id });
        }
        catch {
            unavailable(res);
        }
    });
    router.get('/passkeys', async (_req, res) => {
        const actor = res.locals.securitySession;
        try {
            res.json({ items: await client.portalPasskey.findMany({ where: { email: actor.email }, select: { id: true, createdAt: true },
                    orderBy: { createdAt: 'desc' }, take: 10 }) });
        }
        catch {
            unavailable(res);
        }
    });
    function freshTotp(actor, res) {
        if (actor.method === 'totp' && Date.now() - actor.createdAt.getTime() < freshMs)
            return true;
        res.status(403).json({ error: 'Anahtarları değiştirmek için son 5 dakika içinde şifre ve doğrulama koduyla giriş yapın.' });
        return false;
    }
    router.post('/passkeys/register/start', async (req, res) => {
        const actor = res.locals.securitySession;
        const config = rp(req, res);
        if (!config || !freshTotp(actor, res))
            return;
        try {
            const keys = await client.portalPasskey.findMany({ where: { email: actor.email }, select: { id: true }, take: 10 });
            if (keys.length >= 10)
                return res.status(409).json({ error: 'En fazla 10 geçiş anahtarı kaydedilebilir.' });
            const options = await (0, server_1.generateRegistrationOptions)({ rpID: config.rpID, rpName: 'Tavriko Yönetim', userName: actor.email,
                userID: new Uint8Array((0, node_crypto_1.createHash)('sha256').update(`portal:${actor.email}`).digest()), excludeCredentials: keys,
                attestationType: 'none', timeout: 120_000, authenticatorSelection: { residentKey: 'required', userVerification: 'required' } });
            const attempt = await saveChallenge(options.challenge, 'register', actor.id);
            res.json({ id: attempt.id, options });
        }
        catch {
            unavailable(res);
        }
    });
    router.post('/passkeys/register/finish', async (req, res) => {
        const actor = res.locals.securitySession;
        const config = rp(req, res);
        if (!config || !freshTotp(actor, res))
            return;
        const { id, response } = (req.body || {});
        if (!response || typeof response.id !== 'string' || !credentialId.test(response.id))
            return expired(res);
        try {
            const challenge = await consumeChallenge(id, 'register', actor.id);
            if (!challenge)
                return expired(res);
            const result = await (0, server_1.verifyRegistrationResponse)({ response, expectedChallenge: challenge, expectedOrigin: config.origin,
                expectedRPID: config.rpID, requireUserVerification: true }).catch(() => null);
            if (!result?.verified || !result.registrationInfo)
                return expired(res);
            const key = result.registrationInfo.credential;
            const saved = await client.$transaction(async (tx) => {
                await tx.$queryRaw `SELECT pg_advisory_xact_lock(hashtext(${actor.email}))::text`;
                if (await tx.portalPasskey.count({ where: { email: actor.email } }) >= 10)
                    return false;
                await tx.portalPasskey.create({ data: { id: key.id, email: actor.email, publicKey: key.publicKey, counter: BigInt(key.counter) } });
                return true;
            });
            if (!saved)
                return res.status(409).json({ error: 'Anahtar sınırına ulaşıldı.' });
            res.status(201).json({ success: true });
        }
        catch {
            unavailable(res);
        }
    });
    router.post('/passkeys/remove', async (req, res) => {
        const actor = res.locals.securitySession;
        if (!rp(req, res) || !freshTotp(actor, res))
            return;
        const id = req.body?.id;
        if (typeof id !== 'string' || !credentialId.test(id))
            return res.status(400).json({ error: 'Anahtar geçersiz.' });
        try {
            const removed = await client.$transaction(async (tx) => {
                const result = await tx.portalPasskey.deleteMany({ where: { id, email: actor.email } });
                if (result.count)
                    await tx.portalSession.updateMany({ where: { email: actor.email, passkeyId: id, revokedAt: null },
                        data: { revokedAt: new Date(), revokedBy: actor.email } });
                return result.count;
            });
            if (!removed)
                return res.status(404).json({ error: 'Anahtar bulunamadı.' });
            res.json({ success: true });
        }
        catch {
            unavailable(res);
        }
    });
    return router;
}
