import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger';
import { renderPasswordResetEmail } from './passwordResetEmail';
import { ACCOUNT_REMOVAL_PREHEADER, ACCOUNT_REMOVAL_SUBJECT, renderAccountRemovalEmail } from './accountRemovalEmail';

const EMAIL_ENDPOINT = 'https://api.onesignal.com/notifications?c=email';
const UUID_V4 = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
// These are public resource identifiers, not credentials. Only use the
// Tavriko-hosted asset with the OneSignal app that owns it.
const TAVRIKO_APP_ID = 'bb6deff9-50fa-4867-a17d-bf87ab8f2338';
const TAVRIKO_REMOVAL_TEMPLATE_ID = 'f67ab633-4b54-42b3-a6f0-dbeff95328af';

export function getOneSignalEmailConfig() {
  const appId = process.env.ONESIGNAL_APP_ID?.trim();
  const apiKey = process.env.ONESIGNAL_APP_API_KEY?.trim();
  if (!appId || !apiKey || !UUID_V4.test(appId)) {
    return null;
  }
  return { appId, apiKey };
}

export async function sendOneSignalPasswordResetEmail(
  config: NonNullable<ReturnType<typeof getOneSignalEmailConfig>>,
  reset: { email: string; code: string; validMinutes: number },
): Promise<void> {
  await sendTransactionalEmail(config, reset.email, {
    email_subject: 'Tavriko şifre sıfırlama kodunuz',
    email_preheader: 'Şifrenizi yenilemek için tek kullanımlık kodunuzu Tavriko’ya girin.',
    email_body: renderPasswordResetEmail(reset),
  });
}

export async function sendOneSignalAccountRemovalEmail(
  config: NonNullable<ReturnType<typeof getOneSignalEmailConfig>>,
  removal: { email: string; code: string; validMinutes: number },
): Promise<boolean> {
  const override = process.env.ONESIGNAL_ACCOUNT_REMOVAL_TEMPLATE_ID?.trim();
  const templateId = override === 'inline' ? null : override && UUID_V4.test(override) ? override
    : config.appId.toLowerCase() === TAVRIKO_APP_ID ? TAVRIKO_REMOVAL_TEMPLATE_ID : null;
  return sendTransactionalEmail(config, removal.email, {
    name: 'Tavriko | Hesap silme OTP',
    email_subject: ACCOUNT_REMOVAL_SUBJECT,
    email_preheader: ACCOUNT_REMOVAL_PREHEADER,
    ...(templateId
      ? { template_id: templateId, custom_data: { code: removal.code, valid_minutes: removal.validMinutes } }
      : { email_body: renderAccountRemovalEmail(removal) }),
  });
}

type EmailMessage = { name?: string; email_subject: string; email_preheader: string } & (
  { email_body: string } | { template_id: string; custom_data: { code: string; valid_minutes: number } }
);

export function sendOneSignalSupportEmail(
  config: NonNullable<ReturnType<typeof getOneSignalEmailConfig>>,
  email: string,
  message: Extract<EmailMessage, { email_body: string }>,
): Promise<boolean> {
  return sendTransactionalEmail(config, email, message, 'support');
}

async function sendTransactionalEmail(
  config: NonNullable<ReturnType<typeof getOneSignalEmailConfig>>,
  email: string,
  message: EmailMessage,
  purpose: 'security' | 'support' = 'security',
): Promise<boolean> {
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
        idempotency_key: randomUUID(),
      }),
    });
    const result: unknown = response.ok ? await response.json() : null;
    if (!result || typeof result !== 'object' || !('id' in result) ||
        typeof result.id !== 'string' || !result.id.trim()) {
      // Do not log the address, response body, API key, or OTP.
      logger.warn(purpose === 'security' ? 'AUTH' : 'SYSTEM', 'OneSignal işlem e-postasını kabul etmedi.', { status: response.status });
      return false;
    }
    return true;
  } catch {
    logger.warn(purpose === 'security' ? 'AUTH' : 'SYSTEM', 'OneSignal işlem e-postası gönderilemedi.');
    return false;
  }
}
