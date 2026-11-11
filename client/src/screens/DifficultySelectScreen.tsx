import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { CategoryId, DifficultyLevel, ALL_CATEGORIES } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import {
  TavrikoScreen,
  TavrikoTopBar,
  Button3D,
  XpStarIcon,
  CategorySquircleIcon,
} from '../components/TavrikoIcons';
import { GradientFill } from '../components/TavrikoGradient';

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
const DIFFICULTIES: {
  id: DifficultyLevel;
  title: string;
  color: string;
  glow: string;
  stars: number;
  xpMultiplier: string;
  desc: string;
}[] = [
  { id: 'easy', title: 'Kolay', color: '#3FD08A', glow: 'rgba(63, 208, 138, 0.35)', stars: 1, xpMultiplier: 'x1 XP', desc: 'Isınma turu' },
  { id: 'medium', title: 'Orta', color: '#FFC43D', glow: 'rgba(255, 196, 61, 0.35)', stars: 2, xpMultiplier: 'x1,5 XP', desc: 'Dengeli mücadele' },
  { id: 'hard', title: 'Zor', color: '#FF9B2F', glow: 'rgba(255, 155, 47, 0.35)', stars: 3, xpMultiplier: 'x2 XP', desc: 'Bilgi savaşçısı' },
  { id: 'expert', title: 'Uzman', color: '#FF5A6A', glow: 'rgba(255, 90, 106, 0.35)', stars: 4, xpMultiplier: 'x3 XP', desc: 'Efsane ayarı' },
];

/** Seçilen çip/kart için yaylı (spring) vurgu ölçeği */
const useSelectScale = (selected: boolean) => {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withSpring(selected ? 1.05 : 1, { damping: 12, stiffness: 220 });
  }, [selected, scale]);
  return useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
};

const CountPill: React.FC<{
  count: number;
  selected: boolean;
  onPress: () => void;
  delay: number;
}> = ({ count, selected, onPress, delay }) => {
  const animatedStyle = useSelectScale(selected);
  return (
    <Animated.View entering={ZoomIn.delay(delay).duration(320).springify(0.7)} style={[styles.countPillWrap, animatedStyle]}>
      <TouchableOpacity
        style={[styles.countPill, selected && styles.countPillSelected, selected && { borderColor: '#FFC43D', shadowColor: 'rgba(255, 196, 61, 0.55)' }]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {selected && <View style={styles.countPillGlow} />}
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
  const animatedStyle = useSelectScale(selected);
  // Seçili kartta yumuşak "nefes" ışıması: hafif parlaklık salınımı
  const glow = useSharedValue(0);
  useEffect(() => {
    if (selected) {
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1100 }),
          withTiming(0.35, { duration: 1100 })
        ),
        -1,
        true
      );
    } else {
      glow.value = 0;
    }
  }, [selected, glow]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + glow.value * 0.55,
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(160 + index * 90).duration(420).springify(0.8)}
      style={animatedStyle}
    >
      <TouchableOpacity
        style={[
          styles.diffCard,
          { borderLeftColor: diff.color, shadowColor: diff.glow },
          selected && styles.diffCardSelected,
          selected && { borderColor: diff.color },
        ]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {/* Seçili kartın nefes alan neon ışıması */}
        {selected && (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.diffCardGlowLayer, { backgroundColor: diff.color }, glowStyle]}
          />
        )}
        <View style={{ flex: 1, zIndex: 1 }}>
          <View style={styles.diffTitleRow}>
            <Text style={[styles.diffTitle, { color: diff.color }]}>{diff.title}</Text>
            <View style={[styles.xpPill, { borderColor: `${diff.color}55` }]}>
              <Text style={[styles.xpPillText, { color: diff.color }]}>{diff.xpMultiplier}</Text>
            </View>
          </View>
          <Text style={styles.diffDesc}>{diff.desc}</Text>
          <View style={styles.starsRow}>
            {Array.from({ length: diff.stars }).map((_, idx) => (
              <XpStarIcon key={idx} size={16} />
            ))}
          </View>
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
        {/* Kategori madalyonu + başlık künyesi */}
        <Animated.View
          entering={FadeInDown.duration(460).springify(0.8)}
          style={styles.heroRow}
        >
          <View style={[styles.categoryMedal, { shadowColor: 'rgba(154, 107, 255, 0.5)' }]}>
            <CategorySquircleIcon category={categoryId} size={64} />
            <View style={styles.medalRing} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>TAVRİKO ARENA</Text>
            <Text style={styles.title}>ZORLUK SEVİYESİ</Text>
            <View style={styles.chipRow}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>{category?.name || 'Kategori'}</Text>
              </View>
              {subCategory ? (
                <View style={[styles.chip, styles.chipAccent]}>
                  <Text style={[styles.chipText, { color: '#5ADBB5' }]}>{subCategory}</Text>
                </View>
              ) : null}
              <View style={[styles.chip, styles.chipAccent]}>
                <Text style={[styles.chipText, { color: '#FFC43D' }]}>{questionCount} soru</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Soru sayısı seçimi: 5 / 10 / 15 / 20 */}
        <Text style={styles.countLabel}>SORU SAYISI</Text>
        <View style={styles.countRow}>
          {QUESTION_COUNT_OPTIONS.map((count, idx) => (
            <CountPill
              key={count}
              count={count}
              delay={80 + idx * 60}
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

        <Animated.View entering={FadeInUp.delay(560).duration(480).springify(0.8)} style={styles.footerWrap}>
          {/* Seçilen zorluğun mini özeti */}
          <View style={styles.selectionSummary}>
            <GradientFill colors={['rgba(154,107,255,0.22)', 'rgba(154,107,255,0.04)']} direction="diagonal" />
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
    paddingBottom: 32,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 10,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  categoryMedal: {
    position: 'relative',
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 10,
  },
  medalRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(154, 107, 255, 0.45)',
  },
  heroCopy: {
    flex: 1,
  },
  eyebrow: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 11,
    letterSpacing: 3,
    color: '#5ADBB5',
    marginBottom: 2,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 30,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipAccent: {
    borderColor: 'rgba(154, 107, 255, 0.35)',
    backgroundColor: 'rgba(154, 107, 255, 0.12)',
  },
  chipText: {
    color: '#D9CDF5',
    fontSize: 11.5,
    fontFamily: THEME.fonts.extraBold,
  },
  countLabel: {
    fontFamily: THEME.fonts.display,
    fontSize: 14,
    letterSpacing: 1.5,
    color: THEME.colors.textMuted,
    marginTop: 4,
    marginBottom: 10,
  },
  countRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  countPillWrap: {
    flex: 1,
  },
  countPill: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 6,
  },
  countPillGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(98, 54, 255, 0.30)',
  },
  countPillSelected: {
    backgroundColor: 'rgba(98, 54, 255, 0.18)',
  },
  countPillText: {
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    color: '#CBBFE8',
  },
  countPillTextSelected: {
    color: '#FFFFFF',
  },
  diffCard: {
    height: 96,
    paddingHorizontal: 18,
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderLeftWidth: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
  },
  diffCardSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.13)',
  },
  diffCardGlowLayer: {
    borderRadius: 20,
    opacity: 0.15,
  },
  diffTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  diffTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 26,
  },
  diffDesc: {
    color: '#B8A9DC',
    fontSize: 12,
    fontFamily: THEME.fonts.body,
    marginTop: 2,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
  },
  xpPill: {
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
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
    marginTop: 8,
  },
  selectionSummary: {
    position: 'relative',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(154, 107, 255, 0.28)',
    overflow: 'hidden',
    marginBottom: 14,
  },
  summaryInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
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
