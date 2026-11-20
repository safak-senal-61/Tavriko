"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOneSignalEmailConfig = getOneSignalEmailConfig;
exports.sendOneSignalPasswordResetEmail = sendOneSignalPasswordResetEmail;
const node_crypto_1 = require("node:crypto");
const logger_1 = require("../utils/logger");
const EMAIL_ENDPOINT = 'https://api.onesignal.com/notifications?c=email';
function getOneSignalEmailConfig() {
    const appId = process.env.ONESIGNAL_APP_ID?.trim();
    const apiKey = process.env.ONESIGNAL_APP_API_KEY?.trim();
    if (!appId || !apiKey || !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(appId)) {
        return null;
    }
    return { appId, apiKey };
}
async function sendOneSignalPasswordResetEmail(config, reset) {
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
                email_to: [reset.email],
                email_subject: 'Tavriko şifre sıfırlama kodunuz',
                email_preheader: 'Tek kullanımlık doğrulama kodunuz',
                email_body: `<html lang="tr"><body><h1>Tavriko şifre sıfırlama</h1><p>Şifrenizi yenilemek için aşağıdaki kodu Tavriko’ya girin:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${reset.code}</p><p>Bu kod ${reset.validMinutes} dakika geçerlidir. Kimseyle paylaşmayın.</p><p>Bu isteği siz yapmadıysanız e-postayı yok sayabilirsiniz.</p></body></html>`,
                include_unsubscribed: true,
                disable_email_click_tracking: true,
                idempotency_key: (0, node_crypto_1.randomUUID)(),
            }),
        });
        const result = response.ok ? await response.json() : null;
        if (!result || typeof result !== 'object' || !('id' in result) ||
            typeof result.id !== 'string' || !result.id.trim()) {
            // Do not log the address, response body, API key, or OTP.
            logger_1.logger.warn('AUTH', 'OneSignal şifre sıfırlama e-postasını kabul etmedi.', { status: response.status });
        }
    }
    catch {
        logger_1.logger.warn('AUTH', 'OneSignal şifre sıfırlama e-postası gönderilemedi.');
    }
}
