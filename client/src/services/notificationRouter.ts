/**
 * Push bildirimi → ekran yönlendirme köprüsü.
 *
 * Bildirime dokunma / eylem butonu ("Arkadaşı Ekle", "Odaya Katıl", "Reddet") tepkileri
 * bu modülde çözümlenir:
 *  - friend / friend_request → Arkadaşlar ekranı (istek kabul akışı)
 *  - duel / match_invite → düello odasına katılım (data.roomCode ile)
 *  - system / referral / broadcast → bildirim merkezi veya data.screen
 *
 * Köprü, App katmanı ile navigasyon katmanı arasındaki bağı gevşek tutar:
 * pushNotifications servisi yalnızca `routeNotificationResponse()` çağırır;
 * RootNavigator `subscribeNotificationNavigation()` ile rotayı alır ve
 * `navigateTo` / `handleJoinCustomRoom` uygular. Böylece servis dosyası
 * navigasyonun ayrıntılarını bilmez (döngüsel import yok).
 *
 * Uygulama kapalıyken bildirime dokunulursa (cold start) cevap burada
 * kuyruğa alınır (`pendingRoute`); RootNavigator kullanıcı hazır olduğunda
 * `consumePendingNotificationRoute()` ile işler.
 */
import { Platform } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { useNotificationStore } from '../store/notificationStore';
import { DEFAULT_API_BASE } from '../config';
import { authHeaders } from '../utils/apiAuth';
import { getStoredAuth, hydrateAuthStorage } from '../utils/authStorage';

/** Bildirim rotası: doğrudan bir ekrana git veya bir düello odasına katıl. */
export interface NotificationRoute {
  screen: 'friends' | 'notifications' | 'home' | 'season' | 'events' | 'shop';
  /** Varsa katılınacak düello/özel oda kodu (duel davetleri). */
  roomCode?: string;
  /** true ise bildirim merkezindeki rozetler temizlenip ilgili ekrana gidilir. */
  clearInboxBadge?: boolean;
}

type NavigationListener = (route: NotificationRoute) => void;

let listener: NavigationListener | null = null;
let pendingRoute: NotificationRoute | null = null;

/** RootNavigator mount olduğunda çağrılır; bildirim rotası olaylarını alır. */
export function subscribeNotificationNavigation(fn: NavigationListener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

/** Cold start'ta (yönlendirici henüz hazır değilken) bekleyen rotayı döndürür ve temizler. */
export function consumePendingNotificationRoute(): NotificationRoute | null {
  const route = pendingRoute;
  pendingRoute = null;
  return route;
}

function dispatchRoute(route: NotificationRoute): void {
  if (listener) {
    listener(route);
  } else {
    // Navigator henüz mount değil (cold start) — kullanıcı hazır olunca işlensin.
    pendingRoute = route;
  }
}

/** Bildirim data'sından hedef ekranı çözer. */
function resolveScreen(data: Record<string, unknown>): NotificationRoute {
  const type = typeof data.type === 'string' ? data.type : '';
  const screen = typeof data.screen === 'string' ? data.screen : '';
  const roomCode = typeof data.roomCode === 'string' ? data.roomCode : undefined;

  if (type === 'friend' || type === 'friend_request') {
    return { screen: 'friends', clearInboxBadge: true };
  }
  if (type === 'duel' || type === 'match_invite') {
    // Oda kodu varsa doğrudan odaya katıl; yoksa bildirim merkezinde davet.
    if (roomCode) return { screen: 'home', roomCode, clearInboxBadge: true };
    return { screen: 'notifications', clearInboxBadge: true };
  }
  // Yönetim duyuruları hedef ekranı data.screen ile taşır.
  if (['notifications', 'home', 'season', 'events', 'shop'].includes(screen)) {
    return { screen: screen as NotificationRoute['screen'] };
  }
  return { screen: 'notifications', clearInboxBadge: true };
}

/**
 * Arkadaşlık isteğini bildirimden kabul eder (POST /social/notifications/respond).
 * Sunucu onaylarsa arkadaşlar ekranına yönlendirir; hata olursa bildirim
 * merkezine düşer (kullanıcı oradan tekrar deneyebilir).
 */
async function acceptFriendRequestFromNotification(data: Record<string, unknown>): Promise<void> {
  const user = useGameStore.getState().user;
  const notificationId = typeof data.notificationId === 'string' ? data.notificationId : null;
  if (!user?.id || !notificationId) {
    dispatchRoute({ screen: 'notifications', clearInboxBadge: true });
    return;
  }
  try {
    const res = await fetch(`${DEFAULT_API_BASE}/social/notifications/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ userId: user.id, notificationId, action: 'accept' }),
    });
    const result = await res.json().catch(() => ({}));
    if (res.ok && result.success) {
      dispatchRoute({ screen: 'friends', clearInboxBadge: true });
    } else {
      // İstek artık geçerli olmayabilir — bildirim merkezine yönlendir.
      dispatchRoute({ screen: 'notifications', clearInboxBadge: true });
    }
  } catch {
    dispatchRoute({ screen: 'notifications', clearInboxBadge: true });
  }
}

/**
 * Düello davetini bildirimden kabul eder; oda kodu varsa doğrudan odaya
 * katılır. Oda kodu yoksa hızlı eşleşme başlatılır.
 */
async function acceptDuelFromNotification(data: Record<string, unknown>): Promise<void> {
  const user = useGameStore.getState().user;
  const notificationId = typeof data.notificationId === 'string' ? data.notificationId : null;
  const roomCode = typeof data.roomCode === 'string' ? data.roomCode : undefined;

  // Daveti sunucuda kabul et (bildirim merkezindeki durumu da senkronlar).
  if (user?.id && notificationId) {
    try {
      await fetch(`${DEFAULT_API_BASE}/social/notifications/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId: user.id, notificationId, action: 'accept' }),
      });
    } catch {
      // Ağ hatası olsa bile odaya katılmayı dene.
    }
  }
  if (roomCode) {
    dispatchRoute({ screen: 'home', roomCode, clearInboxBadge: true });
  } else {
    dispatchRoute({ screen: 'notifications', clearInboxBadge: true });
  }
}

