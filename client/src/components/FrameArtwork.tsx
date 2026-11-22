import React, { useEffect, useState } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from './DiscoveryArtwork';

export type FrameArt = { src: ImageSourcePropType; inner: number; motion?: ImageSourcePropType };

// Local WebP assets work offline and need no separate CDN deploy or animated image codec.
// Posters are 512²; motion sheets are 6×4 tiles of 384², played at 80 ms per tile.
export const FRAME_ART: Record<string, FrameArt> = {
  frame_gold: {
    src: require('../../bundled/frames/royal_gold.webp'),
    motion: require('../../bundled/frames/royal_gold_motion.webp'),
    inner: 0.43,
  },
  frame_flame: {
    src: require('../../bundled/frames/flame.webp'),
    motion: require('../../bundled/frames/flame_motion.webp'),
    inner: 0.49,
  },
  frame_dragon_phoenix: {
    src: require('../../bundled/frames/dragon_phoenix.webp'),
    motion: require('../../bundled/frames/dragon_phoenix_motion.webp'),
    inner: 0.52,
  },
  frame_neon: {
    src: require('../../bundled/frames/cyber_neon.webp'),
    motion: require('../../bundled/frames/cyber_neon_motion.webp'),
    inner: 0.50,
  },
  frame_steampunk: {
    src: require('../../bundled/frames/steampunk.webp'),
    motion: require('../../bundled/frames/steampunk_motion.webp'),
    inner: 0.43,
  },
  frame_ice: {
    src: require('../../bundled/frames/crystal.webp'),
    motion: require('../../bundled/frames/crystal_motion.webp'),
    inner: 0.65,
  },
};

const COLS = 6;
const ROWS = 4;
const COUNT = COLS * ROWS;
const FRAME_MS = 80;

function FrameMotion({ source, size, onLoad }: { source: ImageSourcePropType; size: number; onLoad: () => void }) {
  const tick = useSharedValue(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready) return;
    tick.value = withRepeat(withTiming(COUNT, { duration: COUNT * FRAME_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(tick);
  }, [ready, tick]);
  const position = useAnimatedStyle(() => {
    const index = Math.min(COUNT - 1, Math.floor(tick.value));
    return { transform: [{ translateX: -(index % COLS) * size }, { translateY: -Math.floor(index / COLS) * size }] };
  }, [size]);

  return (
    <View style={styles.window} pointerEvents="none" accessible={false}>
      <Animated.View testID="frame-motion" style={[styles.sheet, { width: size * COLS, height: size * ROWS }, position]}>
        <Image source={source} style={styles.image} resizeMode="stretch" resizeMethod="scale" fadeDuration={0}
          onLoad={() => { setReady(true); onLoad(); }} />
      </Animated.View>
    </View>
  );
}

function AnimatedArtwork({ art, size }: { art: FrameArt; size: number }) {
  const reducedMotion = useReducedMotion();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (reducedMotion) setReady(false);
  }, [reducedMotion]);

  return (
    <View style={styles.window} pointerEvents="none" accessible={false}>
      {(!ready || reducedMotion) && (
        <Image source={art.src} style={styles.image} resizeMode="contain" fadeDuration={0} testID="frame-poster" />
      )}
      {!reducedMotion && art.motion && <FrameMotion source={art.motion} size={size} onLoad={() => setReady(true)} />}
    </View>
  );
}

export function FrameArtwork({ art, size, animate }: { art: FrameArt; size: number; animate?: boolean }) {
  if (animate && art.motion) return <AnimatedArtwork key={String(art.src)} art={art} size={size} />;
  return <Image source={art.src} style={styles.image} resizeMode="contain" fadeDuration={0} accessible={false} testID="frame-poster" />;
}

const styles = StyleSheet.create({
  window: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  image: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  sheet: { position: 'absolute', top: 0, left: 0 },
});
