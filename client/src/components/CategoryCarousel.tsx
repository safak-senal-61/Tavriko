import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {
  CategoryData,
  CategorySquircleCard,
} from './CategorySquircleCard';
import { sound } from '../services/soundService';

interface CategoryCarouselProps {
  categories: CategoryData[];
  selectedCategoryId: string;
  onSelectCategory: (category: CategoryData) => void;
  cardSize?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const CategoryCarousel: React.FC<CategoryCarouselProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  cardSize = 88,
}) => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<any>(null);
  const lastHapticIndex = useRef<number>(-1);

  // Kartlar arası boşluk ve snapping hesabı
  const CARD_SPACING = 24;
  const ITEM_WIDTH = cardSize + CARD_SPACING;
  // Modal içi genişlik yaklaşık 340px
  const CONTAINER_WIDTH = Math.min(SCREEN_WIDTH - 48, 360);
  const SPACER_WIDTH = (CONTAINER_WIDTH - ITEM_WIDTH) / 2;

  // Başlangıçta veya kategori değiştiğinde ilgili karta kaydır
  useEffect(() => {
    const selectedIndex = categories.findIndex((c) => c.id === selectedCategoryId);
    if (selectedIndex !== -1 && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: selectedIndex * ITEM_WIDTH,
          animated: true,
        });
      }, 80);
    }
  }, [categories]);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: Platform.OS !== 'web',
      listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const activeIndex = Math.round(offsetX / ITEM_WIDTH);
        if (
          activeIndex >= 0 &&
          activeIndex < categories.length &&
          activeIndex !== lastHapticIndex.current
        ) {
          lastHapticIndex.current = activeIndex;
          sound.triggerHaptic('light');
        }
      },
    }
  );

  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const activeIndex = Math.round(offsetX / ITEM_WIDTH);
    if (activeIndex >= 0 && activeIndex < categories.length) {
      const selected = categories[activeIndex];
      if (selected.id !== selectedCategoryId) {
        sound.playSound('tap');
        sound.triggerHaptic('light');
        onSelectCategory(selected);
      }
    }
  };

  const handleItemPress = (index: number, cat: CategoryData) => {
    sound.playSound('tap');
    sound.triggerHaptic('medium');
    scrollViewRef.current?.scrollTo({
      x: index * ITEM_WIDTH,
      animated: true,
    });
    onSelectCategory(cat);
  };

  const selectedCategory =
    categories.find((c) => c.id === selectedCategoryId) || categories[0];

  return (
    <View style={styles.wrapper}>
      {/* Yatay 3D Karusel */}
      <View style={[styles.carouselContainer, { width: CONTAINER_WIDTH, height: cardSize * 1.55 }]}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_WIDTH}
          decelerationRate="fast"
          bounces={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          contentContainerStyle={{
            paddingHorizontal: SPACER_WIDTH,
            alignItems: 'center',
          }}
        >
          {categories.map((cat, index) => {
            const isSelected = cat.id === selectedCategoryId;

            const inputRange = [
              (index - 1) * ITEM_WIDTH,
              index * ITEM_WIDTH,
              (index + 1) * ITEM_WIDTH,
            ];

            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [0.82, 1.18, 0.82],
              extrapolate: 'clamp',
            });

            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.55, 1.0, 0.55],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={cat.id}
                style={[
                  styles.itemBox,
                  {
                    width: ITEM_WIDTH,
                    transform: [{ scale }],
                    opacity,
                    zIndex: isSelected ? 10 : 1,
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => handleItemPress(index, cat)}
                  style={styles.touchTarget}
                >
                  <CategorySquircleCard
                    category={cat}
                    size={cardSize}
                    isSelected={isSelected}
                  />
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </ScrollView>
      </View>

      {/* Seçili Kategori Başlığı & Alt Bilgi (UI Kit Screen 9) */}
      {selectedCategory && (
        <View style={styles.categoryInfoBox}>
          <Text style={styles.categoryTitle}>{selectedCategory.name}</Text>
          <Text style={styles.categorySub}>
            {selectedCategory.badge ||
              (selectedCategory.type === 'special'
                ? '⭐ Tematik Özel Soru Paketi'
                : '🧬 Genel Branş Soruları')}
          </Text>

          {/* Tavriko UI Kit 3'lü Sayfalama Göstergesi */}
          <View style={styles.paginationDotsRow}>
            <View style={styles.dotInactive} />
            <View style={styles.dotActive} />
            <View style={styles.dotInactive} />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  carouselContainer: {
    overflow: 'hidden',
    justifyContent: 'center',
  },
  itemBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  touchTarget: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryInfoBox: {
    alignItems: 'center',
    marginTop: 6,
    minHeight: 56,
  },
  categoryTitle: {
    fontSize: 19,
    fontFamily: 'Nunito_900Black',
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  categorySub: {
    fontSize: 12,
    fontFamily: 'Nunito_800ExtraBold',
    fontWeight: '800',
    color: '#5ADBB5',
    marginTop: 3,
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  paginationDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  dotActive: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFC43D',
  },
  dotInactive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
});
