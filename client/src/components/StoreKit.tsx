import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ImageSourcePropType,
  ViewStyle,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { THEME } from '../theme/tokens';
import { GradientFill } from './TavrikoGradient';

/* Mağaza / Envanter / Etkinlik / Sezon / Pro Lig ortak görsel kiti */

export const STORE_IMG = {
  seasonHero: require('../../assets/images/store/season_hero.jpg'),
  eventsHero: require('../../assets/images/store/events_hero.jpg'),
  trophy: require('../../assets/images/store/proleague_trophy.png'),
  chestWood: require('../../assets/images/store/chest_wood.png'),
  chestSilver: require('../../assets/images/store/chest_silver.png'),
  chestGold: require('../../assets/images/store/chest_gold.png'),
  chestLegendary: require('../../assets/images/store/chest_legendary.png'),
  key: require('../../assets/images/store/key_gold.png'),
  booster: require('../../assets/images/store/booster_bolt.png'),
  inventoryEmpty: require('../../assets/images/store/inventory_empty.png'),
  eventsEmpty: require('../../assets/images/store/events_empty.png'),
};

/** Ürün/eşya kimliğine göre 3B görsel (yoksa null) */
export const storeImageFor = (id: string, category?: string): ImageSourcePropType | null => {
  const k = (id || '').toLowerCase();
  const c = (category || '').toLowerCase();
  if (c.startsWith('chest') || k.includes('chest')) {
    if (k.includes('legendary') || k.includes('mythic')) return STORE_IMG.chestLegendary;
    if (k.includes('gold')) return STORE_IMG.chestGold;
    if (k.includes('silver')) return STORE_IMG.chestSilver;
    return STORE_IMG.chestWood;
  }
  if (c.startsWith('key') || k.includes('key')) return STORE_IMG.key;
  if (c.startsWith('booster') || k.includes('booster') || k.includes('bolt')) return STORE_IMG.booster;
  return null;
};

export const KIT = {
  card: 'rgba(20, 8, 52, 0.7)',
  border: 'rgba(255, 255, 255, 0.08)',
  muted: 'rgba(217, 205, 245, 0.72)',
  gold: '#FFC837',
  violet: '#6B3CFF',
  mint: '#5ADBB5',
};

