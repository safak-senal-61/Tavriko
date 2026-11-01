import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Path,
  Circle,
} from 'react-native-svg';

export interface CategoryData {
  id: string;
  name: string;
  type: 'general' | 'special';
  badge: string;
  primaryColor: string;
  secondaryColor: string;
  neonBorder: string;
  accentGlow: string;
  iconName:
    | 'science'
    | 'history'
    | 'art'
    | 'geography'
    | 'sports'
    | 'music'
    | 'cinema'
    | 'literature'
    | 'general'
    | 'shuffle';
}

// Tavriko Özgün Cyber-Arcade Renk Paleti (TRT kopyası değil, özgün Tavriko Kimliği)
export const GENERAL_CATEGORIES: CategoryData[] = [
  {
    id: 'science_tech',
    name: 'Bilim & Evren',
    type: 'general',
    badge: '🔬 BİLİM',
    primaryColor: '#00F0FF',
    secondaryColor: '#0072FF',
    neonBorder: '#00F0FF',
    accentGlow: 'rgba(0, 240, 255, 0.45)',
    iconName: 'science',
  },
  {
    id: 'history',
    name: 'Tarih & Medeniyet',
    type: 'general',
    badge: '🏛️ TARİH',
    primaryColor: '#FFE27A',
    secondaryColor: '#FF8800',
    neonBorder: '#FFC43D',
    accentGlow: 'rgba(255, 196, 61, 0.45)',
    iconName: 'history',
  },
  {
    id: 'art_culture',
    name: 'Sanat & Kültür',
    type: 'general',
    badge: '🎨 SANAT',
    primaryColor: '#FF6BC4',
    secondaryColor: '#B00078',
    neonBorder: '#FF6BC4',
    accentGlow: 'rgba(255, 107, 196, 0.45)',
    iconName: 'art',
  },
  {
    id: 'geography',
    name: 'Coğrafya & Dünya',
    type: 'general',
    badge: '🗺️ COĞRAFYA',
    primaryColor: '#5ADBB5',
    secondaryColor: '#0E7A6B',
    neonBorder: '#5ADBB5',
    accentGlow: 'rgba(90, 219, 181, 0.45)',
    iconName: 'geography',
  },
  {
    id: 'sports',
    name: 'Spor & Arena',
    type: 'general',
    badge: '⚽ SPOR',
    primaryColor: '#FF9B2F',
    secondaryColor: '#D0102E',
    neonBorder: '#FF9B2F',
    accentGlow: 'rgba(255, 155, 47, 0.45)',
    iconName: 'sports',
  },
  {
    id: 'cinema_tv',
    name: 'Sinema & Ekran',
    type: 'general',
    badge: '🎬 SİNEMA',
    primaryColor: '#FF416C',
    secondaryColor: '#8A0027',
    neonBorder: '#FF416C',
    accentGlow: 'rgba(255, 65, 108, 0.45)',
    iconName: 'cinema',
  },
  {
    id: 'music',
    name: 'Müzik & Melodi',
    type: 'general',
    badge: '🎵 MÜZİK',
    primaryColor: '#9A6BFF',
    secondaryColor: '#4A00E0',
    neonBorder: '#9A6BFF',
    accentGlow: 'rgba(154, 107, 255, 0.45)',
    iconName: 'music',
  },
  {
    id: 'literature',
    name: 'Edebiyat & Söz',
    type: 'general',
    badge: '📚 EDEBİYAT',
    primaryColor: '#4A9BFF',
    secondaryColor: '#1A237E',
    neonBorder: '#4A9BFF',
    accentGlow: 'rgba(74, 155, 255, 0.45)',
    iconName: 'literature',
  },
];

