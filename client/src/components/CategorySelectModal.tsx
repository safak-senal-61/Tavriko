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
import {
  CategoryData,
  GENERAL_CATEGORIES,
  SPECIAL_CATEGORIES,
} from './CategorySquircleCard';
import { SegmentedFilter } from './SegmentedFilter';
import { CategoryCarousel } from './CategoryCarousel';
import { sound } from '../services/soundService';

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
  // Aktif sekme: Genel veya Özel
  const [activeTab, setActiveTab] = useState<'general' | 'special'>('general');

  // Hangi liste gösteriliyor?
  const currentCategoryList =
    activeTab === 'general' ? GENERAL_CATEGORIES : SPECIAL_CATEGORIES;

  // Seçili kategori
  const [selectedCategory, setSelectedCategory] = useState<CategoryData>(() => {
    return (
      GENERAL_CATEGORIES.find((c) => c.id === initialCategoryId) ||
      SPECIAL_CATEGORIES.find((c) => c.id === initialCategoryId) ||
      GENERAL_CATEGORIES[2] // Sanat & Kültür (Turuncu boya fırçası - ekran görüntüsüyle eşleşir)
    );
  });

  // Modal her açıldığında başlangıç durumunu ayarla
  useEffect(() => {
    if (visible) {
      const isSpecial = SPECIAL_CATEGORIES.some((c) => c.id === initialCategoryId);
      if (isSpecial) {
        setActiveTab('special');
        const found = SPECIAL_CATEGORIES.find((c) => c.id === initialCategoryId);
        if (found) setSelectedCategory(found);
      } else {
        setActiveTab('general');
        const found = GENERAL_CATEGORIES.find((c) => c.id === initialCategoryId);
        if (found) setSelectedCategory(found);
      }
    }
  }, [visible, initialCategoryId]);

  // Sekme değiştiğinde o sekmenin ilk kategorisini seç
  const handleTabChange = (tab: 'general' | 'special') => {
    setActiveTab(tab);
    const targetList = tab === 'general' ? GENERAL_CATEGORIES : SPECIAL_CATEGORIES;
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
        {/* Arka plan tıklaması */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.modalWrapper}>
          {/* Modal Başlığı (Ekran görüntüsündeki gibi beyaz başlık) */}
          <Text style={styles.modalTitle}>Kategorini Seç</Text>

          {/* Beyaz Kart Gövdesi */}
          <View style={styles.cardContainer}>
            {/* 1. Üst Sekme: [ Genel | Özel ] */}
            <View style={styles.tabContainer}>
              <SegmentedFilter
                activeTab={activeTab}
                onChange={handleTabChange}
                width={230}
              />
            </View>

            {/* 2. Orta: 3D Squircle Kategori Karuseli */}
            <CategoryCarousel
              categories={currentCategoryList}
              selectedCategoryId={selectedCategory.id}
              onSelectCategory={setSelectedCategory}
              cardSize={88}
            />

            {/* 3. Alt: Tamam Butonu (Turkuaz - Mavi Degrade Hap Buton) */}
            <TouchableOpacity
              style={styles.confirmButton}
              activeOpacity={0.88}
              onPress={handleConfirm}
            >
              <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id="btnGrad" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#00B4DB" />
                    <Stop offset="1" stopColor="#0083B0" />
                  </LinearGradient>
                </Defs>
                <Rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  rx="26"
                  ry="26"
                  fill="url(#btnGrad)"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  strokeOpacity={0.4}
                />
              </Svg>
              <Text style={styles.confirmButtonText}>Tamam</Text>
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
    backgroundColor: 'rgba(10, 4, 30, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalWrapper: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: 'Nunito_900Black',
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  cardContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
      },
      android: {
        elevation: 16,
      },
      web: {
        boxShadow: '0px 20px 40px rgba(0, 0, 0, 0.45)',
      },
    }),
  },
  tabContainer: {
    marginBottom: 12,
  },
  confirmButton: {
    width: '84%',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#00B4DB',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0px 6px 16px rgba(0, 180, 219, 0.45)',
      },
    }),
  },
  confirmButtonText: {
    fontSize: 18,
    fontFamily: 'Nunito_900Black',
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
