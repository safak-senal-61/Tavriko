import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger';

const EMAIL_ENDPOINT = 'https://api.onesignal.com/notifications?c=email';

export function getOneSignalEmailConfig() {
  const appId = process.env.ONESIGNAL_APP_ID?.trim();
  const apiKey = process.env.ONESIGNAL_APP_API_KEY?.trim();
  if (!appId || !apiKey || !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(appId)) {
    return null;
  }
  return { appId, apiKey };
}

export async function sendOneSignalPasswordResetEmail(
  config: NonNullable<ReturnType<typeof getOneSignalEmailConfig>>,
  reset: { email: string; code: string; validMinutes: number },
): Promise<void> {
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
        idempotency_key: randomUUID(),
      }),
    });
    const result: unknown = response.ok ? await response.json() : null;
    if (!result || typeof result !== 'object' || !('id' in result) ||
        typeof result.id !== 'string' || !result.id.trim()) {
      // Do not log the address, response body, API key, or OTP.
      logger.warn('AUTH', 'OneSignal şifre sıfırlama e-postasını kabul etmedi.', { status: response.status });
    }
  } catch {
    logger.warn('AUTH', 'OneSignal şifre sıfırlama e-postası gönderilemedi.');
  }
}
