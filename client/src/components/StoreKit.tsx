import { cdnImage } from '../utils/cdn';
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
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Path, Circle } from 'react-native-svg';
import { THEME } from '../theme/tokens';
import { GradientFill } from './TavrikoGradient';
import { CharacterAvatar } from './TavrikoAvatars';

/* Mağaza / Envanter / Etkinlik / Sezon / Pro Lig ortak görsel kiti */

export const STORE_IMG = {
  seasonHero: cdnImage('images/store/season_hero.jpg'),
  eventsHero: cdnImage('images/store/events_hero.jpg'),
  trophy: cdnImage('images/store/proleague_trophy.png'),
  chestWood: cdnImage('images/store/chest_wood.png'),
  chestSilver: cdnImage('images/store/chest_silver.png'),
  chestGold: cdnImage('images/store/chest_gold.png'),
  chestLegendary: cdnImage('images/store/chest_legendary.png'),
  key: cdnImage('images/store/key_gold.png'),
  keySilver: cdnImage('images/store/key_silver.png'),
  keyDiamond: cdnImage('images/store/key_diamond.png'),
  booster24h: cdnImage('images/store/booster_24h.png'),
  badgeTrivia: cdnImage('images/store/badge_trivia_master.png'),
  badgeSpeed: cdnImage('images/store/badge_speed_demon.png'),
  badgeChampion: cdnImage('images/store/badge_champion.png'),
  badgeNightOwl: cdnImage('images/store/badge_night_owl.png'),
  badgeVeteran: cdnImage('images/store/badge_veteran.png'),
  badgeSeasonChamp: cdnImage('images/store/badge_season_1_champ.png'),
  badgeGenius: cdnImage('images/store/badge_genius.png'),
  gemsS: cdnImage('images/store/gems_s.png'),
  gemsM: cdnImage('images/store/gems_m.png'),
  gemsL: cdnImage('images/store/gems_l.png'),
  gemsXL: cdnImage('images/store/gems_xl.png'),
  coinsS: cdnImage('images/store/coins_s.png'),
  coinsM: cdnImage('images/store/coins_m.png'),
  coinsL: cdnImage('images/store/coins_l.png'),
  coinsXL: cdnImage('images/store/coins_xl.png'),
  booster: cdnImage('images/store/booster_bolt.png'),
  inventoryEmpty: cdnImage('images/store/inventory_empty.png'),
  eventsEmpty: cdnImage('images/store/events_empty.png'),
};

/** Yeni nesil parlak UI ikon görselleri (buton döşemeleri, sekmeler, amblemler) */
export const UI_IMG = {
  season: cdnImage('images/ui/icon_season.png'),
  prolig: cdnImage('images/ui/icon_prolig.png'),
  shop: cdnImage('images/ui/icon_shop.png'),
  events: cdnImage('images/ui/icon_events.png'),
  inventory: cdnImage('images/ui/icon_inventory.png'),
  daily: cdnImage('images/ui/icon_daily.png'),
  weekly: cdnImage('images/ui/icon_weekly.png'),
  special: cdnImage('images/ui/icon_special.png'),
  seasonEmblem: cdnImage('images/ui/season_emblem.png'),
  levelBadge: cdnImage('images/ui/level_badge.png'),
  titleNadir: cdnImage('images/ui/title_nadir.png'),
  titleEpik: cdnImage('images/ui/title_epik.png'),
  titleEfsanevi: cdnImage('images/ui/title_efsanevi.png'),
  titlesHero: cdnImage('images/store/titles_hero.jpg'),
};

