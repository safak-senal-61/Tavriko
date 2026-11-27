/**
 * Google Play In-App Updates denetleyicisi (yalnızca Android, Play'den kurulan sürümler).
 *
 * - Mağaza sürüm güncellemesi içindir; Expo OTA (otaUpdates.ts) yalnızca JS yamaları içindir.
 * - Açılışta, ön plana dönüşte (en fazla 6 saatte bir) ve bağlantı geri gelince kontrol eder.
 * - Zorunlu güncellemede `required` durumuna geçer; App.tsx tüm uygulamanın üstüne
 *   güncelleme ekranını çizer. Oyuncu iptal ederse ekran yerinde kalır.
 * - İsteğe bağlı güncellemede FLEXIBLE akış: arka planda indirme, bitince
 *   kullanıcı "Yeniden başlat" deyince kurulum (Play uygulamayı yeniden başlatır).
 * - Hatalar oyunu asla bozmaz; Play yoksa/çevrimdışıysa sessizce devam edilir.
 */
import { Linking, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { DEFAULT_API_BASE } from '../config';
import {
  classifyPlayError, decideUpdate, decideWithoutPlay, deferFlexiblePrompt, flexiblePromptDue,
  parseFlexiblePrompt, shouldCheck, UPDATE_TYPE,
  type FlexiblePromptPreference, type PlayUpdateInfo, type UpdateDecision,
} from './playUpdatePolicy';

type InstallStatusEvent = {
  status: PlayUpdateInfo['installStatus'];
  bytesDownloaded: number;
  totalBytesToDownload: number;
  errorCode: number;
};

interface NativePlayUpdates {
  checkForUpdate(): Promise<PlayUpdateInfo>;
  startUpdate(type: number): Promise<boolean>;
  completeUpdate(): Promise<boolean>;
  addListener(event: 'onInstallStatus', listener: (event: InstallStatusEvent) => void): { remove(): void };
  addListener(event: 'onFlowResult', listener: (event: { result: 'accepted' | 'canceled' | 'failed' }) => void): { remove(): void };
}

const native: NativePlayUpdates | null = Platform.OS === 'android'
  ? requireOptionalNativeModule<NativePlayUpdates>('TavrikoPlayUpdates')
  : null;

/** Expo Go, web ve iOS'ta modül yoktur; denetleyici tamamen kapalı kalır. */
export const playUpdatesSupported = Boolean(native) && !__DEV__;

const PACKAGE_NAME = 'com.tavriko.app';
const MIN_VERSION_KEY = 'tavriko_android_min_version_v1';
const PROMPT_KEY = 'tavriko_flex_update_prompt_v1';

export type UpdateNotice = 'canceled' | 'failed' | 'offline' | 'play_unavailable' | null;

interface PlayUpdateState {
  decision: UpdateDecision;
  availableVersionCode: number;
  progress: number | null;
  busy: boolean;
  notice: UpdateNotice;
  promptDue: boolean;
}

export const usePlayUpdateStore = create<PlayUpdateState>(() => ({
  decision: { kind: 'none' },
  availableVersionCode: 0,
  progress: null,
  busy: false,
  notice: null,
  promptDue: false,
}));

const set = (patch: Partial<PlayUpdateState>) => usePlayUpdateStore.setState(patch);

let lastCheckAt = 0;
let lastFailed = false;
let playUnavailable = false;
let inFlight: Promise<void> | null = null;
let autoResumed = false;
let cachedMinVersion: number | null = null;
let promptPref: FlexiblePromptPreference | null = null;

function currentVersionCode(): number {
  const value = Number(Application.nativeBuildVersion);
  return Number.isSafeInteger(value) ? value : 0;
}

async function storedMinVersion(): Promise<number> {
  if (cachedMinVersion !== null) return cachedMinVersion;
  const raw = await SecureStore.getItemAsync(MIN_VERSION_KEY).catch(() => null);
  const value = Number(raw);
  cachedMinVersion = Number.isSafeInteger(value) && value > 0 ? value : 0;
  return cachedMinVersion;
}

/** Sunucudaki asgari sürüm; ulaşılamazsa son bilinen değer kullanılır. */
async function fetchMinVersion(): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    const response = await fetch(`${DEFAULT_API_BASE}/app/update-policy`, { signal: controller.signal });
    if (!response.ok) return storedMinVersion();
    const data = await response.json().catch(() => null);
    const value = Number(data?.android?.minVersionCode);
    const min = Number.isSafeInteger(value) && value > 0 ? value : 0;
    if (min !== cachedMinVersion) {
      cachedMinVersion = min;
      void SecureStore.setItemAsync(MIN_VERSION_KEY, String(min)).catch(() => {});
    }
    return min;
  } catch {
    return storedMinVersion();
  } finally {
    clearTimeout(timer);
  }
}

