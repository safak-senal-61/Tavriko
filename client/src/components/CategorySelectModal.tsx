import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  StyleSheet,
  Platform,
} from 'react-native';
import { Search, X, Check } from 'lucide-react-native';
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

  const [query, setQuery] = useState('');
  const [emptyNotice, setEmptyNotice] = useState<string | null>(null);
  const chipScrollRef = useRef<any>(null);
  const chipX = useRef<Record<string, { x: number; w: number }>>({});

  // Soru olanlar önde, sonra katalog sırası; arama filtresi uygulanır
  const visibleSubs = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    const filtered = q
      ? subList.filter((sc) => sc.name.toLocaleLowerCase('tr').includes(q))
      : subList;
    return filtered
      .map((sc, i) => ({ sc, i }))
      .sort((a, b) => {
        const ea = a.sc.questionCount === 0 ? 1 : 0;
        const eb = b.sc.questionCount === 0 ? 1 : 0;
        return ea - eb || a.i - b.i;
      })
      .map((x) => x.sc);
  }, [subList, query]);

  // Seçili ana kategori çipini ortaya kaydır; sekme/kategori değişince arama sıfırlansın
  useEffect(() => {
    setQuery('');
    setEmptyNotice(null);
    if (activeTab !== 'special') return;
    const t = setTimeout(() => {
      const pos = chipX.current[selectedMain.id];
      if (pos) chipScrollRef.current?.scrollTo({ x: Math.max(0, pos.x - 90), animated: true });
    }, 80);
    return () => clearTimeout(t);
  }, [selectedMain.id, activeTab]);

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
                {/* Ana kategori seçici: seçilen çip otomatik görünür alana kayar */}
                <ScrollView
                  ref={chipScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.mainRow}
                  style={styles.mainScroll}
                >
                  {mainWithCounts.map((cat) => {
                    const active = cat.id === selectedMain.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        activeOpacity={0.85}
                        onLayout={(e) => {
                          chipX.current[cat.id] = {
                            x: e.nativeEvent.layout.x,
                            w: e.nativeEvent.layout.width,
                          };
                        }}
                        onPress={() => {
                          sound.playSound('tap');
                          handlePickMain(cat);
                        }}
                        style={[
                          styles.mainChip,
                          active && {
                            borderColor: cat.primaryColor,
                            backgroundColor: 'rgba(255,255,255,0.14)',
                          },
                        ]}
                      >
                        <Image
                          source={DISCOVER_CATEGORY_IMG[cat.id]}
                          style={styles.mainChipArt}
                          resizeMode="contain"
                        />
                        <Text
                          style={[styles.mainChipText, active && styles.mainChipTextActive]}
                          numberOfLines={1}
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Başlık satırı */}
                <View style={styles.subHeaderRow}>
                  <Text style={styles.subHeader} numberOfLines={1}>
                    {selectedMain.name}
                  </Text>
                  <Text style={styles.subHeaderMeta}>
                    {subList.length} alt kategori
                    {selectedMain.questionCount !== undefined
                      ? ` · ${selectedMain.questionCount} soru`
                      : ''}
                  </Text>
                </View>

                {/* Arama */}
                <View style={styles.searchBox}>
                  <Search size={15} color="rgba(233,225,255,0.55)" />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Alt kategori ara"
                    placeholderTextColor="rgba(233,225,255,0.4)"
                    style={styles.searchInput}
                    autoCorrect={false}
                  />
                  {query.length > 0 && (
                    <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                      <X size={15} color="rgba(233,225,255,0.7)" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Alt kategori ızgarası */}
                <ScrollView
                  style={styles.subScroll}
                  contentContainerStyle={styles.subGrid}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {visibleSubs.length === 0 && (
                    <Text style={styles.noResult}>Eşleşen alt kategori yok</Text>
                  )}
                  {visibleSubs.map((sc) => {
                    const active = sc.id === selectedSubId;
                    const empty = sc.questionCount === 0;
                    return (
                      <View key={sc.id} style={styles.subCell}>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => {
                            if (empty) {
                              sound.playSound('wrong');
                              setEmptyNotice(sc.name);
                              return;
                            }
                            sound.playSound('tap');
                            sound.triggerHaptic('light');
                            setEmptyNotice(null);
                            setSelectedSubId(sc.id);
                          }}
                          style={[
                            styles.subCard,
                            active && styles.subCardActive,
                            empty && styles.subCardEmpty,
                          ]}
                        >
                          {active && (
                            <View style={styles.subCheck}>
                              <Check size={12} color="#06232A" strokeWidth={4} />
                            </View>
                          )}
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
                          <View
                            style={[
                              styles.subPill,
                              empty && styles.subPillEmpty,
                              active && styles.subPillActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.subPillText,
                                empty && styles.subPillTextEmpty,
                                active && styles.subPillTextActive,
                              ]}
                            >
                              {sc.questionCount === undefined
                                ? '…'
                                : empty
                                  ? 'Yakında'
                                  : `${sc.questionCount} soru`}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>

                {/* Durum çubuğu: seçim özeti / uyarı */}
                <View style={styles.statusBar}>
                  {emptyNotice ? (
                    <Text style={styles.statusWarn} numberOfLines={2}>
                      "{emptyNotice}" için henüz soru yok. Başka bir alt kategori seç.
                    </Text>
                  ) : selectedSub ? (
                    <Text style={styles.statusOk} numberOfLines={1}>
                      Seçili: {selectedSub.name}
                      {selectedSub.questionCount !== undefined
                        ? ` · ${selectedSub.questionCount} soru`
                        : ''}
                    </Text>
                  ) : (
                    <Text style={styles.statusHint}>Bir alt kategori seç</Text>
                  )}
                </View>
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
  mainScroll: { width: '100%', flexGrow: 0 },
  mainRow: { paddingHorizontal: 2, gap: 8, paddingVertical: 4 },
  mainChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  mainChipArt: { width: 28, height: 28 },
  mainChipText: { fontSize: 12, fontWeight: '800', color: 'rgba(233,225,255,0.7)' },
  mainChipTextActive: { color: '#FFFFFF' },
  subHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 4,
  },
  subHeader: {
    flexShrink: 1,
    fontSize: 17,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  subHeaderMeta: { fontSize: 11, fontWeight: '800', color: '#5ADBB5' },
  searchBox: {
    width: '100%',
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingVertical: 0,
    ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }),
  },
  subScroll: { width: '100%', height: 292, marginTop: 8 },
  subGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 6 },
  subCell: { width: '33.333%', padding: 4 },
  subCard: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 4,
    height: 130,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  subCardActive: {
    borderColor: '#00F0FF',
    backgroundColor: 'rgba(0,240,255,0.12)',
    ...Platform.select({
      web: { boxShadow: '0 0 14px rgba(0,240,255,0.45)' } as any,
      ios: {
        shadowColor: '#00F0FF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 8,
      },
      default: {},
    }),
  },
  subCardEmpty: { opacity: 0.7, borderStyle: 'dashed' },
  subArt: { width: 54, height: 54 },
  subEmoji: { fontSize: 34, height: 54, lineHeight: 54 },
  subName: {
    flex: 1,
    marginTop: 4,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subPill: {
    minWidth: 52,
    height: 18,
    paddingHorizontal: 8,
    borderRadius: 9,
    backgroundColor: '#FFC43D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subPillEmpty: { backgroundColor: 'rgba(255,255,255,0.12)' },
  subPillActive: { backgroundColor: '#00F0FF' },
  subPillText: { fontSize: 10, fontWeight: '900', color: '#3B1500' },
  subPillTextEmpty: { color: 'rgba(233,225,255,0.7)', fontWeight: '800' },
  subPillTextActive: { color: '#06232A' },
  subCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  noResult: {
    width: '100%',
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(233,225,255,0.6)',
  },
  statusBar: { minHeight: 34, justifyContent: 'center', marginTop: 4, paddingHorizontal: 6 },
  statusOk: { fontSize: 13, fontWeight: '900', color: '#00F0FF', textAlign: 'center' },
  statusHint: { fontSize: 12, fontWeight: '800', color: 'rgba(233,225,255,0.6)', textAlign: 'center' },
  statusWarn: { fontSize: 12, fontWeight: '800', color: '#FFB4C4', textAlign: 'center' },
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
