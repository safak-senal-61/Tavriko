import { create } from 'zustand';

/**
 * İnternet koptuğunda oyuncunun oyunda tutulduğu koruma süresi (ms).
 * Süre dolarsa ve bağlantı dönmezse oyuncu oyundan düşürülür.
 * RootNavigator (süre yönetimi) ve ConnectionStatusOverlay (görsel oran) kullanır.
 */
export const OFFLINE_GAME_GRACE_MS = 20000;

/**
 * Uygulama genelinde internet bağlantısı durumu.
 *
 * Tespit `services/netMonitor.ts` içinde yapılır:
 * - Web: tarayıcı online/offline olayları (anlık) + hafif kalp atışı doğrulaması
 * - Native: periyodik hafif HTTP yoklaması
 *
 * Oyun koruma süresi (`graceEndsAt`) RootNavigator tarafından yönetilir:
 * internet kopunca oyuncu hemen düşürülmez; süre dolarsa oyundan çıkarılır.
 */
interface NetStatusState {
  /** Son bilinen bağlantı durumu (ilk yoklama tamamlanana kadar iyimser) */
  online: boolean;
  /** Çevrimdışılığın başlangıç anı (Date.now()), çevrimiçiyken null */
  offlineSince: number | null;
  /** Oyun koruma süresinin bitiş anı (ms) — dolarsa oyuncu oyundan düşürülür */
  graceEndsAt: number | null;
  /** "Bağlantı geri geldi" bildiriminin tetiklendiği an (ms) */
  reconnectedAt: number | null;
  setOnline: (online: boolean) => void;
  setGraceEndsAt: (graceEndsAt: number | null) => void;
  markReconnected: () => void;
}

export const useNetStatus = create<NetStatusState>((set) => ({
  online: true,
  offlineSince: null,
  graceEndsAt: null,
  reconnectedAt: null,
  setOnline: (online) =>
    set((state) => {
      if (state.online === online) return state;
      if (online) {
        return {
          online: true,
          offlineSince: null,
          // Bağlantı döndü: koruma süresi artık geçersiz, geri geldi bildirimi göster
          graceEndsAt: null,
          reconnectedAt: Date.now(),
        };
      }
      return { online: false, offlineSince: Date.now(), graceEndsAt: null, reconnectedAt: null };
    }),
  setGraceEndsAt: (graceEndsAt) => set({ graceEndsAt }),
  markReconnected: () => set({ reconnectedAt: Date.now() }),
}));