async function loadPromptPref(): Promise<FlexiblePromptPreference> {
  if (promptPref) return promptPref;
  const raw = await SecureStore.getItemAsync(PROMPT_KEY).catch(() => null);
  promptPref = parseFlexiblePrompt(raw);
  return promptPref;
}

function apply(decision: UpdateDecision, availableVersionCode: number) {
  const required = decision.kind === 'required';
  set({ decision, availableVersionCode, busy: false, ...(required ? {} : { progress: decision.kind === 'downloading' ? usePlayUpdateStore.getState().progress : null }) });
  if (decision.kind === 'optional') {
    void loadPromptPref().then(pref => set({ promptDue: flexiblePromptDue(pref, availableVersionCode, Date.now()) }));
  } else {
    set({ promptDue: decision.kind === 'downloaded' });
  }
  // Yarıda kalmış IMMEDIATE güncelleme: Play akışını oturum başına bir kez otomatik sürdür.
  if (decision.kind === 'required' && decision.resume && !autoResumed) {
    autoResumed = true;
    void startRequiredUpdate();
  }
}

async function runCheck(): Promise<void> {
  if (!native) return;
  const current = currentVersionCode();
  const minPromise = fetchMinVersion();
  try {
    const info = await native.checkForUpdate();
    const min = await minPromise;
    lastFailed = false;
    playUnavailable = false;
    const decision = decideUpdate(info, current, min);
    apply(decision, info.availableVersionCode || 0);
    if (usePlayUpdateStore.getState().notice === 'offline' || usePlayUpdateStore.getState().notice === 'play_unavailable') {
      set({ notice: null });
    }
  } catch (error) {
    const min = await minPromise;
    const kind = classifyPlayError((error as { code?: string })?.code);
    lastFailed = kind === 'transient';
    if (kind === 'play_unavailable') playUnavailable = true;
    const fallback = decideWithoutPlay(current, min);
    const { decision: previous, availableVersionCode } = usePlayUpdateStore.getState();
    // Sunucu bu sürümü desteklemiyorsa mağazaya yönlendirerek engelle. Geçici hatada
    // (ör. internet yok) bilinen son durum korunur; Play hiç yoksa engel kalkar.
    const next: UpdateDecision = fallback.kind === 'required' ? fallback
      : kind === 'transient' ? previous : fallback;
    if (next !== previous) apply(next, availableVersionCode);
    set({ notice: kind === 'play_unavailable' ? 'play_unavailable' : 'offline', busy: false });
  } finally {
    lastCheckAt = Date.now();
  }
}

export function checkForPlayUpdate(reason: 'launch' | 'foreground' | 'manual' | 'online'): Promise<void> {
  if (!playUpdatesSupported) return Promise.resolve();
  if (inFlight) return inFlight;
  const required = usePlayUpdateStore.getState().decision.kind === 'required';
  if (!shouldCheck(reason, { lastCheckAt, lastFailed, required, playUnavailable }, Date.now())) return Promise.resolve();
  inFlight = runCheck().finally(() => { inFlight = null; });
  return inFlight;
}

async function openStoreListing() {
  try {
    await Linking.openURL(`market://details?id=${PACKAGE_NAME}`);
  } catch {
    await Linking.openURL(`https://play.google.com/store/apps/details?id=${PACKAGE_NAME}`).catch(() => {});
  }
}

