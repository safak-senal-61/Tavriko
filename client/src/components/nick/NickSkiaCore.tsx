/**
 * Animated Nick — Skia çizim çekirdeği (iOS, Android ve web).
 * Görünmez RN <Text>'in satır yerleşimini alır ve aynı harfleri Skia ile shader
 * dolgusu + bulanık parıltı katmanlarıyla çizer.
 * Native'de doğrudan, web'de CanvasKit yüklendikten sonra dinamik olarak içe
 * aktarılır (bkz. NickSkiaLayer.tsx) — @shopify/react-native-skia web'de
 * içe aktarılırken global CanvasKit'in hazır olmasını bekler.
 */
import React, { memo, useEffect, useMemo, useState } from 'react';
import {
  BlurMask,
  Canvas,
  Glyphs,
  Group,
  Shader,
  Skia,
  type SkFont,
  type SkRuntimeEffect,
  type SkTypeface,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { NickFill, NickStyleDef } from '@trivia/shared';
import { nickShaderSource, paletteUniforms } from './nickShaders';
import { NICK_FONT_FILES } from './nickFonts';
import { Image, Platform } from 'react-native';
import { Asset } from 'expo-asset';

/* ---------- yazı tipi ve shader önbellekleri (modül ömrü boyunca) ---------- */

const typefaces = new Map<string, SkTypeface>();
const pending = new Map<string, Promise<SkTypeface | null>>();

function assetUri(mod: unknown): string | undefined {
  if (Platform.OS === 'web') {
    if (typeof mod === 'string') return mod;
    try {
      return Asset.fromModule(mod as any).uri;
    } catch {
      return (mod as { uri?: string } | null)?.uri;
    }
  }
  return Image.resolveAssetSource(mod as any)?.uri;
}

export function cachedTypeface(key: string): SkTypeface | null {
  return typefaces.get(key) ?? null;
}

export function loadTypeface(key: string): Promise<SkTypeface | null> {
  const hit = typefaces.get(key);
  if (hit) return Promise.resolve(hit);
  const inflight = pending.get(key);
  if (inflight) return inflight;
  const mod = NICK_FONT_FILES[key];
  if (!mod) return Promise.resolve(null);
  const uri = assetUri(mod);
  if (!uri) return Promise.resolve(null);
  const p = Skia.Data.fromURI(uri)
    .then((data) => {
      const tf = Skia.Typeface.MakeFreeTypeFaceFromData(data);
      if (tf) typefaces.set(key, tf);
      return tf;
    })
    .catch(() => null)
    .finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}

/** Skia yazı tipi hazır olana kadar null döner (o sürede lite çizilir). */
export function useNickTypeface(key: string | null): SkTypeface | null {
  const [tf, setTf] = useState<SkTypeface | null>(() => (key ? typefaces.get(key) ?? null : null));
  useEffect(() => {
    if (!key) {
      setTf(null);
      return;
    }
    const cached = typefaces.get(key);
    if (cached) {
      setTf(cached);
      return;
    }
    let alive = true;
    loadTypeface(key).then((t) => {
      if (alive) setTf(t);
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return tf;
}

const effects = new Map<NickFill, SkRuntimeEffect | null>();
function effectFor(fill: NickFill): SkRuntimeEffect | null {
  if (effects.has(fill)) return effects.get(fill) ?? null;
  let eff: SkRuntimeEffect | null = null;
  try {
    eff = Skia.RuntimeEffect.Make(nickShaderSource(fill));
  } catch {
    eff = null;
  }
  effects.set(fill, eff);
  return eff;
}

export function nickEffectSupported(fill: NickFill): boolean {
  return !!effectFor(fill);
}

/* ---------- metin yerleşimi → glif konumları ---------- */

import type { NickLine, NickSkiaTextProps } from './nickSkiaTypes';
export type { NickLine, NickSkiaTextProps };

interface GlyphRun {
  glyphs: { id: number; pos: { x: number; y: number } }[];
  box: { x: number; y: number; w: number; h: number };
}

function layoutGlyphs(
  font: SkFont,
  lines: NickLine[],
  letterSpacing: number,
  pad: number,
  align: 'left' | 'center' | 'right' = 'left',
): GlyphRun {
  const out: GlyphRun['glyphs'] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const ellipsis = font.getGlyphIDs('…');
  const ellW = ellipsis.length ? font.getGlyphWidths(ellipsis)[0] : 0;
  for (const line of lines) {
    let ids = font.getGlyphIDs(line.text.replace(/\s+$/, ''));
    let widths = font.getGlyphWidths(ids);
    const total = () => widths.reduce((a, b) => a + b + letterSpacing, 0);
    const synth = Number.isNaN(line.ascender);
    // Web: tarayıcı kerning uygular, Skia glif genişlikleri uygulamaz → birkaç
    // piksellik fark kesme sayılmaz; harf aralığı sıkıştırılarak kutuya oturtulur.
    let squeeze = 0;
    if (synth && ids.length > 1) {
      const over = total() - letterSpacing - line.width;
      if (over > 0 && over <= line.width * 0.08) squeeze = -over / (ids.length - 1);
    }
    // RN '…' ile kestiyse (veya satır metni sığmıyorsa) aynı şekilde kes
    if (!squeeze && total() > line.width + 1.5 && ids.length > 1) {
      while (ids.length > 1 && total() + ellW > line.width + 1) {
        ids = ids.slice(0, -1);
        widths = widths.slice(0, -1);
      }
      if (ellipsis.length) {
        ids = [...ids, ellipsis[0]];
        widths = [...widths, ellW];
      }
    }
    // Web'de onTextLayout yok: satır kutusu verilir (ascender = NaN), taban çizgisi
    // CSS satır kutusundaki gibi (yarım satır aralığı + font ascent) hesaplanır.
    let baseline: number;
    let startX = line.x;
    if (synth) {
      const m = font.getMetrics();
      const ascent = Math.abs(m.ascent);
      const descent = Math.abs(m.descent);
      baseline = line.y + (line.height - (ascent + descent)) / 2 + ascent + pad;
      const used = widths.reduce((a, b) => a + b + letterSpacing + squeeze, 0) - letterSpacing - squeeze;
      if (align === 'center') startX = line.x + Math.max(0, (line.width - used) / 2);
      else if (align === 'right') startX = line.x + Math.max(0, line.width - used);
    } else {
      baseline = line.y + Math.abs(line.ascender) + pad;
    }
    let x = startX + pad;
    ids.forEach((id, i) => {
      out.push({ id, pos: { x, y: baseline } });
      x += widths[i] + letterSpacing + squeeze;
    });
    minX = Math.min(minX, startX + pad);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, line.y + pad);
    maxY = Math.max(maxY, line.y + line.height + pad);
  }
  if (!out.length) return { glyphs: out, box: { x: pad, y: pad, w: 1, h: 1 } };
  return { glyphs: out, box: { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) } };
}

/* ---------- çizim ---------- */


export const NickSkiaText = memo(function NickSkiaText({
  def,
  typeface,
  fontSize,
  letterSpacing,
  lines,
  width,
  height,
  time,
  glowScale,
  align,
}: NickSkiaTextProps) {
  const effect = effectFor(def.fill);
  const glowR = Math.max(2, def.motion.glow * glowScale * Math.min(1.6, Math.max(0.6, fontSize / 18)));
  const pad = Math.ceil(glowR * 1.6 + 4);

  const font = useMemo(() => {
    // Gerçek piksel boyu: RN satırının capHeight değeri (fontScale dahil) ile eşle
    const probe = Skia.Font(typeface, 100);
    const capPerUnit = (probe.measureText('H').height || 70.5) / 100;
    const cap = lines[0]?.capHeight;
    const size = cap && cap > 0 && capPerUnit > 0 ? cap / capPerUnit : fontSize;
    const f = Skia.Font(typeface, size);
    f.setSubpixel?.(true);
    return f;
  }, [typeface, fontSize, lines]);

  const run = useMemo(() => layoutGlyphs(font, lines, letterSpacing, pad, align), [font, lines, letterSpacing, pad, align]);

  const pal = useMemo(() => paletteUniforms(def.palette.colors), [def.palette.colors]);
  const speed = 1000 / Math.max(300, def.motion.periodMs);
  const box = run.box;

  const uniforms = useDerivedValue(() => ({
    iRes: [box.w, box.h],
    iOrig: [box.x, box.y],
    iTime: time.value,
    iSpeed: speed,
    c0: pal.c0,
    c1: pal.c1,
    c2: pal.c2,
    c3: pal.c3,
    c4: pal.c4,
    c5: pal.c5,
    n: pal.n,
  }));

  const pulse = def.motion.pulse;
  const glowOpacity = useDerivedValue(() => {
    const ph = time.value * speed * Math.PI * 2;
    return 0.78 - pulse * 0.32 * (1 + Math.sin(ph));
  });

  const isGlitch = def.fill === 'glitch';
  const glitchA = useDerivedValue(() => {
    if (!isGlitch) return [{ translateX: 0 }];
    const ph = (time.value * speed) % 1;
    const burst = ph < 0.07 || (ph > 0.52 && ph < 0.56);
    const j = burst ? 2.2 + Math.sin(time.value * 90) * 1.6 : 0.8;
    return [{ translateX: -j }, { translateY: burst ? Math.sin(time.value * 70) * 0.8 : 0 }];
  });
  const glitchB = useDerivedValue(() => {
    if (!isGlitch) return [{ translateX: 0 }];
    const ph = (time.value * speed) % 1;
    const burst = ph < 0.07 || (ph > 0.52 && ph < 0.56);
    const j = burst ? 2.2 + Math.cos(time.value * 80) * 1.6 : 0.8;
    return [{ translateX: j }];
  });
  const mainShift = useDerivedValue(() => {
    if (!isGlitch) return [{ translateX: 0 }];
    const ph = (time.value * speed) % 1;
    const burst = ph < 0.05;
    return [{ translateX: burst ? Math.sin(time.value * 120) * 1.4 : 0 }];
  });

  const isShadow = def.fill === 'shadow';
  const shadowDrift = useDerivedValue(() => {
    if (!isShadow) return [{ translateY: 0 }];
    const ph = time.value * speed * Math.PI * 2;
    return [{ translateY: 2.5 + Math.sin(ph) * 1.5 }, { translateX: Math.cos(ph * 0.5) * 1.5 }];
  });

  const glowColor = useMemo(() => Skia.Color(def.palette.glow), [def.palette.glow]);
  const neonCore = def.fill === 'neon';

  if (!effect || !run.glyphs.length) return null;

  return (
    <Canvas
      pointerEvents="none"
      style={{ position: 'absolute', left: -pad, top: -pad, width: width + pad * 2, height: height + pad * 2 }}
    >
      {isShadow && (
        <Group transform={shadowDrift}>
          <Glyphs font={font} glyphs={run.glyphs} x={0} y={0} color="rgba(0,0,0,0.9)">
            <BlurMask blur={glowR * 0.7} style="normal" />
          </Glyphs>
        </Group>
      )}
      <Glyphs font={font} glyphs={run.glyphs} x={0} y={0} color={glowColor} opacity={glowOpacity}>
        <BlurMask blur={glowR * 0.55} style="normal" />
      </Glyphs>
      {neonCore && (
        <Glyphs font={font} glyphs={run.glyphs} x={0} y={0} color={glowColor} opacity={0.5}>
          <BlurMask blur={Math.max(1.5, glowR * 0.18)} style="solid" />
        </Glyphs>
      )}
      {isGlitch && (
        <>
          <Group transform={glitchA} blendMode="screen">
            <Glyphs font={font} glyphs={run.glyphs} x={0} y={0} color={def.palette.colors[1] ?? '#22D3EE'} opacity={0.75} />
          </Group>
          <Group transform={glitchB} blendMode="screen">
            <Glyphs font={font} glyphs={run.glyphs} x={0} y={0} color={def.palette.colors[2] ?? '#F43F5E'} opacity={0.75} />
          </Group>
        </>
      )}
      <Group transform={mainShift}>
        <Glyphs font={font} glyphs={run.glyphs} x={0} y={0}>
          <Shader source={effect} uniforms={uniforms} />
        </Glyphs>
      </Group>
    </Canvas>
  );
});
