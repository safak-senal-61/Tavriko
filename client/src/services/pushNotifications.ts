/**
 * Expo Push bildirim servisi (mobil).
 *
 * Akış:
 *  1. `initPushNotifications()` — uygulama açılışında bir kez çağrılır:
 *     ön planda gelen bildirimlerin görünmesini sağlar ve Android'de
 *     bildirim kanalını kurar.
 *  2. `registerForPushNotifications(userId)` — kullanıcı oturum açtığında
 *     çağrılır: izin ister, Expo push token'ı alır ve sunucuya kaydeder
 *     (POST /api/push/register). Web'de tamamen no-op'tur.
 *
 * Hatalar sessizce yutulur — bildirim altyapısı oyun akışını asla bozmaz.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { DEFAULT_API_BASE } from '../config';
import { authHeaders } from '../utils/apiAuth';

const ANDROID_CHANNEL_ID = 'default';
const ANDROID_CHANNEL_NAME = 'Genel';

let initialized = false;
let lastRegisteredUserId: string | null = null;
let lastRegisteredToken: string | null = null;

function getEasProjectId(): string | undefined {
  const extra = (Constants.expoConfig as any)?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

/** Ön planda gelen bildirimler banner olarak gösterilir (ses + rozet dahil). */
export function initPushNotifications(): void {
  if (initialized || Platform.OS === 'web') return;
  initialized = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: ANDROID_CHANNEL_NAME,
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
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