/** Kategori kimliğine göre 3B oyun ikonu */
export const CATEGORY_IMG: Record<string, ImageSourcePropType> = {
  gaming_videogames: cdnImage('images/categories/cat_gaming.png'),
  anime_manga: cdnImage('images/categories/cat_anime.png'),
  cartoons_animation: cdnImage('images/categories/cat_cartoons.png'),
  cinema_tv: cdnImage('images/categories/cat_cinema.png'),
  comics_superheroes: cdnImage('images/categories/cat_comics.png'),
  fantasy_fiction: cdnImage('images/categories/cat_fantasy.png'),
  literature: cdnImage('images/categories/cat_literature.png'),
  music: cdnImage('images/categories/cat_music.png'),
  social_internet: cdnImage('images/categories/cat_social.png'),
  animals_wildlife: cdnImage('images/categories/cat_animals.png'),
  mythology_ancient: cdnImage('images/categories/cat_mythology.png'),
  hobbies_leisure: cdnImage('images/categories/cat_hobbies.png'),
  history: cdnImage('images/categories/cat_history.png'),
  geography: cdnImage('images/categories/cat_geography.png'),
  art_culture: cdnImage('images/categories/cat_art.png'),
  sports: cdnImage('images/categories/cat_sports.png'),
  science_tech: cdnImage('images/categories/cat_science.png'),
  logic_puzzles: cdnImage('images/categories/cat_logic.png'),
  mathematics: cdnImage('images/categories/cat_math.png'),
  food_gastronomy: cdnImage('images/categories/cat_food.png'),
  daily_life: cdnImage('images/categories/cat_daily.png'),
  turkey_special: cdnImage('images/categories/cat_turkey.png'),
  space_astronomy: cdnImage('images/categories/cat_space.png'),
  biology: cdnImage('images/categories/cat_biology.png'),
  physics_chemistry: cdnImage('images/categories/cat_physics.png'),
  language_vocab: cdnImage('images/categories/cat_language.png'),
  nature_ecology: cdnImage('images/categories/cat_nature.png'),
  general_culture: cdnImage('images/categories/cat_general.png'),
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
    // Altın iksirleri altın görseli, XP iksirleri yıldırım görseli kullanır
    if (k.includes('coin')) {
      return k.includes('24h') ? STORE_IMG.coinsL : STORE_IMG.coinsM;
    }
    if (k.includes('3x')) {
      return STORE_IMG.booster24h; // 3x XP: büyük iksir görseli
    }
    return k.includes('24h') ? STORE_IMG.booster24h : STORE_IMG.booster;
  }
  if (c.startsWith('badge') || k.includes('badge')) {
    // Her rozet kendi görselini kullanır (aynı görselin tekrarı yok)
    if (k.includes('season') && k.includes('champ')) return STORE_IMG.badgeSeasonChamp;
    if (k.includes('speed')) return STORE_IMG.badgeSpeed;
    if (k.includes('champion')) return STORE_IMG.badgeChampion;
    if (k.includes('night_owl')) return STORE_IMG.badgeNightOwl;
    if (k.includes('veteran')) return STORE_IMG.badgeVeteran;
    if (k.includes('genius')) return STORE_IMG.badgeGenius;
    if (k.includes('7day') || k.includes('legend')) return STORE_IMG.badgeChampion;
    return STORE_IMG.badgeTrivia;
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
  frame_neon: { src: cdnImage('images/store/frame_neon.png'), inner: 0.64 },
  frame_gold: { src: cdnImage('images/store/frame_gold.png'), inner: 0.57 },
  frame_flame: { src: cdnImage('images/store/frame_flame.png'), inner: 0.63 },
};

export const frameFor = (id: string) => {
  const k = (id || '').toLowerCase();
  if (FRAME_IMG[k]) return FRAME_IMG[k];
  if (k.includes('flame') || k.includes('fire')) return FRAME_IMG.frame_flame;
  if (k.includes('gold') || k.includes('royal')) return FRAME_IMG.frame_gold;
  if (k.includes('neon')) return FRAME_IMG.frame_neon;
  return null;
};

/* Profil arka planları: her tema kendi üretilmiş görseline sahip */
export const BG_IMG: Record<string, ImageSourcePropType> = {
  bg_nebula: cdnImage('images/store/bg_nebula.jpg'),
  bg_royal_purple: cdnImage('images/store/bg_royal_purple.jpg'),
  bg_sunset: cdnImage('images/store/bg_sunset.jpg'),
  bg_forest: cdnImage('images/store/bg_forest.jpg'),
  bg_night_city: cdnImage('images/store/bg_night_city.jpg'),
  bg_aurora: cdnImage('images/store/bg_aurora.jpg'),
  bg_volcano: cdnImage('images/store/bg_volcano.jpg'),
};

export const backgroundFor = (id: string): ImageSourcePropType | null => {
  const k = (id || '').toLowerCase();
  if (BG_IMG[k]) return BG_IMG[k];
  if (k.includes('nebula')) return BG_IMG.bg_nebula;
  if (k.includes('royal') || k.includes('purple')) return BG_IMG.bg_royal_purple;
  if (k.includes('sunset')) return BG_IMG.bg_sunset;
  if (k.includes('forest')) return BG_IMG.bg_forest;
  if (k.includes('night') || k.includes('city')) return BG_IMG.bg_night_city;
  if (k.includes('aurora')) return BG_IMG.bg_aurora;
  if (k.includes('volcano')) return BG_IMG.bg_volcano;
  return null;
};

/* ============================================================
   ANİMASYONLU KOZMETİKLER (Reanimated ile benzersiz stiller)
   Her kozmetiğin kendi görsel dili var:
   - Buz: yörüngede dönen kar tanecikleri + buz halkası
   - Zümrüt: dönen yapraklar + nefes alan yeşil halka
   - Menekşe: çift yönlü dönen yıldız/parçacık yörüngesi
   - Alev: yükselen kor parçacıkları + titreyen ateş halkası
   ============================================================ */

