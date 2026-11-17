/**
 * Firebase Cloud Messaging (FCM) doğrudan gönderim servisi.
 *
 * Android cihazlar `expo-notifications` ile FCM device token alır ve
 * `POST /api/push/register` üzerinden sunucuya kaydeder. Bu modül, kayıtlı
 * FCM token'lara bildirimi Google'ın FCM API'si üzerinden doğrudan iletir
 * (Expo push servisine bağımlı değildir).
 *
 * Güvenlik:
 *  - Service account anahtarı YALNIZCA ortam değişkenlerinden okunur:
 *    ya `FIREBASE_SERVICE_ACCOUNT` (düz JSON veya base64 JSON) ya da ayrı
 *    ayrı `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` +
 *    `FIREBASE_PRIVATE_KEY` (Vercel'de tercih edilen yöntem). Repoya,
 *    istemciye veya loglara asla yazılmaz — Supabase anahtarlarıyla aynı kural.
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
  if (raw && raw.trim()) {
    const trimmed = raw.trim();
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      try {
        const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
        return JSON.parse(decoded) as Record<string, unknown>;
      } catch {
        // tek değişken bozuksa ayrı değişkenlere düş
      }
    }
  }
  return decodeServiceAccountFromParts();
}

/**
 * Ayrı ortam değişkenlerinden service account oluşturur (Vercel'de JSON'un
 * tamamını yapıştırmak satır sonu karakterlerinden dolayı bozulduğu için
 * tercih edilen yöntem):
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 * FIREBASE_PRIVATE_KEY içindeki literal "\n" dizileri gerçek satır sonuna
 * çevrilir (Vercel paneline yapıştırılan tek satırlık anahtar için).
 */
function decodeServiceAccountFromParts(): Record<string, unknown> | null {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  let privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  if (!projectId || !clientEmail || !privateKey) return null;
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }
  if (!privateKey.includes('\n')) {
    // Tek satır halinde PEM (başlık/gövde/sonu bitişik): standart biçime çevir
    const m = /^-----BEGIN PRIVATE KEY-----(.+)-----END PRIVATE KEY-----$/.exec(privateKey);
    if (m) {
      const body = m[1].replace(/(.{64})/g, '$1\n').trim();
      privateKey = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
    }
  }
  if (privateKey.endsWith('-----END PRIVATE KEY-----')) {
    privateKey += '\n';
  }
  const serviceAccount: Record<string, unknown> = {
    type: 'service_account',
    project_id: projectId,
    private_key: privateKey,
    client_email: clientEmail,
    token_uri: 'https://oauth2.googleapis.com/token',
  };
  const privateKeyId = process.env.FIREBASE_PRIVATE_KEY_ID?.trim();
  if (privateKeyId) serviceAccount.private_key_id = privateKeyId;
  return serviceAccount;
}

/** firebase-admin'ı lazy yükleyip Messaging örneğini döndürür (veya null). */
function getMessagingInstance(): MessagingLike | null {
  if (initAttempted) return messaging;
  initAttempted = true;

  const serviceAccount = decodeServiceAccount();
  if (!serviceAccount) {
    disabledReason = 'FIREBASE_SERVICE_ACCOUNT veya FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY tanımlı değil';
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

/** FCM durumu (health endpoint için): aktif mi, değilse kısa neden. */
export function getFcmStatus(): { enabled: boolean; reason: string } {
  const enabled = getMessagingInstance() !== null;
  return { enabled, reason: enabled ? '' : disabledReason };
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
  payload: { title: string; body: string; data?: Record<string, unknown>; channelId?: string; categoryId?: string }
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
    // Android'de bildirimler "data-only" gönderilir (`notification` bloğu yok).
    // expo-notifications bu mesajları kendisi sunar; böylece:
    //  - categoryId ile eylem butonları ("Sende Ekle", "Düelloya Katıl")
    //    bildirim üzerinde görünür,
    //  - uygulama ön plandayken (oyun açıkken) bildirim gösterilmez,
    //  - uygulama kapalıyken/arka planda bildirim normal gösterilir.
    // Sunum tercihleri data anahtarlarından okunur (expo-notifications
    // Android push payload spesifikasyonu): title, message, channelId, categoryId.
    const messages = chunk.map((token) => ({
      token,
      data: {
        title: payload.title,
        message: payload.body,
        ...(payload.channelId ? { channelId: payload.channelId } : {}),
        ...(payload.categoryId ? { categoryId: payload.categoryId } : {}),
        ...(payload.data ? stringifyData(payload.data) : {}),
      },
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
