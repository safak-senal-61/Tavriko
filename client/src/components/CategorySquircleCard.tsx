import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { CategorySquircleIcon, TavrikoCategoryKey } from './TavrikoIcons';
import { ALL_CATEGORIES as SHARED_CATEGORIES } from '@trivia/shared';

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

/** Hex rengi rgba() dizgesine çevirir (accentGlow için). */
const withAlpha = (hex: string, alpha: number): string => {
  const clean = (hex || '').replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Kategori listesinin TEK DOĞRULUK KAYNAĞI artık paylaşılan katalogdur
 * (shared/src/categories.ts -> ALL_CATEGORIES). Bu liste Keşfet ekranındaki
 * bölümlerle birebir aynıdır: aynı id'ler, aynı adlar, aynı renkler.
 * Eskiden elle tutulan ayrı bir liste vardı; Keşfet ile uyuşmuyordu ve
 * "tematik paket" id'lerinin çoğu sunucuda mevcut değildi.
 */
export const GENERAL_CATEGORIES: CategoryData[] = SHARED_CATEGORIES.filter(
  (c) => c.id !== 'mixed'
).map((c) => ({
  id: c.id,
  name: c.name,
  type: 'general' as const,
  badge: c.description,
  primaryColor: c.primaryColor,
  secondaryColor: c.accentColor,
  neonBorder: c.primaryColor,
  accentGlow: withAlpha(c.primaryColor, 0.6),
  // Squircle ikonu paylaşılan kategori id'sinden çözülür.
  iconName: c.id,
}));


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
