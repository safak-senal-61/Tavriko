/**
 * NickRenderer — Animated Nick Cosmetics sisteminin merkezi bileşeni.
 *
 * Kullanım:  <NickRenderer styleId={user.equippedNameEffect} text={user.displayName} style={...} />
 *
 * Stil `styleId` üzerinden @trivia/shared NICK_STYLES kayıt defterinden okunur.
 * Kalite otomatik seçilir (bkz. nickQualityCore.resolveNickQuality):
 *   full   → Skia shader dolgusu + bulanık parıltı (+ hero'da Lottie parçacıkları)
 *   lite   → Reanimated renk döngüsü, 24 fps, sabit parıltı
 *   static → animasyonsuz palet rengi
 *
 * Performans:
 *  - Saat yalnızca bileşen ekrandayken ve uygulama ön plandayken ilerler.
 *  - Tam kalite eşzamanlı örnek sayısı bütçelidir (fullPool); aşılırsa lite.
 *  - Görünmez RN <Text> her zaman yerleşimi, kesmeyi (…) ve erişilebilirliği
 *    sağlar; Skia yalnızca onun satır yerleşimini boyar → FlatList ölçümleriyle
 *    birebir uyumlu, ek yeniden yerleşim yok.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PixelRatio,
  Platform,
  StyleSheet,
  Text,
  type LayoutChangeEvent,
  type StyleProp,
  type TextLayoutEvent,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { getNickStyle, type NickStyleDef } from '@trivia/shared';
import { useNickEnv, fullPool, particlePool, allocNickId } from './nickEnv';
import { clampQuality, readableColors, type NickQuality, type NickSlotPool } from './nickQualityCore';
import { NickSkiaText, SKIA_AVAILABLE, nickEffectSupported, useNickTypeface, type NickLine } from './NickSkiaLayer';
import { NickParticles, PARTICLES_AVAILABLE } from './NickParticles';
import { nickFontFor } from './nickFonts';
import { cyclicColor, withAlpha } from './nickColor';
import { useNickClock } from './useNickClock';

const IS_WEB = Platform.OS === 'web';

export type NickVariant = 'inline' | 'hero';

export interface NickRendererProps {
  /** users.equippedNameEffect / mağaza ürün id'si. Boşsa düz metin. */
  styleId?: string | null;
  /** Gösterilecek nick (children de kullanılabilir) */
  text?: string;
  children?: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** hero: profil başlığı / önizleme — öncelikli bütçe, parçacıklar, güçlü parıltı */
  variant?: NickVariant;
  /** Kaliteyi zorla (ör. mağaza önizlemesinde kullanıcı seçimi). Platform sınırı yine uygulanır. */
  quality?: NickQuality;
  /** false → animasyonsuz (ör. arka plandaki modal) */
  animate?: boolean;
  /** Ölçek kısıtlaması gereken dar alanlar için RN Text ile aynı */
  adjustsFontSizeToFit?: boolean;
  allowFontScaling?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

const LAYOUT_KEYS = new Set([
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'marginStart', 'marginEnd', 'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'position', 'top',
  'left', 'right', 'bottom', 'start', 'end', 'width', 'minWidth', 'maxWidth', 'zIndex', 'transform', 'opacity',
]);

function splitStyle(style: StyleProp<TextStyle>) {
  const flat = (StyleSheet.flatten(style) || {}) as Record<string, any>;
  const outer: Record<string, any> = {};
  const inner: Record<string, any> = {};
  for (const k of Object.keys(flat)) {
    if (LAYOUT_KEYS.has(k)) outer[k] = flat[k];
    else inner[k] = flat[k];
  }
  // Dış sarmalayıcı genişliği belirliyorsa metin onu doldurmalı
  if (outer.width != null || outer.flex != null || outer.flexGrow != null || outer.alignSelf === 'stretch') {
    inner.alignSelf = 'stretch';
  }
  return { outer: outer as ViewStyle, inner: inner as TextStyle };
}

function textOf(text: string | undefined, children: React.ReactNode): string {
  if (typeof text === 'string') return text;
  if (children == null || children === false) return '';
  if (Array.isArray(children)) return children.map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : '')).join('');
  return typeof children === 'string' || typeof children === 'number' ? String(children) : '';
}

/** Bütçe havuzundan yer ister; yer açıldığında yeniden dener. */
function usePoolSlot(pool: NickSlotPool, id: number, want: boolean, priority: boolean): boolean {
  const [granted, setGranted] = useState(() => (want ? pool.tryAcquire(id, priority) : false));
  useEffect(() => {
    if (!want) {
      pool.release(id);
      setGranted(false);
      return;
    }
    if (pool.tryAcquire(id, priority)) {
      setGranted(true);
      return;
    }
    setGranted(false);
    return pool.subscribe(() => {
      if (pool.tryAcquire(id, priority)) setGranted(true);
    });
  }, [pool, id, want, priority]);
  useEffect(() => () => pool.release(id), [pool, id]);
  return granted && want;
}

