/**
 * Animated Nick — Skia katmanı (web).
 *
 * Web'de de mobildeki ile aynı Skia shader + parıltı efektleri kullanılır.
 * CanvasKit (wasm) ilk tam kaliteli nick çizileceği zaman yüklenir; çekirdek
 * (NickSkiaCore) CanvasKit hazır olduktan sonra dinamik içe aktarılır, çünkü
 * @shopify/react-native-skia web'de içe aktarılırken global CanvasKit'i okur.
 * Yükleme bitene kadar (veya başarısız olursa) NickRenderer hafif moda düşer.
 */
import React, { useEffect, useState } from 'react';
import type { NickFill } from '@trivia/shared';
import type { NickLine, NickSkiaTextProps } from './nickSkiaTypes';
export type { NickLine, NickSkiaTextProps };

export const SKIA_AVAILABLE = true;

type Core = typeof import('./NickSkiaCore');

let core: Core | null = null;
let corePromise: Promise<Core | null> | null = null;
let failed = false;

/** canvaskit.wasm, web derlemesinde client/public → dist köküne kopyalanır. */
function wasmUrl(file: string): string {
  return `/${file}`;
}

export function loadNickSkiaWeb(): Promise<Core | null> {
  if (core) return Promise.resolve(core);
  if (failed) return Promise.resolve(null);
  if (!corePromise) {
    corePromise = (async () => {
      try {
        const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web');
        await LoadSkiaWeb({ locateFile: wasmUrl });
        core = await import('./NickSkiaCore');
        return core;
      } catch (err) {
        failed = true;
        if (typeof console !== 'undefined') console.warn('[nick] Skia web yüklenemedi, hafif moda geçiliyor.', err);
        return null;
      }
    })();
  }
  return corePromise;
}

/** Skia yazı tipi hazır olana kadar null döner (o sürede lite çizilir). */
export function useNickTypeface(key: string | null): any {
  const [tf, setTf] = useState<any>(() => (key && core ? core.cachedTypeface(key) : null));
  useEffect(() => {
    if (!key) {
      setTf(null);
      return;
    }
    const cached = core?.cachedTypeface(key);
    if (cached) {
      setTf(cached);
      return;
    }
    let alive = true;
    loadNickSkiaWeb()
      .then((c) => (c ? c.loadTypeface(key) : null))
      .then((t) => {
        if (alive) setTf(t ?? null);
      });
    return () => {
      alive = false;
    };
  }, [key]);
  return tf;
}

export function nickEffectSupported(fill: NickFill): boolean {
  if (failed) return false;
  // Çekirdek yüklenene kadar iyimser: yazı tipi hazır olmadan zaten lite çizilir.
  return core ? core.nickEffectSupported(fill) : true;
}

export function NickSkiaText(props: NickSkiaTextProps) {
  if (!core) return null;
  const Impl = core.NickSkiaText;
  return <Impl {...props} />;
}
