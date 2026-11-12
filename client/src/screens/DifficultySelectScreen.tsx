import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  ImageSourcePropType,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { CategoryId, DifficultyLevel, ALL_CATEGORIES } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import {
  TavrikoScreen,
  TavrikoTopBar,
  Button3D,
  XpStarIcon,
} from '../components/TavrikoIcons';
import { GradientFill } from '../components/TavrikoGradient';
import {
  DISCOVER_CATEGORY_IMG,
  DISCOVER_SUBCATEGORY_IMG,
} from '../components/DiscoverArtwork';

const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20] as const;

interface DifficultySelectScreenProps {
  categoryId: CategoryId;
  subCategory?: string;
  onBack: () => void;
  onSelectDifficulty: (difficulty: DifficultyLevel, questionCount: number) => void;
  avatarSeed?: string;
  coins?: number;
  gems?: number;
  isGuest?: boolean;
  onLoginPrompt?: () => void;
}

/**
 * Kart dili diğer Tavriko sayfalarıyla birebir aynı bırakıldı:
 * koyu mor gövde + neon renk kenar şeridi + seçiliyse renkli çerçeve
 * ve yumuşak ışıma. (Dolgu animasyonu yerine statik ince renk tonu
 * kullanılır; köşe kesmesi/taşma oluşturmaz.)
 */
const DIFFICULTIES: {
  id: DifficultyLevel;
  title: string;
  color: string;
  tint: string;
  glow: string;
  stars: number;
  xpMultiplier: string;
  xpShort: string;
  desc: string;
}[] = [
  {
    id: 'easy',
    title: 'Kolay',
    color: '#3FD08A',
    tint: 'rgba(63, 208, 138, 0.10)',
    glow: 'rgba(63, 208, 138, 0.45)',
    stars: 1,
    xpMultiplier: 'x1 XP',
    xpShort: 'x1',
    desc: 'Isınma turu',
  },
  {
    id: 'medium',
    title: 'Orta',
    color: '#FFC43D',
    tint: 'rgba(255, 196, 61, 0.10)',
    glow: 'rgba(255, 196, 61, 0.45)',
    stars: 2,
    xpMultiplier: 'x1,25 XP',
    xpShort: 'x1,25',
    desc: 'Dengeli mücadele',
  },
  {
    id: 'hard',
    title: 'Zor',
    color: '#FF9B2F',
    tint: 'rgba(255, 155, 47, 0.12)',
    glow: 'rgba(255, 155, 47, 0.45)',
    stars: 3,
    xpMultiplier: 'x1,5 XP',
    xpShort: 'x1,5',
    desc: 'Bilgi savaşçısı',
  },
  {
    id: 'expert',
    title: 'Uzman',
    color: '#FF5A6A',
    tint: 'rgba(255, 90, 106, 0.12)',
    glow: 'rgba(255, 90, 106, 0.45)',
    stars: 4,
    xpMultiplier: 'x2 XP',
    xpShort: 'x2',
    desc: 'Efsane ayarı',
  },
];

