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
  Modal,
} from 'react-native';
import { CategoryId, CategoryInfo, ALL_CATEGORIES } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { DEFAULT_API_BASE } from '../config';
import {
  TavrikoScreen,
  TavrikoTopBar,
  TavrikoBottomNav,
  Button3D,
  CategorySquircleIcon,
  SpeedBoltIcon,
  TrophyIcon,
  CoinIcon,
} from '../components/TavrikoIcons';

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
  { id: 'all', label: 'Tümü (28)' },
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<GroupTab>('all');
  const [selectedCatModal, setSelectedCatModal] = useState<CategoryInfo | null>(null);

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
        for (const c of data) {
          if (c && c.id) {
            map[c.id] = c.totalQuestions;
          }
        }
        setLiveCounts(map);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  // Categories list with live counts
  const categoriesWithRealCounts = useMemo(() => {
    return ALL_CATEGORIES.filter((c) => c.id !== 'mixed').map((cat) => ({
      ...cat,
      totalQuestions:
        liveCounts[cat.id] !== undefined ? liveCounts[cat.id] : cat.totalQuestions,
    }));
  }, [liveCounts]);

  // Filtered categories by search and group tabs
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const groupAllowed = new Set(GROUP_MEMBERS[activeGroup]);

    return categoriesWithRealCounts.filter((cat) => {
      if (!groupAllowed.has(cat.id)) return false;
      if (!q) return true;

      // Match main name or description
      if (cat.name.toLowerCase().includes(q)) return true;
      if (cat.description.toLowerCase().includes(q)) return true;

      // Match subcategories!
      if (cat.subCategories && cat.subCategories.some((sc) => sc.name.toLowerCase().includes(q))) {
        return true;
      }
      return false;
    });
  }, [categoriesWithRealCounts, activeGroup, searchQuery]);

  const totalQuestionCount = useMemo(() => {
    return categoriesWithRealCounts.reduce((sum, item) => sum + item.totalQuestions, 0);
  }, [categoriesWithRealCounts]);

  const handleRandomCategory = () => {
    sound.playSound('tap');
    const randomItem =
      categoriesWithRealCounts[Math.floor(Math.random() * categoriesWithRealCounts.length)];
    onSelectCategory(randomItem.id);
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
            <View style={styles.guestShowcaseCard}>
              <View style={styles.guestShowcaseHeader}>
                <Text style={styles.guestShowcaseTitle}>
                  ARKADAŞINLA OYNA & TÜM ÖZELLİKLERİ AÇ!
                </Text>
              </View>
              <Text style={styles.guestShowcaseDesc}>
                Ücretsiz hesap oluşturarak veya Google ile tek tıkla bağlanarak rekabete katıl:
              </Text>
              <View style={styles.perksGrid}>
                <View style={styles.perkChip}>
                  <SpeedBoltIcon size={14} />
                  <Text style={styles.perkChipText}>Canlı 1v1 Düello</Text>
                </View>
                <View style={styles.perkChip}>
                  <TrophyIcon size={14} />
                  <Text style={styles.perkChipText}>Arkadaşınla Özel Oda</Text>
                </View>
                <View style={styles.perkChip}>
                  <TrophyIcon size={14} />
                  <Text style={styles.perkChipText}>Pro Lig & Liderlik</Text>
                </View>
                <View style={styles.perkChip}>
                  <CoinIcon size={14} />
                  <Text style={styles.perkChipText}>+800 Altın Başlangıç</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.guestCtaActionBtn}
                onPress={() => {
                  sound.playSound('reward');
                  sound.triggerHaptic('medium');
                  if (onLoginPrompt) onLoginPrompt();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.guestCtaActionText}>
                  HEMEN GİRİŞ YAP / ÜCRETSİZ KAYIT OL →
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Screen Title */}
          <Text style={styles.title}>KATEGORİLER</Text>
          <Text style={styles.subtitle}>
            {categoriesWithRealCounts.length} ana branş · {totalQuestionCount}+ soru havuzu
          </Text>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Branş veya alt konu ara... (örn: anime, shonen, fps)"
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

          {/* Group Filter Tabs */}
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

          {/* 4x4 Grid of Categories */}
          <View style={styles.grid}>
            {filteredCategories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={styles.catTile}
                onPress={() => {
                  sound.playSound('tap');
                  sound.triggerHaptic('light');
                  setSelectedCatModal(cat);
                }}
                activeOpacity={0.85}
              >
                <CategorySquircleIcon category={cat.id} size={42} />
                <Text style={styles.catName} numberOfLines={1}>
                  {cat.name}
                </Text>
                <Text style={styles.catCount}>{cat.totalQuestions} soru</Text>
              </TouchableOpacity>
            ))}
          </View>

          {filteredCategories.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 32, marginBottom: 6 }}>🔍</Text>
              <Text style={styles.emptyTitle}>Eşleşen Kategori Bulunamadı</Text>
              <Text style={styles.emptySub}>
                Farklı bir arama terimi deneyebilir veya grup sekmesini değiştirebilirsin.
              </Text>
            </View>
          )}

          {/* Random Category Button */}
          <View style={{ marginTop: 20 }}>
            <Button3D
              title="🎲 RASTGELE BRANŞ SEÇ"
              variant="mint"
              onPress={handleRandomCategory}
            />
          </View>
        </Animated.View>
      </ScrollView>

      {/* Subcategory Detail Modal */}
      {selectedCatModal && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedCatModal(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeaderRow}>
                <CategorySquircleIcon category={selectedCatModal.id} size={50} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.modalTitle}>{selectedCatModal.name}</Text>
                  <Text style={styles.modalSub}>{selectedCatModal.description}</Text>
                  <Text style={styles.modalCountBadge}>
                    🎯 Toplam {selectedCatModal.totalQuestions} soru mevcut
                  </Text>
                </View>
              </View>

              {/* Action 1: Play all category questions */}
              <TouchableOpacity
                style={styles.playAllBtn}
                onPress={() => {
                  sound.playSound('tap');
                  const catId = selectedCatModal.id;
                  setSelectedCatModal(null);
                  onSelectCategory(catId);
                }}
                activeOpacity={0.88}
              >
                <Text style={styles.playAllBtnText}>⚡ TÜM BRANŞI OYNA</Text>
              </TouchableOpacity>

              {/* Subcategories title */}
              {selectedCatModal.subCategories && selectedCatModal.subCategories.length > 0 && (
                <>
                  <Text style={styles.subCatHeader}>
                    Alt Başlıklar ({selectedCatModal.subCategories.length})
                  </Text>
                  <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
                    <View style={styles.subCatGrid}>
                      {selectedCatModal.subCategories.map((sc) => (
                        <TouchableOpacity
                          key={sc.id}
                          style={styles.subCatPill}
                          onPress={() => {
                            sound.playSound('tap');
                            const catId = selectedCatModal.id;
                            const subName = sc.name;
                            setSelectedCatModal(null);
                            onSelectCategory(catId, subName);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={{ fontSize: 16, marginRight: 6 }}>{sc.emoji}</Text>
                          <Text style={styles.subCatPillText} numberOfLines={1}>
                            {sc.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}

              {/* Close Button */}
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedCatModal(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCloseBtnText}>KAPAT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

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
  guestShowcaseCard: {
    marginTop: 6,
    marginBottom: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderRadius: 22,
    padding: 14,
    gap: 8,
  },
  guestShowcaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guestShowcaseTitle: {
    flex: 1,
    color: '#FFC43D',
    fontSize: 13,
    fontFamily: THEME.fonts.display,
  },
  guestShowcaseDesc: {
    color: '#E6DCFF',
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
  },
  perksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  perkChip: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  perkChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  guestCtaActionBtn: {
    marginTop: 4,
    backgroundColor: '#10B981',
    borderBottomWidth: 3,
    borderBottomColor: '#065F46',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  guestCtaActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    paddingHorizontal: 4,
  },
  catTile: {
    width: '23.5%',
    height: 104,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 3,
  },
  catName: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
  },
  catCount: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontFamily: THEME.fonts.extraBold,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 2, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: { elevation: 10 },
      web: { boxShadow: '0 8px 30px rgba(245, 158, 11, 0.25)' },
    }),
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
  },
  modalSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
    marginTop: 2,
  },
  modalCountBadge: {
    color: '#10B981',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 4,
  },
  playAllBtn: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' },
    }),
  },
  playAllBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  subCatHeader: {
    color: '#FFC43D',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subCatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingBottom: 8,
  },
  subCatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  subCatPillText: {
    color: '#E2E8F0',
    fontSize: 11.5,
    fontFamily: THEME.fonts.bold,
  },
  modalCloseBtn: {
    marginTop: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  modalCloseBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
});
