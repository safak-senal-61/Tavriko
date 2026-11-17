"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushToExpo = sendPushToExpo;
exports.sendPushToUser = sendPushToUser;
exports.notificationToPushPayload = notificationToPushPayload;
exports.queuePushForNotification = queuePushForNotification;
const logger_1 = require("../utils/logger");
const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_CHUNK_SIZE = 100;
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
 * Token listesine Expo push gönderir. Saf fonksiyondur (db'ye dokunmaz);
 * test edilebilirlik için db bağlantısı gönderen tarafta tutulur.
 * @returns gönderilen mesaj sayısı ve geçersiz (temizlenmesi gereken) tokenlar.
 */
async function sendPushToExpo(tokens, payload) {
    const valid = tokens.filter((t) => typeof t === 'string' && (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken')));
    if (!valid.length)
        return { sent: 0, invalidTokens: [] };
    const invalidTokens = [];
    let sent = 0;
    for (let i = 0; i < valid.length; i += EXPO_PUSH_CHUNK_SIZE) {
        const chunk = valid.slice(i, i + EXPO_PUSH_CHUNK_SIZE);
        try {
            const res = await fetch(EXPO_PUSH_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chunk.map((token) => ({
                    to: token,
                    title: payload.title,
                    body: payload.body,
                    sound: 'default',
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
 * Davet/kabak gibi eylem bildirimlerinde dokunulduğunda bildirim merkezine
 * gidilsin diye data.type taşınır.
 */
function notificationToPushPayload(item) {
    const isActionable = ['friend', 'friend_request', 'duel', 'match_invite', 'system', 'referral'].includes(item.type);
    return {
        title: item.title,
        body: item.sub || 'Tavriko\'da yeni bir bildirimin var.',
        data: isActionable
            ? { type: item.type, notificationId: item.id, ...(item.roomCode ? { roomCode: item.roomCode } : {}) }
            : { type: item.type, notificationId: item.id },
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