/** Animasyonlu çerçeve tanımları: her biri kendine özgü stil */
export const ANIMATED_FRAME_STYLES: Record<string, {
  colors: string[];
  particle: 'snowflake' | 'leaf' | 'star' | 'ember';
  duration: number;
  reverse?: boolean;
  doubleOrbit?: boolean;
}> = {
  frame_ice: { colors: ['#A5F3FC', '#38BDF8', '#0EA5E9'], particle: 'snowflake', duration: 9000, reverse: true },
  frame_emerald: { colors: ['#6EE7B7', '#34D399', '#059669'], particle: 'leaf', duration: 7000 },
  frame_violet: { colors: ['#C4B5FD', '#A78BFA', '#7C3AED'], particle: 'star', duration: 8000, doubleOrbit: true },
  frame_flame: { colors: ['#FFD08A', '#FF6B35', '#E11D48'], particle: 'ember', duration: 5000 },
};

/** Arka planlar: her birinin farklı sahne öğeleri (PRO/VIP temaları dahil) */
export const ANIMATED_BG_STYLES: Record<string, {
  layers: string[];
  scene: 'sun' | 'leaves' | 'stars' | 'aurora' | 'volcano' | 'sparkle' | 'neon' | 'galaxy';
}> = {
  bg_sunset: { layers: ['#7C2D12', '#C2410C', '#F59E0B'], scene: 'sun' },
  bg_forest: { layers: ['#14532D', '#166534', '#4D7C0F'], scene: 'leaves' },
  bg_night_city: { layers: ['#0F172A', '#1E293B', '#334155'], scene: 'stars' },
  bg_aurora: { layers: ['#06283D', '#0B4F6C', '#0EA5A5'], scene: 'aurora' },
  bg_volcano: { layers: ['#1A0505', '#450A0A', '#7F1D1D'], scene: 'volcano' },
  // PRO/VIP arka planları: altın parıltı, neon ışık ve galaksi tozu sahneleri
  bg_pro_gold: { layers: ['#1C1206', '#3B2105', '#B8860B'], scene: 'sparkle' },
  bg_vip_neon: { layers: ['#0A0020', '#2E1065', '#7C3AED'], scene: 'neon' },
  bg_galaxy_vip: { layers: ['#0B0330', '#2E1065', '#6D28D9'], scene: 'galaxy' },
};

/* Rozetler: her rozet kimliğine özgü kalkan tasarımı (renk şeması + iç simge) */
export const BADGE_DESIGNS: Record<string, { c1: string; c2: string; glow: string; icon: string }> = {
  badge_trivia_master: { c1: '#FFE27A', c2: '#B45309', glow: '#FFC837', icon: 'brain' },
  badge_speed_demon: { c1: '#67E8F9', c2: '#0E7490', glow: '#22D3EE', icon: 'bolt' },
  badge_champion: { c1: '#FCA5A5', c2: '#B91C1C', glow: '#EF4444', icon: 'trophy' },
  badge_night_owl: { c1: '#A5B4FC', c2: '#3730A3', glow: '#818CF8', icon: 'moon' },
  badge_veteran: { c1: '#D6A97C', c2: '#92400E', glow: '#C08552', icon: 'medal' },
  badge_genius: { c1: '#99F6E4', c2: '#0F766E', glow: '#5EEAD4', icon: 'spark' },
  badge_7day_legend: { c1: '#FDE68A', c2: '#9333EA', glow: '#F0ABFC', icon: 'star' },
};

