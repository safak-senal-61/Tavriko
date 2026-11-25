/**
 * Animated Nick — çalışma ortamı mağazası.
 * Tercihler, uygulama ön plan durumu, "hareketi azalt" ve cihaz sınıfı tek
 * bir modül düzeyinde izlenir; tüm NickRenderer örnekleri aynı anlık görüntüyü
 * useSyncExternalStore ile okur (her örnek için ayrı dinleyici/state yok).
 */
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, AppState, Platform } from 'react-native';
import * as Device from 'expo-device';
import { loadStoredPreferences, subscribePreferences } from '../../store/appPrefs';
import { isLowEndDevice, NickQuality, NickSlotPool, resolveNickQuality } from './nickQualityCore';
import { SKIA_AVAILABLE } from './NickSkiaLayer';

export interface NickEnvSnapshot {
  /** Bu cihazda ulaşılabilecek en yüksek kalite */
  cap: NickQuality;
  /** Uygulama ön planda mı (arka planda tüm saatler durur) */
  appActive: boolean;
  lowEnd: boolean;
  reduceMotion: boolean;
}

const lowEnd = (() => {
  try {
    if (Platform.OS === 'web') return false;
    return isLowEndDevice({ totalMemory: Device.totalMemory, yearClass: Device.deviceYearClass });
  } catch {
    return false;
  }
})();

let reduceMotion = false;
let appActive = AppState.currentState ? AppState.currentState === 'active' : true;
let snapshot: NickEnvSnapshot = compute();
const listeners = new Set<() => void>();
let wired = false;

function compute(): NickEnvSnapshot {
  const p = loadStoredPreferences();
  return {
    cap: resolveNickQuality({
      pref: p.nickEffects,
      smoothAnimations: p.smoothAnimations,
      batterySaver: p.batterySaver,
      reduceMotion,
      lowEnd,
      skiaAvailable: SKIA_AVAILABLE,
    }),
    appActive,
    lowEnd,
    reduceMotion,
  };
}

function refresh() {
  const next = compute();
  if (
    next.cap !== snapshot.cap ||
    next.appActive !== snapshot.appActive ||
    next.reduceMotion !== snapshot.reduceMotion
  ) {
    snapshot = next;
    listeners.forEach((fn) => fn());
  }
}

function wire() {
  if (wired) return;
  wired = true;
  subscribePreferences(() => refresh());
  try {
    AppState.addEventListener('change', (s) => {
      // iOS 'inactive' (bildirim merkezi vb.) sırasında da durdur
      appActive = s === 'active';
      refresh();
    });
  } catch {}
  try {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        reduceMotion = !!v;
        refresh();
      })
      .catch(() => {});
    AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      reduceMotion = !!v;
      refresh();
    });
  } catch {}
}

function subscribe(fn: () => void) {
  wire();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const getSnapshot = () => snapshot;

export function useNickEnv(): NickEnvSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Aynı anda çalışan tam kalite (Skia) nick sayısı üst sınırı.
 * Web'de her Skia canvas'ı ayrı bir WebGL bağlamı açar (tarayıcı sınırı ~16).
 */
export const fullPool =
  Platform.OS === 'web' ? new NickSlotPool(lowEnd ? 4 : 10, 13) : new NickSlotPool(lowEnd ? 4 : 12);
/** Aynı anda çalışan Lottie parçacık katmanı üst sınırı. */
export const particlePool = new NickSlotPool(lowEnd ? 1 : 4);

let nextId = 1;
export const allocNickId = () => nextId++;
