import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  ImageSourcePropType,
  ViewStyle,
} from 'react-native';
import Animated, {
  FadeInDown,
  ZoomIn,
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
import { CharacterAvatar } from './TavrikoAvatars';

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
  keySilver: require('../../assets/images/store/key_silver.png'),
  keyDiamond: require('../../assets/images/store/key_diamond.png'),
  booster24h: require('../../assets/images/store/booster_24h.png'),
  badgeTrivia: require('../../assets/images/store/badge_trivia_master.png'),
  badgeSpeed: require('../../assets/images/store/badge_speed_demon.png'),
  gemsS: require('../../assets/images/store/gems_s.png'),
  gemsM: require('../../assets/images/store/gems_m.png'),
  gemsL: require('../../assets/images/store/gems_l.png'),
  gemsXL: require('../../assets/images/store/gems_xl.png'),
  coinsS: require('../../assets/images/store/coins_s.png'),
  coinsM: require('../../assets/images/store/coins_m.png'),
  coinsL: require('../../assets/images/store/coins_l.png'),
  coinsXL: require('../../assets/images/store/coins_xl.png'),
  booster: require('../../assets/images/store/booster_bolt.png'),
  inventoryEmpty: require('../../assets/images/store/inventory_empty.png'),
  eventsEmpty: require('../../assets/images/store/events_empty.png'),
};

/** Yeni nesil parlak UI ikon görselleri (buton döşemeleri, sekmeler, amblemler) */
export const UI_IMG = {
  season: require('../../assets/images/ui/icon_season.png'),
  prolig: require('../../assets/images/ui/icon_prolig.png'),
  shop: require('../../assets/images/ui/icon_shop.png'),
  events: require('../../assets/images/ui/icon_events.png'),
  inventory: require('../../assets/images/ui/icon_inventory.png'),
  daily: require('../../assets/images/ui/icon_daily.png'),
  weekly: require('../../assets/images/ui/icon_weekly.png'),
  special: require('../../assets/images/ui/icon_special.png'),
  seasonEmblem: require('../../assets/images/ui/season_emblem.png'),
  levelBadge: require('../../assets/images/ui/level_badge.png'),
  titleNadir: require('../../assets/images/ui/title_nadir.png'),
  titleEpik: require('../../assets/images/ui/title_epik.png'),
  titleEfsanevi: require('../../assets/images/ui/title_efsanevi.png'),
  titlesHero: require('../../assets/images/store/titles_hero.jpg'),
};

/** Kategori kimliğine göre 3B oyun ikonu */
export const CATEGORY_IMG: Record<string, ImageSourcePropType> = {
  gaming_videogames: require('../../assets/images/categories/cat_gaming.png'),
  anime_manga: require('../../assets/images/categories/cat_anime.png'),
  cartoons_animation: require('../../assets/images/categories/cat_cartoons.png'),
  cinema_tv: require('../../assets/images/categories/cat_cinema.png'),
  comics_superheroes: require('../../assets/images/categories/cat_comics.png'),
  fantasy_fiction: require('../../assets/images/categories/cat_fantasy.png'),
  literature: require('../../assets/images/categories/cat_literature.png'),
  music: require('../../assets/images/categories/cat_music.png'),
  social_internet: require('../../assets/images/categories/cat_social.png'),
  animals_wildlife: require('../../assets/images/categories/cat_animals.png'),
  mythology_ancient: require('../../assets/images/categories/cat_mythology.png'),
  hobbies_leisure: require('../../assets/images/categories/cat_hobbies.png'),
  history: require('../../assets/images/categories/cat_history.png'),
  geography: require('../../assets/images/categories/cat_geography.png'),
  art_culture: require('../../assets/images/categories/cat_art.png'),
  sports: require('../../assets/images/categories/cat_sports.png'),
  science_tech: require('../../assets/images/categories/cat_science.png'),
  logic_puzzles: require('../../assets/images/categories/cat_logic.png'),
  mathematics: require('../../assets/images/categories/cat_math.png'),
  food_gastronomy: require('../../assets/images/categories/cat_food.png'),
  daily_life: require('../../assets/images/categories/cat_daily.png'),
  turkey_special: require('../../assets/images/categories/cat_turkey.png'),
  space_astronomy: require('../../assets/images/categories/cat_space.png'),
  biology: require('../../assets/images/categories/cat_biology.png'),
  physics_chemistry: require('../../assets/images/categories/cat_physics.png'),
  language_vocab: require('../../assets/images/categories/cat_language.png'),
  nature_ecology: require('../../assets/images/categories/cat_nature.png'),
  general_culture: require('../../assets/images/categories/cat_general.png'),
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
  if (c.startsWith('key') || k.includes('key')) {
    if (k.includes('diamond')) return STORE_IMG.keyDiamond;
    if (k.includes('silver')) return STORE_IMG.keySilver;
    return STORE_IMG.key;
  }
  if (c.startsWith('booster') || k.includes('booster') || k.includes('bolt')) {
    return k.includes('24h') ? STORE_IMG.booster24h : STORE_IMG.booster;
  }
  if (c.startsWith('badge') || k.includes('badge')) {
    return k.includes('speed') ? STORE_IMG.badgeSpeed : STORE_IMG.badgeTrivia;
  }
  if (k.startsWith('gems_')) {
    const n = parseInt(k.slice(5), 10) || 0;
    return n >= 1500 ? STORE_IMG.gemsXL : n >= 600 ? STORE_IMG.gemsL : n >= 300 ? STORE_IMG.gemsM : STORE_IMG.gemsS;
  }
  if (k.startsWith('coins_')) {
    const n = parseInt(k.slice(6), 10) || 0;
    return n >= 30000 ? STORE_IMG.coinsXL : n >= 10000 ? STORE_IMG.coinsL : n >= 3000 ? STORE_IMG.coinsM : STORE_IMG.coinsS;
  }
  return null;
};