const CountPill: React.FC<{
  count: number;
  selected: boolean;
  onPress: () => void;
  delay: number;
}> = ({ count, selected, onPress, delay }) => {
  // Ölçek animasyonu kaldırıldı: basınca buton ekran dışına taşıyordu.
  // Seçim vurgusu yalnızca renk/çerçeve ile verilir.
  return (
    <Animated.View entering={ZoomIn.delay(delay).duration(320).springify(0.7)} style={styles.countPillWrap}>
      <TouchableOpacity
        style={[
          styles.countPill,
          selected && styles.countPillSelected,
          selected && { shadowColor: 'rgba(255, 196, 61, 0.5)' },
        ]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Text style={[styles.countPillText, selected && styles.countPillTextSelected]}>
          {count}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const DifficultyCard: React.FC<{
  diff: (typeof DIFFICULTIES)[number];
  index: number;
  selected: boolean;
  onPress: () => void;
}> = ({ diff, index, selected, onPress }) => {
  // Ölçek animasyonu kaldırıldı: basınca kart ekran dışına taşıyordu.
  return (
    <Animated.View
      entering={FadeInDown.delay(140 + index * 80).duration(420).springify(0.8)}
    >
      <TouchableOpacity
        style={[
          styles.diffCard,
          { shadowColor: selected ? diff.glow : 'transparent' },
          selected && { backgroundColor: diff.tint },
          selected && { borderColor: diff.color },
        ]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {/* Çarpan madalyonu: zorluk rengiyle parlayan daire */}
        <View
          style={[
            styles.diffMedal,
            { borderColor: `${diff.color}66`, backgroundColor: `${diff.color}14` },
            selected && { shadowColor: diff.glow },
          ]}
        >
          <Text style={[styles.diffMedalText, { color: diff.color }]}>{diff.xpShort}</Text>
        </View>
        <View style={styles.diffBody}>
          <View style={styles.diffTitleRow}>
            <Text style={[styles.diffTitle, { color: diff.color }]}>{diff.title}</Text>
            <View style={styles.starsRow}>
              {Array.from({ length: diff.stars }).map((_, idx) => (
                <XpStarIcon key={idx} size={17} />
              ))}
            </View>
          </View>
          <Text style={styles.diffDesc}>{diff.desc}</Text>
        </View>
        <View style={[styles.xpPill, { borderColor: `${diff.color}59` }]}>
          <Text style={[styles.xpPillText, { color: diff.color }]}>{diff.xpMultiplier}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const DifficultySelectScreen: React.FC<DifficultySelectScreenProps> = ({
  categoryId,
  subCategory,
  onBack,
  onSelectDifficulty,
  avatarSeed,
  coins = 0,
  gems = 0,
  isGuest = false,
  onLoginPrompt,
}) => {
  const [selected, setSelected] = useState<DifficultyLevel>('hard');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const category = ALL_CATEGORIES.find((c) => c.id === categoryId);
  const selectedDiff = useMemo(() => DIFFICULTIES.find((d) => d.id === selected), [selected]);

  // Kategori ve alt kategori görselleri (Keşfet ekranındaki 3B ikonlar)
  const categoryArt: ImageSourcePropType | undefined = DISCOVER_CATEGORY_IMG[categoryId];
  // subCategory parametresi alt kategorinin GÖRÜNEN ADI olarak gelir;
  // görseli id üzerinden eşleştirmek için ada göre id bulunur.
  const subCategoryName = subCategory;
  const subCategoryArt: ImageSourcePropType | undefined = useMemo(() => {
    if (!category || !subCategory) return undefined;
    const sub = category.subCategories.find((s) => s.name === subCategory);
    return sub ? DISCOVER_SUBCATEGORY_IMG[sub.id] : undefined;
  }, [category, subCategory]);

  return (
    <TavrikoScreen>
      <TavrikoTopBar
        leftType="back"
        onLeftPress={onBack}
        avatarSeed={avatarSeed}
        coins={coins}
        gems={gems}
        isGuest={isGuest}
        onGuestLoginPress={onLoginPrompt}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero banner: kategori görseli + kademeli mor degrade */}
        <Animated.View
          entering={FadeInDown.duration(460).springify(0.8)}
          style={styles.heroBanner}
        >
          <Image
            source={require('../../assets/images/discovery/duel_arena.webp')}
            style={styles.heroBackdrop}
            resizeMode="cover"
          />
          <GradientFill
            colors={['rgba(24, 10, 48, 0.55)', 'rgba(24, 10, 48, 0.94)']}
            direction="diagonal"
          />
          <View style={styles.heroRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>TAVRİKO ARENA</Text>
              <Text style={styles.title}>ZORLUK SEVİYESİ</Text>
              <View style={styles.chipRow}>
                <View style={styles.chip}>
                  {categoryArt ? (
                    <Image source={categoryArt} style={styles.chipIcon} />
                  ) : null}
                  <Text style={styles.chipText}>{category?.name || 'Kategori'}</Text>
                </View>
                {subCategoryName ? (
                  <View style={[styles.chip, styles.chipAccent]}>
                    {subCategoryArt ? (
                      <Image source={subCategoryArt} style={styles.chipIcon} />
                    ) : null}
                    <Text style={[styles.chipText, { color: '#5ADBB5' }]}>{subCategoryName}</Text>
                  </View>
                ) : null}
                <View style={[styles.chip, styles.chipAccent]}>
                  <Text style={[styles.chipText, { color: '#FFC43D' }]}>{questionCount} soru</Text>
                </View>
              </View>
            </View>
            {/* Kategorinin 3B görseli: sağda büyük, ışıklı madalyon */}
            {categoryArt ? (
              <Animated.View
                entering={ZoomIn.delay(120).duration(520).springify(0.7)}
                style={styles.heroArtWrap}
              >
                <View style={styles.heroArtGlow} />
                <Image source={categoryArt} style={styles.heroArt} />
                {subCategoryArt ? (
                  <View style={styles.heroSubBadge}>
                    <Image source={subCategoryArt} style={styles.heroSubBadgeImg} />
                  </View>
                ) : null}
              </Animated.View>
            ) : null}
          </View>
        </Animated.View>

        {/* Soru sayısı seçimi: 5 / 10 / 15 / 20 */}
        <Text style={styles.countLabel}>SORU SAYISI</Text>
        <View style={styles.countRow}>
          {QUESTION_COUNT_OPTIONS.map((count, idx) => (
            <CountPill
              key={count}
              count={count}
              delay={60 + idx * 55}
              selected={count === questionCount}
              onPress={() => {
                sound.playSound('tap');
                sound.triggerHaptic('light');
                setQuestionCount(count);
              }}
            />
          ))}
        </View>

        {DIFFICULTIES.map((diff, idx) => (
          <DifficultyCard
            key={diff.id}
            diff={diff}
            index={idx}
            selected={selected === diff.id}
            onPress={() => {
              sound.playSound('tap');
              sound.triggerHaptic('light');
              setSelected(diff.id);
            }}
          />
        ))}

        <Animated.View entering={FadeInUp.delay(500).duration(460).springify(0.8)} style={styles.footerWrap}>
          {/* Seçilen zorluğun mini özeti */}
          <View style={styles.selectionSummary}>
            <GradientFill colors={['rgba(154,107,255,0.20)', 'rgba(154,107,255,0.03)']} direction="diagonal" />
            <View style={styles.summaryInner}>
              <Text style={styles.summaryLabel}>SEÇİMİN</Text>
              <Text style={styles.summaryValue}>
                {selectedDiff?.title} · {questionCount} soru · {selectedDiff?.xpMultiplier}
              </Text>
            </View>
          </View>
          <Button3D
            title="DEVAM"
            onPress={() => onSelectDifficulty(selected, questionCount)}
            style={{ height: 56 }}
          />
        </Animated.View>
      </ScrollView>
    </TavrikoScreen>
  );
};
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 28,
  },
  heroBanner: {
    position: 'relative',
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(154, 107, 255, 0.30)',
    shadowColor: 'rgba(154, 107, 255, 0.35)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 10,
  },
  heroBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroArtWrap: {
    position: 'relative',
    width: 118,
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroArtGlow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 60,
    backgroundColor: 'rgba(154, 107, 255, 0.28)',
    shadowColor: 'rgba(154, 107, 255, 0.55)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 28,
  },
  heroArt: {
    width: 104,
    height: 104,
    borderRadius: 24,
  },
  heroSubBadge: {
    position: 'absolute',
    left: -6,
    bottom: -4,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(18, 8, 40, 0.96)',
    borderWidth: 1.5,
    borderColor: 'rgba(90, 219, 181, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(90, 219, 181, 0.5)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  heroSubBadgeImg: {
    width: 32,
    height: 32,
  },
  eyebrow: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 10.5,
    letterSpacing: 3,
    color: '#5ADBB5',
    marginBottom: 2,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 26,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  chipAccent: {
    borderColor: 'rgba(154, 107, 255, 0.40)',
    backgroundColor: 'rgba(154, 107, 255, 0.14)',
  },
  chipIcon: {
    width: 16,
    height: 16,
  },
  chipText: {
    color: '#E5DBFB',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  countLabel: {
    fontFamily: THEME.fonts.display,
    fontSize: 13,
    letterSpacing: 1.5,
    color: THEME.colors.textMuted,
    marginBottom: 10,
  },
  countRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  countPillWrap: {
    flex: 1,
  },
  countPill: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 5,
  },
  countPillSelected: {
    borderColor: '#FFC43D',
    backgroundColor: 'rgba(98, 54, 255, 0.22)',
  },
  countPillText: {
    fontFamily: THEME.fonts.display,
    fontSize: 17,
    color: '#CBBFE8',
  },
  countPillTextSelected: {
    color: '#FFFFFF',
  },
  diffCard: {
    minHeight: 74,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 7,
  },
  diffMedal: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 4,
  },
  diffMedalText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 16,
  },
  diffBody: {
    flex: 1,
    justifyContent: 'center',
  },
  diffTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  diffTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 20,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  diffDesc: {
    color: '#B8A9DC',
    fontSize: 12,
    fontFamily: THEME.fonts.body,
    marginTop: 3,
  },
  xpPill: {
    backgroundColor: 'rgba(10, 4, 24, 0.78)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  xpPillText: {
    fontSize: 12.5,
    fontFamily: THEME.fonts.extraBold,
  },
  footerWrap: {
    marginTop: 10,
  },
  selectionSummary: {
    position: 'relative',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(154, 107, 255, 0.28)',
    overflow: 'hidden',
    marginBottom: 12,
  },
  summaryInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  summaryLabel: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 10,
    letterSpacing: 2,
    color: '#5ADBB5',
  },
  summaryValue: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 13,
    color: '#FFFFFF',
    flexShrink: 1,
  },
});
