/**
 * Push gönderim servisi (Expo Push + doğrudan FCM).
 *
 * Kullanım akışı:
 *  1. İstemci (mobil) expo-notifications ile token alır, POST /api/push/register
 *     ile sunucuya kaydeder (push_tokens tablosu). Android cihazlar FCM device
 *     token, iOS cihazlar Expo push token kaydeder.
 *  2. Sunucu tarafında uygulama içi bildirim oluştuğu her noktada
 *     `queuePushForNotification` çağrılır: kullanıcı çevrimdışıysa bile push
 *     bildirimi cihaza ulaşır (arkadaşlık isteği, düello daveti, sistem
 *     bildirimi, davet ödülü vb.).
 *  3. Expo push API'si (https://exp.host/--/api/v2/push/send) en fazla 100
 *     mesajlık parçalarla çağrılır; "DeviceNotRegistered" dönen tokenlar
 *     otomatik temizlenir. FCM tokenlar firebase-admin üzerinden doğrudan
 *     gönderilir (bkz. fcmService); kaydı düşen tokenlar temizlenir.
 *
 * Not: prismaClient, bu modülü statik olarak içe aktardığı için db'ye erişim
 * döngüsel içe aktarımı önlemek amacıyla geçici (lazy) require ile yapılır.
 */
import type { NotificationItem } from '@trivia/shared';
import { plainDisplayText } from '@trivia/shared';
import { logger } from '../utils/logger';
import { sendFcmToTokens } from './fcmService';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_CHUNK_SIZE = 100;

/** Expo push token biçimi: "ExponentPushToken[...]" / "ExpoPushToken[...]". */
function isExpoToken(token: string): boolean {
  return token.startsWith('ExponentPushToken') || token.startsWith('ExpoPushToken');
}

/** FCM device token biçimi: uzun, ":" içeren (ör. "...:APA91b..."). */
function isFcmToken(token: string): boolean {
  return !isExpoToken(token) && token.includes(':');
}

export interface PushPayload {
  title: string;
  body: string;
  /** Derin bağlantı / rozet verisi; küçük tutulmalı (JSON < ~1KB). */
  data?: Record<string, unknown>;
  /**
   * Android bildirim kanalı (expo-notifications data anahtarı: channelId).
   * İstemci bu kanalları açılışta oluşturur (bildirimler, davetler...).
   */
  channelId?: string;
  /**
   * Bildirim kategorisi — istemcide kayıtlı eylem butonlarını gösterir:
   * 'friend_request' → "Sende Ekle" butonu, 'duel_invite' → "Düelloya Katıl"
   * butonu. Android'de data.categoryId, iOS (Expo push) tarafında _category.
   */
  categoryId?: string;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

type DbModule = typeof import('../db/prismaClient');

let dbModule: DbModule | null = null;
function getDb(): DbModule['db'] {
  if (!dbModule) {
    // Lazy require: prismaClient -> pushService -> (lazy) prismaClient döngüsü
    // yalnızca çağrı anında çözülür, modül yüklenmesi sırasında değil.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    dbModule = require('../db/prismaClient') as DbModule;
  }
  return dbModule.db;
}

/**
 * Token listesine push gönderir: Expo tokenlar Expo push API'sine, FCM
 * device tokenlar firebase-admin üzerinden doğrudan FCM'ye gider.
 * Saf fonksiyondur (db'ye dokunmaz); test edilebilirlik için db bağlantısı
 * gönderen tarafta tutulur.
 * @returns gönderilen mesaj sayısı ve geçersiz (temizlenmesi gereken) tokenlar.
 */
export async function sendPushToExpo(
  tokens: string[],
  payload: PushPayload
): Promise<{ sent: number; invalidTokens: string[] }> {
  const valid = tokens.filter((t) => typeof t === 'string' && t.trim());
  const expoTokens = valid.filter(isExpoToken);
  const fcmTokens = valid.filter(isFcmToken);
  if (!expoTokens.length && !fcmTokens.length) return { sent: 0, invalidTokens: [] };

  const invalidTokens: string[] = [];
  let sent = 0;

  for (let i = 0; i < expoTokens.length; i += EXPO_PUSH_CHUNK_SIZE) {
    const chunk = expoTokens.slice(i, i + EXPO_PUSH_CHUNK_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          chunk.map((token) => ({
            to: token,
            title: plainDisplayText(payload.title),
            body: plainDisplayText(payload.body),
            sound: 'default',
            ...(payload.channelId ? { channelId: payload.channelId === 'general' ? 'default' : payload.channelId } : {}),
            ...(payload.channelId === 'invites' ? { priority: 'high' } : {}),
            // iOS tarafında eylem butonları kayıtlı kategoriyle gösterilir.
            ...(payload.categoryId ? { _category: payload.categoryId } : {}),
            ...(payload.data ? { data: payload.data } : {}),
          }))
        ),
      });
      const json = (await res.json()) as { data?: ExpoPushTicket[] };
      const tickets = Array.isArray(json?.data) ? json.data : [];
      for (let j = 0; j < tickets.length; j++) {
        const ticket = tickets[j];
        if (ticket?.status === 'ok') {
          sent++;
        } else if (ticket?.status === 'error') {
          // Cihaz kaydı düşmüşse (uygulama kaldırıldı vb.) token'ı temizle.
          if (ticket.details?.error === 'DeviceNotRegistered') {
            invalidTokens.push(chunk[j]);
          } else {
            logger.warn('SYSTEM', `Push ticket hatası: ${ticket.message || 'bilinmeyen'}`);
          }
        }
      }
    } catch (e: any) {
      logger.warn('SYSTEM', `Expo push gönderimi başarısız: ${e?.message || e}`);
    }
  }

  // FCM device tokenlar (Android): firebase-admin ile doğrudan gönderim.
  if (fcmTokens.length) {
    const fcmResult = await sendFcmToTokens(fcmTokens, {
      title: plainDisplayText(payload.title),
      body: plainDisplayText(payload.body),
      data: payload.data,
      channelId: payload.channelId,
      categoryId: payload.categoryId,
    });
    sent += fcmResult.sent;
    invalidTokens.push(...fcmResult.invalidTokens);
  }

  return { sent, invalidTokens };
}

