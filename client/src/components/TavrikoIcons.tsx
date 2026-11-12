import React, { useState } from 'react';
import { GradientFill } from './TavrikoGradient';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Image,
  Platform,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Path,
  Circle,
  Ellipse,
  G,
  Text as SvgText,
} from 'react-native-svg';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { CharacterAvatar, AVATAR_PRESETS, AvatarPreset } from './TavrikoAvatars';
import { useGameStore } from '../store/gameStore';
import { NotificationBell } from './NotificationUI';
import { useUnreadCount } from '../store/notificationStore';
import { BackgroundScene, backgroundFor } from './StoreKit';
// Brand Assets
export const BRAND_LOGO_MAIN = require('../../assets/images/brand/logo_full.png');
export const BRAND_LOGO_BANNER = require('../../assets/images/brand/logo_full.png');
export const BRAND_APP_ICON = require('../../assets/images/app_icon.png');
// Shared SVG Gradients from Tavriko UI Kit
const SharedSvgDefs = () => (
  <Defs>
    <LinearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor="#fff1a0" />
      <Stop offset="0.5" stopColor="#ffb21e" />
      <Stop offset="1" stopColor="#e07a00" />
    </LinearGradient>
    <LinearGradient id="pink" x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor="#ff9af0" />
      <Stop offset="1" stopColor="#e0309f" />
    </LinearGradient>
    <LinearGradient id="blue" x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor="#9fd4ff" />
      <Stop offset="1" stopColor="#2f6fe0" />
    </LinearGradient>
    <LinearGradient id="purple" x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor="#b38bff" />
      <Stop offset="1" stopColor="#5a27c8" />
    </LinearGradient>
    <LinearGradient id="red" x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor="#ff7a8a" />
      <Stop offset="1" stopColor="#d0102e" />
    </LinearGradient>
    <LinearGradient id="green" x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor="#9ff0a8" />
      <Stop offset="1" stopColor="#22a85a" />
    </LinearGradient>
    <LinearGradient id="brown" x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor="#e09a5a" />
      <Stop offset="1" stopColor="#8a4a12" />
    </LinearGradient>
    <LinearGradient id="orange" x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor="#ffb347" />
      <Stop offset="1" stopColor="#ff3d1f" />
    </LinearGradient>
    <LinearGradient id="t0" x1="0" y1="0" x2="1" y2="1">
      <Stop offset="0" stopColor="#9a6bff" />
      <Stop offset="1" stopColor="#5a27c8" />
    </LinearGradient>
    <LinearGradient id="t1" x1="0" y1="0" x2="1" y2="1">
      <Stop offset="0" stopColor="#4a9bff" />
      <Stop offset="1" stopColor="#1f5fe0" />
    </LinearGradient>
    <LinearGradient id="t2" x1="0" y1="0" x2="1" y2="1">
      <Stop offset="0" stopColor="#ff6bc4" />
      <Stop offset="1" stopColor="#c01f80" />
    </LinearGradient>
    <LinearGradient id="t3" x1="0" y1="0" x2="1" y2="1">
      <Stop offset="0" stopColor="#ffb347" />
      <Stop offset="1" stopColor="#e06a00" />
    </LinearGradient>
    <LinearGradient id="t4" x1="0" y1="0" x2="1" y2="1">
      <Stop offset="0" stopColor="#4fe0a0" />
      <Stop offset="1" stopColor="#14935f" />
    </LinearGradient>
    <LinearGradient id="t5" x1="0" y1="0" x2="1" y2="1">
      <Stop offset="0" stopColor="#ff7a8a" />
      <Stop offset="1" stopColor="#c8102e" />
    </LinearGradient>
    <LinearGradient id="t6" x1="0" y1="0" x2="1" y2="1">
      <Stop offset="0" stopColor="#4fd6e8" />
      <Stop offset="1" stopColor="#0e7fa8" />
    </LinearGradient>
    <LinearGradient id="t7" x1="0" y1="0" x2="1" y2="1">
      <Stop offset="0" stopColor="#e0985a" />
      <Stop offset="1" stopColor="#8a4a12" />
    </LinearGradient>
  </Defs>
);
// ============================================================================
// 1. CHARACTER AVATARS (6 Custom SVG Avatars from page02)
// ============================================================================
// 1. CHARACTER AVATARS (10 Official Vector Avatars from Tavriko UI Kit)
// ============================================================================
export {
  AVATAR_PRESETS,
  CharacterAvatar,
  AvatarPreset,
} from './TavrikoAvatars';
export const GoogleGIcon: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48">
    <Path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <Path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <Path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <Path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </Svg>
);
// ============================================================================
// 2. ECONOMY & REWARD ICONS (13 Icons from page28)
// ============================================================================
/* Mağazadaki 3B para/elmas görselleri — oyun genelinde aynı görsel kullanılır */
const COIN_3D_IMG = require('../../assets/images/store/coins_s.png');
const GEM_3D_IMG = require('../../assets/images/store/gems_s.png');
export const CoinIcon: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <Image source={COIN_3D_IMG} style={{ width: size, height: size }} resizeMode="contain" />
);
export const CoinSvg = CoinIcon;
export const CoinTavrikoIcon = CoinIcon;
export const GemIcon: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <Image source={GEM_3D_IMG} style={{ width: size, height: size }} resizeMode="contain" />
);
export const GemTavrikoIcon = GemIcon;
export const TrophyIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <SharedSvgDefs />
    <Path d="M18 8h28v16a14 14 0 01-28 0z" fill="url(#gold)" />
    <Path
      d="M18 14H8v4a10 10 0 0010 10M46 14h10v4a10 10 0 01-10 10"
      fill="none"
      stroke="#ffb21e"
      strokeWidth="4"
      strokeLinecap="round"
    />
    <Rect x="28" y="38" width="8" height="8" fill="#e07a00" />
    <Rect x="18" y="46" width="28" height="10" rx="4" fill="url(#purple)" />
    <Path d="M24 14v10" stroke="#fff" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round" />
  </Svg>
);
export const CrownIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <SharedSvgDefs />
    <Path d="M6 48L8 18l16 14 8-18 8 18 16-14 2 30z" fill="url(#gold)" />
    <Rect x="6" y="48" width="52" height="8" rx="4" fill="#e07a00" />
    <Circle cx="8" cy="18" r="3.5" fill="#FFF9C4" />
    <Circle cx="32" cy="14" r="3.5" fill="#FFF9C4" />
    <Circle cx="56" cy="18" r="3.5" fill="#FFF9C4" />
    <Circle cx="20" cy="52" r="2.2" fill="#E91E63" />
    <Circle cx="32" cy="52" r="2.2" fill="#00E5FF" />
    <Circle cx="44" cy="52" r="2.2" fill="#E91E63" />
  </Svg>
);
export const XpStarIcon: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <SharedSvgDefs />
    <Circle cx="32" cy="32" r="26" fill="#1976D2" />
    <Circle cx="32" cy="32" r="22" fill="#0D47A1" />
    <Path
      d="M32 15l4.5 9 10 1.5-7.2 7 1.7 10-9-4.7-9 4.7 1.7-10-7.2-7 10-1.5z"
      fill="#FFD600"
    />
  </Svg>
);
export const SpeedBoltIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <SharedSvgDefs />
    <Rect x="28" y="4" width="8" height="6" rx="2" fill="#2979FF" />
    <Circle cx="32" cy="35" r="25" fill="#2979FF" />
    <Circle cx="32" cy="35" r="21" fill="#1565C0" />
    <Path
      d="M34 19L21 37h10l-3 14 15-20H29z"
      fill="#FFD600"
      stroke="#FFD600"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </Svg>
);
export const StreakFlameIcon: React.FC<{ size?: number; active?: boolean }> = ({
  size = 24,
  active = false,
}) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <LinearGradient id="flameHot" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFEA79" />
        <Stop offset="0.3" stopColor="#FF7A00" />
        <Stop offset="1" stopColor="#D91E18" />
      </LinearGradient>
      <LinearGradient id="flameCore" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFFFFF" />
        <Stop offset="0.6" stopColor="#FFF176" />
        <Stop offset="1" stopColor="#FF9800" />
      </LinearGradient>
      <LinearGradient id="flameGlow" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FF5722" stopOpacity="0.45" />
        <Stop offset="1" stopColor="#FFB300" stopOpacity="0" />
      </LinearGradient>
    </Defs>
    {active && (
      <>
        {/* Ambient Fire Aura Glow */}
        <Circle cx="32" cy="36" r="26" fill="url(#flameGlow)" />
        {/* Fire Sparks / Embers */}
        <Circle cx="16" cy="18" r="2.5" fill="#FFE082" />
        <Circle cx="48" cy="16" r="2" fill="#FFAB91" />
        <Circle cx="46" cy="30" r="1.8" fill="#FFD54F" />
        <Circle cx="18" cy="32" r="1.5" fill="#FF8A65" />
      </>
    )}
    {/* Outer Flame */}
    <Path
      d="M32 4c3 10 17 16 17 34a17 17 0 01-34 0c0-8 4-12 9-16 1 4 3 6 6 6-2-8-1-16 2-24z"
      fill={active ? 'url(#flameHot)' : '#B89B85'}
      opacity={active ? 1 : 0.65}
    />
    {/* Secondary inner tongue */}
    <Path
      d="M32 20c2 6 10 10 10 20a10 10 0 01-20 0c0-5 3-7 5-10 1 3 2 4 4 4-1-5-1-10 1-14z"
      fill={active ? '#FFB300' : '#8A7060'}
    />
    {/* Inner Core */}
    <Path
      d="M32 34c4 4 8 6 8 12a8 8 0 01-16 0c0-4 4-6 8-12z"
      fill={active ? 'url(#flameCore)' : '#D0BAA8'}
    />
  </Svg>
);
export const BadgeShieldIcon: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <SharedSvgDefs />
    <Path d="M32 4l22 8v18c0 14-9 24-22 30C19 54 10 44 10 30V12z" fill="url(#purple)" />
    <Path
      d="M22 32l8 8 14-16"
      fill="none"
      stroke="#fff"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export const HeartIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <SharedSvgDefs />
    <Path
      d="M32 56S6 40 6 22C6 12 13 7 20 7c5 0 9 3 12 7 3-4 7-7 12-7 7 0 14 5 14 15 0 18-26 34-26 34z"
      fill="url(#red)"
    />
  </Svg>
);
export const ChestIcon: React.FC<{ size?: number }> = ({ size = 36 }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <SharedSvgDefs />
    <Rect x="6" y="28" width="52" height="28" rx="5" fill="url(#brown)" />
    <Path d="M6 30v-4C6 12 58 12 58 26v4z" fill="#c9732a" />
    <Rect x="26" y="14" width="12" height="42" rx="3" fill="url(#gold)" />
    <Rect x="28" y="32" width="8" height="10" rx="2" fill="#fff3b0" />
  </Svg>
);
export const GiftIcon: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <SharedSvgDefs />
    <Rect x="8" y="28" width="48" height="28" rx="5" fill="url(#green)" />
    <Rect x="5" y="19" width="54" height="11" rx="4" fill="url(#green)" />
    <Rect x="28" y="19" width="8" height="37" fill="url(#red)" />
    <Path d="M32 19C20 3 9 12 20 19zM32 19C44 3 55 12 44 19z" fill="url(#red)" />
  </Svg>
);
export const KeyIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <SharedSvgDefs />
    <Circle cx="20" cy="20" r="12" fill="none" stroke="url(#gold)" strokeWidth="8" />
    <Path
      d="M30 30l24 24M44 44l8-8M52 52l6-6"
      stroke="url(#gold)"
      strokeWidth="7"
      strokeLinecap="round"
      fill="none"
    />
  </Svg>
);
export const InventoryCubeIcon: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <SharedSvgDefs />
    <Rect x="12" y="24" width="40" height="32" rx="10" fill="url(#t0)" />
    <Path d="M22 24V16a10 10 0 0120 0v8" stroke="#D1C4E9" strokeWidth="5" strokeLinecap="round" fill="none" />
    <Circle cx="32" cy="38" r="3.5" fill="#FFD600" />
    <Path d="M32 41v5" stroke="#FFD600" strokeWidth="3" strokeLinecap="round" />
  </Svg>
);
// ============================================================================
// 3. CATEGORY SQUIRCLE ICONS (All 16 Categories from page04 & page28)
// ============================================================================
export type TavrikoCategoryKey =
  | 'bilim'
  | 'tarih'
  | 'cografya'
  | 'spor'
  | 'sinema'
  | 'muzik'
  | 'sanat'
  | 'teknoloji'
  | 'doga'
  | 'yemek'
  | 'edebiyat'
  | 'uzay'
  | 'hayvanlar'
  | 'matematik'
  | 'oyun'
  | 'genel_kultur'
  | 'gaming_videogames'
  | 'anime_manga'
  | 'cartoons_animation'
  | 'comics_superheroes'
  | 'fantasy_fiction'
  | 'social_internet'
  | 'mythology_ancient'
  | 'hobbies_leisure'
  | 'daily_life'
  | 'turkey_special'
  | 'turkiye'
  | 'mitoloji'
  | 'anime'
  | 'fantezi';
