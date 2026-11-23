/**
 * Expo Push bildirim servisi (mobil).
 *
 * Akış:
 *  1. `initPushNotifications()` — uygulama açılışında bir kez çağrılır:
 *     bildirim kategorilerini (eylem butonları) kaydeder, Android'de
 *     bildirim kanallarını kurar ve bildirim dokunuşlarını yönlendirir.
 *  2. İzin yalnızca kullanıcının açık eylemiyle istenir.
 *     Mevcut izin varsa `registerForPushNotifications` token'ı kaydeder.
 *     Web'de tamamen no-op'tur.
 *
 * Bildirimler uygulama ön plandayken de banner + ses ile gösterilir —
 * arkadaş/oda davetleri karşı taraf oyundayken anında görünülsün diye.
 * Uygulama arka plandayken/kapalıyken sistem tarafından normal gösterilir.
 *
 * Eylem butonları kategorilerle çalışır (sunucu data.categoryId / iOS
 * _category gönderir):
 *  - friend_request → "Arkadaşı Ekle" / "Reddet"
 *  - duel_invite → "Düelloya Katıl" / "Reddet"
 *  - room_invite → "Odaya Katıl" / "Reddet"
 * Butonların görsel biçimini işletim sistemi belirler. iOS, reddetme
 * eylemlerini destructive olarak vurgular.
 *
 * Hatalar sessizce yutulur — bildirim altyapısı oyun akışını asla bozmaz.
 */
import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { DEFAULT_API_BASE } from '../config';
import { authHeaders } from '../utils/apiAuth';
import { useGameStore } from '../store/gameStore';
import { handleNotificationResponse } from './notificationRouter';

const ANDROID_CHANNEL_ID = 'default';
const ANDROID_CHANNEL_NAME = 'Genel';

let initialized = false;
let permissionRevision = 0;
let lastRegistration: { token: string; session: string; permissionRevision: number } | null = null;

