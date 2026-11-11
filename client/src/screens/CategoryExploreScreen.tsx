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
} from 'react-native';
import Reanimated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { CategoryId, CategoryInfo, ALL_CATEGORIES } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { DEFAULT_API_BASE } from '../config';
import {
  TavrikoScreen,
  TavrikoTopBar,
  TavrikoBottomNav,
  Button3D,
} from '../components/TavrikoIcons';
import { GuestDiscoveryCard } from '../components/DiscoveryArtwork';

interface CategoryExploreScreenProps {
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
  { id: 'gaming_pop', label: '🎮 Oyun & Pop' },
  { id: 'history_culture', label: '🏛️ Tarih & Kültür' },
  { id: 'science_nature', label: '🔬 Bilim & Doğa' },
  { id: 'lifestyle', label: '🎯 Yaşam & Spor' },
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
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const CategoryExploreScreen: React.FC<CategoryExploreScreenProps> = ({
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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});
  const [liveSubCounts, setLiveSubCounts] = useState<Record<string, number>>({});
  // Canlı sayılar yüklenene kadar statik (yanıltıcı) değerler gösterilmez;
  // sayı rozetlerinde "…" yer tutucusu görünür.
  const [countsLoaded, setCountsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<GroupTab>('all');

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

  useEffect(() => {
    const base = apiBaseUrl || DEFAULT_API_BASE;
    let isMounted = true;
    fetch(`${base}/categories`)
      .then((res) => res.json())
      .then((data: CategoryInfo[]) => {
        if (!isMounted || !Array.isArray(data)) return;
        const map: Record<string, number> = {};
        const subMap: Record<string, number> = {};
        for (const c of data) {
          if (c && c.id) {
            map[c.id] = c.totalQuestions;
            for (const sc of c.subCategories || []) {
              if (sc && sc.name) {
                subMap[c.id + '::' + sc.name.trim().toLowerCase()] =
                  sc.questionCount ?? 0;
              }
            }
          }
        }
        setLiveCounts(map);
        setLiveSubCounts(subMap);
        setCountsLoaded(true);
      })
      .catch(() => {
        // Hata olsa bile arayüz "…" üzerinde takılı kalmasın; statik değerler
        // artık gerçekçi olmadığı için 0 üzerinden render edilir.
        setCountsLoaded(true);
      });
    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  // Kategoriler canlı soru sayılarıyla
  const categoriesWithRealCounts = useMemo((): CategoryInfo[] => {
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
      .filter((cat): cat is CategoryInfo & { totalQuestions: number } => cat !== null);
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

  return (
    <TavrikoScreen>
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

          {/* Sayfa Başlığı */}
          <Text style={styles.title}>KEŞFET</Text>
          <Text style={styles.subtitle}>
            {visibleSections.length} bölüm · {totalSubCount} kategori ·{' '}
            {countsLoaded ? `${totalQuestionCount}+ soru` : 'soru sayıları yükleniyor…'}
          </Text>

          {/* Arama */}
          <View style={styles.searchBar}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
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

          {/* Bölümler: üstte sadece bölüm adı yazısı, altında normal kategori gibi alt kategoriler */}
          {visibleSections.map((cat, sIdx) => {
            const accent = cat.primaryColor || '#8B5CF6';
            return (
              <Reanimated.View
                key={`${activeGroup}-${cat.id}`}
                entering={FadeInDown.delay(Math.min(sIdx, 6) * 60).duration(320)}
                style={styles.sectionWrap}
              >
                {/* Bölüm Başlığı — sadece yazı */}
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderLeft}>
                    <View style={[styles.sectionAccentBar, { backgroundColor: accent }]} />
                    <Text style={styles.sectionTitle}>{cat.name}</Text>
                    <Text style={styles.sectionCount}>
                      {countsLoaded ? `${cat.totalQuestions} soru` : '…'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.sectionPlayAll}
                    onPress={() => {
                      sound.playSound('tap');
                      sound.triggerHaptic('light');
                      onSelectCategory(cat.id);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.sectionPlayAllText}>Tümünü Oyna →</Text>
                  </TouchableOpacity>
                </View>

                {/* Alt kategoriler: normal kategori kartları */}
                <View style={styles.grid}>
                  {(cat.subCategories || []).map((sc, idx) => (
                    <Reanimated.View
                      key={`${cat.id}-${sc.id}`}
                      entering={FadeIn.delay(Math.min(idx, 10) * 25).duration(280)}
                      style={styles.catCell}
                    >
                      <TouchableOpacity
                        style={[
                          styles.catTile,
                          {
                            backgroundColor: withAlpha(accent, 0.14),
                            borderColor: withAlpha(accent, 0.45),
                          },
                        ]}
                        onPress={() => {
                          sound.playSound('tap');
                          sound.triggerHaptic('light');
                          onSelectCategory(cat.id, sc.name);
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.catEmoji}>{sc.emoji}</Text>
                        <Text style={styles.catName} numberOfLines={2}>
                          {sc.name}
                        </Text>
                        <Text style={styles.catCount}>
                          {countsLoaded ? `${sc.questionCount ?? 0} soru` : '…'}
                        </Text>
                      </TouchableOpacity>
                    </Reanimated.View>
                  ))}
                </View>
              </Reanimated.View>
            );
          })}

          {visibleSections.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 32, marginBottom: 6 }}>🔍</Text>
              <Text style={styles.emptyTitle}>Eşleşen Kategori Bulunamadı</Text>
              <Text style={styles.emptySub}>
                Farklı bir arama terimi deneyebilir veya grup sekmesini değiştirebilirsin.
              </Text>
            </View>
          )}

          {/* Rastgele Kategori */}
          <View style={{ marginTop: 20 }}>
            <Button3D
              title="🎲 RASTGELE KATEGORİ SEÇ"
              variant="mint"
              onPress={handleRandomCategory}
            />
          </View>
        </Animated.View>
      </ScrollView>

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
    paddingHorizontal: 2,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 30,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 2,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    marginHorizontal: 4,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.medium,
  },
  tabFilterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  tabFilterPill: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabFilterPillActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  tabFilterText: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  tabFilterTextActive: {
    color: '#0F172A',
    fontWeight: '900',
  },

  // Bölüm yapısı
  sectionWrap: {
    marginBottom: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  sectionAccentBar: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: 8,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: THEME.fonts.display,
    letterSpacing: 0.5,
  },
  sectionCount: {
    color: '#5ADBB5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    backgroundColor: 'rgba(90, 219, 181, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 8,
    overflow: 'hidden',
  },
  sectionPlayAll: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    marginLeft: 8,
  },
  sectionPlayAllText: {
    color: '#5ADBB5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },

  // Kategori ızgarası
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    paddingHorizontal: 2,
  },
  catCell: {
    width: '31.8%',
  },
  catTile: {
    height: 96,
    borderRadius: 18,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
  },
  catEmoji: {
    fontSize: 30,
    lineHeight: 34,
  },
  catName: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
  },
  catCount: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 9.5,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
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
});
