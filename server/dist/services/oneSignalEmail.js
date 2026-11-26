"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOneSignalEmailConfig = getOneSignalEmailConfig;
exports.sendOneSignalPasswordResetEmail = sendOneSignalPasswordResetEmail;
exports.sendOneSignalAccountRemovalEmail = sendOneSignalAccountRemovalEmail;
exports.sendOneSignalSupportEmail = sendOneSignalSupportEmail;
const node_crypto_1 = require("node:crypto");
const logger_1 = require("../utils/logger");
const passwordResetEmail_1 = require("./passwordResetEmail");
const accountRemovalEmail_1 = require("./accountRemovalEmail");
const EMAIL_ENDPOINT = 'https://api.onesignal.com/notifications?c=email';
const UUID_V4 = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
// These are public resource identifiers, not credentials. Only use the
// Tavriko-hosted asset with the OneSignal app that owns it.
const TAVRIKO_APP_ID = 'bb6deff9-50fa-4867-a17d-bf87ab8f2338';
const TAVRIKO_REMOVAL_TEMPLATE_ID = 'f67ab633-4b54-42b3-a6f0-dbeff95328af';
function getOneSignalEmailConfig() {
    const appId = process.env.ONESIGNAL_APP_ID?.trim();
    const apiKey = process.env.ONESIGNAL_APP_API_KEY?.trim();
    if (!appId || !apiKey || !UUID_V4.test(appId)) {
        return null;
    }
    return { appId, apiKey };
}
async function sendOneSignalPasswordResetEmail(config, reset) {
    await sendTransactionalEmail(config, reset.email, {
        email_subject: 'Tavriko şifre sıfırlama kodunuz',
        email_preheader: 'Şifrenizi yenilemek için tek kullanımlık kodunuzu Tavriko’ya girin.',
        email_body: (0, passwordResetEmail_1.renderPasswordResetEmail)(reset),
    });
}
async function sendOneSignalAccountRemovalEmail(config, removal) {
    const override = process.env.ONESIGNAL_ACCOUNT_REMOVAL_TEMPLATE_ID?.trim();
    const templateId = override === 'inline' ? null : override && UUID_V4.test(override) ? override
        : config.appId.toLowerCase() === TAVRIKO_APP_ID ? TAVRIKO_REMOVAL_TEMPLATE_ID : null;
    return sendTransactionalEmail(config, removal.email, {
        name: 'Tavriko | Hesap silme OTP',
        email_subject: accountRemovalEmail_1.ACCOUNT_REMOVAL_SUBJECT,
        email_preheader: accountRemovalEmail_1.ACCOUNT_REMOVAL_PREHEADER,
        ...(templateId
            ? { template_id: templateId, custom_data: { code: removal.code, valid_minutes: removal.validMinutes } }
            : { email_body: (0, accountRemovalEmail_1.renderAccountRemovalEmail)(removal) }),
    });
}
function sendOneSignalSupportEmail(config, email, message) {
    return sendTransactionalEmail(config, email, message, 'support');
}
async function sendTransactionalEmail(config, email, message, purpose = 'security') {
    try {
        const response = await fetch(EMAIL_ENDPOINT, {
            method: 'POST',
            headers: {
                Authorization: `Key ${config.apiKey}`,
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(5000),
            redirect: 'error',
            body: JSON.stringify({
                app_id: config.appId,
                email_to: [email],
                ...message,
                include_unsubscribed: true,
                disable_email_click_tracking: true,
                idempotency_key: (0, node_crypto_1.randomUUID)(),
            }),
        });
        const result = response.ok ? await response.json() : null;
        if (!result || typeof result !== 'object' || !('id' in result) ||
            typeof result.id !== 'string' || !result.id.trim()) {
            // Do not log the address, response body, API key, or OTP.
            logger_1.logger.warn(purpose === 'security' ? 'AUTH' : 'SYSTEM', 'OneSignal işlem e-postasını kabul etmedi.', { status: response.status });
            return false;
        }
        return true;
    }
    catch {
        logger_1.logger.warn(purpose === 'security' ? 'AUTH' : 'SYSTEM', 'OneSignal işlem e-postası gönderilemedi.');
        return false;
    }
}
