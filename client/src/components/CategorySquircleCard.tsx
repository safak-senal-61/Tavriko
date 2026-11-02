import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { CategorySquircleIcon, TavrikoCategoryKey } from './TavrikoIcons';

export interface CategoryData {
  id: string;
  name: string;
  type: 'general' | 'special';
  badge: string;
  primaryColor: string;
  secondaryColor: string;
  neonBorder: string;
  accentGlow: string;
  iconName: TavrikoCategoryKey | string;
}

// Tavriko UI Kit - 16 Resmi Kategori
export const GENERAL_CATEGORIES: CategoryData[] = [
  {
    id: 'science_tech',
    name: 'Bilim & Evren',
    type: 'general',
    badge: '🧬 Genel Branş Soruları',
    primaryColor: '#00F0FF',
    secondaryColor: '#0072FF',
    neonBorder: '#00F0FF',
    accentGlow: 'rgba(0, 240, 255, 0.6)',
    iconName: 'bilim',
  },
  {
    id: 'history',
    name: 'Tarih & Medeniyet',
    type: 'general',
    badge: '🏛️ Medeniyet & Geçmiş',
    primaryColor: '#FFE27A',
    secondaryColor: '#FF8800',
    neonBorder: '#FFC43D',
    accentGlow: 'rgba(255, 196, 61, 0.6)',
    iconName: 'tarih',
  },
  {
    id: 'geography',
    name: 'Coğrafya & Dünya',
    type: 'general',
    badge: '🗺️ Kıtalar & Ülkeler',
    primaryColor: '#4A9BFF',
    secondaryColor: '#1F5FE0',
    neonBorder: '#4A9BFF',
    accentGlow: 'rgba(74, 155, 255, 0.6)',
    iconName: 'cografya',
  },
  {
    id: 'sports',
    name: 'Spor & Arena',
    type: 'general',
    badge: '🏀 Takımlar & Rekorlar',
    primaryColor: '#FF9B2F',
    secondaryColor: '#D0102E',
    neonBorder: '#FF9B2F',
    accentGlow: 'rgba(255, 155, 47, 0.6)',
    iconName: 'spor',
  },
  {
    id: 'cinema_tv',
    name: 'Sinema & Dizi',
    type: 'general',
    badge: '🎬 Filmler & Yıldızlar',
    primaryColor: '#FF416C',
    secondaryColor: '#8A0027',
    neonBorder: '#FF416C',
    accentGlow: 'rgba(255, 65, 108, 0.6)',
    iconName: 'sinema',
  },
  {
    id: 'music',
    name: 'Müzik & Sahne',
    type: 'general',
    badge: '🎵 Şarkılar & Sanatçılar',
    primaryColor: '#FF6BC4',
    secondaryColor: '#C01F80',
    neonBorder: '#FF6BC4',
    accentGlow: 'rgba(255, 107, 196, 0.6)',
    iconName: 'muzik',
  },
  {
    id: 'art_culture',
    name: 'Sanat & Kültür',
    type: 'general',
    badge: '🎨 Tablolar & Eserler',
    primaryColor: '#9A6BFF',
    secondaryColor: '#5A27C8',
    neonBorder: '#9A6BFF',
    accentGlow: 'rgba(154, 107, 255, 0.6)',
    iconName: 'sanat',
  },
  {
    id: 'technology',
    name: 'Teknoloji & Siber',
    type: 'general',
    badge: '💻 Yazılım & Cihazlar',
    primaryColor: '#4A9BFF',
    secondaryColor: '#1F5FE0',
    neonBorder: '#4A9BFF',
    accentGlow: 'rgba(74, 155, 255, 0.6)',
    iconName: 'teknoloji',
  },
  {
    id: 'nature',
    name: 'Doğa & Çevre',
    type: 'general',
    badge: '🌿 Ekoloji & Canlılar',
    primaryColor: '#4FE0A0',
    secondaryColor: '#14935F',
    neonBorder: '#4FE0A0',
    accentGlow: 'rgba(79, 224, 160, 0.6)',
    iconName: 'doga',
  },
  {
    id: 'food',
    name: 'Mutfak & Lezzet',
    type: 'general',
    badge: '🍲 Dünya Lezzetleri',
    primaryColor: '#FFB347',
    secondaryColor: '#E06A00',
    neonBorder: '#FFB347',
    accentGlow: 'rgba(255, 179, 71, 0.6)',
    iconName: 'yemek',
  },
  {
    id: 'literature',
    name: 'Edebiyat & Mitoloji',
    type: 'general',
    badge: '📚 Romanlar & Yazarlar',
    primaryColor: '#9A6BFF',
    secondaryColor: '#5A27C8',
    neonBorder: '#9A6BFF',
    accentGlow: 'rgba(154, 107, 255, 0.6)',
    iconName: 'edebiyat',
  },
  {
    id: 'space',
    name: 'Uzay & Astronomi',
    type: 'general',
    badge: '🚀 Kozmik Keşifler',
    primaryColor: '#4FD6E8',
    secondaryColor: '#0E7FA8',
    neonBorder: '#4FD6E8',
    accentGlow: 'rgba(79, 214, 232, 0.6)',
    iconName: 'uzay',
  },
  {
    id: 'animals',
    name: 'Hayvanlar Alemi',
    type: 'general',
    badge: '🐾 Vahşi Doğa',
    primaryColor: '#E0985A',
    secondaryColor: '#8A4A12',
    neonBorder: '#E0985A',
    accentGlow: 'rgba(224, 152, 90, 0.6)',
    iconName: 'hayvanlar',
  },
  {
    id: 'math',
    name: 'Matematik & Mantık',
    type: 'general',
    badge: '🔢 Sayılar & Zeka',
    primaryColor: '#FF7A8A',
    secondaryColor: '#C8102E',
    neonBorder: '#FF7A8A',
    accentGlow: 'rgba(255, 122, 138, 0.6)',
    iconName: 'matematik',
  },
  {
    id: 'gaming',
    name: 'Video Oyunları',
    type: 'general',
    badge: '🎮 Konsol & Espor',
    primaryColor: '#FF6BC4',
    secondaryColor: '#C01F80',
    neonBorder: '#FF6BC4',
    accentGlow: 'rgba(255, 107, 196, 0.6)',
    iconName: 'oyun',
  },
  {
    id: 'general_culture',
    name: 'Genel Kültür & Yaşam',
    type: 'general',
    badge: '💡 Gündem & Bilgi',
    primaryColor: '#9A6BFF',
    secondaryColor: '#5A27C8',
    neonBorder: '#9A6BFF',
    accentGlow: 'rgba(154, 107, 255, 0.6)',
    iconName: 'genel_kultur',
  },
];