/** Rozet görseli: kalkan konturu + rozete özgü iç simge (benzersiz tasarım) */
export const BadgeVisual: React.FC<{ badgeId: string; size?: number }> = ({ badgeId, size = 48 }) => {
  const d = BADGE_DESIGNS[(badgeId || '').toLowerCase()] || BADGE_DESIGNS.badge_trivia_master;
  const s = size;
  const inner = d.icon;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={s} height={s} viewBox="0 0 48 48" fill="none">
        <Defs>
          <LinearGradient id={`bdg-${badgeId}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={d.c1} />
            <Stop offset="1" stopColor={d.c2} />
          </LinearGradient>
        </Defs>
        {/* Kalkan gövdesi */}
        <Path
          d="M24 4 L40 10 V22 C40 34 32 41 24 44 C16 41 8 34 8 22 V10 Z"
          fill={`url(#bdg-${badgeId})`}
          stroke={d.glow}
          strokeWidth="2"
        />
        <Path
          d="M24 4 L40 10 V22 C40 34 32 41 24 44 C16 41 8 34 8 22 V10 Z"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1"
        />
      </Svg>
      {/* İç simge: rozete özgü */}
      <View style={{ position: 'absolute', top: 0, left: 0, width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={s * 0.42} height={s * 0.42} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {inner === 'brain' && (
            <>
              <Path d="M12 4a4 4 0 0 0-4 4 3 3 0 0 0-1 5.8A3 3 0 0 0 10 20h2z" fill="rgba(255,255,255,0.25)" />
              <Path d="M12 4a4 4 0 0 1 4 4 3 3 0 0 1 1 5.8A3 3 0 0 1 14 20h-2z" fill="rgba(255,255,255,0.25)" />
              <Path d="M12 4v16" />
            </>
          )}
          {inner === 'bolt' && <Path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="#FFFFFF" stroke="none" />}
          {inner === 'trophy' && (
            <>
              <Path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0z" />
              <Path d="M7 6H4a3 3 0 0 0 3 5M17 6h3a3 3 0 0 1-3 5" />
            </>
          )}
          {inner === 'moon' && <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="#FFFFFF" stroke="none" />}
          {inner === 'medal' && (
            <>
              <Circle cx="12" cy="14" r="5" fill="rgba(255,255,255,0.25)" />
              <Path d="M9 10L6 3M15 10l3-7M10 3h4" />
            </>
          )}
          {inner === 'spark' && (
            <>
              <Path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
              <Path d="M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
            </>
          )}
          {inner === 'star' && (
            <Path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8z" fill="#FFFFFF" stroke="none" />
          )}
        </Svg>
      </View>
    </View>
  );
};

/** İsim efektleri: renk döngü hızı ve stili farklı */
export const ANIMATED_NAME_STYLES: Record<string, {
  colors: string[];
  duration: number;
  glow: number;
}> = {
  name_gradient_ice: { colors: ['#A5F3FC', '#38BDF8', '#E0F2FE', '#38BDF8'], duration: 5000, glow: 6 },
  name_gradient_rainbow: { colors: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#B197FC', '#FF6B6B'], duration: 3500, glow: 10 },
  name_gradient_fire: { colors: ['#FFE27A', '#FF9B2F', '#E11D48', '#FF9B2F'], duration: 2800, glow: 12 },
  // Yeni isim efektleri: farklı tarzda, her biri 1 saatlik
  name_emerald_vine: { colors: ['#6EE7B7', '#34D399', '#A7F3D0', '#059669'], duration: 4200, glow: 8 },
  name_toxic_slime: { colors: ['#A3E635', '#7C3AED', '#84CC16', '#7C3AED'], duration: 2600, glow: 14 },
  name_candy_heart: { colors: ['#F9A8D4', '#EC4899', '#FBCFE8', '#EC4899'], duration: 3000, glow: 9 },
  name_void_shadow: { colors: ['#A78BFA', '#1E1B4B', '#6D28D9', '#A78BFA'], duration: 6000, glow: 16 },
  name_plasma_bolt: { colors: ['#67E8F9', '#D946EF', '#22D3EE', '#D946EF'], duration: 2000, glow: 18 },
};

const PARTICLE_EMOJI: Record<string, string> = {
  snowflake: '❄',
  leaf: '🍃',
  star: '✦',
  ember: '🔥',
};

/** Yörüngede dönen parçacıklar: avatarın etrafında süzülen öğeler */
const OrbitingParticles: React.FC<{
  radius: number;
  particleSize: number;
  count: number;
  colors: string[];
  particle: string;
  duration: number;
  reverse?: boolean;
}> = ({ radius, particleSize, count, colors, particle, duration, reverse }) => {
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withRepeat(
      withTiming(reverse ? -360 : 360, { duration, easing: Easing.linear }),
      -1,
      false,
    );
  }, [duration, reverse]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));
  const emoji = PARTICLE_EMOJI[particle] || '✦';
  const parts: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const c = colors[i % colors.length];
    parts.push(
      <View
        key={i}
        style={{
          position: 'absolute',
          left: x - particleSize / 2,
          top: y - particleSize / 2,
          width: particleSize,
          height: particleSize,
          borderRadius: particleSize / 2,
          backgroundColor: `${c}33`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: particleSize * 0.62, color: c }}>{emoji}</Text>
      </View>,
    );
  }
  return (
    <Animated.View
      style={[{ position: 'absolute', width: 0, height: 0, left: '50%', top: '50%' }, style]}
      pointerEvents="none"
    >
      {parts}
    </Animated.View>
  );
};

/** Nefes alan halka: kenar rengi döngüde yumuşakça değişir */
const BreathingRing: React.FC<{
  colors: string[];
  size: number;
  ringWidth: number;
  duration: number;
}> = ({ colors, size, ringWidth, duration }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [duration]);
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const idx = Math.min(colors.length - 1, Math.floor(t * colors.length));
    const nextIdx = (idx + 1) % colors.length;
    const local = t * colors.length - idx;
    return {
      position: 'absolute',
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: ringWidth,
      borderColor: mixHex(colors[idx], colors[nextIdx], local),
      shadowColor: mixHex(colors[idx], colors[nextIdx], local),
      shadowOpacity: 0.6,
      shadowRadius: 8,
      transform: [{ scale: 0.96 + 0.05 * Math.sin(t * Math.PI * 2) }],
    };
  });
  return <Animated.View style={style} pointerEvents="none" />;
};