/**
 * Bir kullanıcının tüm kayıtlı cihazlarına push gönderir; geçersiz tokenları
 * temizler. Push servisi kullanılamıyorsa sessizce no-op olur (oyun akışı
 * asla push yüzünden bozulmaz).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number }> {
  if (!userId) return { sent: 0 };
  let tokens: string[] = [];
  try {
    tokens = await getDb().getPushTokensAsync(userId);
  } catch (e: any) {
    logger.warn('SYSTEM', `Token okunamadı (${userId}): ${e?.message || e}`);
    return { sent: 0 };
  }
  if (!tokens.length) return { sent: 0 };

  const { sent, invalidTokens } = await sendPushToExpo(tokens, payload);
  for (const token of invalidTokens) {
    try {
      await getDb().removePushTokenAsync(token);
    } catch {}
  }
  return { sent };
}

/**
 * Uygulama içi bildirim (NotificationItem) push karşılığına çevirir.
 *
 * Eylem bildirimleri kategoriyle gönderilir — bildirim üzerinde doğrudan
 * buton görünür ve dokunulduğunda ilgili sayfaya yönlendirme yapılır:
 *  - friend / friend_request → 'friend_request' kategorisi: "Sende Ekle" butonu,
 *    dokunuş → arkadaşlar ekranı.
 *  - duel / match_invite → 'duel_invite' kategorisi: "Düelloya Katıl" butonu,
 *    dokunuş → düello odasına katılım (data.roomCode ile).
 * Diğer bildirim türleri 'general' kanalından, butonsuz gönderilir.
 */
export function notificationToPushPayload(item: NotificationItem): PushPayload {
  const isFriend = item.type === 'friend' || item.type === 'friend_request';
  const isDuel = item.type === 'duel' || item.type === 'match_invite';

  let channelId = 'general';
  let categoryId: string | undefined;
  if (isFriend) {
    channelId = 'invites';
    categoryId = 'friend_request';
  } else if (isDuel) {
    channelId = 'invites';
    // Özel oda davetleri (DUEL- öneki olmayan kodlar) ayrı kategoriyle
    // gider: buton "Odaya Katıl" olur, davet bağlamı netleşir.
    categoryId = item.roomCode && !item.roomCode.startsWith('DUEL-') ? 'room_invite' : 'duel_invite';
  }

  return {
    title: item.title,
    body: item.sub || 'Tavriko\'da yeni bir bildirimin var.',
    channelId,
    ...(categoryId ? { categoryId } : {}),
    data: {
      type: item.type,
      notificationId: item.id,
      ...(item.roomCode ? { roomCode: item.roomCode } : {}),
      ...(item.senderId ? { senderId: item.senderId } : {}),
    },
  };
}

/**
 * Fire-and-forget: bildirim merkezine düşen her öğe için push kuyruğa alınır.
 * Hata yutulur — çağıran taraf (socket/db akışı) beklemez.
 */
export function queuePushForNotification(userId: string, item: NotificationItem): void {
  if (!userId || !item) return;
  void sendPushToUser(userId, notificationToPushPayload(item)).catch(() => {});
}

/**
 * Tüm kayıtlı push tokenlarına toplu bildirim gönderir (admin paneli
 * "tüm oyunculara duyuru" ve yeniden etkileşim (re-engagement) akışı).
 * Parçalar halinde gönderilir; geçersiz tokenlar temizlenir.
 * @returns gönderilen mesaj sayısı.
 */
export async function sendPushToAllTokens(payload: PushPayload): Promise<{ sent: number }> {
  let tokens: string[] = [];
  try {
    tokens = await getDb().getAllPushTokensAsync();
  } catch (e: any) {
    logger.warn('SYSTEM', `Toplu push token okunamadı: ${e?.message || e}`);
    return { sent: 0 };
  }
  if (!tokens.length) return { sent: 0 };
  const { sent, invalidTokens } = await sendPushToExpo(tokens, payload);
  for (const token of invalidTokens) {
    try {
      await getDb().removePushTokenAsync(token);
    } catch {}
  }
  return { sent };
}

/**
 * Uzun süredir aktif olmayan oyunculara "oyuna dön" bildirimi gönderir.
 * Hedefleme: updatedAt (son oyun/profil etkinliği) verilen eşikten eski
 * kullanıcılara ait tüm kayıtlı cihaz tokenları.
 */
export async function sendReengagementPush(
  payload: PushPayload,
  inactiveSince: Date
): Promise<{ sent: number; targetUsers: number }> {
  let tokens: string[] = [];
  try {
    tokens = await getDb().getInactiveUsersPushTokensAsync(inactiveSince, 1000);
  } catch (e: any) {
    logger.warn('SYSTEM', `Re-engagement token okunamadı: ${e?.message || e}`);
    return { sent: 0, targetUsers: 0 };
  }
  if (!tokens.length) return { sent: 0, targetUsers: 0 };
  const { sent, invalidTokens } = await sendPushToExpo(tokens, payload);
  for (const token of invalidTokens) {
    try {
      await getDb().removePushTokenAsync(token);
    } catch {}
  }
  return { sent, targetUsers: tokens.length };
}