/** Reddetme yanıtı, bildirim gövdesine dokunma rotasına düşmemeli. */
async function declineFromNotification(data: Record<string, unknown>): Promise<void> {
  const notificationId = typeof data.notificationId === 'string' ? data.notificationId : null;
  if (!notificationId) return;
  await hydrateAuthStorage();
  const { user, token } = getStoredAuth();
  if (!user?.id || !token) return;

  try {
    const res = await fetch(`${DEFAULT_API_BASE}/social/notifications/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: user.id, notificationId, action: 'decline' }),
    });
    const result = await res.json();
    if (!res.ok || !result.success) return;
    const inbox = useNotificationStore.getState();
    if (inbox.userId === user.id) {
      inbox.patch(notificationId, { handled: 'declined', sub: 'İstek reddedildi.' });
      inbox.markRead([notificationId]);
    }
  } catch {
    // Başarısız olursa davet bildirim merkezinde tekrar yanıtlanabilir.
  }
}

/**
 * Push bildirimi tepkisini işler (dokunuş veya eylem butonu).
 * expo-notifications response.actionIdentifier:
 *  - Notifications.DEFAULT_ACTION_IDENTIFIER ('default') → bildirim gövdesine dokunma
 *  - 'accept_friend' → arkadaşlık isteğini kabul et butonu
 *  - 'join_duel' → düelloya katıl butonu
 */
export function handleNotificationResponse(response: {
  actionIdentifier: string;
  notification?: { request?: { content?: { data?: Record<string, unknown> } } } | null;
}): void {
  if (Platform.OS === 'web') return;
  const data = (response.notification?.request?.content?.data || {}) as Record<string, unknown>;
  const action = response.actionIdentifier;

  if (action === 'accept_friend') {
    void acceptFriendRequestFromNotification(data);
    return;
  }
  if (action === 'join_duel' || action === 'join_room') {
    void acceptDuelFromNotification(data);
    return;
  }
  if (action === 'decline_friend' || action === 'decline_duel' || action === 'decline_room') {
    void declineFromNotification(data);
    return;
  }
  // Varsayılan dokunuş → ilgili sayfaya yönlendir.
  dispatchRoute(resolveScreen(data));
}
