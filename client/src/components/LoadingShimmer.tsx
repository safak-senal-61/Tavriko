import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from './DiscoveryArtwork';
import { GradientFill } from './TavrikoGradient';

const SKY = ['rgba(206,174,255,0)', 'rgba(206,174,255,0.42)', 'rgba(206,174,255,0)'];
const INK = ['rgba(45,25,63,0)', 'rgba(45,25,63,0.36)', 'rgba(45,25,63,0)'];

function useSweep() {
  const still = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    if (still) return;
    const loop = Animated.loop(Animated.timing(progress, {
      toValue: 1,
      duration: 1400,
      easing: Easing.linear,
      isInteraction: false,
      useNativeDriver: Platform.OS !== 'web',
    }));
    loop.start();
    return () => loop.stop();
  }, [progress, still]);
  return still ? null : progress;
}

function Bone({ progress, style, ink = false }: {
  progress: Animated.Value | null; style: StyleProp<ViewStyle>; ink?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const band = Math.max(18, width * 0.56);
  return (
    <View style={[styles.bone, ink && styles.ink, style]}
      onLayout={progress ? event => setWidth(event.nativeEvent.layout.width) : undefined}>
      {!!width && progress && (
        <Animated.View testID="shimmer-sweep" style={[styles.band, {
          width: band,
          transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-band, width] }) }],
        }]}>
          <GradientFill colors={ink ? INK : SKY} direction="horizontal" />
        </Animated.View>
      )}
    </View>
  );
}

/** Linear shimmer for actions, without a circular spinner or layout jump. */
export function LoadingShimmer({ label, wide = false, ink = false, style }: {
  label?: string; wide?: boolean; ink?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const progress = useSweep();
  return (
    <View accessible={!!label} accessibilityRole={label ? 'progressbar' : undefined}
      accessibilityLabel={label} accessibilityState={label ? { busy: true } : undefined}
      pointerEvents="none" style={[wide ? styles.wide : styles.inline, style]}>
      <Bone progress={progress} ink={ink} style={wide ? styles.wideBar : styles.inlineBar} />
    </View>
  );
}

/** Cold-load skeleton; callers keep rendering a cached snapshot during a refresh. */
export function PageShimmer({ label, shape = 'rows', rows = 3, style }: {
  label: string; shape?: 'rows' | 'cards' | 'profile' | 'lines'; rows?: number; style?: StyleProp<ViewStyle>;
}) {
  const progress = useSweep();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label}
      accessibilityState={{ busy: true }} pointerEvents="none" style={[styles.stack, style]}>
      {shape === 'profile' ? (
        <View style={styles.profile}>
          <Bone progress={progress} style={styles.profileAvatar} />
          <Bone progress={progress} style={styles.profileTitle} />
          <Bone progress={progress} style={styles.profileSubtitle} />
          <View style={styles.metrics}>
            {[0, 1, 2].map(index => <Bone key={index} progress={progress} style={styles.metric} />)}
          </View>
        </View>
      ) : Array.from({ length: rows }, (_, index) => (
        <View key={index} style={[shape !== 'lines' && styles.card,
          shape === 'cards' && styles.tallCard, shape === 'lines' && styles.lines]}>
          {shape !== 'lines' && <Bone progress={progress} style={shape === 'cards' ? styles.tile : styles.avatar} />}
          <View style={styles.copy}>
            <Bone progress={progress} style={[styles.heading, index % 2 === 1 && styles.shortHeading]} />
            <Bone progress={progress} style={styles.subtitle} />
          </View>
          {shape !== 'lines' && <Bone progress={progress} style={styles.pill} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bone: { borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(193,156,248,0.16)' },
  ink: { backgroundColor: 'rgba(42,23,59,0.24)' },
  band: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  inline: { width: 22, height: 20, alignItems: 'center', justifyContent: 'center' },
  inlineBar: { width: 18, height: 6 },
  wide: { alignSelf: 'stretch', minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  wideBar: { width: '68%', maxWidth: 230, height: 10 },
  stack: { alignSelf: 'stretch', gap: 10, minWidth: 0 },
  card: {
    minHeight: 74, padding: 14, gap: 12, flexDirection: 'row', alignItems: 'center', borderRadius: 20,
    backgroundColor: 'rgba(35,20,61,0.65)', borderWidth: 1, borderColor: 'rgba(193,156,248,0.14)',
  },
  tallCard: { minHeight: 108 },
  lines: { paddingVertical: 8 },
  copy: { flex: 1, minWidth: 0, gap: 9 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  tile: { width: 54, height: 54, borderRadius: 14 },
  heading: { width: '72%', height: 12 },
  shortHeading: { width: '58%' },
  subtitle: { width: '47%', height: 8 },
  pill: { width: 42, height: 22, borderRadius: 11 },
  profile: { alignItems: 'center', paddingVertical: 16, gap: 12 },
  profileAvatar: { width: 78, height: 78, borderRadius: 39 },
  profileTitle: { width: '46%', height: 16 },
  profileSubtitle: { width: '30%', height: 10 },
  metrics: { alignSelf: 'stretch', flexDirection: 'row', gap: 10, paddingHorizontal: 14, marginTop: 8 },
  metric: { flex: 1, height: 48, borderRadius: 12 },
});
