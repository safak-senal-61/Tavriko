/**
 * Firebase Cloud Messaging (FCM) doğrudan gönderim servisi.
 *
 * Android cihazlar `expo-notifications` ile FCM device token alır ve
 * `POST /api/push/register` üzerinden sunucuya kaydeder. Bu modül, kayıtlı
 * FCM token'lara bildirimi Google'ın FCM API'si üzerinden doğrudan iletir
 * (Expo push servisine bağımlı değildir).
 *
 * Güvenlik:
 *  - Service account anahtarı YALNIZCA `FIREBASE_SERVICE_ACCOUNT` ortam
 *    değişkeninden okunur (düz JSON veya base64 JSON). Repoya, istemciye
 *    veya loglara asla yazılmaz — Supabase anahtarlarıyla aynı kural.
 *  - Değişken tanımsızsa modül sessizce devre dışı kalır; oyun akışı
 *    bildirim yüzünden asla bozulmaz.
 */
import { logger } from '../utils/logger';

type MessagingModule = typeof import('firebase-admin/messaging');

interface FcmSendResult {
  sent: number;
  invalidTokens: string[];
}

const FCM_CHUNK_SIZE = 500;

interface MessagingLike {
  sendEach(messages: Array<Record<string, unknown>>): Promise<{
    responses: Array<{ success: boolean; error?: { code?: string; message?: string } }>;
  }>;
}

let messaging: MessagingLike | null = null;
let initAttempted = false;
let disabledReason = '';

/** FIREBASE_SERVICE_ACCOUNT değerini (düz JSON veya base64) çözer. */
function decodeServiceAccount(): Record<string, unknown> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    try {
      const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

/** firebase-admin'ı lazy yükleyip Messaging örneğini döndürür (veya null). */
function getMessagingInstance(): MessagingLike | null {
  if (initAttempted) return messaging;
  initAttempted = true;

  const serviceAccount = decodeServiceAccount();
  if (!serviceAccount) {
    disabledReason = 'FIREBASE_SERVICE_ACCOUNT tanımlı değil';
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { initializeApp, cert, getApps } = require('firebase-admin/app') as typeof import('firebase-admin/app');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getMessaging } = require('firebase-admin/messaging') as MessagingModule;
    const appName = 'tavriko-fcm';
    const app =
      getApps().find((a) => a.name === appName) ||
      initializeApp({ credential: cert(serviceAccount as never) }, appName);
    const m = getMessaging(app);
    messaging = m as unknown as MessagingLike;
  } catch (e: any) {
    disabledReason = e?.message || String(e);
    logger.warn('SYSTEM', `FCM başlatılamadı: ${disabledReason}`);
    messaging = null;
  }
  return messaging;
}

/** FCM doğrudan gönderimi aktif mi? (test ve teşhis için) */
export function isFcmEnabled(): boolean {
  return getMessagingInstance() !== null;
}

/** FCM data payload değerleri string olmalı; objeler JSON'a çevrilir. */
function stringifyData(data?: Record<string, unknown>): Record<string, string> | undefined {
  if (!data) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  return out;
}

/**
 * FCM device token listesine bildirim gönderir.
 * @returns gönderilen mesaj sayısı ve geçersiz (temizlenmesi gereken) tokenlar.
 */
export async function sendFcmToTokens(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, unknown> }
): Promise<FcmSendResult> {
  const messagingInstance = getMessagingInstance();
  if (!messagingInstance) {
    if (tokens.length) {
      logger.warn('SYSTEM', `FCM devre dışı (${disabledReason}); ${tokens.length} Android bildirimi gönderilemedi.`);
    }
    return { sent: 0, invalidTokens: [] };
  }

  let sent = 0;
  const invalidTokens: string[] = [];

  for (let i = 0; i < tokens.length; i += FCM_CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + FCM_CHUNK_SIZE);
    const messages = chunk.map((token) => ({
      token,
      notification: { title: payload.title, body: payload.body },
      ...(payload.data ? { data: stringifyData(payload.data) } : {}),
      android: { priority: 'high' as const },
    }));
    try {
      const result = await messagingInstance.sendEach(messages);
      result.responses.forEach((response, j) => {
        if (response.success) {
          sent++;
        } else {
          const code = response.error?.code || '';
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            invalidTokens.push(chunk[j]);
          } else {
            logger.warn('SYSTEM', `FCM gönderim hatası: ${code} ${response.error?.message || ''}`);
          }
        }
      });
    } catch (e: any) {
      logger.warn('SYSTEM', `FCM gönderimi başarısız: ${e?.message || e}`);
    }
  }

  return { sent, invalidTokens };
}
