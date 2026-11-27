/**
 * Cihazda planlanan "oyuna dön" bildirimleri (expo-notifications, yerel).
 *
 * Bildirim izni açık, giriş yapmış oyuncu uygulamayı arka plana aldığında
 * 2 saat, 5 saat, 1, 2 ve 3 gün sonrası için hatırlatma planlanır. Oyuncu
 * uygulamaya dönünce veya çıkış yapınca hepsi iptal edilir. Sunucu push'una
 * (Vercel cron) bağlı değildir; internet olmasa da çalışır.
 */
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { COMEBACK_OFFSETS_HOURS, planComebackReminders } from './comebackPlan';

const ID_PREFIX = 'tavriko-comeback-';
const ids = COMEBACK_OFFSETS_HOURS.map((_, index) => `${ID_PREFIX}${index}`);
const supported = Platform.OS === 'android' || Platform.OS === 'ios';

let queue: Promise<void> = Promise.resolve();
function enqueue(job: () => Promise<void>) {
  queue = queue.then(job).catch(() => {});
  return queue;
}

export function cancelComebackReminders(): Promise<void> {
  if (!supported) return Promise.resolve();
  return enqueue(async () => {
    await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
  });
}

export function scheduleComebackReminders(): Promise<void> {
  if (!supported) return Promise.resolve();
  return enqueue(async () => {
    await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
    const now = Date.now();
    const plan = planComebackReminders(now, Math.floor(now / 86_400_000));
    await Promise.all(plan.map(({ at, message }, index) => Notifications.scheduleNotificationAsync({
      identifier: ids[index],
      content: {
        title: message.title,
        body: message.body,
        sound: 'notification.wav',
        data: message.screen === 'friends'
          ? { type: 'friend', source: 'comeback' }
          : { type: 'system', screen: message.screen, source: 'comeback' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
      },
    }).catch(() => undefined)));
  });
}

/**
 * RootNavigator'da bir kez kullanılır. `userId` yalnızca giriş yapmış gerçek
 * oyuncuda doludur; `granted` bildirim izninin açık olduğunu belirtir.
 */
export function useComebackNotifications(userId: string | null, granted: boolean) {
  const enabled = supported && Boolean(userId) && granted;
  useEffect(() => {
    if (!supported) return;
    // Uygulamaya dönüldü (veya izin/oturum değişti): bekleyen hatırlatmalar geçersiz.
    void cancelComebackReminders();
    if (!enabled) return;
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background') void scheduleComebackReminders();
      else if (state === 'active') void cancelComebackReminders();
    });
    return () => sub.remove();
  }, [enabled, userId]);
}
