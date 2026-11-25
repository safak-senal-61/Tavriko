import type { SharedValue } from 'react-native-reanimated';
import type { NickStyleDef } from '@trivia/shared';

/** RN onTextLayout satırı (Skia çizimi için gerekli alanlar) */
export interface NickLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ascender: number;
  capHeight?: number;
}

export interface NickSkiaTextProps {
  def: NickStyleDef;
  /** Skia SkTypeface (web'de hiç oluşmaz) */
  typeface: any;
  /** RN fontSize (ölçeklenmemiş) — satır capHeight ile düzeltilir */
  fontSize: number;
  letterSpacing: number;
  lines: NickLine[];
  width: number;
  height: number;
  time: SharedValue<number>;
  /** parıltı çarpanı (hero varyantında daha güçlü) */
  glowScale: number;
}