export const NickRenderer = memo(function NickRenderer(props: NickRendererProps) {
  const def = getNickStyle(props.styleId);
  const text = textOf(props.text, props.children);
  if (!def) {
    return (
      <Text
        style={props.style}
        numberOfLines={props.numberOfLines}
        adjustsFontSizeToFit={props.adjustsFontSizeToFit}
        allowFontScaling={props.allowFontScaling}
        testID={props.testID}
        accessibilityLabel={props.accessibilityLabel}
      >
        {text}
      </Text>
    );
  }
  return <NickStyled {...props} def={def} text={text} />;
});

const NickStyled = memo(function NickStyled({
  def,
  text,
  style,
  numberOfLines,
  variant = 'inline',
  quality,
  animate = true,
  adjustsFontSizeToFit,
  allowFontScaling,
  testID,
  accessibilityLabel,
}: NickRendererProps & { def: NickStyleDef; text: string }) {
  const env = useNickEnv();
  const hero = variant === 'hero';
  const idRef = useRef(0);
  if (!idRef.current) idRef.current = allocNickId();
  const id = idRef.current;

  // --- kalite üst sınırı ---
  let cap: NickQuality = quality ? clampQuality(quality, SKIA_AVAILABLE ? 'full' : 'lite') : env.cap;
  if (!animate) cap = 'static';
  const running = cap !== 'static' && env.appActive;

  // --- stil + yazı tipi ---
  const { outer, inner, fontKey } = useMemo(() => {
    const s = splitStyle(style) as { outer: ViewStyle; inner: Record<string, any> };
    let key = nickFontFor(s.inner.fontFamily, s.inner.fontWeight as any);
    if (!s.inner.fontFamily && key) {
      s.inner.fontFamily = key;
      delete s.inner.fontWeight;
    }
    // adjustsFontSizeToFit ile ölçülen gerçek boyutu Skia bilemez → lite
    if (adjustsFontSizeToFit) key = null;
    return { outer: s.outer, inner: s.inner as TextStyle, fontKey: key };
  }, [style, adjustsFontSizeToFit]);

  const fontSize = typeof inner.fontSize === 'number' ? inner.fontSize : 14;
  const letterSpacing = typeof inner.letterSpacing === 'number' ? inner.letterSpacing : 0;
  // RN <Text> sistem yazı ölçeğini (Android "Yazı boyutu", iOS Dynamic Type)
  // uygular; Skia aynı boyutta çizmeli, yoksa harfler taşar ve yanlış kesilir.
  const fontScale = !IS_WEB && allowFontScaling !== false ? PixelRatio.getFontScale() || 1 : 1;
  const drawFontSize = fontSize * fontScale;

  // --- saat + görünürlük ---
  const { ref, time, onScreen } = useNickClock(running, { fps: cap === 'full' ? 0 : env.lowEnd ? 20 : 24 });

  // --- tam kalite (Skia) kararı ---
  const fullWanted = cap === 'full' && running && onScreen && !!fontKey && nickEffectSupported(def.fill);
  const fullGranted = usePoolSlot(fullPool, id, fullWanted, hero);
  const typeface = useNickTypeface(fullWanted ? fontKey : null);
  const [lines, setLines] = useState<NickLine[] | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const onTextLayout = useCallback((e: TextLayoutEvent) => {
    const next: NickLine[] = e.nativeEvent.lines.map((l: any) => ({
      text: String(l.text ?? ''),
      x: l.x,
      y: l.y,
      width: l.width,
      height: l.height,
      ascender: l.ascender,
      capHeight: l.capHeight,
    }));
    setLines((prev) => (prev && sameLines(prev, next) ? prev : next));
  }, []);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((prev) => (prev && Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5 ? prev : { w: width, h: height }));
  }, []);

  // react-native-web onTextLayout üretmez: tek satırlık nicklerde satırı kutudan
  // sentezle (ascender = NaN → çekirdek font metrikleriyle taban çizgisini bulur).
  const lineHeight = typeof inner.lineHeight === 'number' ? inner.lineHeight : fontSize * 1.37;
  const webLines = useMemo<NickLine[] | null>(() => {
    if (!IS_WEB || !box || box.w <= 0) return null;
    const singleLine = numberOfLines === 1 || box.h < lineHeight * 1.5;
    if (!singleLine) return null;
    return [{ text, x: 0, y: 0, width: box.w, height: box.h, ascender: NaN }];
  }, [box, text, numberOfLines, lineHeight]);
  const drawLines = IS_WEB ? webLines : lines;
  const align: 'left' | 'center' | 'right' =
    inner.textAlign === 'center' ? 'center' : inner.textAlign === 'right' ? 'right' : 'left';

  const mode: NickQuality =
    fullGranted && typeface && drawLines && drawLines.length && box ? 'full' : cap === 'static' ? 'static' : 'lite';

  // --- parçacıklar (yalnızca hero + full) ---
  const wantParticles =
    hero && mode === 'full' && PARTICLES_AVAILABLE && def.particles.kind !== 'none' && onScreen;
  const particlesGranted = usePoolSlot(particlePool, id, wantParticles, false);

  // --- lite / static Reanimated stili ---
  const liteColors = useMemo(() => readableColors(def.palette.colors, def.palette.base), [def]);
  const hidden = useSharedValue(mode === 'full' ? 1 : 0);
  const animated = useSharedValue(mode === 'lite' ? 1 : 0);
  useEffect(() => {
    hidden.value = mode === 'full' ? 1 : 0;
    animated.value = mode === 'lite' ? 1 : 0;
  }, [mode, hidden, animated]);
  const speed = 1000 / Math.max(300, def.motion.periodMs);
  const base = def.palette.base;
  const glowHex = withAlpha(def.palette.glow, 0.75);
  const isGlitch = def.fill === 'glitch';
  const glowRadius = Math.max(2, def.motion.glow * (hero ? 0.9 : 0.6));

  const animStyle = useAnimatedStyle(() => {
    if (hidden.value === 1) {
      // Skia çizerken yerleşim metni tamamen gizlenir. Android 'transparent'
      // gölge rengini varsayılan yarı saydam siyaha düşürebildiği için yalnızca
      // renk değil opaklık ve gölge yarıçapı da sıfırlanır (koyu "hayalet" harfler).
      return { opacity: 0, color: 'transparent', textShadowColor: 'transparent', textShadowRadius: 0, transform: [{ translateX: 0 }] };
    }
    if (animated.value !== 1) {
      return { opacity: 1, color: base, textShadowColor: glowHex, textShadowRadius: glowRadius, transform: [{ translateX: 0 }] };
    }
    const t = time.value * speed;
    const c = cyclicColor(liteColors, t);
    let dx = 0;
    if (isGlitch) {
      const ph = t % 1;
      if (ph < 0.06 || (ph > 0.52 && ph < 0.55)) dx = Math.sin(time.value * 90) * 1.6;
    }
    return { opacity: 1, color: c, textShadowColor: c, textShadowRadius: glowRadius, transform: [{ translateX: dx }] };
  });

  const staticShadow = useMemo(
    () => ({ textShadowOffset: { width: 0, height: 0 }, textShadowRadius: glowRadius }),
    [glowRadius],
  );

  return (
    <Animated.View ref={ref} style={[styles.wrap, outer]} collapsable={false}>
      <Animated.Text
        style={[inner, staticShadow, animStyle]}
        numberOfLines={numberOfLines}
        adjustsFontSizeToFit={adjustsFontSizeToFit}
        allowFontScaling={allowFontScaling}
        onTextLayout={cap === 'full' && !IS_WEB ? onTextLayout : undefined}
        onLayout={cap === 'full' ? onLayout : undefined}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
      >
        {text}
      </Animated.Text>
      {mode === 'full' && typeface && drawLines && box && (
        <NickSkiaText
          def={def}
          typeface={typeface}
          fontSize={drawFontSize}
          letterSpacing={letterSpacing}
          lines={drawLines}
          align={align}
          width={box.w}
          height={box.h}
          time={time}
          glowScale={hero ? 1.25 : 0.85}
        />
      )}
      {particlesGranted && box && (
        <NickParticles
          kind={def.particles.kind}
          colors={def.particles.colors}
          width={box.w}
          height={box.h}
          speed={Math.min(1.6, Math.max(0.7, 2600 / def.motion.periodMs))}
        />
      )}
    </Animated.View>
  );
});

function sameLines(a: NickLine[], b: NickLine[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.text !== y.text || Math.abs(x.x - y.x) > 0.5 || Math.abs(x.y - y.y) > 0.5 || Math.abs(x.width - y.width) > 0.5) {
      return false;
    }
  }
  return true;
}

const styles = StyleSheet.create({
  wrap: {
    // Parıltı/parçacıklar kutu dışına taşabilsin
    overflow: 'visible',
    ...(Platform.OS === 'web' ? { display: 'flex' as const } : null),
  },
});

export default NickRenderer;