export const CategorySquircleIcon: React.FC<{
  category: TavrikoCategoryKey | string;
  size?: number;
}> = ({ category, size = 44 }) => {
  const key = category.toLowerCase();
  const renderGlyph = () => {
    if (key.includes('bilim') || key === 'science_tech' || key === 'physics_chemistry') {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t6)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <Ellipse cx="32" cy="32" rx="21" ry="8" />
            <Ellipse cx="32" cy="32" rx="21" ry="8" transform="rotate(60 32 32)" />
            <Ellipse cx="32" cy="32" rx="21" ry="8" transform="rotate(120 32 32)" />
          </G>
          <Circle cx="32" cy="32" r="3.5" fill="#fff" />
        </>
      );
    }
    if (key.includes('tarih') || key === 'history') {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t7)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M10 24L32 10l22 14z" />
            <Path d="M16 28v20M27 28v20M37 28v20M48 28v20M10 54h44" />
          </G>
        </>
      );
    }
    if (key.includes('cografya') || key === 'geography') {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t1)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <Circle cx="32" cy="32" r="20" />
            <Ellipse cx="32" cy="32" rx="9" ry="20" />
            <Path d="M12 32h40" />
          </G>
        </>
      );
    }
    if (key.includes('spor') || key === 'sports') {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t3)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <Circle cx="32" cy="32" r="20" />
            <Path d="M12 32h40M32 12v40M17 17a22 22 0 010 30M47 17a22 22 0 000 30" />
          </G>
        </>
      );
    }
    if (key.includes('sinema') || key === 'cinema_tv') {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t5)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <Rect x="10" y="26" width="44" height="26" rx="5" />
            <Path d="M10 26l38-12 4 8-42 4zM22 22l6 7M34 18l6 7" />
          </G>
          <Path d="M28 34l10 6-10 6z" fill="#fff" />
        </>
      );
    }
    if (key.includes('muzik') || key === 'music') {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t2)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M26 46V16l22-5v30" />
          </G>
          <Circle cx="20" cy="46" r="6" fill="#fff" />
          <Circle cx="42" cy="41" r="6" fill="#fff" />
        </>
      );
    }
    if (key.includes('sanat') || key === 'art_culture') {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t0)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M32 10C18 10 10 20 10 31c0 12 10 22 22 22 4 0 5-3 3-6s0-6 4-6h8c6 0 10-4 10-10C57 19 47 10 32 10z" />
          </G>
          <Circle cx="22" cy="30" r="3.5" fill="#fff" />
          <Circle cx="31" cy="21" r="3.5" fill="#fff" />
          <Circle cx="43" cy="23" r="3.5" fill="#fff" />
        </>
      );
    }
    if (key.includes('teknoloji')) {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t1)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <Rect x="19" y="19" width="26" height="26" rx="5" />
            <Path d="M27 8v11M37 8v11M27 45v11M37 45v11M8 27h11M8 37h11M45 27h11M45 37h11" />
          </G>
          <Rect x="28" y="28" width="8" height="8" rx="2" fill="#fff" />
        </>
      );
    }
    if (key.includes('doga') || key.includes('nature') || key === 'biology') {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t4)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M12 52C12 28 28 12 52 12c0 24-16 40-40 40z" />
            <Path d="M12 52L36 28" />
          </G>
        </>
      );
    }
    if (key.includes('yemek') || key.includes('food')) {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t3)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M14 10v14c0 4 3 6 6 6s6-2 6-6V10M20 10v44" />
            <Path d="M46 54V10c-8 4-10 12-10 20h10" />
          </G>
        </>
      );
    }
    if (key.includes('language') || key.includes('dil')) {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t6)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M14 18h36a4 4 0 014 4v16a4 4 0 01-4 4H30l-10 8v-8h-6a4 4 0 01-4-4V22a4 4 0 014-4z" />
            <Path d="M20 26h24M20 34h16" />
          </G>
        </>
      );
    }
    if (key.includes('edebiyat') || key === 'literature') {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t0)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M32 20c-6-5-14-6-22-5v34c8-1 16 0 22 5 6-5 14-6 22-5V15c-8-1-16 0-22 5zM32 20v34" />
          </G>
        </>
      );
    }
    if (key.includes('uzay') || key === 'space_astronomy') {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t6)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M32 8c10 8 12 20 10 32H22C20 28 22 16 32 8z" />
            <Path d="M22 40l-8 8 2 6 8-4M42 40l8 8-2 6-8-4M28 48c0 5 2 7 4 9 2-2 4-4 4-9" />
          </G>
          <Circle cx="32" cy="26" r="4" fill="#fff" />
        </>
      );
    }
    if (key.includes('hayvanlar') || key.includes('animals')) {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t7)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <Path
            d="M32 33c-8 0-14 6-12 12 2 5 8 4 12 4s10 1 12-4c2-6-4-12-12-12z"
            fill="#fff"
          />
          <Circle cx="15" cy="28" r="5.5" fill="#fff" />
          <Circle cx="25" cy="16" r="5.5" fill="#fff" />
          <Circle cx="39" cy="16" r="5.5" fill="#fff" />
          <Circle cx="49" cy="28" r="5.5" fill="#fff" />
        </>
      );
    }
    if (key.includes('matematik') || key === 'mathematics') {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t5)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 20h16M23 12v16M37 20h16M37 41l16 14M53 41L37 55M15 48h16" />
          </G>
          <Circle cx="23" cy="41" r="2.5" fill="#fff" />
          <Circle cx="23" cy="55" r="2.5" fill="#fff" />
        </>
      );
    }
    if (key.includes('oyun') || key === 'logic_puzzles') {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t2)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M14 22h36c5 0 8 5 8 12v6c0 6-6 8-10 4l-4-6H20l-4 6c-4 4-10 2-10-4v-6c0-7 3-12 8-12z" />
            <Path d="M20 28v8M16 32h8" />
          </G>
          <Circle cx="42" cy="30" r="2.8" fill="#fff" />
          <Circle cx="48" cy="35" r="2.8" fill="#fff" />
        </>
      );
    }
    if (key.includes('gaming') || key.includes('video_oyunlari')) {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t2)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M14 24h36c5 0 8 5 8 12v4c0 6-6 8-10 4l-4-5H20l-4 5c-4 4-10 2-10-4v-4c0-7 3-12 8-12z" />
            <Path d="M21 29v8M17 33h8" />
          </G>
          <Circle cx="41" cy="31" r="2.5" fill="#fff" />
          <Circle cx="47" cy="36" r="2.5" fill="#fff" />
        </>
      );
    }
    if (key.includes('anime') || key.includes('manga')) {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t5)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M32 10L36 24L50 28L36 32L32 46L28 32L14 28L28 24Z" />
            <Circle cx="46" cy="44" r="4" />
            <Circle cx="18" cy="44" r="4" />
          </G>
        </>
      );
    }
    if (key.includes('cartoons') || key.includes('cizgi_film') || key.includes('animasyon')) {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t7)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
            <Circle cx="32" cy="34" r="16" />
            <Circle cx="20" cy="18" r="9" />
            <Circle cx="44" cy="18" r="9" />
          </G>
          <Circle cx="27" cy="32" r="2.5" fill="#fff" />
          <Circle cx="37" cy="32" r="2.5" fill="#fff" />
          <Path d="M28 42q4 4 8 0" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
        </>
      );
    }
    if (key.includes('comics') || key.includes('superhero') || key.includes('cizgi_roman')) {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t1)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M32 10l18 8v16c0 12-18 20-18 20S14 46 14 34V18z" />
            <Path d="M26 28l6-6 6 6M32 22v18" />
          </G>
        </>
      );
    }
    if (key.includes('fantasy') || key.includes('fantastik')) {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t2)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M20 48L44 14M44 14l-2 10M44 14l-10-2" />
            <Path d="M14 42l8 8M18 38l4 4" />
          </G>
          <Circle cx="38" cy="38" r="3" fill="#fff" />
          <Circle cx="26" cy="22" r="2" fill="#fff" />
        </>
      );
    }
    if (key.includes('social') || key.includes('sosyal')) {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t6)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
            <Circle cx="32" cy="18" r="6" />
            <Circle cx="18" cy="42" r="6" />
            <Circle cx="46" cy="42" r="6" />
            <Path d="M22 37l6-14M42 37l-6-14" />
          </G>
        </>
      );
    }
    if (key.includes('mythology') || key.includes('mitoloji')) {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t7)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M36 10L22 32h10l-4 22 18-28H36z" />
          </G>
        </>
      );
    }
    if (key.includes('hobbies') || key.includes('hobi')) {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t4)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
            <Circle cx="32" cy="32" r="20" />
            <Path d="M32 18l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" />
          </G>
        </>
      );
    }
    if (key.includes('daily_life') || key.includes('toplum') || key.includes('gunluk')) {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t0)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
            <Circle cx="32" cy="20" r="7" />
            <Path d="M18 48c0-8 6-13 14-13s14 5 14 13" />
          </G>
        </>
      );
    }
    if (key.includes('turkey') || key.includes('turkiye')) {
      return (
        <>
          <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t3)" />
          <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
          <G fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M30 18a14 14 0 100 28 10 10 0 110-28z" />
            <Path d="M42 32l4 1.5-2.5 3.5 1 4.5-4-2-4 2 1-4.5-2.5-3.5 4-1.5z" fill="#fff" />
          </G>
        </>
      );
    }
    // Default: Genel Kültür
    return (
      <>
        <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t0)" />
        <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
        <G fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M32 8a16 16 0 00-8 30v6h16v-6A16 16 0 0032 8z" />
          <Path d="M26 50h12M28 56h8" />
        </G>
      </>
    );
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <SharedSvgDefs />
      {renderGlyph()}
    </Svg>
  );
};
// ============================================================================
// 4. MODE & TOOL SQUIRCLE ICONS (8 Icons from page03 & page28)
// ============================================================================
export const ModeSquircleIcon: React.FC<{
  mode:
    | 'custom_room'
    | 'single_player'
    | 'daily'
    | 'friends'
    | 'question'
    | 'timer'
    | 'notification'
    | 'settings';
  size?: number;
}> = ({ mode, size = 44 }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <SharedSvgDefs />
    {mode === 'custom_room' && (
      <>
        <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t1)" />
        <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
        <Path
          d="M22 28V20a10 10 0 0120 0v8"
          stroke="#fff"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Rect x="15" y="28" width="34" height="26" rx="7" fill="#fff" />
        <Circle cx="32" cy="38" r="3.2" fill="#1565C0" />
        <Path d="M30.5 40l-1.5 7h6l-1.5-7z" fill="#1565C0" />
      </>
    )}
    {mode === 'single_player' && (
      <>
        <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t5)" />
        <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
        <Circle cx="32" cy="23" r="9" fill="#fff" />
        <Path
          d="M16 49c0-8.8 7.2-14 16-14s16 5.2 16 14"
          stroke="#fff"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="#fff"
          opacity="0.95"
        />
      </>
    )}
    {mode === 'daily' && (
      <>
        <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t4)" />
        <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
        <G fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <Rect x="10" y="14" width="44" height="40" rx="8" />
          <Path d="M10 26h44M22 8v10M42 8v10M24 40l6 6 11-12" />
        </G>
      </>
    )}
    {mode === 'friends' && (
      <>
        <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t0)" />
        <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
        <G fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="24" cy="22" r="8" />
          <Path d="M8 52c0-9 7-14 16-14s16 5 16 14" />
          <Circle cx="44" cy="24" r="6" />
          <Path d="M44 38c7 0 12 4 12 12" />
        </G>
      </>
    )}
    {mode === 'question' && (
      <>
        <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t3)" />
        <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
        <SvgText
          x="32"
          y="45"
          textAnchor="middle"
          fontWeight="900"
          fontSize="38"
          fill="#fff"
        >
          ?
        </SvgText>
      </>
    )}
    {mode === 'timer' && (
      <>
        <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t6)" />
        <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
        <G fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="32" cy="32" r="21" />
          <Path d="M32 19v14l9 5" />
        </G>
      </>
    )}
    {mode === 'notification' && (
      <>
        <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t5)" />
        <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
        <G fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M32 10c-9 0-14 7-14 16v10l-6 8h40l-6-8V26c0-9-5-16-14-16zM26 52a6 6 0 0012 0" />
        </G>
      </>
    )}
    {mode === 'settings' && (
      <>
        <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#t7)" />
        <Path d="M3 21a18 18 0 0118-18h22a18 18 0 0118 18v8H3z" fill="#fff" opacity="0.12" />
        <G fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="32" cy="32" r="9" />
          <Path d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M15 49l6-6M43 21l6-6" />
        </G>
      </>
    )}
  </Svg>
);
// ============================================================================
// 5. BOTTOM NAV & HUD ICONS
// ============================================================================
export const BellLineIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 20,
  color = '#fff',
}) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <G fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M32 10c-9 0-14 7-14 16v10l-6 8h40l-6-8V26c0-9-5-16-14-16zM26 52a6 6 0 0012 0" />
    </G>
  </Svg>
);
export const CheckMarkSvg: React.FC<{ size?: number; color?: string }> = ({
  size = 22,
  color = '#fff',
}) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Path
      d="M16 33l11 11 21-22"
      fill="none"
      stroke={color}
      strokeWidth="7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export const CrossMarkSvg: React.FC<{ size?: number; color?: string }> = ({
  size = 22,
  color = '#fff',
}) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Path
      d="M20 20l24 24M44 20L20 44"
      fill="none"
      stroke={color}
      strokeWidth="7"
      strokeLinecap="round"
    />
  </Svg>
);
export const EyeOpenIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 22,
  color = '#D9CDF5',
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle
      cx="12"
      cy="12"
      r="3.2"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
    />
  </Svg>
);
export const EyeOffIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 22,
  color = '#8E7EB8',
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M17.94 17.94A10.07 10.07 0 0112 19c-7 0-11-7-11-7a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 7 11 7a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
// ============================================================================
// TRANSPARENT VECTOR TAVRIKO BRAND LOGO (No Square Box!)
// ============================================================================
export const TavrikoHeroLogo: React.FC<{
  width?: number;
  height?: number;
}> = ({ width = 230, height = 135 }) => (
  <Image
    source={BRAND_LOGO_MAIN}
    style={{ width, height }}
    resizeMode="contain"
    accessibilityLabel="Tavriko"
  />
);
export const TavrikoBadgeBanner: React.FC<{
  scale?: number;
}> = ({ scale = 1 }) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8 * scale,
      paddingHorizontal: 16 * scale,
      paddingVertical: 7 * scale,
      borderRadius: 20 * scale,
      backgroundColor: 'rgba(67, 40, 168, 0.55)',
      borderWidth: 1.5,
      borderColor: 'rgba(130, 196, 255, 0.38)',
    }}
  >
    <CrownIcon size={22 * scale} />
    <Text
      style={{
        fontFamily: THEME.fonts.display,
        fontSize: 22 * scale,
        color: '#FFFFFF',
        letterSpacing: 0.6,
      }}
    >
      Tavriko
    </Text>
  </View>
);
export const NavIcon: React.FC<{
  tab: 'play' | 'explore' | 'leaders' | 'friends' | 'profile' | 'shop' | 'leagues' | 'events' | 'inventory';
  active?: boolean;
  size?: number;
}> = ({ tab, active = false, size = 24 }) => {
  const color = active ? '#ffc43d' : '#d9cdf5';
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {tab === 'play' && (
        <Path
          d="M22 12l30 20-30 20z"
          fill={color}
          stroke={color}
          strokeWidth="6"
          strokeLinejoin="round"
        />
      )}
      {tab === 'explore' && (
        <>
          <Circle
            cx="32"
            cy="32"
            r="22"
            fill="none"
            stroke={color}
            strokeWidth="5"
          />
          <Path d="M43 21l-6 16-16 6 6-16z" fill={color} />
        </>
      )}
      {(tab === 'leaders' || tab === 'leagues') && (
        <G fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M20 10h24v14a12 12 0 01-24 0z" />
          <Path d="M20 14h-8v4a8 8 0 008 8M44 14h8v4a8 8 0 01-8 8M32 36v10M22 54h20" />
        </G>
      )}
      {tab === 'friends' && (
        <G fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="24" cy="22" r="8" />
          <Path d="M8 52c0-9 7-14 16-14s16 5 16 14" />
          <Circle cx="44" cy="24" r="6" />
          <Path d="M44 38c7 0 12 4 12 12" />
        </G>
      )}
      {tab === 'profile' && (
        <G fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="32" cy="22" r="10" />
          <Path d="M12 54c0-11 9-16 20-16s20 5 20 16" />
        </G>
      )}
      {tab === 'shop' && (
        <G fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 24h40l-4 28H16z" />
          <Path d="M22 24v-6a10 10 0 0120 0v6" />
        </G>
      )}
      {tab === 'events' && (
        <G fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <Rect x="10" y="14" width="44" height="40" rx="8" />
          <Path d="M10 26h44M22 8v10M42 8v10" />
        </G>
      )}
      {tab === 'inventory' && (
        <G fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M32 8l22 11v26L32 56 10 45V19z" />
          <Path d="M10 19l22 11 22-11M32 30v26" />
        </G>
      )}
    </Svg>
  );
};
// ============================================================================
// 6. REUSABLE UI PRIMITIVES FROM TAVRIKO UI KIT
// ============================================================================
export const TavrikoScreen: React.FC<{
  children: React.ReactNode;
  style?: ViewStyle;
}> = ({ children, style }) => {
  // Kuşanılmış profil arka planı: süresi dolmamışsa tüm uygulamanın arka planını değiştirir.
  const storeUser = useGameStore((s) => s.user);
  const equippedBg = storeUser?.equippedBackground;
  const bgExpires = storeUser?.equippedBackgroundExpiresAt;
  const activeBg =
    equippedBg && (!bgExpires || bgExpires > Date.now()) ? equippedBg : null;
  const bgIsImage = activeBg ? !!backgroundFor(activeBg) : false;
  return (
    <View style={[styles.screenRoot, style]}>
      {/* Kuşanılmış arka plan: uygulama geneli */}
      {activeBg && (
        <View style={styles.equippedBgLayer} pointerEvents="none">
          {bgIsImage ? (
            <Image
              source={backgroundFor(activeBg)!}
              style={styles.equippedBgImage}
              resizeMode="cover"
            />
          ) : (
            <BackgroundScene bgId={activeBg} width="100%" height="100%" />
          )}
          {/* Okunabilirlik için hafif karartma */}
          <View style={styles.equippedBgDim} pointerEvents="none" />
        </View>
      )}
      {/* Radial Top Purple Glow */}
      <View style={styles.topRadialGlow} pointerEvents="none" />
      {/* Bottom Magenta/Cyan Ambient Glows */}
      <View style={styles.bottomGlowOrb} pointerEvents="none" />
      <View style={styles.sideCyanOrb} pointerEvents="none" />
      {/* Subtle Diagonal Stripes */}
      <View style={styles.stripe1} pointerEvents="none" />
      <View style={styles.stripe2} pointerEvents="none" />
      <View style={styles.stripe3} pointerEvents="none" />
      {children}
    </View>
  );
};
export const BackChevronIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 20,
  color = '#FFFFFF',
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15 18L9 12L15 6"
      stroke={color}
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const CloseXIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 18,
  color = '#FFFFFF',
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 6L6 18M6 6L18 18"
      stroke={color}
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const TavrikoTopBar: React.FC<{
  leftType?: 'bell' | 'back' | 'close' | 'none';
  onLeftPress?: () => void;
  coins?: number;
  gems?: number;
  avatarSeed?: string;
  onAvatarPress?: () => void;
  onCurrencyPress?: () => void;
  isGuest?: boolean;
  onGuestLoginPress?: () => void;
}> = ({
  leftType = 'bell',
  onLeftPress,
  coins,
  gems,
  avatarSeed,
  onAvatarPress,
  onCurrencyPress,
  isGuest = false,
  onGuestLoginPress,
}) => {
  const storeUser = useGameStore((s) => s.user);
  const unread = useUnreadCount();
  const displayCoins = coins !== undefined && coins !== null ? coins : storeUser?.coins ?? 0;
  const displayGems = gems !== undefined && gems !== null ? gems : storeUser?.gems ?? 0;
  const displayAvatar = avatarSeed || storeUser?.avatarUrl || storeUser?.displayName || 'av1';

  if (isGuest) {
    return (
      <View style={styles.topBarRow}>
        {leftType === 'back' || leftType === 'close' ? (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              sound.playSound('tap');
              sound.triggerHaptic('light');
              if (onLeftPress) onLeftPress();
            }}
            activeOpacity={0.8}
          >
            {leftType === 'back' ? (
              <BackChevronIcon size={22} color="#FFFFFF" />
            ) : (
              <CloseXIcon size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.guestBadgePill}>
            <Text style={styles.guestBadgeText}>MİSAFİR MODU</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.guestLoginCtaBtn}
          onPress={() => {
            sound.playSound('reward');
            sound.triggerHaptic('medium');
            if (onGuestLoginPress) onGuestLoginPress();
            else if (onAvatarPress) onAvatarPress();
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.guestLoginCtaText}>GİRİŞ YAP / KAYIT OL</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={styles.topBarRow}>
      {leftType !== 'none' ? (
        <TouchableOpacity
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={leftType === 'bell' ? `Bildirimler, ${unread} okunmamış` : leftType === 'back' ? 'Geri' : 'Kapat'}
          onPress={() => {
            sound.playSound('tap');
            sound.triggerHaptic('light');
            if (onLeftPress) onLeftPress();
          }}
          activeOpacity={0.8}
        >
          {leftType === 'bell' && <NotificationBell />}
          {leftType === 'back' && <BackChevronIcon size={22} color="#FFFFFF" />}
          {leftType === 'close' && <CloseXIcon size={18} color="#FFFFFF" />}
        </TouchableOpacity>
      ) : (
        <View style={{ width: 44 }} />
      )}
      <TouchableOpacity
        style={styles.currencyPill}
        onPress={() => {
          if (onCurrencyPress) {
            sound.playSound('reward');
            sound.triggerHaptic('light');
            onCurrencyPress();
          }
        }}
        activeOpacity={onCurrencyPress ? 0.8 : 1}
      >
        <CoinIcon size={20} />
        <Text style={styles.currencyText}>{displayCoins}</Text>
        <View style={{ width: 6 }} />
        <GemIcon size={20} />
        <Text style={styles.currencyText}>{displayGems}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          if (onAvatarPress) {
            sound.playSound('tap');
            sound.triggerHaptic('light');
            onAvatarPress();
          }
        }}
        activeOpacity={0.85}
        style={styles.avatarCircleWrap}
      >
        <CharacterAvatar seed={displayAvatar} size={40} />
      </TouchableOpacity>
    </View>
  );
};
export const Button3D: React.FC<{
  title: string;
  variant?: 'gold' | 'mint' | 'red' | 'glass' | 'purple';
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}> = ({ title, variant = 'gold', onPress, disabled, style, textStyle }) => {
  const variantContainer =
    variant === 'mint'
      ? styles.btn3DMint
      : variant === 'red'
      ? styles.btn3DRed
      : variant === 'glass'
      ? styles.btn3DGlass
      : variant === 'purple'
      ? styles.btn3DPurple
      : styles.btn3DGold;
  const variantText =
    variant === 'mint'
      ? styles.btn3DTextMint
      : variant === 'red' || variant === 'glass' || variant === 'purple'
      ? styles.btn3DTextWhite
      : styles.btn3DTextGold;
  return (
    <TouchableOpacity
      onPress={() => {
        sound.playSound('tap');
        sound.triggerHaptic('medium');
        if (onPress) onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: Boolean(disabled) }}
      activeOpacity={0.85}
      style={[
        styles.btn3DBase,
        variantContainer,
        disabled && { opacity: 0.55 },
        style,
      ]}
    >
      <Text style={[styles.btn3DTextBase, variantText, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
};
export const TavrikoProgressBar: React.FC<{
  progress: number; // 0 to 100
  height?: number;
  style?: ViewStyle;
}> = ({ progress, height = 10, style }) => {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <View style={[styles.barTrack, { height, borderRadius: height / 2 }, style]}>
      <View
        style={[
          styles.barFill,
          { width: `${clamped}%`, borderRadius: height / 2 },
        ]}
      />
    </View>
  );
};
export type MainNavTab = 'play' | 'explore' | 'leaders' | 'friends' | 'profile';
export type SecondaryNavTab = 'shop' | 'leagues' | 'play' | 'events' | 'inventory';
type NavItemDef<K extends string> = { key: K; label: string };

/** Ortak alt menü: sabit aktif kapsül (animasyonsuz) + isteğe bağlı yükseltilmiş orta "Oyna" butonu */
const NavBarBase = <K extends string>({
  items,
  activeKey,
  onSelect,
  raisedKey,
}: {
  items: NavItemDef<K>[];
  activeKey: K;
  onSelect: (k: K) => void;
  raisedKey?: K;
}) => {
  const [w, setW] = useState(0);
  const slot = w > 0 ? (w - 12) / items.length : 0;
  const idx = items.findIndex((i) => i.key === activeKey);
  const showPill = idx >= 0 && items[idx].key !== raisedKey;
  return (
    <View style={styles.bottomNav} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <View style={styles.navSheen} pointerEvents="none" />
      {w > 0 && showPill && (
        <View
          style={[styles.navPill, { width: slot - 8, left: 10 + idx * slot }]}
          pointerEvents="none"
        >
          <GradientFill direction="vertical" colors={['#7C4DFF', '#5A2BD8']} />
          <View style={styles.navPillDot} />
        </View>
      )}
      {items.map((item) => {
        const isActive = activeKey === item.key;
        const press = () => {
          sound.playSound('nav');
          sound.triggerHaptic('light');
          onSelect(item.key);
        };
        if (item.key === raisedKey) {
          return (
            <TouchableOpacity key={item.key} style={styles.navItem} onPress={press} activeOpacity={0.85}>
              <View style={styles.navRaised}>
                <GradientFill direction="vertical" colors={['#FFD970', '#FFB21E']} />
                <View style={styles.navRaisedIcon}>
                  <Svg width={22} height={22} viewBox="0 0 64 64">
                    <Path d="M22 12l30 20-30 20z" fill="#2A1200" stroke="#2A1200" strokeWidth="6" strokeLinejoin="round" />
                  </Svg>
                </View>
              </View>
              <Text style={[styles.navLabel, styles.navLabelRaised]} numberOfLines={1}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity key={item.key} style={styles.navItem} onPress={press} activeOpacity={0.8}>
            <NavIcon tab={item.key as any} active={isActive} size={22} />
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]} numberOfLines={1}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export const TavrikoBottomNav: React.FC<{
  activeTab: MainNavTab;
  onSelectTab: (tab: MainNavTab) => void;
}> = ({ activeTab, onSelectTab }) => (
  <NavBarBase<MainNavTab>
    items={[
      { key: 'play', label: 'Oyna' },
      { key: 'explore', label: 'Keşfet' },
      { key: 'leaders', label: 'Liderler' },
      { key: 'friends', label: 'Arkadaşlar' },
      { key: 'profile', label: 'Profil' },
    ]}
    activeKey={activeTab}
    onSelect={onSelectTab}
  />
);

export const TavrikoSecondaryBottomNav: React.FC<{
  activeTab: SecondaryNavTab;
  onSelectTab: (tab: SecondaryNavTab) => void;
}> = ({ activeTab, onSelectTab }) => (
  <NavBarBase<SecondaryNavTab>
    items={[
      { key: 'shop', label: 'Mağaza' },
      { key: 'leagues', label: 'Ligler' },
      { key: 'play', label: 'Oyna' },
      { key: 'events', label: 'Etkinlik' },
      { key: 'inventory', label: 'Envanter' },
    ]}
    activeKey={activeTab}
    onSelect={onSelectTab}
    raisedKey="play"
  />
);
const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#1B0C38',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 26,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  equippedBgLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  equippedBgImage: {
    width: '100%',
    height: '100%',
  },
  equippedBgDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 4, 24, 0.55)',
  },
  topRadialGlow: {
    position: 'absolute',
    top: -120,
    left: -40,
    right: -40,
    height: 360,
    borderRadius: 220,
    backgroundColor: '#5b2cc4',
    opacity: 0.45,
  },
  bottomGlowOrb: {
    position: 'absolute',
    bottom: -140,
    right: -60,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#9A27D8',
    opacity: 0.24,
  },
  sideCyanOrb: {
    position: 'absolute',
    top: 240,
    left: -100,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#247FE0',
    opacity: 0.18,
  },
  stripe1: {
    position: 'absolute',
    top: -100,
    left: -120,
    width: 600,
    height: 28,
    backgroundColor: 'rgba(0,0,0,0.12)',
    transform: [{ rotate: '-25deg' }],
  },
  stripe2: {
    position: 'absolute',
    top: 160,
    left: -120,
    width: 650,
    height: 28,
    backgroundColor: 'rgba(0,0,0,0.12)',
    transform: [{ rotate: '-25deg' }],
  },
  stripe3: {
    position: 'absolute',
    top: 440,
    left: -120,
    width: 650,
    height: 28,
    backgroundColor: 'rgba(0,0,0,0.12)',
    transform: [{ rotate: '-25deg' }],
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: 'rgba(24, 11, 52, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 5,
      },
      android: {
        elevation: 4,
      },
      web: {
        cursor: 'pointer',
        boxShadow: '0 3px 10px rgba(0,0,0,0.3)',
      },
    }),
  },
  iconButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: THEME.fonts.extraBold,
  },
  currencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  currencyText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  avatarCircleWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  guestBadgePill: {
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  guestBadgeText: {
    color: '#FFC43D',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.4,
  },
  guestLoginCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFB21E',
    borderBottomWidth: 3,
    borderBottomColor: '#B8560A',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  guestLoginCtaText: {
    color: '#3B1500',
    fontSize: 11,
    fontFamily: THEME.fonts.display,
  },
  btn3DBase: {
    minHeight: 50,
    borderRadius: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
  },
  btn3DGold: {
    backgroundColor: '#FFB21E',
    borderBottomColor: '#B8560A',
    borderTopWidth: 1,
    borderTopColor: '#FFE27A',
  },
  btn3DMint: {
    backgroundColor: '#5ADBB5',
    borderBottomColor: '#1D7A6B',
    borderTopWidth: 1,
    borderTopColor: '#8FF0CF',
  },
  btn3DRed: {
    backgroundColor: '#E83850',
    borderBottomColor: '#7A0A1C',
    borderTopWidth: 1,
    borderTopColor: '#FF7A8A',
  },
  btn3DPurple: {
    backgroundColor: '#6B3CFF',
    borderBottomColor: '#4319B8',
    borderTopWidth: 1,
    borderTopColor: '#9D7DFF',
  },
  btn3DGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255, 255, 255, 0.22)',
  },
  btn3DTextBase: {
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    letterSpacing: 0.5,
  },
  btn3DTextGold: {
    color: '#3B1500',
  },
  btn3DTextMint: {
    color: '#0C3A33',
  },
  btn3DTextWhite: {
    color: '#FFFFFF',
  },
  barTrack: {
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#FF9B2F',
  },
  bottomNav: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    height: 66,
    borderRadius: 24,
    paddingHorizontal: 6,
    backgroundColor: '#130933',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0 10px 30px rgba(0,0,0,0.45)' } as any,
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.45,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
      },
    }),
  },
  navSheen: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  navPill: {
    position: 'absolute',
    left: 10,
    top: 7,
    bottom: 7,
    borderRadius: 17,
    overflow: 'hidden',
    alignItems: 'center',
  },
  navPillDot: {
    position: 'absolute',
    bottom: 4,
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FFC837',
  },
  navItem: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 2,
  },
  navRaised: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginTop: -30,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#1A0B3B',
  },
  navRaisedIcon: {
    position: 'relative',
    zIndex: 2,
    paddingLeft: 3,
  },
  navLabel: {
    fontSize: 10.5,
    fontFamily: THEME.fonts.extraBold,
    color: 'rgba(217, 205, 245, 0.7)',
  },
  navLabelActive: {
    color: '#FFFFFF',
  },
  navLabelRaised: {
    color: '#FFC837',
  },
});