function getEasProjectId(): string | undefined {
  const extra = (Constants.expoConfig as any)?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

/**
 * Bildirim kategorileri: bildirim üzerinde görünen eylem butonları.
 * Expo yanıt dinleyicisinin uygulama tamamen kapalıyken de çalışabilmesi
 * için "Reddet" eylemi uygulamayı açar, ancak odaya yönlendirmez.
 */
async function registerNotificationCategories(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync('friend_request', [
      {
        identifier: 'accept_friend',
        buttonTitle: 'Arkadaşı Ekle',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'decline_friend',
        buttonTitle: 'Reddet',
        options: { opensAppToForeground: true, isDestructive: true },
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
        buttonTitle: 'Reddet',
        options: { opensAppToForeground: true, isDestructive: true },
      },
    ]);
    await Notifications.setNotificationCategoryAsync('room_invite', [
      {
        identifier: 'join_room',
        buttonTitle: 'Odaya Katıl',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'decline_room',
        buttonTitle: 'Reddet',
        options: { opensAppToForeground: true, isDestructive: true },
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
let androidDefaultChannel: Promise<unknown> | undefined;

function ensureAndroidDefaultChannel() {
  return androidDefaultChannel ??= Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: ANDROID_CHANNEL_NAME,
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FFC43D',
    sound: 'notification.wav',
  }).catch(error => {
    androidDefaultChannel = undefined;
    throw error;
  });
}

export function initPushNotifications(): void {
  if (initialized || Platform.OS === 'web') return;
  initialized = true;

  // ÖN PLANDA DA BİLDİRİM GÖRÜNÜR: arkadaş/oda davetleri çoğunlukla
  // karşı taraf oyundayken gönderilir; banner gizlenince davet push'u
  // hiç görünmüyordu ("davet gitmiyor" şikâyetinin sebebi). Artık
  // uygulama açıkken de banner + ses + rozet gösterilir.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
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
    void ensureAndroidDefaultChannel().catch(() => {});
    // Davetler (arkadaşlık isteği / düello) ayrı kanalda: farklı ses,
    // yüksek öncelik. Sunucu data.channelId ile bu kanalı hedefler.
    void Notifications.setNotificationChannelAsync('invites', {
      name: 'Davetler',
      description: 'Arkadaşlık istekleri ve düello davetleri',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 150, 300],
      lightColor: '#FFC43D',
      sound: 'notification.wav',
    }).catch(() => {});
    // Yönetim duyuruları (tüm oyunculara toplu bildirim).
    void Notifications.setNotificationChannelAsync('announcements', {
      name: 'Duyurular',
      description: 'Tavriko duyuruları ve etkinlik haberleri',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#FFC43D',
      sound: 'notification.wav',
    }).catch(() => {});
  }
}

export type PushPermission = 'unknown' | 'granted' | 'requestable' | 'blocked';
export const pushSupported = Platform.OS === 'android' || Platform.OS === 'ios';

function permissionState(status: Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>): PushPermission {
  if (status.granted && status.status === 'granted') return 'granted';
  // Re-register after an observed denial even if the device token has not changed.
  // Keep the last token available for logout; only invalidate deduplication here.
  permissionRevision += 1;
  if (Platform.OS === 'android' && Number(Platform.Version) < 33) return 'blocked';
  return status.canAskAgain ? 'requestable' : 'blocked';
}

export async function getPushPermission(): Promise<PushPermission> {
  if (!pushSupported) return 'unknown';
  try {
    return permissionState(await Notifications.getPermissionsAsync());
  } catch {
    return 'unknown';
  }
}

/** Must only be called by an explicit button press, never by foreground sync. */
export async function enablePushFromUserAction(): Promise<PushPermission> {
  if (!pushSupported) return 'unknown';
  const current = await getPushPermission();
  if (current === 'requestable') {
    // Android 13+ needs a notification channel before the first OS prompt.
    if (Platform.OS === 'android') await ensureAndroidDefaultChannel();
    return permissionState(await Notifications.requestPermissionsAsync());
  }
  if (current === 'blocked') await openPushSettings();
  return current;
}

export async function openPushSettings(): Promise<void> {
  if (!pushSupported) return;
  const packageName = Constants.expoConfig?.android?.package;
  if (Platform.OS === 'android' && Number(Platform.Version) >= 26 && packageName) {
    try {
      await Linking.sendIntent('android.settings.APP_NOTIFICATION_SETTINGS', [
        { key: 'android.provider.extra.APP_PACKAGE', value: packageName },
      ]);
      return;
    } catch {
      // Some devices only expose the app details screen.
    }
  }
  await Linking.openSettings();
}

/**
 * Kullanıcının push token'ını sunucuya kaydeder. Aynı oturumda tekrar
 * çağrılırsa atlanır; token değişirse veya izin yeniden açılırsa gönderilir.
 *
 * Android: FCM device token (backend firebase-admin ile doğrudan FCM'ye
 * gönderir; Expo push servisine bağımlı değildir). Token alınamazsa
 * (Expo Go vb.) Expo push token'a düşer.
 * iOS: Expo push token (APNs teslimi Expo/EAS üzerinden).
 */
const registrations = new Map<string, { permissionRevision: number; promise: Promise<void> }>();

export function registerForPushNotifications(userId: string): Promise<void> {
  if (!pushSupported) return Promise.resolve();
  const active = useGameStore.getState();
  if (active.user?.id !== userId || active.user.isGuest || !active.token || active.token === 'mock_token') {
    return Promise.resolve();
  }
  const session = active.token;
  const revision = permissionRevision;
  const pending = registrations.get(session);
  if (pending?.permissionRevision === revision) return pending.promise;
  const promise = registerGrantedDevice(userId, session, revision).finally(() => {
    if (registrations.get(session)?.promise === promise) registrations.delete(session);
  });
  registrations.set(session, { permissionRevision: revision, promise });
  return promise;
}

async function registerGrantedDevice(userId: string, session: string, revision: number): Promise<void> {
  initPushNotifications();

  try {
    if (await getPushPermission() !== 'granted') return;

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

    if (!token || revision !== permissionRevision) return;
    if (lastRegistration?.token === token && lastRegistration.session === session &&
        lastRegistration.permissionRevision === revision) return;
    const current = useGameStore.getState();
    if (current.user?.id !== userId || current.token !== session) return;

    const res = await fetch(`${DEFAULT_API_BASE}/push/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
    if (res.ok && revision === permissionRevision && useGameStore.getState().token === session) {
      lastRegistration = { token, session, permissionRevision: revision };
    }
  } catch {
    // İzin reddedilmiş, ağ hatası vb. — sessiz geç.
  }
}

/** Çıkışta / bildirim kapatmada token'ı sunucudan kaldırır. */
export async function unregisterPushNotifications(): Promise<void> {
  const registration = lastRegistration;
  if (Platform.OS === 'web' || !registration) return;
  try {
    await fetch(`${DEFAULT_API_BASE}/push/unregister`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ token: registration.token }),
    });
  } catch {
    // sessiz geç
  } finally {
    if (lastRegistration === registration) lastRegistration = null;
  }
}
