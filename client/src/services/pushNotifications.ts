/**
 * Expo Push bildirim servisi (mobil).
 *
 * Akış:
 *  1. `initPushNotifications()` — uygulama açılışında bir kez çağrılır:
 *     bildirim kategorilerini (eylem butonları) kaydeder, Android'de
 *     bildirim kanallarını kurar ve bildirim dokunuşlarını yönlendirir.
 *  2. `registerForPushNotifications(userId)` — kullanıcı oturum açtığında
 *     çağrılır: izin ister, Expo push token'ı alır ve sunucuya kaydeder
 *     (POST /api/push/register). Web'de tamamen no-op'tur.
 *
 * Oyun açıkken (ön planda) bildirim gösterilmez — kullanıcı rahatsız
 * edilmez. Bildirimler yalnızca uygulama kapalıyken / arka plandayken
 * cihazda gösterilir. Android'de sunucu data-only FCM mesajı gönderdiği
 * için ön planda bildirim zaten sunulmaz; iOS (ön plan) tarafında
 * handler banner'ı kapatır.
 *
 * Eylem butonları kategorilerle çalışır (sunucu data.categoryId / iOS
 * _category gönderir):
 *  - friend_request → "Sende Ekle" / "Reddet"
 *  - duel_invite → "Düelloya Katıl" / "Reddet"
 * Bildirime veya butona dokununca notificationRouter ile ilgili sayfaya
 * yönlendirilir.
 *
 * Hatalar sessizce yutulur — bildirim altyapısı oyun akışını asla bozmaz.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { DEFAULT_API_BASE } from '../config';
import { authHeaders } from '../utils/apiAuth';
import { handleNotificationResponse } from './notificationRouter';

const ANDROID_CHANNEL_ID = 'default';
const ANDROID_CHANNEL_NAME = 'Genel';

let initialized = false;
let lastRegisteredUserId: string | null = null;
let lastRegisteredToken: string | null = null;

function getEasProjectId(): string | undefined {
  const extra = (Constants.expoConfig as any)?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

/**
 * Bildirim kategorileri: bildirim üzerinde görünen eylem butonları.
 * 'friend_request' → arkadaşlık isteği; 'duel_invite' → düello daveti.
 */
async function registerNotificationCategories(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync('friend_request', [
      {
        identifier: 'accept_friend',
        buttonTitle: 'Sende Ekle',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'decline_friend',
        buttonTitle: 'Reddet',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ]);
    await Notifications.setNotificationCategoryAsync('duel_invite', [
      {
        identifier: 'join_duel',
        buttonTitle: 'Düelloya Katıl',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'decline_duel',
        buttonTitle: 'Şimdi Değil',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ]);
  } catch {
    // Kategori kaydı başarısızsa bildirimler butonsuz çalışmaya devam eder.
  }
}

/**
 * Push bildirimlerini başlatır: kategoriler (eylem butonları), Android
 * bildirim kanalları ve dokunuş yönlendirmesi.
 */
export function initPushNotifications(): void {
  if (initialized || Platform.OS === 'web') return;
  initialized = true;

  // OYUN AÇIKKEN BİLDİRİM GELMESİN: ön planda gelen bildirimler
  // gösterilmez (banner yok, ses yok, rozet yok). Uygulama arka plana
  // alındığında/kapandığında bildirimler sistem tarafından normal
  // gösterilir. Uygulama içi bildirim merkezi (zil ikonu) çalışmaya devam eder.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  void registerNotificationCategories();

  // Bildirime/butona dokunuş → ilgili sayfaya yönlendirme.
  Notifications.addNotificationResponseReceivedListener((response) => {
    handleNotificationResponse(response);
  });

  // Uygulama bildirime dokunularak AÇILDIYSA (cold start) cevabı işle;
  // navigator hazır değilse notificationRouter kuyruğa alır.
  void Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) handleNotificationResponse(response);
    })
    .catch(() => {});

  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: ANDROID_CHANNEL_NAME,
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FFC43D',
    }).catch(() => {});
    // Davetler (arkadaşlık isteği / düello) ayrı kanalda: farklı ses,
    // yüksek öncelik. Sunucu data.channelId ile bu kanalı hedefler.
    void Notifications.setNotificationChannelAsync('invites', {
      name: 'Davetler',
      description: 'Arkadaşlık istekleri ve düello davetleri',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 150, 300],
      lightColor: '#FFC43D',
    }).catch(() => {});
    // Yönetim duyuruları (tüm oyunculara toplu bildirim).
    void Notifications.setNotificationChannelAsync('announcements', {
      name: 'Duyurular',
      description: 'Tavriko duyuruları ve etkinlik haberleri',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#FFC43D',
    }).catch(() => {});
  }
}

async function acquirePermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (current.canAskAgain === false) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

/**
 * Kullanıcının push token'ını sunucuya kaydeder. Aynı oturumda tekrar
 * çağrılırsa (ekran değişimi vb.) atlanır; token değişirse yeniden gönderilir.
 *
 * Android: FCM device token (backend firebase-admin ile doğrudan FCM'ye
 * gönderir; Expo push servisine bağımlı değildir). Token alınamazsa
 * (Expo Go vb.) Expo push token'a düşer.
 * iOS: Expo push token (APNs teslimi Expo/EAS üzerinden).
 */
export async function registerForPushNotifications(userId: string): Promise<void> {
  if (Platform.OS === 'web' || !userId) return;
  initPushNotifications();

  try {
    const granted = await acquirePermission();
    if (!granted) return;

    let token: string | undefined;

    if (Platform.OS === 'android') {
      // Android: doğrudan FCM device token (google-services.json build'e gömülü).
      try {
        const device = await Notifications.getDevicePushTokenAsync();
        if (typeof device?.data === 'string' && device.data) token = device.data;
      } catch {
        // Expo Go / FCM kaydı yok — aşağıda Expo token denenir.
      }
    }

    if (!token) {
      const projectId = getEasProjectId();
      if (!projectId) return; // EAS projectId tanımsızsa token alınamaz
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
      token = data;
    }

    if (!token || (token === lastRegisteredToken && userId === lastRegisteredUserId)) return;

    const res = await fetch(`${DEFAULT_API_BASE}/push/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
    if (res.ok) {
      lastRegisteredToken = token;
      lastRegisteredUserId = userId;
    }
  } catch {
    // İzin reddedilmiş, ağ hatası vb. — sessiz geç.
  }
}

/** Çıkışta / bildirim kapatmada token'ı sunucudan kaldırır. */
export async function unregisterPushNotifications(): Promise<void> {
  if (Platform.OS === 'web' || !lastRegisteredToken) return;
  const token = lastRegisteredToken;
  try {
    await fetch(`${DEFAULT_API_BASE}/push/unregister`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ token }),
    });
  } catch {
    // sessiz geç
  } finally {
    lastRegisteredToken = null;
    lastRegisteredUserId = null;
  }
}
