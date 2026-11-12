import { useEffect, useState } from 'react';
import { UserSettings } from '@trivia/shared';
import { sound } from '../services/soundService';

/**
 * Tavriko kullanıcı ayarı köprüsü
 * -------------------------------
 * SettingsScreen ayarları hem cihazda (localStorage) hem PostgreSQL'e kaydeder.
 * Bu modül kayıtlı ayarları motorlara (ses, müzik, haptik) uygular ve ayarı
 * kullanan ekranlara (animasyonlar, otomatik sonraki soru, varsayılan zorluk...)
 * canlı olarak duyurur. Böylece ayarlar uygulama açıldığında da, değiştirildiği
 * anda da gerçekten devreye girer.
 */

export const PREFS_STORAGE_KEY = 'tavriko_user_settings_v1';
export const PREFS_STORAGE_KEY_V2 = 'tavriko_user_settings_v2';

let memoryPrefs: UserSettings | null = null;
const listeners = new Set<(p: UserSettings) => void>();

const readStorage = (): UserSettings => {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY_V2) || localStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as UserSettings;
    }
  } catch {}
  return {};
};

export const loadStoredPreferences = (): UserSettings => {
  if (memoryPrefs) return memoryPrefs;
  memoryPrefs = readStorage();
  return memoryPrefs;
};

const pctToFloat = (pct: any, fallback: number): number => {
  const n = Number(pct);
  if (Number.isFinite(n) && n > 0) return Math.min(1, n / 100);
  return fallback;
};

/** Kayıtlı bir ayarı motorlara uygula (ses efektleri, müzik, haptik). */
export const applyAudioPreferences = (p: UserSettings) => {
  try {
    sound.setSoundEnabled((p.sfxEnabled ?? (p as any).soundEnabled) !== false);
    sound.setSoundVolume(pctToFloat(p.sfxVolume, 1));
    sound.setHapticsEnabled(p.hapticsEnabled !== false);
    if (p.hapticIntensity === 'light' || p.hapticIntensity === 'medium' || p.hapticIntensity === 'strong') {
      sound.setHapticIntensity(p.hapticIntensity);
    }
    sound.setMusicEnabled(p.musicEnabled === true);
    sound.setMusicVolume(pctToFloat(p.musicVolume, 0.5));
  } catch {
    // never break app boot because of prefs
  }
};

/**
 * Ayarları cihaza yazar, ses/haptik motorlarına uygular ve dinleyen ekranlara duyurur.
 * Hem SettingsScreen (kullanıcı ayarı değiştirdiğinde) hem giriş sonrası sunucu
 * ayarlarını eşitlerken kullanılır.
 */
export const savePreferences = (settings: UserSettings, opts: { persist?: boolean } = {}) => {
  memoryPrefs = { ...settings };
  if (opts.persist !== false) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PREFS_STORAGE_KEY_V2, JSON.stringify(memoryPrefs));
      }
    } catch {}
  }
  applyAudioPreferences(memoryPrefs);
  listeners.forEach((fn) => {
    try {
      fn(memoryPrefs as UserSettings);
    } catch {}
  });
};

/** Sunucudan gelen (hesaba bağlı) ayarları cihaz ayarlarıyla birleştirip uygular. */
export const syncPreferencesFromAccount = (accountSettings?: UserSettings | null) => {
  if (!accountSettings || typeof accountSettings !== 'object') return;
  savePreferences({ ...loadStoredPreferences(), ...accountSettings });
};

export const subscribePreferences = (fn: (p: UserSettings) => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** Bileşenlerin güncel ayarları canlı izlemesi için. */
export const usePreferences = (): UserSettings => {
  const [prefs, setPrefs] = useState<UserSettings>(() => loadStoredPreferences());
  useEffect(() => subscribePreferences(setPrefs), []);
  return prefs;
};

/** Uygulama açılışında kayıtlı tercihleri devreye al. */
export const applyStoredPreferencesOnBoot = () => {
  applyAudioPreferences(loadStoredPreferences());
};
