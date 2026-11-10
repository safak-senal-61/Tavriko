import React, { useRef, useEffect, useCallback } from 'react';
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
  const snapTimerRef = useRef<any>(null);
  const isSnappingRef = useRef(false);

  // Kartlar arası boşluk ve yapışma (snap) hesabı
  const CARD_SPACING = 24;
  const ITEM_WIDTH = cardSize + CARD_SPACING;
  // Modal içi genişlik yaklaşık 340px
  const CONTAINER_WIDTH = Math.min(SCREEN_WIDTH - 48, 360);
  // Kenar dolgusu: kart i, contentOffset = i * ITEM_WIDTH ile TAM ortalanacak şekilde.
  // (Önceki değer (CONTAINER - ITEM) / 2 idi ve kartlar 12px kayık duruyordu.)
  const SPACER_WIDTH = (CONTAINER_WIDTH - cardSize) / 2;

  const maxIndex = Math.max(0, categories.length - 1);

  // En yakın karta yumuşakça kaydır (tam yapışma: yarım kalmaz)
  const snapToNearest = useCallback(
    (offsetX: number, animated = true) => {
      const rawIndex = offsetX / ITEM_WIDTH;
      const nearestIndex = Math.max(0, Math.min(maxIndex, Math.round(rawIndex)));
      const target = nearestIndex * ITEM_WIDTH;
      if (Math.abs(target - offsetX) < 1) return; // zaten hizalı
      isSnappingRef.current = true;
      scrollViewRef.current?.scrollTo({ x: target, animated });
      // Seçimi de güncelle
      const selected = categories[nearestIndex];
      if (selected && selected.id !== selectedCategoryId) {
        sound.playSound('tap');
        sound.triggerHaptic('light');
        onSelectCategory(selected);
      }
      setTimeout(() => {
        isSnappingRef.current = false;
      }, 320);
    },
    [categories, maxIndex, ITEM_WIDTH, selectedCategoryId, onSelectCategory]
  );

  // Web'de mouse tekerleği/serbest sürükleme sonrası da tam karta oturt
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }], {
      useNativeDriver: Platform.OS !== 'web',
      listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (isSnappingRef.current) return;
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
        if (Platform.OS === 'web') {
          // Tekerlek/dokunma kaydırması bırakılınca en yakın karta yapış
          if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
          snapTimerRef.current = setTimeout(() => {
            snapToNearest(offsetX);
          }, 140);
        }
      },
    }
  );

  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    if (isSnappingRef.current) return;
    snapToNearest(event.nativeEvent.contentOffset.x);
  };

  const handleItemPress = (index: number, cat: CategoryData) => {
    sound.playSound('tap');
    sound.triggerHaptic('medium');
    isSnappingRef.current = true;
    scrollViewRef.current?.scrollTo({
      x: index * ITEM_WIDTH,
      animated: true,
    });
    setTimeout(() => {
      isSnappingRef.current = false;
    }, 320);
    onSelectCategory(cat);
  };

  // Başlangıçta veya sekme değiştiğinde seçili kartı ortaya getir
  useEffect(() => {
    const selectedIndex = categories.findIndex((c) => c.id === selectedCategoryId);
    if (selectedIndex !== -1 && scrollViewRef.current) {
      setTimeout(() => {
        isSnappingRef.current = true;
        scrollViewRef.current?.scrollTo({
          x: selectedIndex * ITEM_WIDTH,
          animated: true,
        });
        setTimeout(() => {
          isSnappingRef.current = false;
        }, 320);
      }, 60);
    }
  }, [categories]);

  const selectedCategory =
    categories.find((c) => c.id === selectedCategoryId) || categories[0];

  // Dinamik sayfalama noktaları (maks. 7 nokta, pencere kayar)
  const renderDots = () => {
    const total = categories.length;
    if (total === 0) return null;
    const selectedIndex = categories.findIndex(
      (c) => c.id === selectedCategory?.id
    );
    const maxDots = 7;
    let start = 0;
    let end = total;
    if (total > maxDots) {
      start = Math.max(0, selectedIndex - 3);
      end = Math.min(total, start + maxDots);
      start = Math.max(0, end - maxDots);
    }
    const dots = [];
    for (let i = start; i < end; i++) {
      const isActive = i === selectedIndex;
        dots.push(
        <View
          key={i}
          style={[styles.dotInactive, isActive && styles.dotActive]}
        />
      );
    }
    return dots;
  };

  return (
    <View style={styles.wrapper}>
      {/* Yatay 3D Karusel */}
      <View style={[styles.carouselContainer, { width: CONTAINER_WIDTH, height: cardSize * 1.55 }]}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_WIDTH}
          snapToAlignment="start"
          decelerationRate="fast"
          bounces={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onScrollEndDrag={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            // Sürükleme bırakılınca da tam karta otur (web dahil)
            if (Platform.OS === 'web') {
              // Web'de kısa bekle: momentum devam ediyor olabilir
              if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
              snapTimerRef.current = setTimeout(() => {
                snapToNearest(event.nativeEvent.contentOffset.x);
              }, 60);
            }
          }}
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
              outputRange: [0.8, 1.16, 0.8],
              extrapolate: 'clamp',
            });

            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.45, 1.0, 0.45],
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
          <Text style={styles.categorySub} numberOfLines={1}>
            {selectedCategory.badge ||
              (selectedCategory.type === 'special'
                ? '⭐ Tematik Özel Soru Paketi'
                : '🧬 Genel Branş Soruları')}
          </Text>

          {/* Dinamik sayfalama göstergesi */}
          <View style={styles.paginationDotsRow}>{renderDots()}</View>
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
    maxWidth: 300,
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