export const SPECIAL_CATEGORIES: CategoryData[] = [
  {
    id: 'yesilcam',
    name: 'Yeşilçam Efsaneleri',
    type: 'special',
    badge: '⭐ TEMATİK',
    primaryColor: '#FF6B6B',
    secondaryColor: '#C92A2A',
    neonBorder: '#FF6B6B',
    accentGlow: 'rgba(255, 107, 107, 0.45)',
    iconName: 'cinema',
  },
  {
    id: 'turkish_pop_90s',
    name: "90'lar Nostalji Pop",
    type: 'special',
    badge: '⭐ TEMATİK',
    primaryColor: '#F06595',
    secondaryColor: '#A61E4D',
    neonBorder: '#F06595',
    accentGlow: 'rgba(240, 101, 149, 0.45)',
    iconName: 'music',
  },
  {
    id: 'ottoman_history',
    name: 'Osmanlı & Hanedan',
    type: 'special',
    badge: '⭐ TEMATİK',
    primaryColor: '#FCC419',
    secondaryColor: '#D97706',
    neonBorder: '#FCC419',
    accentGlow: 'rgba(252, 196, 25, 0.45)',
    iconName: 'history',
  },
  {
    id: 'super_lig_legends',
    name: 'Süper Lig Derbileri',
    type: 'special',
    badge: '⭐ TEMATİK',
    primaryColor: '#51CF66',
    secondaryColor: '#1B6535',
    neonBorder: '#51CF66',
    accentGlow: 'rgba(81, 207, 102, 0.45)',
    iconName: 'sports',
  },
  {
    id: 'world_capitals',
    name: 'Dünya Başkentleri',
    type: 'special',
    badge: '⭐ TEMATİK',
    primaryColor: '#339AF0',
    secondaryColor: '#1864AB',
    neonBorder: '#339AF0',
    accentGlow: 'rgba(51, 154, 240, 0.45)',
    iconName: 'geography',
  },
  {
    id: 'space_astronomy',
    name: 'Kozmik Evren & Galaksi',
    type: 'special',
    badge: '⭐ TEMATİK',
    primaryColor: '#845EF7',
    secondaryColor: '#5F3DC4',
    neonBorder: '#845EF7',
    accentGlow: 'rgba(132, 94, 247, 0.45)',
    iconName: 'science',
  },
];

interface SquircleIconProps {
  name: CategoryData['iconName'];
  size?: number;
  color?: string;
}

export const CategorySquircleIcon: React.FC<SquircleIconProps> = ({
  name,
  size = 46,
  color = '#FFFFFF',
}) => {
  switch (name) {
    case 'science':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M9 3H15M10 3V8.5L5.2 17.2C4.5 18.5 5.4 20 7 20H17C18.6 20 19.5 18.5 18.8 17.2L14 8.5V3"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M7.5 15H16.5"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity={0.85}
          />
          <Circle cx="10" cy="17.5" r="1.2" fill={color} />
          <Circle cx="14" cy="16.5" r="0.9" fill={color} opacity={0.7} />
        </Svg>
      );

    case 'history':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3 21H21M4 18H20M5 7L12 3L19 7H5ZM7 18V9M11 18V9M13 18V9M17 18V9"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'art':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M17.5 3.5C18.9 2.1 21.1 2.1 22.5 3.5C23.9 4.9 23.9 7.1 22.5 8.5L13.8 17.2C13.2 17.8 12.4 18.1 11.5 18.1H8.5V15.1C8.5 14.2 8.8 13.4 9.4 12.8L17.5 3.5Z"
            fill={color}
          />
          <Path
            d="M8.5 18.1C6.5 18.1 5 19.6 5 21.6C5 22.1 5.4 22.5 5.9 22.5C7.9 22.5 9.4 21 9.4 19V18.1H8.5Z"
            fill={color}
            opacity={0.9}
          />
        </Svg>
      );

    case 'geography':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2.2" />
          <Path
            d="M3 12H21M12 3C14.5 6 16 9 16 12C16 15 14.5 18 12 21C9.5 18 8 15 8 12C8 9 9.5 6 12 3Z"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'sports':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2.2" />
          <Path
            d="M12 7.5L15 9.5L14 13H10L9 9.5L12 7.5ZM12 3V7.5M19 6L15 9.5M21 14L14 13M15 21L14 17M9 21L10 17M3 14L10 13M5 6L9 9.5"
            stroke={color}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'music':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="7.5" cy="16.5" r="3.5" fill={color} />
          <Circle cx="17.5" cy="13.5" r="3.5" fill={color} />
          <Path
            d="M11 16.5V6L21 3V13.5"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <Path d="M11 9L21 6" stroke={color} strokeWidth="2.2" />
        </Svg>
      );

    case 'cinema':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect
            x="3"
            y="5"
            width="18"
            height="15"
            rx="2.5"
            stroke={color}
            strokeWidth="2.2"
          />
          <Path d="M3 10H21" stroke={color} strokeWidth="2" />
          <Path d="M7 5L5 10M12 5L10 10M17 5L15 10" stroke={color} strokeWidth="1.8" />
        </Svg>
      );

    case 'literature':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 19.5C4 18.1 5.1 17 6.5 17H20M4 19.5C4 20.9 5.1 22 6.5 22H20V3H6.5C5.1 3 4 4.1 4 5.5V19.5Z"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M8 7H16M8 11H14" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        </Svg>
      );

    case 'shuffle':
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M16 3H21V8M4 20L21 3M21 16V21H16M15 15L21 21M4 4L9 9"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
  }
};

