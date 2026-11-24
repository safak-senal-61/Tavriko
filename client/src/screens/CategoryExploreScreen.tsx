import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
  TextInput,
  Image,
  Modal,
} from 'react-native';
import Reanimated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { CategoryId, CategoryInfo, ALL_CATEGORIES } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { DEFAULT_API_BASE } from '../config';
import { categoryCounts, subCountKey } from '../utils/categoryCounts';
import { PAGE_TTL } from '../utils/pageDataCache';
import { categoriesUrl } from '../utils/pageResources';
import { usePageData } from '../utils/usePageData';
import { Search } from 'lucide-react-native';
import {
  TavrikoScreen,
  TavrikoTopBar,
  TavrikoBottomNav,
  Button3D,
  CategorySquircleIcon,
} from '../components/TavrikoIcons';
import { GuestDiscoveryCard } from '../components/DiscoveryArtwork';
import { usePlayerWebLayout } from '../navigation/PlayerWebLayoutContext';
import {
  DISCOVER_CATEGORY_IMG,
  DISCOVER_SUBCATEGORY_IMG,
  HERO_DISCOVER_IMG,
} from '../components/DiscoverArtwork';

interface CategoryExploreScreenProps {
  wideLayout?: boolean;
  onBack: () => void;
  onSelectCategory: (categoryId: CategoryId, subCategory?: string) => void;
  onNavigateTab?: (tab: 'play' | 'explore' | 'leaders' | 'friends' | 'profile') => void;
  onNotifications?: () => void;
  avatarSeed?: string;
  coins?: number;
  gems?: number;
  isGuest?: boolean;
  onLoginPrompt?: () => void;
  apiBaseUrl?: string;
}

type GroupTab = 'all' | 'gaming_pop' | 'history_culture' | 'science_nature' | 'lifestyle';

const GROUP_TABS: { id: GroupTab; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'gaming_pop', label: 'Oyun & Pop' },
  { id: 'history_culture', label: 'Tarih & Kültür' },
  { id: 'science_nature', label: 'Bilim & Doğa' },
  { id: 'lifestyle', label: 'Yaşam & Spor' },
];

const GROUP_MEMBERS: Record<GroupTab, CategoryId[]> = {
  all: ALL_CATEGORIES.map((c) => c.id),
  gaming_pop: [
    'gaming_videogames',
    'anime_manga',
    'cartoons_animation',
    'comics_superheroes',
    'fantasy_fiction',
    'social_internet',
  ],
  history_culture: [
    'history',
    'mythology_ancient',
    'turkey_special',
    'art_culture',
    'literature',
  ],
  science_nature: [
    'science_tech',
    'space_astronomy',
    'biology',
    'physics_chemistry',
    'nature_ecology',
    'animals_wildlife',
    'mathematics',
  ],
  lifestyle: [
    'cinema_tv',
    'music',
    'sports',
    'food_gastronomy',
    'hobbies_leisure',
    'daily_life',
    'logic_puzzles',
    'language_vocab',
    'geography',
    'general_culture',
  ],
};

