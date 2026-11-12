import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Platform,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { ALL_CATEGORIES as SHARED_CATEGORIES } from '@trivia/shared';
import { CategoryData, GENERAL_CATEGORIES } from './CategorySquircleCard';
import { DISCOVER_CATEGORY_IMG, DISCOVER_SUBCATEGORY_IMG } from './DiscoverArtwork';
import { SegmentedFilter } from './SegmentedFilter';
import { CategoryCarousel } from './CategoryCarousel';
import { sound } from '../services/soundService';
import { THEME } from '../theme/tokens';
import { DEFAULT_API_BASE } from '../config';
import { CategoryCounts, fetchCategoryCounts, subCountKey } from '../utils/categoryCounts';

/**
 * Kategori listesinin TEK DOĞRULUK KAYNAĞI shared/src/categories.ts kataloğudur;
 * Keşfet ekranı da aynı kataloğu, aynı görselleri ve aynı canlı soru sayılarını kullanır.
 *
 *  - "Genel" sekmesi: TÜM ana kategoriler. Seçilirse sorular o ana kategorinin
 *    alt kategorilerinden karışık gelir.
 *  - "Özel" sekmesi: seçilen ana kategorinin TÜM alt kategorileri (görselleriyle).
 *    Seçilirse sorular yalnızca o alt kategoriden gelir.
 */
const MAIN_CATEGORIES: CategoryData[] = [...GENERAL_CATEGORIES];

export interface SelectedSubCategory {
  id: string;
  name: string;
  emoji?: string;
  questionCount?: number;
}

interface CategorySelectModalProps {
  visible: boolean;
  initialCategoryId?: string;
  initialSubCategoryId?: string;
  apiBaseUrl?: string;
  onClose: () => void;
  onSelectCategory: (category: CategoryData, subCategory?: SelectedSubCategory) => void;
}

