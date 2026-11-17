"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushToExpo = sendPushToExpo;
exports.sendPushToUser = sendPushToUser;
exports.notificationToPushPayload = notificationToPushPayload;
exports.queuePushForNotification = queuePushForNotification;
exports.sendPushToAllTokens = sendPushToAllTokens;
exports.sendReengagementPush = sendReengagementPush;
const logger_1 = require("../utils/logger");
const fcmService_1 = require("./fcmService");
const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_CHUNK_SIZE = 100;
/** Expo push token biçimi: "ExponentPushToken[...]" / "ExpoPushToken[...]". */
function isExpoToken(token) {
    return token.startsWith('ExponentPushToken') || token.startsWith('ExpoPushToken');
}
/** FCM device token biçimi: uzun, ":" içeren (ör. "...:APA91b..."). */
function isFcmToken(token) {
    return !isExpoToken(token) && token.includes(':');
}
let dbModule = null;
function getDb() {
    if (!dbModule) {
        // Lazy require: prismaClient -> pushService -> (lazy) prismaClient döngüsü
        // yalnızca çağrı anında çözülür, modül yüklenmesi sırasında değil.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        dbModule = require('../db/prismaClient');
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
async function sendPushToExpo(tokens, payload) {
    const valid = tokens.filter((t) => typeof t === 'string' && t.trim());
    const expoTokens = valid.filter(isExpoToken);
    const fcmTokens = valid.filter(isFcmToken);
    if (!expoTokens.length && !fcmTokens.length)
        return { sent: 0, invalidTokens: [] };
    const invalidTokens = [];
    let sent = 0;
    for (let i = 0; i < expoTokens.length; i += EXPO_PUSH_CHUNK_SIZE) {
        const chunk = expoTokens.slice(i, i + EXPO_PUSH_CHUNK_SIZE);
        try {
            const res = await fetch(EXPO_PUSH_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chunk.map((token) => ({
                    to: token,
                    title: payload.title,
                    body: payload.body,
                    sound: 'default',
                    // iOS tarafında eylem butonları kayıtlı kategoriyle gösterilir.
                    ...(payload.categoryId ? { _category: payload.categoryId } : {}),
                    ...(payload.data ? { data: payload.data } : {}),
                }))),
            });
            const json = (await res.json());
            const tickets = Array.isArray(json?.data) ? json.data : [];
            for (let j = 0; j < tickets.length; j++) {
                const ticket = tickets[j];
                if (ticket?.status === 'ok') {
                    sent++;
                }
                else if (ticket?.status === 'error') {
                    // Cihaz kaydı düşmüşse (uygulama kaldırıldı vb.) token'ı temizle.
                    if (ticket.details?.error === 'DeviceNotRegistered') {
                        invalidTokens.push(chunk[j]);
                    }
                    else {
                        logger_1.logger.warn('SYSTEM', `Push ticket hatası: ${ticket.message || 'bilinmeyen'}`);
                    }
                }
            }
        }
        catch (e) {
            logger_1.logger.warn('SYSTEM', `Expo push gönderimi başarısız: ${e?.message || e}`);
        }
    }
    // FCM device tokenlar (Android): firebase-admin ile doğrudan gönderim.
    if (fcmTokens.length) {
        const fcmResult = await (0, fcmService_1.sendFcmToTokens)(fcmTokens, {
            title: payload.title,
            body: payload.body,
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
async function sendPushToUser(userId, payload) {
    if (!userId)
        return { sent: 0 };
    let tokens = [];
    try {
        tokens = await getDb().getPushTokensAsync(userId);
    }
    catch (e) {
        logger_1.logger.warn('SYSTEM', `Token okunamadı (${userId}): ${e?.message || e}`);
        return { sent: 0 };
    }
    if (!tokens.length)
        return { sent: 0 };
    const { sent, invalidTokens } = await sendPushToExpo(tokens, payload);
    for (const token of invalidTokens) {
        try {
            await getDb().removePushTokenAsync(token);
        }
        catch { }
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
function notificationToPushPayload(item) {
    const isFriend = item.type === 'friend' || item.type === 'friend_request';
    const isDuel = item.type === 'duel' || item.type === 'match_invite';
    let channelId = 'general';
    let categoryId;
    if (isFriend) {
        channelId = 'invites';
        categoryId = 'friend_request';
    }
    else if (isDuel) {
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
function queuePushForNotification(userId, item) {
    if (!userId || !item)
        return;
    void sendPushToUser(userId, notificationToPushPayload(item)).catch(() => { });
}
/**
 * Tüm kayıtlı push tokenlarına toplu bildirim gönderir (admin paneli
 * "tüm oyunculara duyuru" ve yeniden etkileşim (re-engagement) akışı).
 * Parçalar halinde gönderilir; geçersiz tokenlar temizlenir.
 * @returns gönderilen mesaj sayısı.
 */
async function sendPushToAllTokens(payload) {
    let tokens = [];
    try {
        tokens = await getDb().getAllPushTokensAsync();
    }
    catch (e) {
        logger_1.logger.warn('SYSTEM', `Toplu push token okunamadı: ${e?.message || e}`);
        return { sent: 0 };
    }
    if (!tokens.length)
        return { sent: 0 };
    const { sent, invalidTokens } = await sendPushToExpo(tokens, payload);
    for (const token of invalidTokens) {
        try {
            await getDb().removePushTokenAsync(token);
        }
        catch { }
    }
    return { sent };
}
/**
 * Uzun süredir aktif olmayan oyunculara "oyuna dön" bildirimi gönderir.
 * Hedefleme: updatedAt (son oyun/profil etkinliği) verilen eşikten eski
 * kullanıcılara ait tüm kayıtlı cihaz tokenları.
 */
async function sendReengagementPush(payload, inactiveSince) {
    let tokens = [];
    try {
        tokens = await getDb().getInactiveUsersPushTokensAsync(inactiveSince, 1000);
    }
    catch (e) {
        logger_1.logger.warn('SYSTEM', `Re-engagement token okunamadı: ${e?.message || e}`);
        return { sent: 0, targetUsers: 0 };
    }
    if (!tokens.length)
        return { sent: 0, targetUsers: 0 };
    const { sent, invalidTokens } = await sendPushToExpo(tokens, payload);
    for (const token of invalidTokens) {
        try {
            await getDb().removePushTokenAsync(token);
        }
        catch { }
    }
    return { sent, targetUsers: tokens.length };
}