/** Yükselen kor parçacığı: alev çerçevesi için dikey süzülen kıvılcım */
const RisingEmber: React.FC<{
  x: number;
  delay: number;
  color: string;
  size: number;
  travel: number;
}> = ({ x, delay, color, size, travel }) => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(
      withSequence(
        withDelay(delay, withTiming(0, { duration: 0 })),
        withTiming(1, { duration: 2200 + delay % 800, easing: Easing.out(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [delay]);
  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x,
    bottom: 0,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    opacity: 0.85 * (1 - p.value),
    transform: [{ translateY: -p.value * travel }, { scale: 0.6 + p.value * 0.8 }],
  }));
  return <Animated.View style={style} pointerEvents="none" />;
};

/** Animasyonlu çerçeve: her çerçeve kendi animasyon diliyle avatarı sarar */
export const AnimatedFrame: React.FC<{
  frameId: string;
  seed?: string;
  size: number;
  glow?: boolean;
}> = ({ frameId, seed, size }) => {
  const def = ANIMATED_FRAME_STYLES[(frameId || '').toLowerCase()] || ANIMATED_FRAME_STYLES.frame_ice;
  const inner = Math.round(size * 0.58);
  const orbitRadius = Math.round(size * 0.44);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size * 0.8,
          height: size * 0.8,
          borderRadius: (size * 0.8) / 2,
          backgroundColor: `${def.colors[1]}22`,
        }}
      />
      {def.particle === 'ember' ? (
        <>
          <BreathingRing colors={def.colors} size={Math.round(size * 0.96)} ringWidth={Math.max(3, size * 0.05)} duration={1400} />
          {[0.2, 0.35, 0.5, 0.65, 0.8].map((fx, i) => (
            <RisingEmber
              key={i}
              x={size * (0.15 + fx * 0.7)}
              delay={i * 380}
              color={def.colors[i % def.colors.length]}
              size={Math.max(4, size * 0.07)}
              travel={size * 0.9}
            />
          ))}
        </>
      ) : def.doubleOrbit ? (
        <>
          <BreathingRing colors={def.colors} size={Math.round(size * 0.92)} ringWidth={Math.max(2, size * 0.035)} duration={2600} />
          <OrbitingParticles
            radius={orbitRadius}
            particleSize={Math.max(10, size * 0.13)}
            count={4}
            colors={def.colors}
            particle={def.particle}
            duration={def.duration}
          />
          <OrbitingParticles
            radius={Math.round(orbitRadius * 0.78)}
            particleSize={Math.max(8, size * 0.1)}
            count={3}
            colors={[def.colors[2], def.colors[0]]}
            particle={def.particle}
            duration={def.duration * 0.7}
            reverse
          />
        </>
      ) : (
        <>
          <BreathingRing colors={def.colors} size={Math.round(size * 0.94)} ringWidth={Math.max(2, size * 0.04)} duration={2200} />
          <OrbitingParticles
            radius={orbitRadius}
            particleSize={Math.max(10, size * 0.14)}
            count={def.particle === 'snowflake' ? 5 : 4}
            colors={def.colors}
            particle={def.particle}
            duration={def.duration}
            reverse={def.reverse}
          />
        </>
      )}
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          overflow: 'hidden',
          borderWidth: 1.5,
          borderColor: def.colors[0],
          backgroundColor: '#170733',
        }}
      >
        <CharacterAvatar seed={seed} size={inner} />
      </View>
    </View>
  );
};

/** Gökyüzü öğeleri: güneş (batım), yıldızlar (gece şehri) */
const TwinkleStar: React.FC<{ x: number; y: number; delay: number; size: number }> = ({ x, y, delay, size }) => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(
      withSequence(
        withDelay(delay, withTiming(0, { duration: 0 })),
        withTiming(1, { duration: 1600 + (delay % 900), easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [delay]);
  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x,
    top: y,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: '#E0F2FE',
    opacity: 0.15 + 0.85 * Math.abs(Math.sin(p.value * Math.PI)),
  }));
  return <Animated.View style={style} pointerEvents="none" />;
};

const PulsingSun: React.FC<{ size: number }> = ({ size }) => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    right: -size * 0.3,
    top: size * 0.35,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: '#F59E0B',
    opacity: 0.35 + 0.3 * Math.sin(p.value * Math.PI),
    transform: [{ scale: 0.92 + 0.12 * Math.sin(p.value * Math.PI) }],
  }));
  return <Animated.View style={style} pointerEvents="none" />;
};

/** Süzülen yaprak: orman arka planı için */
const DriftingLeaf: React.FC<{ x: number; delay: number; size: number; drift: number }> = ({ x, delay, size, drift }) => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(
      withSequence(
        withDelay(delay, withTiming(0, { duration: 0 })),
        withTiming(1, { duration: 5000 + (delay % 3000), easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [delay]);
  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x,
    top: 10 + p.value * drift,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: '#6EE7B7',
    opacity: 0.25 + 0.35 * Math.sin(p.value * Math.PI),
    transform: [{ translateY: Math.sin(p.value * Math.PI * 2) * 6 }, { rotate: `${p.value * 360}deg` }],
  }));
  return <Animated.View style={style} pointerEvents="none" />;
};