export const CategorySelectModal: React.FC<CategorySelectModalProps> = ({
  visible,
  initialCategoryId = 'general_culture',
  initialSubCategoryId,
  apiBaseUrl,
  onClose,
  onSelectCategory,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'special'>('general');
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [selectedMainId, setSelectedMainId] = useState<string>(initialCategoryId);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(initialSubCategoryId || null);

  // Canlı soru sayıları (Keşfet ile aynı uç nokta)
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    fetchCategoryCounts(apiBaseUrl || DEFAULT_API_BASE)
      .then((c) => alive && setCounts(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [visible, apiBaseUrl]);

  // Açılışta mevcut seçimi geri yükle
  useEffect(() => {
    if (!visible) return;
    setSelectedMainId(initialCategoryId);
    setSelectedSubId(initialSubCategoryId || null);
    setActiveTab(initialSubCategoryId ? 'special' : 'general');
  }, [visible, initialCategoryId, initialSubCategoryId]);

  const mainWithCounts: CategoryData[] = useMemo(
    () =>
      MAIN_CATEGORIES.map((c) => ({
        ...c,
        questionCount: counts ? counts.main[c.id] ?? 0 : undefined,
      })),
    [counts]
  );

  const selectedMain =
    mainWithCounts.find((c) => c.id === selectedMainId) || mainWithCounts[0];

  const subList = useMemo(() => {
    const def = SHARED_CATEGORIES.find((c) => c.id === selectedMain.id);
    return (def?.subCategories || []).map((sc) => ({
      ...sc,
      questionCount: counts ? counts.sub[subCountKey(selectedMain.id, sc.name)] ?? 0 : undefined,
    }));
  }, [selectedMain.id, counts]);

  const selectedSub = subList.find((sc) => sc.id === selectedSubId) || null;
  const selectedSubEmpty = !!selectedSub && selectedSub.questionCount === 0;

  const handleTabChange = (tab: 'general' | 'special') => {
    setActiveTab(tab);
    if (tab === 'general') setSelectedSubId(null);
  };

  const handlePickMain = (cat: CategoryData) => {
    setSelectedMainId(cat.id);
    setSelectedSubId(null);
  };

  const canConfirm =
    activeTab === 'general' ? true : !!selectedSub && !selectedSubEmpty;

  const handleConfirm = () => {
    if (!canConfirm) {
      sound.playSound('wrong');
      return;
    }
    sound.playSound('tap');
    sound.triggerHaptic('medium');
    if (activeTab === 'special' && selectedSub) {
      onSelectCategory(selectedMain, {
        id: selectedSub.id,
        name: selectedSub.name,
        emoji: selectedSub.emoji,
        questionCount: selectedSub.questionCount,
      });
    } else {
      onSelectCategory(selectedMain);
    }
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
                  ? `${mainWithCounts.length} ana kategori · sorular alt kategorilerden karışık gelir`
                  : 'Tek bir alt kategori seç · sorular yalnızca ondan gelir'}
              </Text>
            </View>

            {activeTab === 'general' ? (
              <CategoryCarousel
                categories={mainWithCounts}
                selectedCategoryId={selectedMain.id}
                onSelectCategory={handlePickMain}
                cardSize={90}
              />
            ) : (
              <View style={styles.specialWrap}>
                {/* Ana kategori seçici (görselli) */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.mainRow}
                >
                  {mainWithCounts.map((cat) => {
                    const active = cat.id === selectedMain.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        activeOpacity={0.85}
                        onPress={() => {
                          sound.playSound('tap');
                          handlePickMain(cat);
                        }}
                        style={[
                          styles.mainChip,
                          active && { borderColor: cat.primaryColor, backgroundColor: 'rgba(255,255,255,0.10)' },
                        ]}
                      >
                        <Image
                          source={DISCOVER_CATEGORY_IMG[cat.id]}
                          style={styles.mainChipArt}
                          resizeMode="contain"
                        />
                        <Text style={[styles.mainChipText, active && styles.mainChipTextActive]} numberOfLines={1}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={styles.subHeader} numberOfLines={1}>
                  {selectedMain.name} · {subList.length} alt kategori
                  {selectedMain.questionCount !== undefined ? ` · ${selectedMain.questionCount} soru` : ''}
                </Text>

                {/* Alt kategori ızgarası: görsel + ad + soru sayısı */}
                <ScrollView
                  style={styles.subScroll}
                  contentContainerStyle={styles.subGrid}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {subList.map((sc) => {
                    const active = sc.id === selectedSubId;
                    const empty = sc.questionCount === 0;
                    return (
                      <View key={sc.id} style={styles.subCell}>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => {
                            sound.playSound(empty ? 'wrong' : 'tap');
                            setSelectedSubId(sc.id);
                          }}
                          style={[
                            styles.subCard,
                            active && { borderColor: '#00F0FF', backgroundColor: 'rgba(0,240,255,0.10)' },
                            empty && styles.subCardEmpty,
                          ]}
                        >
                          <View style={styles.subCountPill}>
                            <Text style={styles.subCountText}>
                              {sc.questionCount === undefined ? '…' : sc.questionCount}
                            </Text>
                          </View>
                          {DISCOVER_SUBCATEGORY_IMG[sc.id] ? (
                            <Image
                              source={DISCOVER_SUBCATEGORY_IMG[sc.id]}
                              style={styles.subArt}
                              resizeMode="contain"
                            />
                          ) : (
                            <Text style={styles.subEmoji}>{sc.emoji}</Text>
                          )}
                          <Text style={styles.subName} numberOfLines={2}>
                            {sc.name}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>

                {selectedSubEmpty && (
                  <Text style={styles.emptyWarn}>
                    Bu alt kategoride henüz yayınlanmış soru yok. Başka bir alt kategori seç.
                  </Text>
                )}
              </View>
            )}

            {/* 3. Tavriko 3D Onay Butonu (Altın / Neon Mint Tavriko Stili) */}
            <TouchableOpacity
              style={[styles.confirm3DButton, !canConfirm && { opacity: 0.45 }]}
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
                <Text style={styles.confirmButtonText}>
                  {activeTab === 'special' && !selectedSub ? 'ALT KATEGORİ SEÇ' : 'SEÇİMİ ONAYLA'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  specialWrap: { width: '100%', alignItems: 'center' },
  mainRow: { paddingHorizontal: 4, gap: 8, paddingVertical: 4 },
  mainChip: {
    width: 74,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  mainChipArt: { width: 40, height: 40 },
  mainChipText: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(233,225,255,0.7)',
    paddingHorizontal: 3,
    textAlign: 'center',
  },
  mainChipTextActive: { color: '#FFFFFF' },
  subHeader: {
    marginTop: 8,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '800',
    color: '#5ADBB5',
    textAlign: 'center',
  },
  subScroll: { width: '100%', maxHeight: 300 },
  subGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 4 },
  subCell: { width: '33.333%', padding: 4 },
  subCard: {
    alignItems: 'center',
    minHeight: 112,
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 4,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  subCardEmpty: { opacity: 0.5 },
  subArt: { width: 56, height: 56 },
  subEmoji: { fontSize: 36, height: 56, lineHeight: 56 },
  subName: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subCountPill: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 2,
    minWidth: 22,
    paddingHorizontal: 5,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFC43D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subCountText: { fontSize: 10, fontWeight: '900', color: '#3B1500' },
  emptyWarn: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '800',
    color: '#FFD2DC',
    textAlign: 'center',
  },
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