/* Sayfa başlığı: sola hizalı, küçük alt başlık */
export const KitHeader: React.FC<{
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}> = ({ title, subtitle, right }) => (
  <Animated.View entering={FadeInDown.duration(380)} style={kit.headerRow}>
    <View style={{ flex: 1 }}>
      <Text style={kit.title} numberOfLines={1}>
        {title}
      </Text>
      {!!subtitle && (
        <Text style={kit.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </View>
    {right}
  </Animated.View>
);

/* Görselli üst bant */
export const KitHero: React.FC<{
  source?: ImageSourcePropType;
  /** Sağda süzülen 3B obje (arka plan görseli yerine/ek olarak) */
  art?: ImageSourcePropType;
  artSize?: number;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  height?: number;
  children?: React.ReactNode;
  delay?: number;
}> = ({ source, art, artSize = 132, eyebrow, title, subtitle, height = 168, children, delay = 60 }) => (
  <Animated.View entering={FadeInDown.delay(delay).duration(420)} style={[kit.hero, { minHeight: height }]}>
    {source ? (
      <Image source={source} style={kit.heroImg} resizeMode="cover" />
    ) : (
      <GradientFill
        direction="diagonal"
        colors={['#2A0F63', '#4A1D9A', '#7A2E9E']}
        stops={[0, 0.6, 1]}
      />
    )}
    {art && (
      <View style={kit.heroArtWrap} pointerEvents="none">
        <View style={[kit.heroArtGlow, { width: artSize, height: artSize, borderRadius: artSize / 2 }]} />
        <FloatingImage source={art} size={artSize} />
      </View>
    )}
    <GradientFill
      direction="horizontal"
      colors={['rgba(14,5,38,0.96)', 'rgba(14,5,38,0.72)', 'rgba(14,5,38,0)']}
      stops={[0, 0.5, 0.92]}
    />
    <GradientFill
      colors={['rgba(14,5,38,0)', 'rgba(14,5,38,0.75)']}
      stops={[0.45, 1]}
    />
    <View style={kit.heroBody}>
      {!!eyebrow && <Text style={kit.eyebrow}>{eyebrow}</Text>}
      <Text style={kit.heroTitle} numberOfLines={2}>
        {title}
      </Text>
      {!!subtitle && (
        <Text style={kit.heroSub} numberOfLines={2}>
          {subtitle}
        </Text>
      )}
      {children}
    </View>
  </Animated.View>
);

/* Kayan başparmaklı segment kontrol (2-4 sekme) */
export const KitSegment = <T extends string>({
  tabs,
  active,
  onChange,
  style,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  style?: ViewStyle;
}) => {
  const [w, setW] = useState(0);
  const idx = Math.max(0, tabs.findIndex((t) => t.id === active));
  const seg = (w - 8) / tabs.length;
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withSpring(idx * seg, { damping: 18, stiffness: 180 });
  }, [idx, seg]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={[kit.segment, style]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && <Animated.View style={[kit.segThumb, { width: seg }, thumb]} />}
      {tabs.map((t) => (
        <TouchableOpacity
          key={t.id}
          style={kit.segBtn}
          activeOpacity={0.85}
          onPress={() => onChange(t.id)}
        >
          <Text
            style={[kit.segText, t.id === active && kit.segTextActive]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {t.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

/* Çok sekmeli yatay çipler (emoji yok) */
export const KitChips = <T extends string>({
  tabs,
  active,
  onChange,
  scrollRef,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T, idx: number) => void;
  scrollRef?: React.RefObject<any>;
}) => (
  <ScrollView
    ref={scrollRef}
    horizontal
    showsHorizontalScrollIndicator={false}
    style={kit.chipsWrap}
    contentContainerStyle={kit.chips}
  >
    {tabs.map((t, i) => {
      const on = t.id === active;
      return (
        <TouchableOpacity
          key={t.id}
          activeOpacity={0.85}
          onPress={() => onChange(t.id, i)}
          style={[kit.chip, on && kit.chipOn]}
        >
          <Text style={[kit.chipText, on && kit.chipTextOn]}>{t.label}</Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

/* Hafifçe süzülen görsel */
export const FloatingImage: React.FC<{
  source: ImageSourcePropType;
  size: number;
  amplitude?: number;
  style?: ViewStyle;
}> = ({ source, size, amplitude = 5, style }) => {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(
      withSequence(
        withTiming(-amplitude, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, []);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={[st, style]}>
      <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
    </Animated.View>
  );
};

/* Boş durum kartı */
export const KitEmpty: React.FC<{
  source: ImageSourcePropType;
  title: string;
  desc?: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ source, title, desc, actionLabel, onAction }) => (
  <Animated.View entering={FadeInDown.delay(120).duration(420)} style={kit.empty}>
    <FloatingImage source={source} size={128} />
    <Text style={kit.emptyTitle}>{title}</Text>
    {!!desc && <Text style={kit.emptyDesc}>{desc}</Text>}
    {!!actionLabel && !!onAction && (
      <TouchableOpacity style={kit.emptyBtn} activeOpacity={0.85} onPress={onAction}>
        <Text style={kit.emptyBtnText}>{actionLabel}</Text>
      </TouchableOpacity>
    )}
  </Animated.View>
);

/* Bölüm başlığı */
export const KitSection: React.FC<{ title: string; meta?: string }> = ({ title, meta }) => (
  <View style={kit.sectionRow}>
    <Text style={kit.sectionTitle}>{title}</Text>
    {!!meta && <Text style={kit.sectionMeta}>{meta}</Text>}
  </View>
);

export const kit = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 14,
  },
  title: {
    fontFamily: THEME.fonts.black,
    fontSize: 30,
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: KIT.muted,
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    marginTop: 2,
  },
  hero: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: KIT.border,
    backgroundColor: '#14062F',
    marginBottom: 16,
  },
  heroImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  heroArtWrap: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroArtGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 200, 55, 0.18)',
  },
  heroBody: {
    padding: 16,
    paddingRight: '34%',
    flex: 1,
    justifyContent: 'flex-end',
  },
  eyebrow: {
    color: KIT.gold,
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 26,
    fontFamily: THEME.fonts.black,
    letterSpacing: -0.3,
  },
  heroSub: {
    color: 'rgba(235, 228, 255, 0.82)',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: THEME.fonts.medium,
    marginTop: 4,
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(10, 4, 30, 0.55)',
    borderWidth: 1,
    borderColor: KIT.border,
    marginBottom: 16,
  },
  segThumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 10,
    backgroundColor: KIT.violet,
  },
  segBtn: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  segText: {
    color: 'rgba(217, 205, 245, 0.75)',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  segTextActive: {
    color: '#FFFFFF',
  },
  chipsWrap: {
    marginHorizontal: -16,
    marginBottom: 12,
    flexGrow: 0,
  },
  chips: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 4, 30, 0.55)',
    borderWidth: 1,
    borderColor: KIT.border,
  },
  chipOn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  chipText: {
    color: 'rgba(217, 205, 245, 0.85)',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
  },
  chipTextOn: {
    color: '#1A0B3B',
    fontFamily: THEME.fonts.extraBold,
  },
  empty: {
    backgroundColor: KIT.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: KIT.border,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 4,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: THEME.fonts.black,
    marginTop: 10,
  },
  emptyDesc: {
    color: KIT.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: THEME.fonts.medium,
    textAlign: 'center',
    marginTop: 6,
  },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: KIT.gold,
    paddingHorizontal: 22,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
  },
  emptyBtnText: {
    color: '#1A0B3B',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: THEME.fonts.extraBold,
  },
  sectionMeta: {
    color: KIT.muted,
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
});
