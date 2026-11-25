/**
 * Animated Nick — Lottie parçacık katmanı (web).
 * Mobildeki ile aynı Lottie animasyonları lottie-web (SVG) ile oynatılır.
 * lottie-react-native'in colorFilters özelliği web'de olmadığından paket
 * renkleri c0/c1/c2 katmanlarının dolgu/çizgi renklerine doğrudan yazılır.
 * lottie-web ilk parçacık katmanı göründüğünde yüklenir; bileşen ekrandan
 * çıkınca animasyon yok edilir (bellek/pil).
 */
import React, { memo, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import type { NickParticlesProps } from './nickParticleTypes';
export type { NickParticlesProps };

export const PARTICLES_AVAILABLE = true;

const SOURCES: Record<string, any> = {
  sparkle: require('../../../assets/lottie/nick/sparkle.json'),
  embers: require('../../../assets/lottie/nick/embers.json'),
  electric: require('../../../assets/lottie/nick/electric.json'),
  stardust: require('../../../assets/lottie/nick/stardust.json'),
  snow: require('../../../assets/lottie/nick/snow.json'),
};

type LottiePlayer = typeof import('lottie-web').default;
let playerPromise: Promise<LottiePlayer | null> | null = null;
function loadPlayer(): Promise<LottiePlayer | null> {
  if (!playerPromise) {
    playerPromise = import('lottie-web/build/player/lottie_light')
      .then((m: any) => (m.default ?? m) as LottiePlayer)
      .catch(() => null);
  }
  return playerPromise;
}

function hexToRgb01(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [1, 1, 1];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function recolor(node: any, rgb: [number, number, number]) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((n) => recolor(n, rgb));
    return;
  }
  if ((node.ty === 'fl' || node.ty === 'st') && node.c && node.c.a === 0 && Array.isArray(node.c.k)) {
    node.c = { ...node.c, k: [rgb[0], rgb[1], rgb[2], node.c.k[3] ?? 1] };
  }
  if (node.shapes) recolor(node.shapes, rgb);
  if (node.it) recolor(node.it, rgb);
}

const tinted = new Map<string, any>();
function tintedAnimation(kind: string, colors: string[]): any {
  const list = colors.length ? colors : ['#FFFFFF'];
  const key = `${kind}|${list.join(',')}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  const base = SOURCES[kind];
  if (!base) return null;
  const data = JSON.parse(JSON.stringify(base));
  for (const layer of data.layers ?? []) {
    const m = /^c(\d)$/.exec(String(layer.nm ?? ''));
    if (!m) continue;
    recolor(layer, hexToRgb01(list[Number(m[1]) % list.length]));
  }
  if (tinted.size > 40) tinted.clear();
  tinted.set(key, data);
  return data;
}

export const NickParticles = memo(function NickParticles({ kind, colors, width, height, speed = 1, intensity = 1 }: NickParticlesProps) {
  const hostRef = useRef<any>(null);
  const colorKey = colors.join(',');
  const animationData = useMemo(() => tintedAnimation(kind, colors), [kind, colorKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!animationData) return;
    let anim: any = null;
    let alive = true;
    loadPlayer().then((lottie) => {
      const container = hostRef.current as HTMLElement | null;
      if (!alive || !lottie || !container) return;
      anim = lottie.loadAnimation({
        container,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData,
        rendererSettings: { preserveAspectRatio: 'xMidYMid slice', progressiveLoad: true },
      });
      anim.setSpeed(speed);
    });
    return () => {
      alive = false;
      anim?.destroy();
    };
  }, [animationData, speed]);

  if (!animationData || width <= 0 || height <= 0) return null;
  const padX = Math.min(24, width * 0.08);
  const padY = Math.max(6, height * 0.45);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: -padX,
        top: -padY,
        width: width + padX * 2,
        height: height + padY * 2,
        opacity: Math.min(1, 0.85 * intensity),
      }}
    >
      <View ref={hostRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
});
