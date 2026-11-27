/**
 * Google Play uygulama içi güncelleme kararları (saf fonksiyonlar, test edilebilir).
 *
 * Zorunlu (IMMEDIATE) güncelleme iki yoldan tetiklenir:
 *  1. Play Console sürümünde `inAppUpdatePriority` 4 veya 5 ise.
 *  2. Sunucudaki `ANDROID_MIN_VERSION_CODE` mevcut versionCode'dan büyükse.
 * Diğer her yeni sürüm isteğe bağlı (FLEXIBLE) sunulur.
 */

export const UPDATE_TYPE = { FLEXIBLE: 0, IMMEDIATE: 1 } as const;
export const IMMEDIATE_PRIORITY = 4;

export interface PlayUpdateInfo {
  updateAvailable: boolean;
  immediateInProgress: boolean;
  immediateAllowed: boolean;
  flexibleAllowed: boolean;
  availableVersionCode: number;
  stalenessDays: number | null;
  priority: number;
  installStatus: 'pending' | 'downloading' | 'downloaded' | 'installing' | 'installed' | 'failed' | 'canceled' | 'unknown';
  bytesDownloaded: number;
  totalBytesToDownload: number;
}

export type UpdateDecision =
  /** Güncelleme yok ya da gösterilecek bir şey yok. */
  | { kind: 'none' }
  /** Zorunlu: oyuncu güncellemeden devam edemez. `via` Play akışı mı mağaza sayfası mı. */
  | { kind: 'required'; via: 'play' | 'store'; resume: boolean }
  /** İsteğe bağlı: FLEXIBLE akış önerilir. */
  | { kind: 'optional' }
  /** FLEXIBLE indirme sürüyor. */
  | { kind: 'downloading' }
  /** FLEXIBLE indirme bitti; yeniden başlatma bekleniyor. */
  | { kind: 'downloaded' };

export function decideUpdate(info: PlayUpdateInfo, currentVersionCode: number, minVersionCode: number): UpdateDecision {
  if (info.installStatus === 'downloaded') return { kind: 'downloaded' };
  // Yarıda kalan IMMEDIATE güncelleme sürdürülmeli (Google yönergesi).
  if (info.immediateInProgress) return { kind: 'required', via: 'play', resume: true };
  if (!info.updateAvailable) return { kind: 'none' };
  const belowMinimum = minVersionCode > 0 && currentVersionCode > 0 && currentVersionCode < minVersionCode;
  const mandatory = belowMinimum || info.priority >= IMMEDIATE_PRIORITY;
  if (mandatory) return { kind: 'required', via: info.immediateAllowed ? 'play' : 'store', resume: false };
  if (info.installStatus === 'downloading' || info.installStatus === 'pending' || info.installStatus === 'installing') {
    return { kind: 'downloading' };
  }
  if (info.flexibleAllowed) return { kind: 'optional' };
  return { kind: 'none' };
}

/**
 * Play'e ulaşılamadığında (yan yükleme, Play Store yok, çevrimdışı) karar.
 * Yalnızca sunucu bu sürümün artık desteklenmediğini söylüyorsa engeller;
 * aksi halde oyuncu uygulamayı kullanmaya devam eder.
 */
export function decideWithoutPlay(currentVersionCode: number, minVersionCode: number): UpdateDecision {
  if (minVersionCode > 0 && currentVersionCode > 0 && currentVersionCode < minVersionCode) {
    return { kind: 'required', via: 'store', resume: false };
  }
  return { kind: 'none' };
}

export type PlayErrorClass = 'play_unavailable' | 'transient';

/** Yerel modülün `E_PLAY_UPDATE_<AD>` hata kodlarını sınıflandırır. */
export function classifyPlayError(code: unknown): PlayErrorClass {
  const value = typeof code === 'string' ? code : '';
  if (/APP_NOT_OWNED|API_NOT_AVAILABLE|PLAY_STORE_NOT_FOUND|INSTALL_NOT_ALLOWED/.test(value)) return 'play_unavailable';
  return 'transient';
}

// ---- Kontrol sıklığı ----
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** Normal durumda ön plana dönüşte en fazla 6 saatte bir kontrol. */
export const FOREGROUND_CHECK_INTERVAL_MS = 6 * HOUR;
/** Geçici hata sonrası tekrar deneme aralığı. */
export const RETRY_AFTER_ERROR_MS = 30 * MINUTE;
/** Zorunlu güncelleme ekranındayken ön plana dönüşte yeniden kontrol aralığı. */
export const REQUIRED_RECHECK_MS = 10_000;

export function shouldCheck(
  reason: 'launch' | 'foreground' | 'manual' | 'online',
  state: { lastCheckAt: number; lastFailed: boolean; required: boolean; playUnavailable: boolean },
  now: number,
): boolean {
  if (reason === 'manual') return true;
  if (state.required) return now - state.lastCheckAt >= REQUIRED_RECHECK_MS;
  if (reason === 'launch') return true;
  if (state.playUnavailable) return false;
  const gap = state.lastFailed ? RETRY_AFTER_ERROR_MS : FOREGROUND_CHECK_INTERVAL_MS;
  return now - state.lastCheckAt >= gap;
}

// ---- İsteğe bağlı güncelleme önerisinin sıklığı ----
export interface FlexiblePromptPreference {
  versionCode: number;
  dismissed: number;
  nextAt: number;
}

export const INITIAL_FLEXIBLE_PROMPT: FlexiblePromptPreference = { versionCode: 0, dismissed: 0, nextAt: 0 };
const PROMPT_INTERVALS_HOURS = [24, 48, 72] as const;

export function parseFlexiblePrompt(raw: string | null): FlexiblePromptPreference {
  try {
    const data = raw ? JSON.parse(raw) : null;
    if (Number.isSafeInteger(data?.versionCode) && Number.isSafeInteger(data?.dismissed) &&
        Number.isSafeInteger(data?.nextAt) && data.dismissed >= 0) return data;
  } catch {
    // Bozuk tercih açılışı engellememeli.
  }
  return INITIAL_FLEXIBLE_PROMPT;
}

/** Yeni bir sürüm gelince sayaç sıfırlanır; aynı sürüm için ertelemeler giderek uzar. */
export function flexiblePromptDue(pref: FlexiblePromptPreference, versionCode: number, now: number): boolean {
  if (pref.versionCode !== versionCode) return true;
  return now >= pref.nextAt;
}

export function deferFlexiblePrompt(pref: FlexiblePromptPreference, versionCode: number, now: number): FlexiblePromptPreference {
  const dismissed = pref.versionCode === versionCode ? pref.dismissed + 1 : 1;
  const hours = PROMPT_INTERVALS_HOURS[Math.min(dismissed - 1, PROMPT_INTERVALS_HOURS.length - 1)];
  return { versionCode, dismissed, nextAt: now + hours * HOUR };
}