/** Yardımcı: hex rengi alfa ile rgba'ya çevirir */
const withAlpha = (hex: string, alpha: number): string => {
  const clean = (hex || '').replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

type CategoryWithCounts = CategoryInfo & { totalQuestions: number };

export const CategoryExploreScreen: React.FC<CategoryExploreScreenProps> = ({
  wideLayout = false,
  onBack,
  onSelectCategory,
  onNavigateTab,
  onNotifications,
  avatarSeed,
  coins = 0,
  gems = 0,
  isGuest = false,
  onLoginPrompt,
  apiBaseUrl,
}) => {
  const page = usePlayerWebLayout();
  const artSize = Math.round(84 * (page?.ui.art ?? 1));
  const webCategoryArt = page?.roomy && { width: artSize, height: artSize };
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const countsQuery = usePageData<CategoryInfo[]>(categoriesUrl(apiBaseUrl || DEFAULT_API_BASE), PAGE_TTL.categories);
  const { main: liveCounts, sub: liveSubCounts } = useMemo(
    () => categoryCounts(Array.isArray(countsQuery.data) ? countsQuery.data : []), [countsQuery.data],
  );
  // Canlı sayılar yüklenene kadar statik (yanıltıcı) değerler gösterilmez;
  // sayı rozetlerinde "…" yer tutucusu görünür.
  const countsLoaded = Array.isArray(countsQuery.data);
  const countLabel = (count?: number) => count !== undefined ? `${count} soru` : countsQuery.loading ? '…' : 'Sayı bilinmiyor';
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<GroupTab>('all');
  // Alt kategori seçim sayfası (bottom sheet) için seçili bölüm
  const [sheetCategory, setSheetCategory] = useState<CategoryWithCounts | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 380,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Kategoriler canlı soru sayılarıyla
  const categoriesWithRealCounts = useMemo((): CategoryWithCounts[] => {
    return ALL_CATEGORIES.filter((c) => c.id !== 'mixed').map((cat) => ({
      ...cat,
      totalQuestions:
        liveCounts[cat.id] !== undefined ? liveCounts[cat.id] : cat.totalQuestions,
      subCategories: (cat.subCategories || []).map((sc) => ({
        ...sc,
        questionCount:
          liveSubCounts[cat.id + '::' + sc.name.trim().toLowerCase()] ??
          sc.questionCount ??
          0,
      })),
    }));
  }, [liveCounts, liveSubCounts]);

  // Arama ve grup sekmesine göre filtrelenmiş bölümler
  const visibleSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const groupAllowed = new Set(GROUP_MEMBERS[activeGroup]);

    return categoriesWithRealCounts
      .filter((cat) => groupAllowed.has(cat.id))
      .map((cat) => {
        if (!q) return cat;
        // Arama: ana ad veya alt kategori adı eşleşmeli
        const nameMatch =
          cat.name.toLowerCase().includes(q) ||
          (cat.description && cat.description.toLowerCase().includes(q));
        const subs = (cat.subCategories || []).filter((sc) =>
          sc.name.toLowerCase().includes(q)
        );
        if (nameMatch) return cat;
        if (subs.length > 0) return { ...cat, subCategories: subs };
        return null;
      })
      .filter((cat): cat is CategoryWithCounts => cat !== null);
  }, [categoriesWithRealCounts, activeGroup, searchQuery]);

  const totalSubCount = useMemo(
    () => visibleSections.reduce((sum, s) => sum + (s.subCategories?.length || 0), 0),
    [visibleSections]
  );

  const totalQuestionCount = useMemo(
    () => visibleSections.reduce((sum, item) => sum + item.totalQuestions, 0),
    [visibleSections]
  );

  const handleRandomCategory = () => {
    sound.playSound('tap');
    // Rastgele bir bölümün rastgele bir alt kategorisi seçilir
    const allSubs = visibleSections.flatMap((cat) =>
      (cat.subCategories || []).map((sc) => ({ catId: cat.id, subName: sc.name }))
    );
    if (allSubs.length === 0) {
      if (visibleSections.length > 0) onSelectCategory(visibleSections[0].id);
      return;
    }
    const pick = allSubs[Math.floor(Math.random() * allSubs.length)];
    onSelectCategory(pick.catId, pick.subName);
  };

  const openSheet = (cat: CategoryWithCounts) => {
    sound.playSound('tap');
    sound.triggerHaptic('light');
    setSheetCategory(cat);
  };

  const closeSheet = () => setSheetCategory(null);

  const playAll = (cat: CategoryWithCounts) => {
    sound.playSound('tap');
    sound.triggerHaptic('medium');
    closeSheet();
    onSelectCategory(cat.id);
  };

  const playSub = (cat: CategoryWithCounts, subName: string) => {
    sound.playSound('tap');
    sound.triggerHaptic('light');
    closeSheet();
    onSelectCategory(cat.id, subName);
  };

  return (
    <TavrikoScreen mainTab>
      <TavrikoTopBar
        leftType="bell"
        onLeftPress={onNotifications || onBack}
        avatarSeed={avatarSeed}
        coins={coins}
        gems={gems}
        isGuest={isGuest}
        onGuestLoginPress={onLoginPrompt}
        onAvatarPress={() => onNavigateTab && onNavigateTab('profile')}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'web' && styles.scrollContentWeb,
          wideLayout && styles.scrollContentWide,
          isGuest && { paddingBottom: 36 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Guest Mode Feature Showcase */}
          {isGuest && (
            <GuestDiscoveryCard onPress={() => {
              sound.playSound('reward');
              sound.triggerHaptic('medium');
              onLoginPrompt?.();
            }} />
          )}

          {/* Kahraman Başlık Kartı */}
          <View style={styles.hero}>
            <Image source={HERO_DISCOVER_IMG} style={styles.heroArt} />
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>KEŞFET</Text>
              <Text style={styles.heroSubtitle} numberOfLines={2}>
                {visibleSections.length} bölüm · {totalSubCount} kategori ·{' '}
                {countsLoaded ? `${totalQuestionCount}+ soru` : countsQuery.loading ? 'soru sayıları yükleniyor…' : 'soru sayıları alınamadı'}
              </Text>
              <TouchableOpacity
                style={styles.heroRandom}
                onPress={handleRandomCategory}
                activeOpacity={0.85}
              >
                <Text style={styles.heroRandomText}>Rastgele Kategori</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Arama */}
          <View style={styles.searchBar}>
            <Search size={16} color="#D3C4EA" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Kategori ara... (örn: anime, futbol, uzay)"
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '900' }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Grup Sekmeleri */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabFilterRow}
          >
            {GROUP_TABS.map((tab) => {
              const isActive = activeGroup === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tabFilterPill, isActive && styles.tabFilterPillActive]}
                  onPress={() => {
                    sound.playSound('tap');
                    setActiveGroup(tab.id);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.tabFilterText,
                      isActive && styles.tabFilterTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Kategori kartları: telefonda iki, geniş web'de üç sütun. */}
          <View style={[styles.grid, wideLayout && styles.gridWide]}>
            {visibleSections.map((cat, idx) => {
              const accent = cat.primaryColor || '#8B5CF6';
              const art = DISCOVER_CATEGORY_IMG[cat.id];
              return (
                <Reanimated.View
                  key={`${activeGroup}-${cat.id}`}
                  entering={FadeInDown.delay(Math.min(idx, 10) * 45).duration(320)}
                  style={[styles.catCell, wideLayout && styles.catCellWide]}
                >
                  <TouchableOpacity
                    style={[
                      styles.catCard,
                      {
                        backgroundColor: withAlpha(accent, 0.13),
                        borderColor: withAlpha(accent, 0.42),
                      },
                    ]}
                    onPress={() => openSheet(cat)}
                    activeOpacity={0.85}
                  >
                    {art ? (
                      <View
                        style={[
                          styles.catArtGlow,
                          { boxShadow: `0 0 20px ${withAlpha(accent, 0.55)}` },
                        ]}
                      >
                        <Image source={art} style={[styles.catArt, webCategoryArt]} />
                      </View>
                    ) : (
                      <CategorySquircleIcon category={cat.id} size={56} />
                    )}
                    <Text style={[styles.catName, page?.roomy && styles.webCatName]} numberOfLines={2}>
                      {cat.name}
                    </Text>
                    <View style={styles.catMetaRow}>
                      <View style={styles.catCountPill}>
                        <Text style={styles.catCountText}>
                          {countLabel(liveCounts[cat.id])}
                        </Text>
                      </View>
                      <Text style={styles.catSubCount}>
                        {cat.subCategories?.length || 0} alt
                      </Text>
                    </View>
                  </TouchableOpacity>
                </Reanimated.View>
              );
            })}
          </View>

          {visibleSections.length === 0 && (
            <View style={styles.emptyState}>
              <Search size={32} color="#D3C4EA" style={{ marginBottom: 6 }} />
              <Text style={styles.emptyTitle}>Eşleşen Kategori Bulunamadı</Text>
              <Text style={styles.emptySub}>
                Farklı bir arama terimi deneyebilir veya grup sekmesini değiştirebilirsin.
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Alt Kategori Seçim Sayfası */}
      <Modal
        visible={sheetCategory !== null}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={closeSheet}
        >
          <TouchableOpacity
            style={[
              styles.sheet,
              sheetCategory && {
                borderColor: withAlpha(sheetCategory.primaryColor || '#8B5CF6', 0.45),
              },
            ]}
            activeOpacity={1}
            onPress={() => {}}
          >
            {sheetCategory && (
              <View>
                <View style={styles.sheetHandle} />

                {/* Bölüm başlığı */}
                <View style={styles.sheetHeader}>
                  {DISCOVER_CATEGORY_IMG[sheetCategory.id] ? (
                    <Image
                      source={DISCOVER_CATEGORY_IMG[sheetCategory.id]}
                      style={styles.sheetArt}
                    />
                  ) : null}
                  <View style={styles.sheetHeaderText}>
                    <Text style={styles.sheetTitle} numberOfLines={2}>
                      {sheetCategory.name}
                    </Text>
                    <Text style={styles.sheetDesc} numberOfLines={2}>
                      {sheetCategory.description}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.sheetClose}
                    onPress={closeSheet}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.sheetCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* İstatistikler */}
                <View style={styles.sheetStatsRow}>
                  <View style={styles.sheetStatPill}>
                    <Text style={styles.sheetStatText}>
                      {countLabel(liveCounts[sheetCategory.id])}
                    </Text>
                  </View>
                  <View style={styles.sheetStatPill}>
                    <Text style={styles.sheetStatText}>
                      {sheetCategory.subCategories?.length || 0} alt kategori
                    </Text>
                  </View>
                </View>

                <Button3D
                  title="TÜMÜNÜ OYNA"
                  variant="gold"
                  onPress={() => playAll(sheetCategory)}
                  style={{ marginTop: 12 }}
                />

                {/* Alt kategoriler */}
                {(sheetCategory.subCategories || []).length > 0 && (
                  <>
                    <Text style={styles.sheetSubLabel}>ALT KATEGORİLER</Text>
                    <ScrollView
                      style={[
                        styles.sheetSubScroll,
                        {
                          height: Math.min(
                            340,
                            Math.ceil(
                              (sheetCategory.subCategories?.length || 0) / 2
                            ) * 50 + 8
                          ),
                        },
                      ]}
                      contentContainerStyle={styles.sheetSubWrap}
                      showsVerticalScrollIndicator={false}
                    >
                      {(sheetCategory.subCategories || []).map((sc) => (
                        <TouchableOpacity
                          key={sc.id}
                          style={[
                            styles.subChip,
                            {
                              backgroundColor: withAlpha(
                                sheetCategory.primaryColor || '#8B5CF6',
                                0.14
                              ),
                              borderColor: withAlpha(
                                sheetCategory.primaryColor || '#8B5CF6',
                                0.4
                              ),
                            },
                          ]}
                          onPress={() => playSub(sheetCategory, sc.name)}
                          activeOpacity={0.8}
                        >
                          {DISCOVER_SUBCATEGORY_IMG[sc.id] ? (
                            <Image
                              source={DISCOVER_SUBCATEGORY_IMG[sc.id]}
                              style={styles.subChipArt}
                            />
                          ) : (
                            <CategorySquircleIcon category={sheetCategory.id} size={34} />
                          )}
                          <Text style={styles.subChipName} numberOfLines={2}>
                            {sc.name}
                          </Text>
                          <Text style={styles.subChipCount}>
                            {liveSubCounts[subCountKey(sheetCategory.id, sc.name)] ?? (countsQuery.loading ? '…' : '—')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {!isGuest && (
        <TavrikoBottomNav
          activeTab="explore"
          onSelectTab={(tab) => {
            if (tab === 'play') onBack();
            else if (onNavigateTab) onNavigateTab(tab);
          }}
        />
      )}
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 120,
    paddingHorizontal: 12,
  },
  scrollContentWeb: { paddingBottom: 12 },
  scrollContentWide: { paddingHorizontal: 0 },

  // Kahraman başlık kartı
  hero: {
    minHeight: 150,
    borderRadius: 24,
    borderWidth: 1.4,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(91, 44, 196, 0.22)',
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 12,
    paddingVertical: 12,
  },
  heroArt: {
    position: 'absolute',
    right: -6,
    top: -6,
    width: 196,
    height: '118%',
    resizeMode: 'contain',
    opacity: 0.95,
  },
  heroContent: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 16,
    paddingRight: 158,
  },
  heroTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 32,
    lineHeight: 34,
    color: '#FFFFFF',
    marginBottom: 3,
  },
  heroSubtitle: {
    color: '#CBBFE8',
    fontSize: 10.5,
    fontFamily: THEME.fonts.extraBold,
    lineHeight: 14,
  },
  heroRandom: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#FFC43D',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroRandomText: {
    color: '#241050',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '900',
  },

  // Arama
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    borderRadius: 16,
    borderWidth: 1.4,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.medium,
  },

  // Grup sekmeleri
  tabFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  tabFilterPill: {
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabFilterPillActive: {
    backgroundColor: '#FFC43D',
    borderColor: '#FFC43D',
  },
  tabFilterText: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  tabFilterTextActive: {
    color: '#241050',
    fontWeight: '900',
  },

  // Kategori ızgarası
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  catCell: {
    width: '48.6%',
  },
  gridWide: { justifyContent: 'flex-start', columnGap: '2%' },
  catCellWide: { width: '32%' },
  catCard: {
    borderRadius: 22,
    borderWidth: 1.4,
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 10,
  },
  catArtGlow: {
    borderRadius: 18,
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 14,
      },
      android: { elevation: 8 },
      web: {},
    }),
  },
  catArt: {
    width: 84,
    height: 84,
    resizeMode: 'contain',
  },
  webCatName: { fontSize: 16, lineHeight: 21 },
  catEmojiFallback: {
    fontSize: 40,
    lineHeight: 92,
    height: 92,
    marginBottom: 8,
  },
  catName: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 16,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    minHeight: 32,
  },
  catMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  catCountPill: {
    backgroundColor: 'rgba(90, 219, 181, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  catCountText: {
    color: '#5ADBB5',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  catSubCount: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 10,
    fontFamily: THEME.fonts.bold,
  },

  // Boş durum
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.display,
  },
  emptySub: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: THEME.fonts.medium,
    textAlign: 'center',
    marginTop: 4,
  },

  // Alt sayfa (bottom sheet)
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 2, 16, 0.74)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1A0E3C',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1.4,
    borderBottomWidth: 0,
    maxHeight: '84%',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 26,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetArt: {
    width: 64,
    height: 64,
    resizeMode: 'contain',
  },
  sheetHeaderText: {
    flex: 1,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 22,
    fontFamily: THEME.fonts.display,
  },
  sheetDesc: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 14,
    fontFamily: THEME.fonts.medium,
    marginTop: 2,
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseText: {
    color: '#CBBFE8',
    fontSize: 14,
    fontWeight: '900',
  },
  sheetStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  sheetStatPill: {
    backgroundColor: 'rgba(90, 219, 181, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sheetStatText: {
    color: '#5ADBB5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  sheetSubLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 1.5,
    marginTop: 16,
    marginBottom: 10,
  },
  sheetSubScroll: {},
  sheetSubWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 4,
  },
  subChip: {
    width: '48.4%',
    borderRadius: 14,
    borderWidth: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  subChipArt: {
    width: 34,
    height: 34,
    resizeMode: 'contain',
  },
  subChipEmoji: {
    fontSize: 17,
  },
  subChipName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 10.5,
    lineHeight: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  subChipCount: {
    color: '#5ADBB5',
    fontSize: 9.5,
    fontFamily: THEME.fonts.bold,
    backgroundColor: 'rgba(10, 4, 24, 0.6)',
    borderRadius: 7,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
});
