/**
 * Animated Nick — Skia katmanı web karşılığı.
 * Web paketine Skia/CanvasKit eklenmez; NickRenderer web'de lite moda düşer.
 */
import type { NickFill } from '@trivia/shared';
import type { NickLine, NickSkiaTextProps } from './nickSkiaTypes';
export type { NickLine, NickSkiaTextProps };

export const SKIA_AVAILABLE = false;

export function useNickTypeface(_key: string | null): any {
  return null;
}

export function nickEffectSupported(_fill: NickFill): boolean {
  return false;
}

export const NickSkiaText = (_props: NickSkiaTextProps): null => null;
