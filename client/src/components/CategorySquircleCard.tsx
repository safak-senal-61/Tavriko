import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Path,
  Circle,
  G,
} from 'react-native-svg';

export interface CategoryData {
  id: string;
  name: string;
  type: 'general' | 'special';
  primaryColor: string;
  secondaryColor: string;
  accentShadow: string;
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

export const GENERAL_CATEGORIES: CategoryData[] = [
  {
    id: 'science_tech',
    name: 'Bilim & Teknoloji',
    type: 'general',
    primaryColor: '#8CD47E',
    secondaryColor: '#5EBA50',
    accentShadow: 'rgba(94, 186, 80, 0.45)',
    iconName: 'science',
  },
  {
    id: 'history',
    name: 'Tarih',
    type: 'general',
    primaryColor: '#F7C244',
    secondaryColor: '#E6A820',
    accentShadow: 'rgba(230, 168, 32, 0.45)',
    iconName: 'history',
  },
  {
    id: 'art_culture',
    name: 'Sanat & Kültür',
    type: 'general',
    primaryColor: '#FF6433',
    secondaryColor: '#E24515',
    accentShadow: 'rgba(226, 69, 21, 0.5)',
    iconName: 'art',
  },
  {
    id: 'geography',
    name: 'Coğrafya',
    type: 'general',
    primaryColor: '#5EB6EA',
    secondaryColor: '#369BD4',
    accentShadow: 'rgba(54, 155, 212, 0.45)',
    iconName: 'geography',
  },
  {
    id: 'sports',
    name: 'Spor',
    type: 'general',
    primaryColor: '#FFA339',
    secondaryColor: '#E88214',
    accentShadow: 'rgba(232, 130, 20, 0.45)',
    iconName: 'sports',
  },
  {
    id: 'cinema_tv',
    name: 'Sinema & Dizi',
    type: 'general',
    primaryColor: '#FF5E79',
    secondaryColor: '#E03653',
    accentShadow: 'rgba(224, 54, 83, 0.45)',
    iconName: 'cinema',
  },
  {
    id: 'music',
    name: 'Müzik',
    type: 'general',
    primaryColor: '#D864FF',
    secondaryColor: '#B036DE',
    accentShadow: 'rgba(176, 54, 222, 0.45)',
    iconName: 'music',
  },
  {
    id: 'literature',
    name: 'Edebiyat',
    type: 'general',
    primaryColor: '#5C7CFA',
    secondaryColor: '#3B5BDB',
    accentShadow: 'rgba(59, 91, 219, 0.45)',
    iconName: 'literature',
  },
];

export const SPECIAL_CATEGORIES: CategoryData[] = [
  {
    id: 'yesilcam',
    name: 'Yeşilçam Klasikleri',
    type: 'special',
    primaryColor: '#FF6B6B',
    secondaryColor: '#C92A2A',
    accentShadow: 'rgba(201, 42, 42, 0.45)',
    iconName: 'cinema',
  },
  {
    id: 'turkish_pop_90s',
    name: "90'lar Türkçe Pop",
    type: 'special',
    primaryColor: '#F06595',
    secondaryColor: '#A61E4D',
    accentShadow: 'rgba(166, 30, 77, 0.45)',
    iconName: 'music',
  },
  {
    id: 'ottoman_history',
    name: 'Osmanlı Tarihi',
    type: 'special',
    primaryColor: '#FCC419',
    secondaryColor: '#D97706',
    accentShadow: 'rgba(217, 119, 6, 0.45)',
    iconName: 'history',
  },
  {
    id: 'super_lig_legends',
    name: 'Süper Lig Efsaneleri',
    type: 'special',
    primaryColor: '#51CF66',
    secondaryColor: '#2B8A3E',
    accentShadow: 'rgba(43, 138, 62, 0.45)',
    iconName: 'sports',
  },
  {
    id: 'world_capitals',
    name: 'Dünya Başkentleri',
    type: 'special',
    primaryColor: '#339AF0',
    secondaryColor: '#1864AB',
    accentShadow: 'rgba(24, 100, 171, 0.45)',
    iconName: 'geography',
  },
  {
    id: 'space_astronomy',
    name: 'Uzay & Evren',
    type: 'special',
    primaryColor: '#845EF7',
    secondaryColor: '#5F3DC4',
    accentShadow: 'rgba(95, 61, 196, 0.45)',
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
      // Erlenmayer matarası / Flask
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
          <Circle cx="10" cy="17.5" r="1" fill={color} opacity={0.9} />
          <Circle cx="14" cy="16.5" r="0.75" fill={color} opacity={0.7} />
        </Svg>
      );

    case 'history':
      // Parthenon / Antik Sütunlu Tapınak
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
      // Açılı Boya Fırçası (TRT Görselindeki gibi)
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
          <Path
            d="M16 5L20 9"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'geography':
      // Dünya Küresi (Globe)
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
      // Futbol / Spor Topu
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
      // Müzik Notaları
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
      // Klaket (Film Clapper)
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
      // Kitap
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
      // Karışık / Shuffle
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
  size = 88,
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
          shadowColor: category.accentShadow,
        },
        isSelected && styles.containerSelected,
      ]}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Ana renk dolgusu */}
          <LinearGradient
            id={`grad_${category.id}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <Stop offset="0" stopColor={category.primaryColor} />
            <Stop offset="1" stopColor={category.secondaryColor} />
          </LinearGradient>

          {/* 3D Üst Parlama (Glossy Highlight) */}
          <LinearGradient id="squircleGloss" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.45" />
            <Stop offset="0.4" stopColor="#FFFFFF" stopOpacity="0.12" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Ana Squircle Gövde */}
        <Rect
          x="1"
          y="1"
          width={size - 2}
          height={size - 2}
          rx={cornerRadius}
          ry={cornerRadius}
          fill={`url(#grad_${category.id})`}
          stroke="#FFFFFF"
          strokeWidth={isSelected ? 3.5 : 1.2}
          strokeOpacity={isSelected ? 0.95 : 0.35}
        />

        {/* 3D Üst Parlama Katmanı */}
        <Rect
          x="3"
          y="3"
          width={size - 6}
          height={(size - 6) * 0.52}
          rx={cornerRadius * 0.82}
          ry={cornerRadius * 0.82}
          fill="url(#squircleGloss)"
        />
      </Svg>

      {/* Merkezdeki Vektörel İkon */}
      <View style={styles.iconCenter}>
        <CategorySquircleIcon
          name={category.iconName}
          size={size * 0.52}
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
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.38,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
      web: {
        filter: 'drop-shadow(0px 8px 14px rgba(0,0,0,0.22))',
      },
    }),
  },
  containerSelected: {
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.55,
        shadowRadius: 16,
      },
      android: {
        elevation: 14,
      },
      web: {
        filter: 'drop-shadow(0px 12px 20px rgba(0,0,0,0.35))',
      },
    }),
  },
  iconCenter: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
