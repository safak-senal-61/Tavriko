import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { UserProfile } from '@trivia/shared';

/**
 * Evrensel oturum depolama.
 *
 * Web: localStorage (önceki davranışla birebir aynı).
 * Mobil: expo-secure-store (Android Keystore / iOS Keychain). SecureStore API'si
 * asenkron olduğu için açılışta `hydrateAuthStorage()` ile senkron bir önbellek
 * doldurulur; sonraki okumalar bu önbellekten yapılır.
 */

const KEY_USER = 'tavriko_auth_user';
const KEY_TOKEN = 'tavriko_auth_token';

let cachedUser: string | null = null;
let cachedToken: string | null = null;
let hydrated = Platform.OS === 'web';

/** Uygulama açılışında bir kez çağrılır: mobilde güvenli depodan oturumu yükler. */
export const hydrateAuthStorage = async (): Promise<void> => {
  if (hydrated) return;
  try {
    const [u, t] = await Promise.all([
      SecureStore.getItemAsync(KEY_USER),
      SecureStore.getItemAsync(KEY_TOKEN),
    ]);
    cachedUser = u;
    cachedToken = t;
  } catch {
    cachedUser = null;
    cachedToken = null;
  }
  hydrated = true;
};

export const getStoredAuth = (): { user: UserProfile | null; token: string | null } => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const rawUser = window.localStorage.getItem(KEY_USER);
        const rawToken = window.localStorage.getItem(KEY_TOKEN);
        const user = rawUser ? (JSON.parse(rawUser) as UserProfile) : null;
        return { user, token: rawToken || null };
      } catch {
        return { user: null, token: null };
      }
    }
    return { user: null, token: null };
  }
  try {
    const user = cachedUser ? (JSON.parse(cachedUser) as UserProfile) : null;
    return { user, token: cachedToken || null };
  } catch {
    return { user: null, token: null };
  }
};

export const saveStoredAuth = (user: UserProfile | null, token?: string | null) => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        if (user) {
          window.localStorage.setItem(KEY_USER, JSON.stringify(user));
        } else {
          window.localStorage.removeItem(KEY_USER);
        }
        if (token !== undefined) {
          if (token) {
            window.localStorage.setItem(KEY_TOKEN, token);
          } else {
            window.localStorage.removeItem(KEY_TOKEN);
          }
        }
      } catch {}
    }
    return;
  }
  // Mobil: önbelleği hemen güncelle, güvenli depoya asenkron yaz.
  cachedUser = user ? JSON.stringify(user) : null;
  if (token !== undefined) {
    cachedToken = token || null;
  }
  if (user && cachedUser) {
    SecureStore.setItemAsync(KEY_USER, cachedUser).catch(() => {});
  } else {
    SecureStore.deleteItemAsync(KEY_USER).catch(() => {});
  }
  if (token !== undefined) {
    if (token) {
      SecureStore.setItemAsync(KEY_TOKEN, token).catch(() => {});
    } else {
      SecureStore.deleteItemAsync(KEY_TOKEN).catch(() => {});
    }
  }
};

export const clearAllAccountStorage = () => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(KEY_USER);
        window.localStorage.removeItem(KEY_TOKEN);
        window.localStorage.removeItem('tavriko_permanent_wallet');
        const keys = Object.keys(window.localStorage);
        for (const k of keys) {
          if (k.startsWith('tavriko_wallet_')) {
            window.localStorage.removeItem(k);
          }
        }
      } catch {}
    }
    return;
  }
  cachedUser = null;
  cachedToken = null;
  SecureStore.deleteItemAsync(KEY_USER).catch(() => {});
  SecureStore.deleteItemAsync(KEY_TOKEN).catch(() => {});
};