/* Çerçeveler: görsel + iç boşluk oranı (avatarın çerçeve içinde kaplayacağı çap) */
export const FRAME_IMG: Record<string, { src: ImageSourcePropType; inner: number }> = {
  frame_neon: { src: require('../../assets/images/store/frame_neon.png'), inner: 0.64 },
  frame_gold: { src: require('../../assets/images/store/frame_gold.png'), inner: 0.57 },
  frame_flame: { src: require('../../assets/images/store/frame_flame.png'), inner: 0.63 },
};

export const frameFor = (id: string) => {
  const k = (id || '').toLowerCase();
  if (FRAME_IMG[k]) return FRAME_IMG[k];
  if (k.includes('flame') || k.includes('fire')) return FRAME_IMG.frame_flame;
  if (k.includes('gold') || k.includes('royal')) return FRAME_IMG.frame_gold;
  if (k.includes('neon')) return FRAME_IMG.frame_neon;
  return null;
};

/* Profil arka planları */
export const BG_IMG: Record<string, ImageSourcePropType> = {
  bg_nebula: require('../../assets/images/store/bg_nebula.jpg'),
  bg_royal_purple: require('../../assets/images/store/bg_royal_purple.jpg'),
};

export const backgroundFor = (id: string): ImageSourcePropType | null => {
  const k = (id || '').toLowerCase();
  if (BG_IMG[k]) return BG_IMG[k];
  if (k.includes('nebula')) return BG_IMG.bg_nebula;
  if (k.includes('royal') || k.includes('purple')) return BG_IMG.bg_royal_purple;
  return null;
};

/* ============================================================
   ANİMASYONLU KOZMETİKLER (Reanimated ile renkli geçişler)
   Süreli (30 gün) kozmetikler için canlı, nefes alan görseller
   ============================================================ */

/** Animasyonlu çerçevelerin renk paletleri (3 renkli geçiş döngüsü) */
export const ANIMATED_FRAME_COLORS: Record<string, string[]> = {
  frame_ice: ['#A5F3FC', '#38BDF8', '#0EA5E9'],
  frame_emerald: ['#6EE7B7', '#34D399', '#059669'],
  frame_violet: ['#C4B5FD', '#A78BFA', '#7C3AED'],
  frame_flame: ['#FFD08A', '#FF6B35', '#E11D48'],
};

/** Animasyonlu arka planların renk katmanları */
export const ANIMATED_BG_LAYERS: Record<string, string[]> = {
  bg_sunset: ['#7C2D12', '#C2410C', '#F59E0B'],
  bg_forest: ['#14532D', '#166534', '#4D7C0F'],
  bg_night_city: ['#0F172A', '#1E293B', '#334155'],
};

/** Animasyonlu isim efekti renk döngüleri */
export const ANIMATED_NAME_COLORS: Record<string, string[]> = {
  name_gradient_ice: ['#A5F3FC', '#38BDF8', '#E0F2FE', '#38BDF8'],
  name_gradient_rainbow: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF'],
  name_gradient_fire: ['#FFE27A', '#FF9B2F', '#E11D48', '#FF9B2F'],
};

