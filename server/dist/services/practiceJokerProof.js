"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJokerSigningSecret = exports.practiceSessionPattern = void 0;
exports.sealPracticeJoker = sealPracticeJoker;
exports.readPracticeJoker = readPracticeJoker;
const node_crypto_1 = require("node:crypto");
exports.practiceSessionPattern = /^sess_[a-f0-9]{32}$/;
const getJokerSigningSecret = () => process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || '';
exports.getJokerSigningSecret = getJokerSigningSecret;
const key = (secret) => (0, node_crypto_1.createHmac)('sha256', secret).update('tavriko:practice-joker:v2').digest();
const scopeBytes = ({ userId, sessionId, questionId }) => Buffer.from(JSON.stringify([userId, sessionId, questionId]));
function sealPracticeJoker(scope, question, deadline, secret) {
    const nonce = (0, node_crypto_1.randomBytes)(12);
    const cipher = (0, node_crypto_1.createCipheriv)('aes-256-gcm', key(secret), nonce);
    cipher.setAAD(scopeBytes(scope));
    const data = Buffer.concat([cipher.update(JSON.stringify({ deadline, options: question.options, correctOptionId: question.correctOptionId })), cipher.final()]);
    return `v2.${Buffer.concat([nonce, cipher.getAuthTag(), data]).toString('base64url')}`;
}
function readPracticeJoker(proof, scope, secret) {
    if (typeof proof !== 'string' || proof.length > 64_000 || !secret)
        return null;
    if (/^\d{13}\.[a-f0-9]{64}$/.test(proof)) {
        const [deadline, signature] = proof.split('.');
        const expected = (0, node_crypto_1.createHmac)('sha256', secret).update(JSON.stringify(['practice-joker', scope.userId, scope.sessionId, scope.questionId, Number(deadline)])).digest();
        return (0, node_crypto_1.timingSafeEqual)(expected, Buffer.from(signature, 'hex')) ? { deadline: Number(deadline) } : null;
    }
    if (!/^v2\.[A-Za-z0-9_-]+$/.test(proof))
        return null;
    try {
        const data = Buffer.from(proof.slice(3), 'base64url');
        const cipher = (0, node_crypto_1.createDecipheriv)('aes-256-gcm', key(secret), data.subarray(0, 12));
        cipher.setAAD(scopeBytes(scope));
        cipher.setAuthTag(data.subarray(12, 28));
        const decoded = JSON.parse(Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString());
        if (!Number.isSafeInteger(decoded.deadline) || !Array.isArray(decoded.options) ||
            !decoded.options.some(option => option.id === decoded.correctOptionId))
            return null;
        return { deadline: decoded.deadline, question: { options: decoded.options, correctOptionId: decoded.correctOptionId } };
    }
    catch {
        return null;
    }
}
