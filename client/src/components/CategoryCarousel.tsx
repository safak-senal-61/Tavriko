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
  cardSize = 92,
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
      <View style={[styles.carouselContainer, { width: CONTAINER_WIDTH, height: cardSize * 1.6 }]}>
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
              outputRange: [0.8, 1.25, 0.8],
              extrapolate: 'clamp',
            });

            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.6, 1.0, 0.6],
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

      {/* Seçili Kategori Başlığı & Alt Bilgi */}
      {selectedCategory && (
        <View style={styles.categoryInfoBox}>
          <Text style={styles.categoryTitle}>{selectedCategory.name}</Text>
          <Text style={styles.categorySub}>
            {selectedCategory.type === 'special'
              ? '⭐ Tematik Özel Soru Paketi'
              : '🎯 Genel Branş Soruları'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
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
    marginTop: 8,
    minHeight: 44,
  },
  categoryTitle: {
    fontSize: 18,
    fontFamily: 'Nunito_900Black',
    fontWeight: '900',
    color: '#241050',
    textAlign: 'center',
  },
  categorySub: {
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
    fontWeight: '700',
    color: '#7C6F9C',
    marginTop: 2,
    textAlign: 'center',
  },
});