/** Kutup ışığı şeridi: aurora arka planı için dalgalanan renk bandı */
const AuroraRibbon: React.FC<{ top: number; height: number; delay: number; color: string }> = ({ top, height, delay, color }) => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(
      withSequence(withDelay(delay, withTiming(0, { duration: 0 })), withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) })),
      -1,
      true,
    );
  }, [delay]);
  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: -20,
    right: -20,
    top,
    height,
    backgroundColor: color,
    opacity: 0.14 + 0.22 * Math.sin(p.value * Math.PI),
    transform: [{ skewY: `${Math.sin(p.value * Math.PI * 2) * 8}deg` }, { translateX: Math.sin(p.value * Math.PI) * 14 }],
    borderRadius: height,
  }));
  return <Animated.View style={style} pointerEvents="none" />;
};

/** Yükselen kor: volkan arka planı için yukarı süzülen kıvılcım */
const VolcanoEmber: React.FC<{ x: number; delay: number; size: number; drift: number }> = ({ x, delay, size, drift }) => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(
      withSequence(withDelay(delay, withTiming(0, { duration: 0 })), withTiming(1, { duration: 4200 + (delay % 2500), easing: Easing.inOut(Easing.sin) })),
      -1,
      true,
    );
  }, [delay]);
  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x,
    top: 10 + (1 - p.value) * drift,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: '#FB923C',
    opacity: 0.2 + 0.45 * Math.sin(p.value * Math.PI),
    transform: [{ translateX: Math.sin(p.value * Math.PI * 3) * 8 }],
  }));
  return <Animated.View style={style} pointerEvents="none" />;
};

/** Altın parıltısı: PRO altın temasında yükselen ışıltılar */
const GoldSparkle: React.FC<{ x: number; delay: number; size: number; drift: number }> = ({ x, delay, size, drift }) => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(
      withSequence(withDelay(delay, withTiming(0, { duration: 0 })), withTiming(1, { duration: 5000 + (delay % 2000), easing: Easing.inOut(Easing.sin) })),
      -1,
      true,
    );
  }, [delay]);
  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x,
    top: 10 + (1 - p.value) * drift,
    width: size,
    height: size * 0.35,
    borderRadius: size,
    backgroundColor: '#FFE27A',
    opacity: 0.25 + 0.5 * Math.sin(p.value * Math.PI),
    transform: [{ translateX: Math.sin(p.value * Math.PI * 4) * 10 }, { rotate: `${Math.sin(p.value * Math.PI * 2) * 45}deg` }],
  }));
  return <Animated.View style={style} pointerEvents="none" />;
};

/** Neon ışık huzmesi: VIP neon temasında sallanan mor-cyan huzmeler */
const NeonBeam: React.FC<{ x: number; delay: number; width: number; height: number; color: string }> = ({ x, delay, width, height, color }) => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(
      withTiming(1, { duration: 3600 + delay, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [delay]);
  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x,
    bottom: 0,
    width,
    height,
    borderRadius: width,
    backgroundColor: color,
    opacity: 0.12 + 0.18 * Math.sin(p.value * Math.PI),
    transform: [{ rotate: `${-18 + 10 * Math.sin(p.value * Math.PI * 2)}deg` }, { translateY: height * 0.12 * Math.sin(p.value * Math.PI * 3) }],
  }));
  return <Animated.View style={style} pointerEvents="none" />;
};

/** Galaksi tozu: VIP galaksi temasında süzülen mor-kuvars yıldız zerreleri */
const GalaxyDust: React.FC<{ x: number; delay: number; size: number; drift: number }> = ({ x, delay, size, drift }) => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(
      withSequence(withDelay(delay, withTiming(0, { duration: 0 })), withTiming(1, { duration: 6000 + (delay % 3000), easing: Easing.inOut(Easing.sin) })),
      -1,
      true,
    );
  }, [delay]);
  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x,
    top: 10 + (1 - p.value) * drift,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: Math.floor(delay / 700) % 2 === 0 ? '#A78BFA' : '#67E8F9',
    opacity: 0.15 + 0.55 * Math.sin(p.value * Math.PI),
    transform: [{ translateX: Math.sin(p.value * Math.PI * 2) * 14 }],
  }));
  return <Animated.View style={style} pointerEvents="none" />;
};

/** Arka plan sahnesi: katmanlar + sahneye özgü canlı öğeler (telefon çerçevesi olmadan).
 *  Mağaza önizlemesinde, profil kartında ve uygulama genelinde kullanılır.
 *  width/height sayı olabileceği gibi '100%' gibi yüzde değer de olabilir (kendi kendine ölçer). */