// Tavriko UI Kit - Özel Tematik Paketler
export const SPECIAL_CATEGORIES: CategoryData[] = [
  {
    id: 'yesilcam',
    name: 'Yeşilçam Efsaneleri',
    type: 'special',
    badge: '⭐ Tematik Soru Paketi',
    primaryColor: '#FF416C',
    secondaryColor: '#8A0027',
    neonBorder: '#FF416C',
    accentGlow: 'rgba(255, 65, 108, 0.6)',
    iconName: 'sinema',
  },
  {
    id: 'turkish_pop_90s',
    name: "90'lar Nostalji Pop",
    type: 'special',
    badge: '⭐ Tematik Soru Paketi',
    primaryColor: '#FF6BC4',
    secondaryColor: '#C01F80',
    neonBorder: '#FF6BC4',
    accentGlow: 'rgba(255, 107, 196, 0.6)',
    iconName: 'muzik',
  },
  {
    id: 'ottoman_history',
    name: 'Osmanlı & Hanedan',
    type: 'special',
    badge: '⭐ Tematik Soru Paketi',
    primaryColor: '#FFE27A',
    secondaryColor: '#FF8800',
    neonBorder: '#FFE27A',
    accentGlow: 'rgba(255, 226, 122, 0.6)',
    iconName: 'tarih',
  },
  {
    id: 'super_lig_legends',
    name: 'Süper Lig Derbileri',
    type: 'special',
    badge: '⭐ Tematik Soru Paketi',
    primaryColor: '#FF9B2F',
    secondaryColor: '#D0102E',
    neonBorder: '#FF9B2F',
    accentGlow: 'rgba(255, 155, 47, 0.6)',
    iconName: 'spor',
  },
  {
    id: 'world_capitals',
    name: 'Dünya Başkentleri',
    type: 'special',
    badge: '⭐ Tematik Soru Paketi',
    primaryColor: '#4A9BFF',
    secondaryColor: '#1F5FE0',
    neonBorder: '#4A9BFF',
    accentGlow: 'rgba(74, 155, 255, 0.6)',
    iconName: 'cografya',
  },
  {
    id: 'space_astronomy',
    name: 'Kozmik Evren & Galaksi',
    type: 'special',
    badge: '⭐ Tematik Soru Paketi',
    primaryColor: '#4FD6E8',
    secondaryColor: '#0E7FA8',
    neonBorder: '#4FD6E8',
    accentGlow: 'rgba(79, 214, 232, 0.6)',
    iconName: 'uzay',
  },
];

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
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
        },
      ]}
    >
      <CategorySquircleIcon category={category.iconName || category.id} size={size} />

      {/* Seçili İken Parlayan Neon Çerçeve (UI Kit Screen 9) */}
      {isSelected && (
        <View
          style={[
            styles.selectedGlowRing,
            {
              width: size + 6,
              height: size + 6,
              borderRadius: (size + 6) * 0.32,
            },
          ]}
          pointerEvents="none"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  selectedGlowRing: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#00F0FF',
    ...Platform.select({
      ios: {
        shadowColor: '#00F0FF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.95,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '0 0 20px rgba(0, 240, 255, 0.85), inset 0 0 10px rgba(0, 240, 255, 0.45)',
      },
    }),
  },
});