/** Tek bir nefes alan halka katmanı: renk geçişli pulse animasyonu */
const PulseRing: React.FC<{ color: string; period: number; size: number; ringWidth: number }> = ({
  color,
  period,
  size,
  ringWidth,
}) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [period]);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      position: 'absolute',
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: ringWidth,
      borderColor: color,
      opacity: 0.15 + 0.75 * Math.sin(p * Math.PI),
      transform: [{ scale: 0.92 + 0.1 * Math.sin(p * Math.PI) }],
    };
  });
  return <Animated.View style={style} pointerEvents="none" />;
};

/** Animasyonlu çerçeve: avatarı saran 3 katmanlı renk geçişli pulse halkaları */
export const AnimatedFrame: React.FC<{
  frameId: string;
  seed?: string;
  size: number;
  glow?: boolean;
}> = ({ frameId, seed, size, glow = true }) => {
  const colors = ANIMATED_FRAME_COLORS[(frameId || '').toLowerCase()] || ANIMATED_FRAME_COLORS.frame_ice;
  const inner = Math.round(size * 0.62);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <PulseRing color={colors[0]} period={1500} size={size} ringWidth={Math.max(2, size * 0.035)} />
      <PulseRing color={colors[1]} period={2100} size={Math.round(size * 0.94)} ringWidth={Math.max(2, size * 0.045)} />
      <PulseRing color={colors[2]} period={2600} size={Math.round(size * 0.86)} ringWidth={Math.max(2, size * 0.05)} />
      {glow && (
        <View
          style={{
            position: 'absolute',
            width: size * 0.75,
            height: size * 0.75,
            borderRadius: (size * 0.75) / 2,
            backgroundColor: colors[1],
            opacity: 0.18,
          }}
        />
      )}
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          overflow: 'hidden',
          borderWidth: 1.5,
          borderColor: colors[0],
          backgroundColor: '#170733',
        }}
      >
        <CharacterAvatar seed={seed} size={inner} />
      </View>
    </View>
  );
};

/** Animasyonlu arka plan önizlemesi: renk katmanları yumuşak geçişle nefes alır */
export const AnimatedBackgroundThumb: React.FC<{
  bgId: string;
  seed?: string;
  name?: string;
  width: number;
}> = ({ bgId, seed, name, width }) => {
  const layers = ANIMATED_BG_LAYERS[(bgId || '').toLowerCase()] || ANIMATED_BG_LAYERS.bg_sunset;
  const h = Math.round(width * 1.62);
  const av = Math.round(width * 0.34);
  return (
    <View style={[kit.phone, { width, height: h, borderRadius: width * 0.16, overflow: 'hidden' }]}>
      {layers.map((c, i) => (
        <PulseBgLayer key={i} color={c} period={3200 + i * 1400} />
      ))}
      <View style={kit.phoneNotch as ViewStyle} />
      <View style={{ alignItems: 'center', marginTop: h * 0.14 }}>
        <View
          style={{
            width: av,
            height: av,
            borderRadius: av / 2,
            overflow: 'hidden',
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.7)',
          }}
        >
          <CharacterAvatar seed={seed} size={av} />
        </View>
        <Text style={[kit.phoneName, { fontSize: Math.max(8, width * 0.09) }]} numberOfLines={1}>
          {name || 'Oyuncu'}
        </Text>
      </View>
      <View style={[kit.phoneCard, { top: h * 0.56, height: h * 0.13 } as ViewStyle]} />
      <View style={[kit.phoneCard, { top: h * 0.72, height: h * 0.13 } as ViewStyle]} />
    </View>
  );
};

/** Arka plan katmanı: opaklık nefes alarak renkler arası yumuşak geçiş sağlar */
const PulseBgLayer: React.FC<{ color: string; period: number }> = ({ color, period }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [period]);
  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color,
    opacity: 0.25 + 0.5 * Math.sin(progress.value * Math.PI),
  }));
  return <Animated.View style={style} pointerEvents="none" />;
};