/** Zorunlu güncelleme: Google Play'in tam ekran IMMEDIATE akışını başlatır. */
export async function startRequiredUpdate(): Promise<void> {
  const state = usePlayUpdateStore.getState();
  if (state.decision.kind !== 'required' || state.busy) return;
  set({ busy: true, notice: null });
  if (state.decision.via === 'store' || !native) {
    await openStoreListing();
    set({ busy: false });
    return;
  }
  try {
    const started = await native.startUpdate(UPDATE_TYPE.IMMEDIATE);
    if (!started) {
      // Play artık bu akışa izin vermiyor: mağaza sayfası son çare.
      await openStoreListing();
      set({ busy: false });
    }
    // Başladıysa sonuç onFlowResult ile gelir.
  } catch (error) {
    const kind = classifyPlayError((error as { code?: string })?.code);
    set({ busy: false, notice: kind === 'play_unavailable' ? 'play_unavailable' : 'failed' });
  }
}

/** İsteğe bağlı güncelleme: Play onay penceresi, ardından arka planda indirme. */
export async function startFlexibleUpdate(): Promise<void> {
  const state = usePlayUpdateStore.getState();
  if (state.decision.kind !== 'optional' || state.busy || !native) return;
  set({ busy: true, notice: null, promptDue: false });
  try {
    const started = await native.startUpdate(UPDATE_TYPE.FLEXIBLE);
    if (!started) set({ busy: false });
  } catch (error) {
    const kind = classifyPlayError((error as { code?: string })?.code);
    set({ busy: false, notice: kind === 'play_unavailable' ? 'play_unavailable' : 'failed' });
  }
}

/** FLEXIBLE indirme bittiyse kurar; Play uygulamayı yeniden başlatır. */
export async function completeFlexibleUpdate(): Promise<void> {
  if (!native || usePlayUpdateStore.getState().decision.kind !== 'downloaded') return;
  set({ busy: true });
  try {
    await native.completeUpdate();
  } catch {
    set({ busy: false, notice: 'failed' });
  }
}

/** "Sonra": aynı sürüm için öneri 24/48/72 saat ertelenir. */
export function dismissFlexiblePrompt(): void {
  const { availableVersionCode, decision } = usePlayUpdateStore.getState();
  set({ promptDue: false, notice: null });
  if (decision.kind !== 'optional') return;
  void loadPromptPref().then(pref => {
    promptPref = deferFlexiblePrompt(pref, availableVersionCode, Date.now());
    void SecureStore.setItemAsync(PROMPT_KEY, JSON.stringify(promptPref)).catch(() => {});
  });
}

let listening = false;
/** Uygulama açılışında bir kez çağrılır: Play olaylarını dinler ve ilk kontrolü yapar. */
export function initPlayUpdates(): void {
  if (!playUpdatesSupported || !native || listening) return;
  listening = true;
  native.addListener('onInstallStatus', event => {
    const total = event.totalBytesToDownload;
    switch (event.status) {
      case 'pending':
      case 'downloading':
        if (usePlayUpdateStore.getState().decision.kind !== 'required') {
          set({ decision: { kind: 'downloading' }, progress: total > 0 ? Math.min(1, event.bytesDownloaded / total) : null, busy: false });
        }
        break;
      case 'downloaded':
        set({ decision: { kind: 'downloaded' }, progress: 1, busy: false, promptDue: true });
        break;
      case 'installed':
        set({ decision: { kind: 'none' }, progress: null, busy: false, promptDue: false });
        break;
      case 'failed':
        set({ busy: false, progress: null, notice: 'failed' });
        void checkForPlayUpdate('manual');
        break;
      case 'canceled':
        set({ busy: false, progress: null });
        void checkForPlayUpdate('manual');
        break;
      default:
        break;
    }
  });
  native.addListener('onFlowResult', ({ result }) => {
    const state = usePlayUpdateStore.getState();
    if (result === 'accepted') return; // IMMEDIATE'te Play devralır; FLEXIBLE'da indirme olayları gelir.
    set({ busy: false, notice: result === 'canceled' ? 'canceled' : 'failed' });
    if (state.decision.kind === 'optional' && result === 'canceled') dismissFlexiblePrompt();
    // Zorunlu güncellemede ekran yerinde kalır; durum tazelenir.
    void checkForPlayUpdate('manual');
  });
  void checkForPlayUpdate('launch');
}
