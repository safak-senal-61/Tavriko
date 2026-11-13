import { AppState, Platform } from 'react-native';
import { useNetStatus } from '../store/netStatus';
import { CDN_BASE } from '../utils/cdn';

/**
 * İnternet bağlantısı izleyici (Web + iOS + Android).
 *
 * - Web: tarayıcının anlık `online`/`offline` olayları + kalp atışı doğrulaması
 *   (`navigator.onLine` yalnızca ağ arayüzünü bilir; yönlendirici bağlı ama
 *   internet yok durumunu yakalamaz).
 * - Native: NetInfo gibi ek bir native bağımlılık getirmemek için hafif
 *   periyodik HTTP yoklaması yapılır.
 *
 * Herhangi bir HTTP yanıtı (404 dahil) ağın erişilebilir olduğu anlamına gelir;
 * yalnızca fetch hatası veya zaman aşımı çevrimdışı sayılır.
 */

const ONLINE_CHECK_MS = 8000; // Çevrimiçiyken doğrulama sıklığı
const OFFLINE_CHECK_MS = 3000; // Çevrimdışı şüphesinde hızlı yoklama
const PROBE_TIMEOUT_MS = 3500;

let intervalId: ReturnType<typeof setInterval> | null = null;
let probing = false;
let started = false;

async function probeNetwork(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    // Cache-buster'lı HEAD: küçük yanıt, tarayıcı önbelleğine takılmaz
    await fetch(`${CDN_BASE}/favicon.png?netprobe=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function runProbe(): Promise<void> {
  if (probing) return;
  // Arka planda gereksiz yoklama yapma (batarya dostu)
  if (AppState.currentState !== 'active') return;
  probing = true;
  try {
    const reachable = await probeNetwork();
    const store = useNetStatus.getState();
    if (reachable !== store.online) store.setOnline(reachable);
  } finally {
    probing = false;
  }
}

function scheduleNext(): void {
  if (intervalId) clearInterval(intervalId);
  const online = useNetStatus.getState().online;
  intervalId = setInterval(() => {
    void runProbe();
  }, online ? ONLINE_CHECK_MS : OFFLINE_CHECK_MS);
}

export const netMonitor = {
  start(): void {
    if (started || typeof fetch === 'undefined') return;
    started = true;

    // Web: tarayıcı olayları anlık bildirir
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof window.addEventListener === 'function' &&
      typeof navigator !== 'undefined'
    ) {
      window.addEventListener('online', () => useNetStatus.getState().setOnline(true));
      window.addEventListener('offline', () => useNetStatus.getState().setOnline(false));
      useNetStatus.getState().setOnline(navigator.onLine !== false);
    }

    // Her iki platformda da gerçek internet erişimini doğrulayan kalp atışı
    void runProbe();
    scheduleNext();
    // Durum değişince yoklama sıklığını da güncelle
    useNetStatus.subscribe((state, prev) => {
      if (state.online !== prev.online) scheduleNext();
    });
  },

  /** Tek seferlik anlık kontrol (ör. "Yeniden dene" düğmesi) */
  async checkNow(): Promise<boolean> {
    const reachable = await probeNetwork();
    useNetStatus.getState().setOnline(reachable);
    return reachable;
  },

  stop(): void {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    started = false;
  },
};
