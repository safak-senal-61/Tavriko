import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { CategoryData, GENERAL_CATEGORIES } from './CategorySquircleCard';

/**
 * "Genel" sekmesi: herkesin çözdüğü popüler ana kategoriler.
 */
const POPULAR_CATEGORY_IDS = [
  'general_culture',
  'science_tech',
  'history',
  'geography',
  'sports',
  'cinema_tv',
  'music',
  'art_culture',
  'animals_wildlife',
  'space_astronomy',
];

const POPULAR_CATEGORIES = GENERAL_CATEGORIES.filter((c) =>
  POPULAR_CATEGORY_IDS.includes(c.id)
);

/**
 * "Özel" sekmesi: Keşfet'teki TÜM kategoriler — tek doğruluk kaynağı
 * shared/src/categories.ts kataloğudur (GENERAL_CATEGORIES buradan türetilir).
 * Eskiden burada sunucuda var olmayan sahte "tematik paket" id'leri
 * (yesilcam, world_capitals vb.) listeleniyordu; Keşfet ile uyuşmuyordu.
 */
const ALL_CATEGORIES: CategoryData[] = [...GENERAL_CATEGORIES];
import { SegmentedFilter } from './SegmentedFilter';
import { CategoryCarousel } from './CategoryCarousel';
import { sound } from '../services/soundService';
import { THEME } from '../theme/tokens';

interface CategorySelectModalProps {
  visible: boolean;
  initialCategoryId?: string;
  onClose: () => void;
  onSelectCategory: (category: CategoryData) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const CategorySelectModal: React.FC<CategorySelectModalProps> = ({
  visible,
  initialCategoryId = 'art_culture',
  onClose,
  onSelectCategory,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'special'>('general');

  // Genel = popüler kategoriler, Özel = TÜM kategoriler
  const currentCategoryList =
    activeTab === 'general' ? POPULAR_CATEGORIES : ALL_CATEGORIES;

  const [selectedCategory, setSelectedCategory] = useState<CategoryData>(() => {
    return (
      POPULAR_CATEGORIES.find((c) => c.id === initialCategoryId) ||
      ALL_CATEGORIES.find((c) => c.id === initialCategoryId) ||
      POPULAR_CATEGORIES[0]
    );
  });

  useEffect(() => {
    if (visible) {
      const isPopular = POPULAR_CATEGORIES.some((c) => c.id === initialCategoryId);
      if (isPopular) {
        setActiveTab('general');
        const found = POPULAR_CATEGORIES.find((c) => c.id === initialCategoryId);
        if (found) setSelectedCategory(found);
      } else {
        // Diğer tüm kategoriler "Özel" (Tümü) sekmesinde
        setActiveTab('special');
        const found = ALL_CATEGORIES.find((c) => c.id === initialCategoryId);
        if (found) setSelectedCategory(found);
      }
    }
  }, [visible, initialCategoryId]);

  const handleTabChange = (tab: 'general' | 'special') => {
    setActiveTab(tab);
    const targetList = tab === 'general' ? POPULAR_CATEGORIES : ALL_CATEGORIES;
    setSelectedCategory(targetList[0]);
  };

  const handleConfirm = () => {
    sound.playSound('tap');
    sound.triggerHaptic('medium');
    onSelectCategory(selectedCategory);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Arka plan karartması */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.modalWrapper}>
          {/* Tavriko Dark Luxury Obsidian Kart Gövdesi */}
          <View style={styles.cardContainer}>
            {/* Üst Vurgu Barı */}
            <View style={styles.headerBar}>
              <Text style={styles.modalBadge}>TAVRİKO ARENA</Text>
              <Text style={styles.modalTitle}>Kategorini Seç</Text>
            </View>

            {/* 1. Üst Sekme: [ Genel | Özel ] */}
            <View style={styles.tabContainer}>
              <SegmentedFilter
                activeTab={activeTab}
                onChange={handleTabChange}
                width={250}
              />
              <Text style={styles.tabHint}>
                {activeTab === 'general'
                  ? `Herkesin çözdüğü ${POPULAR_CATEGORIES.length} popüler kategori`
                  : `Oyundaki tüm ${ALL_CATEGORIES.length} kategori`}
              </Text>
            </View>

            {/* 2. 3D Cyber-Squircle Kategori Karuseli */}
            <CategoryCarousel
              categories={currentCategoryList}
              selectedCategoryId={selectedCategory.id}
              onSelectCategory={setSelectedCategory}
              cardSize={90}
            />

            {/* 3. Tavriko 3D Onay Butonu (Altın / Neon Mint Tavriko Stili) */}
            <TouchableOpacity
              style={styles.confirm3DButton}
              activeOpacity={0.88}
              onPress={handleConfirm}
            >
              {/* 3D Alt Dudak (Lip) */}
              <View style={styles.btnLip} />

              {/* 3D Üst Gövde */}
              <View style={styles.btnBody}>
                <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                  <Defs>
                    <LinearGradient id="tavrikoConfirmGrad" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor="#FFE27A" />
                      <Stop offset="0.6" stopColor="#FF9B2F" />
                      <Stop offset="1" stopColor="#E07A00" />
                    </LinearGradient>
                  </Defs>
                  <Rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    rx="24"
                    ry="24"
                    fill="url(#tavrikoConfirmGrad)"
                  />
                </Svg>
                <Text style={styles.confirmButtonText}>SEÇİMİ ONAYLA</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 4, 24, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalWrapper: {
    width: '100%',
    maxWidth: 390,
    alignItems: 'center',
  },
  cardContainer: {
    width: '100%',
    backgroundColor: '#1E0E3D',
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(154, 107, 255, 0.4)',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#6B3CFF',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.6,
        shadowRadius: 28,
      },
      android: {
        elevation: 18,
      },
      web: {
        boxShadow: '0px 20px 50px rgba(107, 60, 255, 0.45)',
      },
    }),
  },
  headerBar: {
    alignItems: 'center',
    marginBottom: 14,
  },
  modalBadge: {
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '900',
    color: '#5ADBB5',
    letterSpacing: 2,
    marginBottom: 2,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  tabContainer: {
    marginBottom: 10,
    alignItems: 'center',
  },
  tabHint: {
    marginTop: 7,
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '700',
    color: 'rgba(233, 225, 255, 0.65)',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  confirm3DButton: {
    width: '88%',
    height: 54,
    position: 'relative',
    marginTop: 16,
    borderRadius: 24,
  },
  btnLip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 52,
    borderRadius: 24,
    backgroundColor: '#B8560A',
  },
  btnBody: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  confirmButtonText: {
    fontSize: 16,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
    color: '#3B1500',
    letterSpacing: 1,
  },
});
