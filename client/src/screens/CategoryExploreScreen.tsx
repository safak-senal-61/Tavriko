import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { CategoryId, CategoryInfo } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { DEFAULT_API_BASE } from '../config';
import {
  TavrikoScreen,
  TavrikoTopBar,
  TavrikoBottomNav,
  Button3D,
  CategorySquircleIcon,
  TavrikoCategoryKey,
  CrownIcon,
  SpeedBoltIcon,
  TrophyIcon,
  CoinIcon,
} from '../components/TavrikoIcons';
interface CategoryExploreScreenProps {
  onBack: () => void;
  onSelectCategory: (categoryId: CategoryId) => void;
  onNavigateTab?: (tab: 'play' | 'explore' | 'leaders' | 'friends' | 'profile') => void;
  onNotifications?: () => void;
  avatarSeed?: string;
  coins?: number;
  gems?: number;
  isGuest?: boolean;
  onLoginPrompt?: () => void;
  apiBaseUrl?: string;
}
const UI_KIT_CATEGORIES: {
  key: TavrikoCategoryKey;
  id: CategoryId;
  name: string;
  defaultCount: number;
}[] = [
  { key: 'bilim', id: 'science_tech', name: 'Bilim', defaultCount: 10 },
  { key: 'tarih', id: 'history', name: 'Tarih', defaultCount: 12 },
  { key: 'cografya', id: 'geography', name: 'Coğrafya', defaultCount: 15 },
  { key: 'spor', id: 'sports', name: 'Spor', defaultCount: 7 },
  { key: 'sinema', id: 'cinema_tv', name: 'Sinema', defaultCount: 6 },
  { key: 'muzik', id: 'music', name: 'Müzik', defaultCount: 6 },
  { key: 'sanat', id: 'art_culture', name: 'Sanat', defaultCount: 6 },
  { key: 'teknoloji', id: 'physics_chemistry', name: 'Teknoloji', defaultCount: 6 },
  { key: 'doga', id: 'nature_ecology', name: 'Doğa', defaultCount: 14 },
  { key: 'yemek', id: 'food_gastronomy', name: 'Yemek', defaultCount: 17 },
  { key: 'edebiyat', id: 'literature', name: 'Edebiyat', defaultCount: 6 },
  { key: 'uzay', id: 'space_astronomy', name: 'Uzay', defaultCount: 6 },
  { key: 'hayvanlar', id: 'animals_wildlife', name: 'Hayvanlar', defaultCount: 14 },
  { key: 'matematik', id: 'mathematics', name: 'Matematik', defaultCount: 11 },
  { key: 'oyun', id: 'logic_puzzles', name: 'Oyun & Zeka', defaultCount: 6 },
  { key: 'genel_kultur', id: 'general_culture', name: 'Genel Kültür', defaultCount: 16 },
];
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
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        useNativeDriver: true,
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
  const categoriesWithRealCounts = UI_KIT_CATEGORIES.map((cat) => ({
    ...cat,
    count:
      liveCounts[cat.id] !== undefined ? liveCounts[cat.id] : cat.defaultCount,
  }));
  const totalQuestionCount = categoriesWithRealCounts.reduce(
    (sum, item) => sum + item.count,
    0
  );
  const handleRandomCategory = () => {
    const randomItem =
      UI_KIT_CATEGORIES[Math.floor(Math.random() * UI_KIT_CATEGORIES.length)];
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
          {/* Guest Mode Feature Showcase Card to Motivate Login */}
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
          <Text style={styles.title}>KATEGORİLER</Text>
          <Text style={styles.subtitle}>
            {UI_KIT_CATEGORIES.length} kategori · {totalQuestionCount} gerçek soru
          </Text>
          {/* 4x4 Category Grid */}
          <View style={styles.grid}>
            {categoriesWithRealCounts.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={styles.catTile}
                onPress={() => {
                  sound.playSound('tap');
                  sound.triggerHaptic('light');
                  onSelectCategory(cat.id);
                }}
                activeOpacity={0.85}
              >
                <CategorySquircleIcon category={cat.key} size={42} />
                <Text style={styles.catName} numberOfLines={1}>
                  {cat.name}
                </Text>
                <Text style={styles.catCount}>{cat.count} soru</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ marginTop: 16 }}>
            <Button3D
              title="RASTGELE KATEGORİ"
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
    paddingBottom: 110,
  },
  guestShowcaseCard: {
    marginTop: 6,
    marginBottom: 6,
    backgroundColor: 'rgba(42, 18, 92, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 196, 61, 0.45)',
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
    backgroundColor: '#5ADBB5',
    borderBottomWidth: 3,
    borderBottomColor: '#1D7A6B',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  guestCtaActionText: {
    color: '#0C3A33',
    fontSize: 12,
    fontFamily: THEME.fonts.display,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 34,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 2,
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  catTile: {
    width: '23.5%',
    height: 100,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  catName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
  },
  catCount: {
    color: '#E6DCFF',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
});