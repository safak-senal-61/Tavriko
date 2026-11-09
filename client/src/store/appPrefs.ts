import { UserSettings } from '@trivia/shared';
import { sound } from '../services/soundService';

/**
 * Tavriko kullanıcı ayarı köprüsü
 * -------------------------------
 * SettingsScreen ayarları hem cihazda (localStorage) hem PostgreSQL'e kaydeder.
 * Bu modül kayıtlı ayarları motorlara (ses, müzik, haptik) uygular, böylece
 * ayarlar uygulama açıldığında da gerçekten devreye girer.
 */

export const PREFS_STORAGE_KEY = 'tavriko_user_settings_v1';

export const loadStoredPreferences = (): UserSettings => {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('tavriko_user_settings_v2') || localStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as UserSettings;
    }
  } catch {}
  return {};
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

/** Uygulama açılışında kayıtlı tercihleri devreye al. */
export const applyStoredPreferencesOnBoot = () => {
  applyAudioPreferences(loadStoredPreferences());
};
