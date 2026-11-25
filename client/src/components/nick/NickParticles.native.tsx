/**
 * Animated Nick — Lottie parçacık katmanı (yıldız, kıvılcım, elektrik, kar…).
 * Animasyonlar scripts/generate-nick-lottie.mjs ile üretilen beyaz şekillerdir;
 * paket renkleri colorFilters ile c0/c1/c2 katmanlarına uygulanır.
 * Bu bileşen yalnızca nick ekranda görünürken ve parçacık bütçesi izin
 * verdiğinde takılır; ekran dışında tamamen sökülür (bellek/pil).
 */
import React, { memo, useMemo } from 'react';
import { View } from 'react-native';
import LottieView from 'lottie-react-native';
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

export const NickParticles = memo(function NickParticles({ kind, colors, width, height, speed = 1, intensity = 1 }: NickParticlesProps) {
  const source = SOURCES[kind];
  const filters = useMemo(() => {
    const list = colors.length ? colors : ['#FFFFFF'];
    return ['c0', 'c1', 'c2'].map((keypath, i) => ({ keypath, color: list[i % list.length] }));
  }, [colors]);
  if (!source || width <= 0 || height <= 0) return null;
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
    <LottieView
      source={source}
      autoPlay
      loop
      speed={speed}
      colorFilters={filters}
      resizeMode="cover"
      renderMode="HARDWARE"
      cacheComposition
      style={{ width: '100%', height: '100%' }}
    />
    </View>
  );
});