/** Animasyonlu isim efekti: renk döngüsü içinde süzülen yazı */
export const AnimatedNameText: React.FC<{
  effectId: string;
  children?: string;
  style?: any;
  numberOfLines?: number;
}> = ({ effectId, children, style, numberOfLines }) => {
  const colors = ANIMATED_NAME_COLORS[(effectId || '').toLowerCase()] || ANIMATED_NAME_COLORS.name_gradient_ice;
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3600, easing: Easing.linear }), -1, false);
  }, []);
  const animStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const idx = Math.min(colors.length - 1, Math.floor(t * colors.length));
    const nextIdx = (idx + 1) % colors.length;
    const local = t * colors.length - idx;
    // Basit lineer renk karışımı (hex)
    return {
      color: mixHex(colors[idx], colors[nextIdx], local),
      textShadowColor: mixHex(colors[idx], colors[nextIdx], local),
      textShadowRadius: 8,
      textShadowOffset: { width: 0, height: 0 },
    };
  });
  return (
    <Animated.Text style={[style, animStyle]} numberOfLines={numberOfLines}>
      {children}
    </Animated.Text>
  );
};

/** İki hex rengi karıştırır (Reanimated worklet güvenli) */
const mixHex = (a: string, b: string, t: number): string => {
  'worklet';
  const pa = parseInt(a.replace('#', ''), 16);
  const pb = parseInt(b.replace('#', ''), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  const hex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(bl)}`;
};

/* Avatar + çerçeve: kullanıcının fotoğrafı/avatarı çerçevenin içinde görünür */
export const FramedAvatar: React.FC<{ frameId: string; seed?: string; size: number }> = ({
  frameId,
  seed,
  size,
}) => {
  const fr = frameFor(frameId);
  const inner = Math.round(size * (fr?.inner ?? 0.78));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: 'hidden' }}>
        <CharacterAvatar seed={seed} size={inner} />
      </View>
      {fr && (
        <Image
          source={fr.src}
          style={{ position: 'absolute', width: size, height: size }}
          resizeMode="contain"
        />
      )}
    </View>
  );
};

/* Küçük telefon önizlemesi: arka planın uygulamada nasıl duracağı */
export const BackgroundThumb: React.FC<{
  bgId: string;
  seed?: string;
  name?: string;
  width: number;
}> = ({ bgId, seed, name, width }) => {
  const src = backgroundFor(bgId);
  const h = Math.round(width * 1.62);
  const av = Math.round(width * 0.34);
  return (
    <View style={[kit.phone, { width, height: h, borderRadius: width * 0.16 }]}>
      {src && <Image source={src} style={kit.heroImg} resizeMode="cover" />}
      <View style={[kit.phoneNotch, { width: width * 0.3 }]} />
      <View style={{ alignItems: 'center', marginTop: h * 0.14 }}>
        <View style={{ width: av, height: av, borderRadius: av / 2, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)' }}>
          <CharacterAvatar seed={seed} size={av} />
        </View>
        <Text style={[kit.phoneName, { fontSize: Math.max(8, width * 0.09) }]} numberOfLines={1}>
          {name || 'Oyuncu'}
        </Text>
      </View>
      <View style={[kit.phoneCard, { top: h * 0.56, height: h * 0.13 }]} />
      <View style={[kit.phoneCard, { top: h * 0.72, height: h * 0.13 }]} />
    </View>
  );
};

/* Büyütülmüş önizleme (çerçeve veya arka plan) */
export const CosmeticPreviewModal: React.FC<{
  visible: boolean;
  kind: 'frame' | 'background' | null;
  itemId: string;
  title: string;
  seed?: string;
  name?: string;
  level?: number;
  stats?: { label: string; value: string }[];
  onClose: () => void;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ visible, kind, itemId, title, seed, name, level, stats, onClose, actionLabel, onAction }) => {
  const bg = kind === 'background' ? backgroundFor(itemId) : null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={kit.pvBackdrop}>
        <Animated.View entering={ZoomIn.duration(260)} style={kit.pvPhone}>
          {bg ? (
            <Image source={bg} style={kit.heroImg} resizeMode="cover" />
          ) : (
            <GradientFill colors={['#2A0F63', '#170733']} />
          )}
          <View style={kit.pvTopBar}>
            <TouchableOpacity onPress={onClose} style={kit.pvClose} activeOpacity={0.8}>
              <Text style={kit.pvCloseText}>Kapat</Text>
            </TouchableOpacity>
            <Text style={kit.pvLabel}>Önizleme</Text>
          </View>
          <View style={{ alignItems: 'center', marginTop: 36 }}>
            {kind === 'frame' ? (
              <FramedAvatar frameId={itemId} seed={seed} size={200} />
            ) : (
              <View style={kit.pvAvatar}>
                <CharacterAvatar seed={seed} size={110} />
              </View>
            )}
            <Text style={kit.pvName} numberOfLines={1}>
              {name || 'Oyuncu'}
            </Text>
            {typeof level === 'number' && <Text style={kit.pvLevel}>Seviye {level}</Text>}
          </View>
          {!!stats?.length && (
            <View style={kit.pvStats}>
              {stats.map((st) => (
                <View key={st.label} style={kit.pvStat}>
                  <Text style={kit.pvStatValue}>{st.value}</Text>
                  <Text style={kit.pvStatLabel}>{st.label}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={kit.pvFooter}>
            <Text style={kit.pvTitle} numberOfLines={1}>
              {title}
            </Text>
            {!!actionLabel && !!onAction && (
              <TouchableOpacity style={kit.pvAction} onPress={onAction} activeOpacity={0.85}>
                <Text style={kit.pvActionText}>{actionLabel}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
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
  tabs: { id: T; label: string; icon?: ImageSourcePropType }[];
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
          {t.icon ? (
            <Image
              source={t.icon}
              style={{ width: 18, height: 18, marginRight: 5 }}
              resizeMode="contain"
            />
          ) : null}
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

/* Hafifçe süzülen herhangi bir içerik (ikon, görsel, buton vb.) */
export const FloatingElement: React.FC<{
  children: React.ReactNode;
  amplitude?: number;
  duration?: number;
  style?: ViewStyle;
}> = ({ children, amplitude = 4, duration = 1500, style }) => {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(
      withSequence(
        withTiming(-amplitude, { duration, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, []);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={[st, style]}>{children}</Animated.View>
  );
};

/* Nabız gibi atan içerik (dikkat çekici buton/ikon) */
export const PulseElement: React.FC<{
  children: React.ReactNode;
  min?: number;
  max?: number;
  duration?: number;
  style?: ViewStyle;
}> = ({ children, min = 1, max = 1.06, duration = 750, style }) => {
  const s = useSharedValue(min);
  useEffect(() => {
    s.value = withRepeat(
      withSequence(
        withTiming(max, { duration, easing: Easing.inOut(Easing.quad) }),
        withTiming(min, { duration, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, []);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[st, style]}>{children}</Animated.View>
  );
};

/* İçinden ışık şeridi geçen parlama efekti (ilerleme çubukları, vurgulu kartlar) */
export const ShimmerView: React.FC<{
  color?: string;
  duration?: number;
  style?: ViewStyle;
}> = ({ color = '#FFFFFF', duration = 1600, style }) => {
  const x = useSharedValue(-90);
  useEffect(() => {
    x.value = withRepeat(
      withSequence(
        withTiming(300, { duration, easing: Easing.inOut(Easing.quad) }),
        withTiming(-90, { duration: 0 })
      ),
      -1,
      false
    );
  }, []);
  const st = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { skewX: '-18deg' }],
  }));
  return (
    <View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, overflow: 'hidden' }, style]} pointerEvents="none">
      <Animated.View
        style={[
          st,
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 70,
            backgroundColor: color,
            opacity: 0.32,
          },
        ]}
      />
    </View>
  );
};

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
  phone: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: '#14062F',
  },
  phoneNotch: {
    position: 'absolute',
    top: 4,
    alignSelf: 'center',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  phoneName: {
    color: '#FFFFFF',
    fontFamily: THEME.fonts.extraBold,
    marginTop: 3,
    maxWidth: '90%',
  },
  phoneCard: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    borderRadius: 5,
    backgroundColor: 'rgba(10, 4, 30, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  pvBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 2, 16, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  pvPhone: {
    width: '100%',
    maxWidth: 360,
    aspectRatio: 9 / 17,
    maxHeight: '96%',
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: '#14062F',
  },
  pvTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  pvClose: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 4, 30, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  pvCloseText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  pvLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  pvAvatar: {
    width: 124,
    height: 124,
    borderRadius: 62,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    marginVertical: 38,
  },
  pvName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: THEME.fonts.black,
    marginTop: 6,
  },
  pvLevel: {
    color: 'rgba(235, 228, 255, 0.85)',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    marginTop: 2,
  },
  pvStats: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 22,
  },
  pvStat: {
    flex: 1,
    height: 62,
    borderRadius: 14,
    backgroundColor: 'rgba(10, 4, 30, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  pvStatValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: THEME.fonts.black,
  },
  pvStatLabel: {
    color: 'rgba(235, 228, 255, 0.8)',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
  },
  pvFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: 'rgba(10, 4, 30, 0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pvTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.extraBold,
  },
  pvAction: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FFC837',
    justifyContent: 'center',
  },
  pvActionText: {
    color: '#1A0B3B',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
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
    flexDirection: 'row',
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
