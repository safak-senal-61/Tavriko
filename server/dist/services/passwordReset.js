"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PASSWORD_RESET_TOKEN_PREFIX = exports.PASSWORD_RESET_RESEND_SECONDS = exports.PASSWORD_RESET_VALID_MINUTES = void 0;
exports.getPasswordResetSecret = getPasswordResetSecret;
exports.issuePasswordReset = issuePasswordReset;
exports.confirmPasswordReset = confirmPasswordReset;
const node_crypto_1 = require("node:crypto");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
exports.PASSWORD_RESET_VALID_MINUTES = 15;
exports.PASSWORD_RESET_RESEND_SECONDS = 60;
exports.PASSWORD_RESET_TOKEN_PREFIX = 'password-reset:';
const MAX_ATTEMPTS = 5;
function getPasswordResetSecret() {
    return process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || '';
}
async function lockAccount(tx, identifier) {
    const byEmail = identifier.includes('@');
    const where = byEmail ? { email: identifier } : { username: identifier };
    const match = await tx.user.findUnique({ where, select: { id: true } });
    if (!match || match.id.startsWith('guest_'))
        return null;
    // Serializes resends, guesses and consumption across serverless instances.
    const locked = await tx.$queryRaw `SELECT id FROM users WHERE id = ${match.id} FOR UPDATE`;
    if (!locked.length)
        return null;
    const account = await tx.user.findUnique({
        where,
        select: { id: true, email: true, passwordHash: true },
    });
    if (!account || account.id !== match.id || !account.passwordHash || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email)) {
        return null;
    }
    return { ...account, passwordHash: account.passwordHash };
}
const tokenId = (id) => `${exports.PASSWORD_RESET_TOKEN_PREFIX}${id}`;
function digest(secret, account, code) {
    // Bind to the current mailbox and password, so changing either invalidates the code.
    return (0, node_crypto_1.createHmac)('sha256', secret)
        .update(JSON.stringify(['password-reset-v1', account.id, account.email, account.passwordHash, code]))
        .digest('hex');
}
async function issuePasswordReset(db, identifier, secret) {
    return db.$transaction(async (tx) => {
        const account = await lockAccount(tx, identifier);
        if (!account)
            return null;
        const id = tokenId(account.id);
        const existing = await tx.passwordResetToken.findUnique({ where: { id } });
        const now = new Date();
        if (existing && now.getTime() - existing.createdAt.getTime() < exports.PASSWORD_RESET_RESEND_SECONDS * 1000) {
            return null;
        }
        let code;
        let mac;
        do {
            code = (0, node_crypto_1.randomInt)(1_000_000).toString().padStart(6, '0');
            mac = digest(secret, account, code);
        } while (existing?.code.endsWith(`:${mac}`));
        const data = {
            email: account.email,
            // Store the version, attempt count and keyed digest in the existing column.
            // This slot never matches the legacy account-deletion flow's raw six-digit code.
            code: `v1:0:${mac}`,
            used: false,
            createdAt: now,
            expiresAt: new Date(now.getTime() + exports.PASSWORD_RESET_VALID_MINUTES * 60_000),
        };
        await tx.passwordResetToken.upsert({ where: { id }, create: { id, ...data }, update: data });
        return { email: account.email, code, validMinutes: exports.PASSWORD_RESET_VALID_MINUTES };
    });
}
async function confirmPasswordReset(db, input, secret) {
    return db.$transaction(async (tx) => {
        const account = await lockAccount(tx, input.identifier);
        if (!account)
            return false;
        const id = tokenId(account.id);
        const active = await tx.passwordResetToken.findUnique({ where: { id } });
        if (!active || active.used || active.email !== account.email || active.expiresAt.getTime() <= Date.now()) {
            return false;
        }
        const parts = /^v1:([0-4]):([a-f0-9]{64})$/.exec(active.code);
        if (!parts)
            return false;
        const [, failures, storedMac] = parts;
        const candidateMac = digest(secret, account, input.code);
        if (!(0, node_crypto_1.timingSafeEqual)(Buffer.from(storedMac, 'hex'), Buffer.from(candidateMac, 'hex'))) {
            const attempts = Number(failures) + 1;
            await tx.passwordResetToken.update({
                where: { id }, data: { code: `v1:${attempts}:${storedMac}`, used: attempts >= MAX_ATTEMPTS },
            });
            return false;
        }
        await tx.user.update({
            where: { id: account.id }, data: { passwordHash: await bcryptjs_1.default.hash(input.password, 10) },
        });
        await tx.passwordResetToken.update({ where: { id }, data: { used: true } });
        return true;
    });
}
