/**
 * Analitik (çerez/PostHog) onayı — KVKK uyumu.
 *
 * PostHog analitiği yalnızca kullanıcı açıkça "Kabul Et" dedikten sonra
 * başlatılır. Red veya cevapsız durumda hiçbir olay gönderilmez.
 *
 * Depolama:
 * - Web: localStorage (çerez yerine yerel anahtar; paylaşılmaz)
 * - Mobil: expo-secure-store (Keystore/Keychain)
 * Değerler: 'granted' | 'denied' | null (null = henüz sorulmamış)
 */
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';

export type AnalyticsConsentValue = 'granted' | 'denied';

const KEY = 'tavriko_analytics_consent';

type ConsentSnapshot = AnalyticsConsentValue | null | undefined;
let cached: ConsentSnapshot;
let hydration: Promise<void> | undefined;
let write = Promise.resolve();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const snapshot = () => cached;
const notify = () => listeners.forEach(listener => listener());

const readWeb = (): AnalyticsConsentValue | null => {
  try {
    const v =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem(KEY)
        : null;
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
};

if (Platform.OS === 'web') cached = readWeb();

/** Uygulama açılışında bir kez çağrılır: mobilde güvenli depodan onayı yükler. */
export const hydrateAnalyticsConsent = (): Promise<void> => {
  if (cached !== undefined) return Promise.resolve();
  return hydration ??= SecureStore.getItemAsync(KEY)
    .catch(() => null)
    .then(v => {
      if (cached !== undefined) return;
      cached = v === 'granted' || v === 'denied' ? v : null;
      notify();
    });
};

/** Mevcut onay durumu; null = henüz sorulmamış. */
export const getAnalyticsConsent = (): AnalyticsConsentValue | null => cached ?? null;
export const useAnalyticsConsent = (): ConsentSnapshot => useSyncExternalStore(subscribe, snapshot, snapshot);

/** Kullanıcının kararını kaydeder ve önbelleği günceller. */
export const setAnalyticsConsent = (value: AnalyticsConsentValue): void => {
  cached = value;
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(KEY, value);
    } catch {
      // localStorage kapalıysa yalnızca oturum boyunca hatırlanır
    }
  } else {
    write = write.then(() => SecureStore.setItemAsync(KEY, value)).catch(() => {});
  }
  notify();
};
