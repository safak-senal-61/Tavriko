/**
 * Animated Nick — kalite kararı ve efekt bütçesi (saf mantık, RN bağımsız).
 *
 *  full   : Skia shader + parıltı + (izin varsa) Lottie parçacıkları
 *  lite   : Reanimated renk döngüsü + sabit parıltı, düşük kare hızı
 *  static : animasyon yok; paletin ana rengi + hafif sabit parıltı
 */
import type { NickEffectsPreference } from '@trivia/shared';

export type NickQuality = 'full' | 'lite' | 'static';

export interface NickEnvInput {
  /** Kullanıcı tercihi (Ayarlar → Nick efektleri) */
  pref?: NickEffectsPreference | null;
  /** Ayarlar → Akıcı animasyonlar (false = animasyonlar kapalı) */
  smoothAnimations?: boolean | null;
  /** Ayarlar → Pil tasarrufu */
  batterySaver?: boolean | null;
  /** İşletim sistemi "hareketi azalt" erişilebilirlik ayarı */
  reduceMotion?: boolean;
  /** Düşük donanımlı cihaz (RAM / yıl sınıfı) */
  lowEnd?: boolean;
  /** Bu platformda Skia çizimi mevcut mu (web'de false) */
  skiaAvailable?: boolean;
}

/** Ortam + tercihlere göre bu cihazda ulaşılabilecek en yüksek kalite. */
export function resolveNickQuality(env: NickEnvInput): NickQuality {
  const pref: NickEffectsPreference = env.pref ?? 'auto';
  if (pref === 'off') return 'static';
  // Kullanıcı genel animasyonları kapattıysa nickler de durur.
  if (env.smoothAnimations === false) return 'static';
  const cap: NickQuality = env.skiaAvailable ? 'full' : 'lite';
  if (pref === 'lite') return 'lite';
  if (pref === 'full') return cap;
  // auto
  if (env.reduceMotion) return 'static';
  if (env.batterySaver || env.lowEnd) return 'lite';
  return cap;
}

/** İstenen kaliteyi ortam üst sınırıyla kırpar. */
export function clampQuality(requested: NickQuality, cap: NickQuality): NickQuality {
  const rank: Record<NickQuality, number> = { static: 0, lite: 1, full: 2 };
  return rank[requested] <= rank[cap] ? requested : cap;
}

/** Cihaz özelliklerinden düşük donanım tahmini. */
export function isLowEndDevice(info: { totalMemory?: number | null; yearClass?: number | null }): boolean {
  const gb = info.totalMemory ? info.totalMemory / 1024 ** 3 : null;
  if (gb != null && gb < 3.2) return true;
  if (info.yearClass != null && info.yearClass < 2018) return true;
  return false;
}

/**
 * Eşzamanlı ağır efekt bütçesi. Aynı anda en fazla `max` tam kalite nick
 * (veya parçacık katmanı) çalışır; diğerleri lite'a düşer. Öncelikli
 * (hero/önizleme) istekler bütçeyi aşabilir ama sayılır.
 */
export class NickSlotPool {
  private holders = new Set<number>();
  private listeners = new Set<() => void>();
  /**
   * @param max   normal istekler için üst sınır
   * @param hardMax öncelikli istekler dahil mutlak üst sınır (web'de WebGL bağlam sınırı)
   */
  constructor(public max: number, public hardMax = Infinity) {}

  get used() {
    return this.holders.size;
  }

  tryAcquire(id: number, priority = false): boolean {
    if (this.holders.has(id)) return true;
    if (this.holders.size >= this.hardMax) return false;
    if (!priority && this.holders.size >= this.max) return false;
    this.holders.add(id);
    return true;
  }

  release(id: number) {
    if (this.holders.delete(id)) {
      this.listeners.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
    }
  }

  has(id: number) {
    return this.holders.has(id);
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}

/** Palette içinden lite modda okunabilir (yeterince parlak) renkleri seçer. */
export function readableColors(colors: string[], fallback: string, minLum = 0.32): string[] {
  const lum = (hex: string) => {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const list = colors.filter((c) => /^#[0-9a-f]{6}/i.test(c) && lum(c) >= minLum);
  if (list.length >= 2) return list;
  if (list.length === 1) return [list[0], fallback];
  return [fallback, fallback];
}