interface CategorySquircleCardProps {
  category: CategoryData;
  size?: number;
  isSelected?: boolean;
}

export const CategorySquircleCard: React.FC<CategorySquircleCardProps> = ({
  category,
  size = 90,
  isSelected = false,
}) => {
  const cornerRadius = size * 0.28;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          shadowColor: category.accentGlow,
        },
        isSelected && styles.containerSelected,
      ]}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Tavriko Cyber Jewel Gradient */}
          <LinearGradient
            id={`tavriko_grad_${category.id}`}
            x1="0"
            y1="0"
            x2="0.8"
            y2="1"
          >
            <Stop offset="0" stopColor={category.primaryColor} />
            <Stop offset="0.6" stopColor={category.secondaryColor} />
            <Stop offset="1" stopColor="#0E0522" />
          </LinearGradient>

          {/* Tavriko Neon Rim Lighting */}
          <LinearGradient
            id={`tavriko_rim_${category.id}`}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
            <Stop offset="0.5" stopColor={category.neonBorder} stopOpacity="0.95" />
            <Stop offset="1" stopColor={category.secondaryColor} stopOpacity="0.4" />
          </LinearGradient>

          {/* 3D Üst Cam Parlaması */}
          <LinearGradient id="tavrikoGloss" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
            <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.12" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Ana Tavriko Squircle Gövde */}
        <Rect
          x="1.5"
          y="1.5"
          width={size - 3}
          height={size - 3}
          rx={cornerRadius}
          ry={cornerRadius}
          fill={`url(#tavriko_grad_${category.id})`}
          stroke={`url(#tavriko_rim_${category.id})`}
          strokeWidth={isSelected ? 3.5 : 1.5}
        />

        {/* 3D Üst Cam Parlama Katmanı */}
        <Rect
          x="3.5"
          y="3.5"
          width={size - 7}
          height={(size - 7) * 0.48}
          rx={cornerRadius * 0.8}
          ry={cornerRadius * 0.8}
          fill="url(#tavrikoGloss)"
        />
      </Svg>

      {/* Merkezdeki Vektörel İkon */}
      <View style={styles.iconCenter}>
        <CategorySquircleIcon
          name={category.iconName}
          size={size * 0.48}
          color="#FFFFFF"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      web: {
        filter: 'drop-shadow(0px 6px 14px rgba(0,0,0,0.35))',
      },
    }),
  },
  containerSelected: {
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.75,
        shadowRadius: 20,
      },
      android: {
        elevation: 16,
      },
      web: {
        filter: 'drop-shadow(0px 10px 24px rgba(0, 240, 255, 0.55))',
      },
    }),
  },
  iconCenter: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
