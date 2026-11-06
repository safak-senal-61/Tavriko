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
    id: 'gaming_videogames',
    name: 'Video Oyunları',
    type: 'general',
    badge: '🎮 Konsol, PC & E-spor',
    primaryColor: '#8B5CF6',
    secondaryColor: '#5B21B6',
    neonBorder: '#8B5CF6',
    accentGlow: 'rgba(139, 92, 246, 0.6)',
    iconName: 'gaming_videogames',
  },
  {
    id: 'anime_manga',
    name: 'Anime ve Manga',
    type: 'general',
    badge: '🍥 Shonen, Isekai & Pop Kültür',
    primaryColor: '#EC4899',
    secondaryColor: '#9D174D',
    neonBorder: '#EC4899',
    accentGlow: 'rgba(236, 72, 153, 0.6)',
    iconName: 'anime_manga',
  },
  {
    id: 'cartoons_animation',
    name: 'Çizgi Film & Animasyon',
    type: 'general',
    badge: '🎠 Klasik & 3D Karakterler',
    primaryColor: '#F59E0B',
    secondaryColor: '#B45309',
    neonBorder: '#F59E0B',
    accentGlow: 'rgba(245, 158, 11, 0.6)',
    iconName: 'cartoons_animation',
  },
  {
    id: 'cinema_tv',
    name: 'Sinema ve Diziler',
    type: 'general',
    badge: '🎬 Filmler & Replikler',
    primaryColor: '#E11D48',
    secondaryColor: '#881337',
    neonBorder: '#E11D48',
    accentGlow: 'rgba(225, 29, 72, 0.6)',
    iconName: 'sinema',
  },
  {
    id: 'comics_superheroes',
    name: 'Çizgi Roman & Kahramanlar',
    type: 'general',
    badge: '🦸 Marvel, DC & Güçler',
    primaryColor: '#0284C7',
    secondaryColor: '#075985',
    neonBorder: '#0284C7',
    accentGlow: 'rgba(2, 132, 199, 0.6)',
    iconName: 'comics_superheroes',
  },
  {
    id: 'fantasy_fiction',
    name: 'Fantastik & Kurgu',
    type: 'general',
    badge: '🐉 Ejderhalar & Paralel Evrenler',
    primaryColor: '#7C3AED',
    secondaryColor: '#4C1D95',
    neonBorder: '#7C3AED',
    accentGlow: 'rgba(124, 58, 237, 0.6)',
    iconName: 'fantasy_fiction',
  },
  {
    id: 'literature',
    name: 'Kitaplar & Edebiyat',
    type: 'general',
    badge: '📚 Dünya Klasikleri & Romanlar',
    primaryColor: '#D97706',
    secondaryColor: '#78350F',
    neonBorder: '#D97706',
    accentGlow: 'rgba(217, 119, 6, 0.6)',
    iconName: 'edebiyat',
  },
  {
    id: 'music',
    name: 'Müzik Dünyası',
    type: 'general',
    badge: '🎵 Rock, Pop & Şarkıcılar',
    primaryColor: '#14B8A6',
    secondaryColor: '#115E59',
    neonBorder: '#14B8A6',
    accentGlow: 'rgba(20, 184, 166, 0.6)',
    iconName: 'muzik',
  },
  {
    id: 'social_internet',
    name: 'Sosyal Medya & İnternet',
    type: 'general',
    badge: '📱 Memeler & Viral Olaylar',
    primaryColor: '#06B6D4',
    secondaryColor: '#155E75',
    neonBorder: '#06B6D4',
    accentGlow: 'rgba(6, 182, 212, 0.6)',
    iconName: 'social_internet',
  },
  {
    id: 'animals_wildlife',
    name: 'Hayvanlar Alemi',
    type: 'general',
    badge: '🐾 Vahşi Doğa & Canlılar',
    primaryColor: '#10B981',
    secondaryColor: '#064E3B',
    neonBorder: '#10B981',
    accentGlow: 'rgba(16, 185, 129, 0.6)',
    iconName: 'hayvanlar',
  },
  {
    id: 'mythology_ancient',
    name: 'Mitoloji & Efsaneler',
    type: 'general',
    badge: '⚡ Tanrılar, Efsaneler & Destanlar',
    primaryColor: '#F59E0B',
    secondaryColor: '#92400E',
    neonBorder: '#F59E0B',
    accentGlow: 'rgba(245, 158, 11, 0.6)',
    iconName: 'mythology_ancient',
  },
  {
    id: 'hobbies_leisure',
    name: 'Eğlence & Hobiler',
    type: 'general',
    badge: '🎣 Kamp, Kahve & Hobiler',
    primaryColor: '#10B981',
    secondaryColor: '#047857',
    neonBorder: '#10B981',
    accentGlow: 'rgba(16, 185, 129, 0.6)',
    iconName: 'hobbies_leisure',
  },
  {
    id: 'history',
    name: 'Tarih & Medeniyet',
    type: 'general',
    badge: '🏛️ Savaşlar & Liderler',
    primaryColor: '#8B5CF6',
    secondaryColor: '#4C1D95',
    neonBorder: '#8B5CF6',
    accentGlow: 'rgba(139, 92, 246, 0.6)',
    iconName: 'tarih',
  },
  {
    id: 'geography',
    name: 'Coğrafya & Dünya',
    type: 'general',
    badge: '🗺️ Kıtalar, Dağlar & Başkentler',
    primaryColor: '#3B82F6',
    secondaryColor: '#1E3A8A',
    neonBorder: '#3B82F6',
    accentGlow: 'rgba(59, 130, 246, 0.6)',
    iconName: 'cografya',
  },
  {
    id: 'art_culture',
    name: 'Sanat & Kültür',
    type: 'general',
    badge: '🎨 Tablolar, Heykel & Müzeler',
    primaryColor: '#F97316',
    secondaryColor: '#7C2D12',
    neonBorder: '#F97316',
    accentGlow: 'rgba(249, 115, 22, 0.6)',
    iconName: 'sanat',
  },
  {
    id: 'sports',
    name: 'Spor & Arena',
    type: 'general',
    badge: '⚽ Futbol, Basket & Rekorlar',
    primaryColor: '#EF4444',
    secondaryColor: '#991B1B',
    neonBorder: '#EF4444',
    accentGlow: 'rgba(239, 68, 68, 0.6)',
    iconName: 'spor',
  },
  {
    id: 'science_tech',
    name: 'Bilim & Teknoloji',
    type: 'general',
    badge: '💻 Yazılım, Yapay Zeka & Fizik',
    primaryColor: '#06B6D4',
    secondaryColor: '#0E7490',
    neonBorder: '#06B6D4',
    accentGlow: 'rgba(6, 182, 212, 0.6)',
    iconName: 'bilim',
  },
  {
    id: 'logic_puzzles',
    name: 'Oyun & Zeka',
    type: 'general',
    badge: '🧩 Bulmaca, Şifre & Mantık',
    primaryColor: '#EC4899',
    secondaryColor: '#831843',
    neonBorder: '#EC4899',
    accentGlow: 'rgba(236, 72, 153, 0.6)',
    iconName: 'oyun',
  },
  {
    id: 'mathematics',
    name: 'Matematik & Mantık',
    type: 'general',
    badge: '🔢 Geometri & Denklemler',
    primaryColor: '#10B981',
    secondaryColor: '#065F46',
    neonBorder: '#10B981',
    accentGlow: 'rgba(16, 185, 129, 0.6)',
    iconName: 'matematik',
  },
  {
    id: 'food_gastronomy',
    name: 'Yemek & Mutfak',
    type: 'general',
    badge: '🍲 Dünya & Türk Lezzetleri',
    primaryColor: '#F59E0B',
    secondaryColor: '#78350F',
    neonBorder: '#F59E0B',
    accentGlow: 'rgba(245, 158, 11, 0.6)',
    iconName: 'yemek',
  },
  {
    id: 'daily_life',
    name: 'Günlük Hayat & Toplum',
    type: 'general',
    badge: '👨‍👩‍👧 Psikoloji, Finans & Hayat',
    primaryColor: '#6366F1',
    secondaryColor: '#3730A3',
    neonBorder: '#6366F1',
    accentGlow: 'rgba(99, 102, 241, 0.6)',
    iconName: 'daily_life',
  },
  {
    id: 'turkey_special',
    name: 'Türkiye’ye Özel',
    type: 'general',
    badge: '🇹🇷 Tarih, Yeşilçam & Anadolu',
    primaryColor: '#DC2626',
    secondaryColor: '#7F1D1D',
    neonBorder: '#DC2626',
    accentGlow: 'rgba(220, 38, 38, 0.6)',
    iconName: 'turkey_special',
  },
  {
    id: 'space_astronomy',
    name: 'Uzay & Astronomi',
    type: 'general',
    badge: '🚀 Gezegenler & Galaksiler',
    primaryColor: '#6366F1',
    secondaryColor: '#312E81',
    neonBorder: '#6366F1',
    accentGlow: 'rgba(99, 102, 241, 0.6)',
    iconName: 'uzay',
  },
  {
    id: 'biology',
    name: 'Biyoloji & Canlılar',
    type: 'general',
    badge: '🧬 Anatomi & Genetik',
    primaryColor: '#22C55E',
    secondaryColor: '#14532D',
    neonBorder: '#22C55E',
    accentGlow: 'rgba(34, 197, 94, 0.6)',
    iconName: 'doga',
  },
  {
    id: 'physics_chemistry',
    name: 'Fizik & Kimya',
    type: 'general',
    badge: '⚛️ Atomlar & Elementler',
    primaryColor: '#A855F7',
    secondaryColor: '#581C87',
    neonBorder: '#A855F7',
    accentGlow: 'rgba(168, 85, 247, 0.6)',
    iconName: 'teknoloji',
  },
  {
    id: 'language_vocab',
    name: 'Dil & Kelime',
    type: 'general',
    badge: '🔤 Etimoloji & Deyimler',
    primaryColor: '#0284C7',
    secondaryColor: '#0C4A6E',
    neonBorder: '#0284C7',
    accentGlow: 'rgba(2, 132, 199, 0.6)',
    iconName: 'yemek',
  },
  {
    id: 'nature_ecology',
    name: 'Doğa & Ekoloji',
    type: 'general',
    badge: '🌲 Ormanlar & Çevre',
    primaryColor: '#22C55E',
    secondaryColor: '#166534',
    neonBorder: '#22C55E',
    accentGlow: 'rgba(34, 197, 94, 0.6)',
    iconName: 'doga',
  },
  {
    id: 'general_culture',
    name: 'Genel Kültür',
    type: 'general',
    badge: '💡 İlginç Gerçekler & Rekorlar',
    primaryColor: '#F59E0B',
    secondaryColor: '#B45309',
    neonBorder: '#F59E0B',
    accentGlow: 'rgba(245, 158, 11, 0.6)',
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