export const BackgroundScene: React.FC<{ bgId: string; width: number | string; height: number | string; style?: any }> = ({ bgId, width, height, style }) => {
  const def = ANIMATED_BG_STYLES[(bgId || '').toLowerCase()] || ANIMATED_BG_STYLES.bg_sunset;
  const [dims, setDims] = useState<{ w: number; h: number } | null>(
    typeof width === 'number' && typeof height === 'number' ? { w: width, h: height } : null,
  );
  return (
    <View
      style={[{ width, height, overflow: 'hidden' }, style]}
      pointerEvents="none"
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        if (!dims || Math.abs(w - dims.w) > 1 || Math.abs(h - dims.h) > 1) setDims({ w, h });
      }}
    >
      {dims && (
        <>
          {def.layers.map((c, i) => (
            <PulseBgLayer key={i} color={c} period={3600 + i * 1600} />
          ))}
          {def.scene === 'sun' && <PulsingSun size={dims.w * 0.5} />}
          {def.scene === 'stars' &&
            [
              [0.08, 0.1], [0.3, 0.06], [0.55, 0.12], [0.75, 0.08], [0.18, 0.22],
              [0.62, 0.26], [0.85, 0.2], [0.4, 0.34], [0.05, 0.4], [0.9, 0.36],
            ].map(([fx, fy], i) => (
              <TwinkleStar key={i} x={dims.w * fx} y={dims.h * fy} delay={i * 700} size={Math.max(3, dims.w * 0.045)} />
            ))}
          {def.scene === 'leaves' &&
            [0.1, 0.3, 0.5, 0.7, 0.85].map((fx, i) => (
              <DriftingLeaf key={i} x={dims.w * fx} delay={i * 900} size={Math.max(4, dims.w * 0.06)} drift={dims.h * 0.6} />
            ))}
          {def.scene === 'aurora' && (
            <>
              <AuroraRibbon top={dims.h * 0.08} height={dims.h * 0.1} delay={0} color="#34D399" />
              <AuroraRibbon top={dims.h * 0.2} height={dims.h * 0.07} delay={1400} color="#22D3EE" />
              <AuroraRibbon top={dims.h * 0.3} height={dims.h * 0.12} delay={2600} color="#A78BFA" />
            </>
          )}
          {def.scene === 'volcano' &&
            [0.15, 0.35, 0.55, 0.75, 0.9].map((fx, i) => (
              <VolcanoEmber key={i} x={dims.w * fx} delay={i * 800} size={Math.max(4, dims.w * 0.05)} drift={dims.h * 0.8} />
            ))}
          {def.scene === 'sparkle' &&
            [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95].map((fx, i) => (
              <GoldSparkle key={i} x={dims.w * fx} delay={i * 700} size={Math.max(6, dims.w * 0.07)} drift={dims.h * 0.9} />
            ))}
          {def.scene === 'neon' && (
            <>
              <NeonBeam x={dims.w * 0.05} delay={0} width={Math.max(8, dims.w * 0.12)} height={dims.h * 0.7} color="#D946EF" />
              <NeonBeam x={dims.w * 0.4} delay={900} width={Math.max(6, dims.w * 0.09)} height={dims.h * 0.8} color="#22D3EE" />
              <NeonBeam x={dims.w * 0.72} delay={1700} width={Math.max(8, dims.w * 0.12)} height={dims.h * 0.65} color="#D946EF" />
              {[
                [0.12, 0.12], [0.38, 0.2], [0.62, 0.08], [0.85, 0.18], [0.22, 0.32],
                [0.52, 0.38], [0.9, 0.3], [0.05, 0.45],
              ].map(([fx, fy], i) => (
                <TwinkleStar key={`s-${i}`} x={dims.w * fx} y={dims.h * fy} delay={i * 600} size={Math.max(3, dims.w * 0.04)} />
              ))}
            </>
          )}
          {def.scene === 'galaxy' && (
            <>
              {[
                [0.06, 0.1], [0.28, 0.05], [0.5, 0.12], [0.7, 0.08], [0.88, 0.15],
                [0.16, 0.24], [0.6, 0.28], [0.35, 0.36], [0.92, 0.4], [0.08, 0.42],
              ].map(([fx, fy], i) => (
                <TwinkleStar key={`gs-${i}`} x={dims.w * fx} y={dims.h * fy} delay={i * 500} size={Math.max(3, dims.w * 0.042)} />
              ))}
              {[0.12, 0.32, 0.52, 0.72, 0.9].map((fx, i) => (
                <GalaxyDust key={`gd-${i}`} x={dims.w * fx} delay={i * 900} size={Math.max(5, dims.w * 0.06)} drift={dims.h * 0.85} />
              ))}
            </>
          )}
        </>
      )}
    </View>
  );
};

