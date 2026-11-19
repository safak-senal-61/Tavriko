"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.otpFingerprint = void 0;
exports.parseOtpSecret = parseOtpSecret;
exports.otpCode = otpCode;
exports.consumeOtp = consumeOtp;
const node_crypto_1 = require("node:crypto");
// RFC 6238: six digits, SHA-1, 30 seconds. Keep provisioning out of the browser.
function parseOtpSecret(secret) {
    if (typeof secret !== 'string' || !/^[A-Z2-7]{32,64}$/.test(secret))
        return null;
    let n = 0, bits = 0;
    const bytes = [];
    for (const c of secret) {
        n = (n << 5) | 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c);
        bits += 5;
        if (bits >= 8) {
            bits -= 8;
            bytes.push((n >> bits) & 255);
        }
    }
    return (n & ((1 << bits) - 1)) === 0 ? Buffer.from(bytes) : null;
}
function otpCode(secret, step) {
    const bytes = Buffer.alloc(8);
    bytes.writeBigUInt64BE(BigInt(step));
    const hash = (0, node_crypto_1.createHmac)('sha1', secret).update(bytes).digest();
    return String((hash.readUInt32BE(hash[19] & 15) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
const otpFingerprint = (secret) => (0, node_crypto_1.createHash)('sha256').update(secret).digest('hex');
exports.otpFingerprint = otpFingerprint;
async function consumeOtp(client, email, secret, code, now = Date.now()) {
    const window = Math.floor(now / 300_000);
    const step = Math.floor(now / 30_000);
    const factor = (0, exports.otpFingerprint)(secret);
    return client.$transaction(async (tx) => {
        await tx.$executeRaw `INSERT INTO "portal_otp_states" ("email","factor","window","attempts") VALUES (${email},${factor},${window},0) ON CONFLICT DO NOTHING`;
        const [state] = await tx.$queryRaw `
      SELECT "factor","lastStep","window","attempts" FROM "portal_otp_states" WHERE "email"=${email} FOR UPDATE`;
        const attempts = state.window === window ? state.attempts : 0;
        if (attempts >= 8)
            return 'limited';
        const lastStep = state.factor === factor ? state.lastStep : -1;
        const matched = [step, step - 1, step + 1].find(t => t > lastStep && (0, node_crypto_1.timingSafeEqual)(Buffer.from(otpCode(secret, t)), Buffer.from(code)));
        await tx.portalOtpState.update({ where: { email }, data: {
                factor, lastStep: matched ?? lastStep, window, attempts: attempts + 1,
            } });
        return matched === undefined ? 'invalid' : 'ok';
    });
}
