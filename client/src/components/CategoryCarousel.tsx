import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Animated,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { CategoryData, CategorySquircleCard } from './CategorySquircleCard';
import { sound } from '../services/soundService';

interface CategoryCarouselProps {
  categories: CategoryData[];
  selectedCategoryId: string;
  onSelectCategory: (category: CategoryData) => void;
  cardSize?: number;
}

const EDGE_FADE = 44;
const BG = '#1E0E3D';
const MAX_JUMP = 6;

/**
 * Kategori akışı: her bırakışta MUTLAKA bir karta oturur (iki kartın arasında
 * kalmaz). Sürükleme + hız tahmini, yan oklar, yan karta dokunma ve web'de
 * tekerlek/trackpad ile gezinilir. Başlık ve soru sayısı sürüklerken canlı güncellenir.
 */
export const CategoryCarousel: React.FC<CategoryCarouselProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  cardSize = 90,
}) => {
  const ITEM = cardSize + 22;
  const maxIndex = Math.max(0, categories.length - 1);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const initialIndex = Math.max(0, categories.findIndex((c) => c.id === selectedCategoryId));
  const pos = useRef(new Animated.Value(initialIndex)).current;
  const posRef = useRef(initialIndex);
  const startRef = useRef(initialIndex);
  const targetRef = useRef(initialIndex);
  const [displayIndex, setDisplayIndex] = useState(initialIndex);
  const [width, setWidth] = useState(320);
  const containerRef = useRef<any>(null);

  // Güncel değerleri PanResponder / dinleyiciler için ref'te tut
  const latest = useRef({ categories, selectedCategoryId, onSelectCategory, ITEM, maxIndex });
  latest.current = { categories, selectedCategoryId, onSelectCategory, ITEM, maxIndex };

  useEffect(() => {
    const id = pos.addListener(({ value }) => {
      posRef.current = value;
      const r = Math.round(value);
      setDisplayIndex((prev) => (prev === r ? prev : r));
    });
    return () => pos.removeListener(id);
  }, [pos]);

  const settle = useCallback(
    (index: number, notify: boolean) => {
      const { categories: cats, selectedCategoryId: selId, onSelectCategory: onSel, maxIndex: mx } =
        latest.current;
      const i = clamp(index, 0, mx);
      targetRef.current = i;
      Animated.spring(pos, {
        toValue: i,
        useNativeDriver: false,
        friction: 9,
        tension: 80,
      }).start();
      const cat = cats[i];
      if (notify && cat && cat.id !== selId) {
        sound.playSound('tap');
        sound.triggerHaptic('light');
        onSel(cat);
      }
    },
    [pos]
  );

  // Dışarıdan seçim değişirse (açılış, sekme geçişi) o karta git
  useEffect(() => {
    const i = categories.findIndex((c) => c.id === selectedCategoryId);
    if (i !== -1 && i !== targetRef.current) settle(i, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId, categories.length]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        pos.stopAnimation();
        startRef.current = posRef.current;
      },
      onPanResponderMove: (_, g) => {
        const { ITEM: item, maxIndex: mx } = latest.current;
        pos.setValue(clamp(startRef.current - g.dx / item, -0.35, mx + 0.35));
      },
      onPanResponderRelease: (_, g) => {
        const { ITEM: item, maxIndex: mx } = latest.current;
        const projected = startRef.current - (g.dx + g.vx * 160) / item;
        const base = Math.round(startRef.current);
        const target = clamp(Math.round(projected), base - MAX_JUMP, base + MAX_JUMP);
        settle(clamp(target, 0, mx), true);
      },
      onPanResponderTerminate: () => settle(Math.round(posRef.current), true),
    })
  ).current;

  // Web: tekerlek / trackpad ile birer kart ilerle
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node: any = containerRef.current;
    if (!node || !node.addEventListener) return;
    let lock = false;
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(d) < 6) return;
      e.preventDefault();
      if (lock) return;
      lock = true;
      setTimeout(() => (lock = false), 160);
      settle(targetRef.current + (d > 0 ? 1 : -1), true);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [settle]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - width) > 1) setWidth(w);
  };

  const shown = categories[clamp(displayIndex, 0, maxIndex)] || categories[0];
  const baseLeft = width / 2 - ITEM / 2;

  const items = useMemo(
    () =>
      categories.map((cat, index) => {
        const translateX = pos.interpolate({
          inputRange: [index - 4, index + 4],
          outputRange: [4 * ITEM, -4 * ITEM],
        });
        const scale = pos.interpolate({
          inputRange: [index - 2, index - 1, index, index + 1, index + 2],
          outputRange: [0.6, 0.78, 1.12, 0.78, 0.6],
          extrapolate: 'clamp',
        });
        const opacity = pos.interpolate({
          inputRange: [index - 2, index - 1, index, index + 1, index + 2],
          outputRange: [0, 0.65, 1, 0.65, 0],
          extrapolate: 'clamp',
        });
        return { cat, index, translateX, scale, opacity };
      }),
    [categories, pos, ITEM]
  );

  const cardHeight = cardSize * 1.12 + 44;

  return (
    <View style={styles.wrapper}>
      <View
        ref={containerRef}
        onLayout={onLayout}
        style={[styles.stage, { height: cardHeight + 18 }]}
        {...pan.panHandlers}
      >
        {items.map(({ cat, index, translateX, scale, opacity }) => {
          if (Math.abs(index - displayIndex) > 4) return null;
          const isCenter = index === displayIndex;
          return (
            <Animated.View
              key={cat.id}
              style={[
                styles.item,
                {
                  width: ITEM,
                  left: baseLeft,
                  height: cardHeight,
                  opacity,
                  zIndex: isCenter ? 10 : 1,
                  transform: [{ translateX }, { scale }],
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                  sound.triggerHaptic('medium');
                  settle(index, true);
                }}
                style={styles.touchTarget}
              >
                <CategorySquircleCard
                  category={{ ...cat, questionCount: undefined }}
                  size={cardSize}
                  isSelected={isCenter}
                />
                <View style={[styles.cardPill, isCenter && styles.cardPillActive]}>
                  <Text style={[styles.cardPillText, isCenter && styles.cardPillTextActive]}>
                    {cat.questionCount === undefined ? '…' : `${cat.questionCount} soru`}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* Kenarlarda yumuşak solma */}
        <View pointerEvents="none" style={[styles.fade, { left: 0 }]}>
          <Svg width={EDGE_FADE} height="100%">
            <Defs>
              <LinearGradient id="fadeL" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={BG} stopOpacity="1" />
                <Stop offset="1" stopColor={BG} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#fadeL)" />
          </Svg>
        </View>
        <View pointerEvents="none" style={[styles.fade, { right: 0 }]}>
          <Svg width={EDGE_FADE} height="100%">
            <Defs>
              <LinearGradient id="fadeR" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={BG} stopOpacity="0" />
                <Stop offset="1" stopColor={BG} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#fadeR)" />
          </Svg>
        </View>

        {/* Oklar */}
        <TouchableOpacity
          style={[styles.arrow, { left: 2 }, displayIndex <= 0 && styles.arrowOff]}
          disabled={displayIndex <= 0}
          onPress={() => settle(targetRef.current - 1, true)}
          activeOpacity={0.7}
        >
          <ChevronLeft size={18} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.arrow, { right: 2 }, displayIndex >= maxIndex && styles.arrowOff]}
          disabled={displayIndex >= maxIndex}
          onPress={() => settle(targetRef.current + 1, true)}
          activeOpacity={0.7}
        >
          <ChevronRight size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {shown && (
        <View style={styles.infoBox}>
          <Text style={styles.title} numberOfLines={1}>
            {shown.name}
          </Text>
          <View style={styles.countChip}>
            <Text style={styles.countChipText}>
              {shown.questionCount === undefined ? 'Sayılıyor…' : `${shown.questionCount} soru`}
            </Text>
          </View>
          <Text style={styles.desc} numberOfLines={1}>
            {shown.badge}
          </Text>
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${((displayIndex + 1) / Math.max(1, categories.length)) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {displayIndex + 1} / {categories.length}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { width: '100%', alignItems: 'center' },
  stage: {
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
    ...Platform.select({ web: { touchAction: 'pan-y', userSelect: 'none' } as any, default: {} }),
  },
  item: {
    position: 'absolute',
    top: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchTarget: { alignItems: 'center', justifyContent: 'center', padding: 4 },
  cardPill: {
    marginTop: 8,
    paddingHorizontal: 9,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPillActive: { backgroundColor: '#FFC43D' },
  cardPillText: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.8)' },
  cardPillTextActive: { color: '#3B1500', fontWeight: '900' },
  fade: { position: 'absolute', top: 0, bottom: 0, width: EDGE_FADE },
  arrow: {
    position: 'absolute',
    top: '38%',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  arrowOff: { opacity: 0.25 },
  infoBox: { alignItems: 'center', marginTop: 4, width: '100%' },
  title: {
    fontSize: 22,
    fontFamily: 'Nunito_900Black',
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  countChip: {
    marginTop: 5,
    paddingHorizontal: 14,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,196,61,0.16)',
    borderWidth: 1.5,
    borderColor: '#FFC43D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countChipText: { fontSize: 13, fontWeight: '900', color: '#FFC43D' },
  desc: {
    marginTop: 7,
    fontSize: 12,
    fontFamily: 'Nunito_800ExtraBold',
    fontWeight: '800',
    color: '#5ADBB5',
    textAlign: 'center',
    maxWidth: 310,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  progressTrack: {
    width: 120,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: '#FFC43D' },
  progressText: { fontSize: 11, fontWeight: '800', color: 'rgba(233,225,255,0.7)' },
});