/** Animasyonlu arka plan önizlemesi: her sahnenin kendine özgü canlı öğeleri */
export const AnimatedBackgroundThumb: React.FC<{
  bgId: string;
  seed?: string;
  name?: string;
  width: number;
}> = ({ bgId, seed, name, width }) => {
  const def = ANIMATED_BG_STYLES[(bgId || '').toLowerCase()] || ANIMATED_BG_STYLES.bg_sunset;
  const h = Math.round(width * 1.62);
  const av = Math.round(width * 0.34);
  return (
    <View style={[kit.phone, { width, height: h, borderRadius: width * 0.16, overflow: 'hidden' }]}>
      <BackgroundScene bgId={bgId} width={width} height={h} />
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
    opacity: 0.22 + 0.5 * Math.sin(progress.value * Math.PI),
  }));
  return <Animated.View style={style} pointerEvents="none" />;
};

/** Animasyonlu isim efekti: her efektin kendine özgü hız ve parlaklığı */
export const AnimatedNameText: React.FC<{
  effectId: string;
  children?: string;
  style?: any;
  numberOfLines?: number;
}> = ({ effectId, children, style, numberOfLines }) => {
  const def = ANIMATED_NAME_STYLES[(effectId || '').toLowerCase()] || ANIMATED_NAME_STYLES.name_gradient_ice;
  const colors = def.colors;
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: def.duration, easing: Easing.linear }), -1, false);
  }, [def.duration]);
  const animStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const idx = Math.min(colors.length - 1, Math.floor(t * colors.length));
    const nextIdx = (idx + 1) % colors.length;
    const local = t * colors.length - idx;
    return {
      color: mixHex(colors[idx], colors[nextIdx], local),
      textShadowColor: mixHex(colors[idx], colors[nextIdx], local),
      textShadowRadius: def.glow,
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

/** Animasyonlu kozmetik kimlikleri (ShopScreen ve profil modalı için) */
export const ANIMATED_FRAME_COLORS: Record<string, string[]> = Object.fromEntries(
  Object.entries(ANIMATED_FRAME_STYLES).map(([k, v]) => [k, v.colors]),
);
export const ANIMATED_BG_LAYERS: Record<string, string[]> = Object.fromEntries(
  Object.entries(ANIMATED_BG_STYLES).map(([k, v]) => [k, v.layers]),
);
export const ANIMATED_NAME_COLORS: Record<string, string[]> = Object.fromEntries(
  Object.entries(ANIMATED_NAME_STYLES).map(([k, v]) => [k, v.colors]),
);

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

/* Büyütülmüş önizleme (çerçeve, arka plan veya isim efekti) */
export const CosmeticPreviewModal: React.FC<{
  visible: boolean;
  kind: 'frame' | 'background' | 'name' | null;
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
  const isAnimFrame = kind === 'frame' && !!ANIMATED_FRAME_STYLES[(itemId || '').toLowerCase()];
  const isAnimBg = kind === 'background' && !!ANIMATED_BG_STYLES[(itemId || '').toLowerCase()];
  const isNameEffect = kind === 'name';
  const animNameDef = isNameEffect
    ? ANIMATED_NAME_STYLES[(itemId || '').toLowerCase()]
    : null;
  const [pvW, setPvW] = useState(240);
  const [pvH, setPvH] = useState(390);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={kit.pvBackdrop}>
        <Animated.View
          entering={ZoomIn.duration(260)}
          style={[kit.pvPhone, { overflow: 'hidden' }]}
          onLayout={(e) => {
            const { width: w, height: hgt } = e.nativeEvent.layout;
            if (w > 0 && hgt > 0) {
              setPvW(w);
              setPvH(hgt);
            }
          }}
        >
          {bg ? (
            <Image source={bg} style={kit.heroImg} resizeMode="cover" />
          ) : isAnimBg ? (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              <BackgroundScene bgId={itemId} width={pvW} height={pvH} />
            </View>
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
              isAnimFrame ? (
                <AnimatedFrame frameId={itemId} seed={seed} size={200} />
              ) : (
                <FramedAvatar frameId={itemId} seed={seed} size={200} />
              )
            ) : (
              <View style={kit.pvAvatar}>
                <CharacterAvatar seed={seed} size={110} />
              </View>
            )}
            {isNameEffect ? (
              <AnimatedNameText effectId={itemId} style={kit.pvName} numberOfLines={1}>
                {name || 'Oyuncu'}
              </AnimatedNameText>
            ) : (
              <Text style={kit.pvName} numberOfLines={1}>
                {name || 'Oyuncu'}
              </Text>
            )}
            {typeof level === 'number' && <Text style={kit.pvLevel}>Seviye {level}</Text>}
            {isNameEffect && (
              <Text style={[kit.pvLevel, { marginTop: 6, fontSize: 11, color: 'rgba(217,205,245,0.6)' }]}>
                İsim efektiniz profilinizde ve arkadaş listesinde böyle görünecek
              </Text>
            )}
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
