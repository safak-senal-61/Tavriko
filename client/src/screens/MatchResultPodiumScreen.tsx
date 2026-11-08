import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  FinalMatchSummary,
  MatchQuestionReviewItem,
  PlayerScoreSummary,
  calculateLevelFromXp,
} from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { loadStoredPreferences } from '../store/appPrefs';
import {
  TavrikoScreen,
  Button3D,
  CharacterAvatar,
  CrownIcon,
  CoinIcon,
  CheckMarkSvg,
  CrossMarkSvg,
} from '../components/TavrikoIcons';
import { formatNumberTR } from '../components/TavrikoGradient';

interface MatchResultPodiumScreenProps {
  summary: FinalMatchSummary;
  currentUserId: string;
  questionReviews?: MatchQuestionReviewItem[];
  /** Kullanıcının güncel toplam XP'si; verilirse gerçek seviye ilerlemesi gösterilir */
  userXp?: number;
  onPlayAgain: () => void;
  onHome: () => void;
}

/** Eski 1000'lik ölçekten kalan puanları temiz 100-150 ölçeğine normalize eder */
const normalizeDisplayScore = (rawScore: number, totalRounds: number = 5): number => {
  const s = Math.max(0, Math.round(Number(rawScore) || 0));
  const threshold = Math.max(1, totalRounds) * 260;
  return s > threshold ? Math.round(s / 10) : s;
};

const PLACE_TONES: Record<1 | 2 | 3, { ring: string; text: string; base: string; height: number; avatar: number }> = {
  1: { ring: '#FFC43D', text: '#FFD66B', base: 'rgba(255, 196, 61, 0.16)', height: 96, avatar: 70 },
  2: { ring: '#C9D3E6', text: '#E3E9F5', base: 'rgba(201, 211, 230, 0.12)', height: 70, avatar: 56 },
  3: { ring: '#E39A5C', text: '#F2B988', base: 'rgba(227, 154, 92, 0.13)', height: 54, avatar: 52 },
};

const STATUS_COLORS = {
  correct: '#3FD08A',
  wrong: '#FF6B6B',
  timeout: '#FFC43D',
};

/** 0'dan hedefe yumuşakça sayan sayı (istatistik kutuları için) */
const useCountUp = (target: number, durationMs = 700, delayMs = 0) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf: ReturnType<typeof setTimeout> | null = null;
    const start = Date.now() + delayMs;
    const tick = () => {
      const t = Math.min(1, Math.max(0, (Date.now() - start) / durationMs));
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = setTimeout(tick, 16);
    };
    raf = setTimeout(tick, delayMs);
    return () => {
      if (raf) clearTimeout(raf);
    };
  }, [target, durationMs, delayMs]);
  return value;
};

const PodiumColumn: React.FC<{
  entry: PlayerScoreSummary;
  place: 1 | 2 | 3;
  totalRounds: number;
  isMe: boolean;
  delay: number;
}> = ({ entry, place, totalRounds, isMe, delay }) => {
  const tone = PLACE_TONES[place];
  const ring = tone.avatar + 8;
  return (
    <Animated.View entering={FadeInUp.delay(delay).springify().damping(14)} style={styles.podiumCol}>
      {place === 1 ? (
        <Animated.View entering={ZoomIn.delay(delay + 260).springify()}>
          <CrownIcon size={28} />
        </Animated.View>
      ) : (
        <View style={{ height: 28 }} />
      )}
      <View style={[styles.podiumRing, { width: ring, height: ring, borderRadius: ring / 2, borderColor: tone.ring }]}>
        <CharacterAvatar seed={entry.avatarUrl || entry.displayName} size={tone.avatar} />
      </View>
      <Text style={[styles.podiumName, isMe && { color: '#FFC43D' }]} numberOfLines={1}>
        {isMe ? 'Sen' : entry.displayName}
      </Text>
      <Text style={[styles.podiumScore, { color: tone.text }]}>
        {formatNumberTR(normalizeDisplayScore(entry.score, totalRounds))}
        <Text style={styles.podiumUnit}> puan</Text>
      </Text>
      <View style={[styles.podiumBase, { height: tone.height, backgroundColor: tone.base, borderColor: tone.ring }]}>
        <Text style={[styles.podiumPlace, { color: tone.ring }]}>{place}</Text>
        {typeof entry.correctAnswersCount === 'number' && (
          <Text style={styles.podiumCorrect}>
            {entry.correctAnswersCount}/{totalRounds} doğru
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

const StatTile: React.FC<{ label: string; value: string; accent?: string; delay: number }> = ({
  label,
  value,
  accent = '#FFFFFF',
  delay,
}) => (
  <Animated.View entering={FadeInDown.delay(delay).duration(360)} style={styles.statTile}>
    <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </Animated.View>
);

export const MatchResultPodiumScreen: React.FC<MatchResultPodiumScreenProps> = ({
  summary,
  currentUserId,
  questionReviews,
  userXp,
  onPlayAgain,
  onHome,
}) => {
  const reviews = questionReviews || summary.questionReviews || [];
  const totalRounds = Math.max(1, summary.totalRounds || reviews.length || 5);

  const first = summary.podium?.first || null;
  const second = summary.podium?.second || null;
  const third = summary.podium?.third || null;

  const myRanking = summary.rankings?.find((r) => r.playerId === currentUserId);
  const isWinner =
    (myRanking && myRanking.rank === 1) || first?.playerId === currentUserId;
  const myRank = myRanking?.rank ?? (isWinner ? 1 : undefined);
  const playerCount = Math.max(summary.rankings?.length || 0, [first, second, third].filter(Boolean).length);

  const correctCount =
    typeof myRanking?.correctAnswersCount === 'number'
      ? myRanking.correctAnswersCount
      : reviews.filter((r) => r.isCorrect).length;
  const accuracyPct = Math.round((correctCount / totalRounds) * 100);
  const myScore = normalizeDisplayScore(myRanking?.score || 0, totalRounds);

  // KURAL: 0 doğru cevap veya erken çıkışta para/XP ödülü sıfırlanır!
  const isZeroPerformance = correctCount === 0 || (myRanking?.score || 0) <= 0;
  const xpEarned = isZeroPerformance
    ? 0
    : isWinner
    ? Math.min(35, correctCount * 5 + 10)
    : Math.min(15, correctCount * 3);
  const coinsEarned = isZeroPerformance
    ? 0
    : isWinner
    ? Math.min(15, correctCount * 2 + 5)
    : Math.min(6, correctCount * 1);

  const levelInfo = typeof userXp === 'number' ? calculateLevelFromXp(userXp) : null;

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const animCorrect = useCountUp(correctCount, 600, 350);
  const animAccuracy = useCountUp(accuracyPct, 700, 420);
  const animScore = useCountUp(myScore, 800, 490);

  const levelFill = useSharedValue(0);
  useEffect(() => {
    if (loadStoredPreferences().victoryMelody !== false) {
      sound.playSound('victory');
    }
    sound.triggerHaptic('success');
  }, []);
  useEffect(() => {
    if (levelInfo) {
      levelFill.value = withDelay(650, withTiming(levelInfo.progressPct / 100, { duration: 900, easing: Easing.out(Easing.cubic) }));
    }
  }, [levelInfo?.progressPct]);
  const levelFillStyle = useAnimatedStyle(() => ({ width: `${levelFill.value * 100}%` }));

  const headline = isWinner ? 'Kazandın' : myRank === 2 && playerCount === 2 ? 'Az kaldı' : 'Maç bitti';
  const subline = [
    myRank ? `${myRank}. sıra` : null,
    `${totalRounds} soru`,
    playerCount > 1 ? `${playerCount} oyuncu` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const toggleReview = (idx: number) => {
    sound.playSound('tap');
    sound.triggerHaptic('light');
    setExpandedIdx((prev) => (prev === idx ? null : idx));
  };

  return (
    <TavrikoScreen>
      <View style={styles.screenWrapper}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Başlık */}
          <Animated.View entering={FadeIn.duration(360)} style={styles.headerWrap}>
            <Text style={styles.kicker}>MAÇ SONUCU</Text>
            <Text style={[styles.headline, isWinner && { color: '#FFD66B' }]}>{headline}</Text>
            <Text style={styles.subline}>{subline}</Text>
          </Animated.View>

          {/* Podyum (2 - 1 - 3) */}
          <View style={[styles.podiumRow, !third && styles.podiumRowDuel]}>
            {second ? (
              <PodiumColumn entry={second} place={2} totalRounds={totalRounds} isMe={second.playerId === currentUserId} delay={180} />
            ) : null}
            {first ? (
              <PodiumColumn entry={first} place={1} totalRounds={totalRounds} isMe={first.playerId === currentUserId} delay={60} />
            ) : (
              <View style={styles.podiumCol} />
            )}
            {third ? (
              <PodiumColumn entry={third} place={3} totalRounds={totalRounds} isMe={third.playerId === currentUserId} delay={280} />
            ) : null}
          </View>

          {/* İstatistikler */}
          <View style={styles.statsRow}>
            <StatTile label="Doğru" value={`${animCorrect}/${totalRounds}`} accent="#5ADBB5" delay={320} />
            <StatTile label="İsabet" value={`%${animAccuracy}`} delay={390} />
            <StatTile label="Puan" value={formatNumberTR(animScore)} accent="#FFD66B" delay={460} />
          </View>

          {/* Ödüller */}
          <Animated.View entering={FadeInDown.delay(520).duration(380)} style={styles.rewardCard}>
            <View style={styles.rewardRow}>
              <Text style={styles.sectionTitle}>Kazandıkların</Text>
              <View style={styles.rewardChips}>
                <Animated.View entering={ZoomIn.delay(700).springify()} style={styles.rewardChip}>
                  <Text style={styles.xpChipText}>+{xpEarned} XP</Text>
                </Animated.View>
                <Animated.View entering={ZoomIn.delay(800).springify()} style={styles.rewardChip}>
                  <CoinIcon size={16} />
                  <Text style={styles.coinChipText}>+{coinsEarned}</Text>
                </Animated.View>
              </View>
            </View>
            {levelInfo ? (
              <View style={styles.levelWrap}>
                <View style={styles.levelLabels}>
                  <Text style={styles.levelText}>Seviye {levelInfo.level}</Text>
                  <Text style={styles.levelXpText}>
                    {formatNumberTR(levelInfo.currentLevelXp)} / {formatNumberTR(levelInfo.nextLevelXpRequired)} XP
                  </Text>
                </View>
                <View style={styles.levelTrack}>
                  <Animated.View style={[styles.levelFill, levelFillStyle]} />
                </View>
              </View>
            ) : isZeroPerformance ? (
              <Text style={styles.rewardHint}>Ödül kazanmak için en az bir soruyu doğru bilmelisin.</Text>
            ) : null}
          </Animated.View>

          {/* Soru Özeti */}
          {reviews.length > 0 && (
            <Animated.View entering={FadeInDown.delay(600).duration(380)} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.sectionTitle}>Soru özeti</Text>
                <View style={styles.dotStrip}>
                  {reviews.map((item, idx) => (
                    <View
                      key={`dot_${idx}`}
                      style={[
                        styles.dot,
                        {
                          backgroundColor: item.isCorrect
                            ? STATUS_COLORS.correct
                            : item.isTimeout
                            ? STATUS_COLORS.timeout
                            : STATUS_COLORS.wrong,
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>

              {reviews.map((item, idx) => {
                const color = item.isCorrect
                  ? STATUS_COLORS.correct
                  : item.isTimeout
                  ? STATUS_COLORS.timeout
                  : STATUS_COLORS.wrong;
                const isOpen = expandedIdx === idx;
                const pts = normalizeDisplayScore(item.pointsEarned || 0, 1);
                return (
                  <TouchableOpacity
                    key={`review_${idx}`}
                    activeOpacity={0.85}
                    onPress={() => toggleReview(idx)}
                    style={[styles.reviewRow, idx > 0 && styles.reviewRowDivider]}
                    accessibilityRole="button"
                    accessibilityLabel={`Soru ${item.roundNumber || idx + 1}, ${item.isCorrect ? 'doğru' : item.isTimeout ? 'süre doldu' : 'yanlış'}`}
                  >
                    <View style={[styles.reviewNum, { borderColor: color, backgroundColor: color + '1F' }]}>
                      {item.isCorrect ? (
                        <CheckMarkSvg size={14} color={color} />
                      ) : item.isTimeout ? (
                        <Text style={[styles.reviewNumText, { color }]}>{item.roundNumber || idx + 1}</Text>
                      ) : (
                        <CrossMarkSvg size={13} color={color} />
                      )}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.reviewQuestion} numberOfLines={isOpen ? undefined : 2}>
                        {item.questionText}
                      </Text>
                      <Text style={styles.reviewMeta} numberOfLines={isOpen ? undefined : 1}>
                        {item.isCorrect
                          ? item.correctAnswerText
                          : item.isTimeout
                          ? `Süre doldu · Doğrusu: ${item.correctAnswerText}`
                          : `${item.userAnswerText ? `${item.userAnswerText} · ` : ''}Doğrusu: ${item.correctAnswerText}`}
                      </Text>
                      {isOpen && item.explanation ? (
                        <Animated.View entering={FadeIn.duration(220)} style={styles.explanationBox}>
                          <Text style={styles.explanationText}>{item.explanation}</Text>
                        </Animated.View>
                      ) : null}
                    </View>
                    <Text style={[styles.reviewPts, { color: item.isCorrect ? '#FFD66B' : 'rgba(217, 205, 245, 0.45)' }]}>
                      {item.isCorrect ? `+${pts}` : '0'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </Animated.View>
          )}
        </ScrollView>

        {/* Sabit Alt Aksiyon Çubuğu */}
        <Animated.View entering={FadeInUp.delay(400).duration(360)} style={styles.stickyBottomDock}>
          <Button3D title="TEKRAR OYNA" onPress={onPlayAgain} style={{ flex: 1 }} textStyle={{ fontSize: 14 }} />
          <Button3D title="ANA SAYFA" variant="mint" onPress={onHome} style={{ flex: 1 }} textStyle={{ fontSize: 14 }} />
        </Animated.View>
      </View>
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 110,
    paddingHorizontal: 6,
  },
  headerWrap: {
    marginTop: 10,
    marginBottom: 6,
  },
  kicker: {
    color: 'rgba(217, 205, 245, 0.6)',
    fontSize: 11,
    letterSpacing: 1.6,
    fontFamily: THEME.fonts.extraBold,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 34,
    letterSpacing: -0.6,
    fontFamily: THEME.fonts.black,
    marginTop: 2,
  },
  subline: {
    color: 'rgba(217, 205, 245, 0.75)',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    marginTop: 2,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 10,
    marginBottom: 14,
  },
  podiumRowDuel: {
    paddingHorizontal: 36,
  },
  podiumCol: {
    flex: 1,
    alignItems: 'center',
  },
  podiumRing: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B0C38',
    marginBottom: 6,
  },
  podiumName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
    maxWidth: '100%',
  },
  podiumScore: {
    fontSize: 14,
    fontFamily: THEME.fonts.black,
    marginTop: 1,
    marginBottom: 8,
  },
  podiumUnit: {
    fontSize: 10,
    fontFamily: THEME.fonts.bold,
    color: 'rgba(217, 205, 245, 0.7)',
  },
  podiumBase: {
    alignSelf: 'stretch',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 1,
    borderBottomWidth: 0,
    alignItems: 'center',
    paddingTop: 8,
  },
  podiumPlace: {
    fontSize: 26,
    lineHeight: 30,
    fontFamily: THEME.fonts.black,
  },
  podiumCorrect: {
    color: 'rgba(217, 205, 245, 0.75)',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  statTile: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(20, 8, 52, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontFamily: THEME.fonts.black,
  },
  statLabel: {
    color: 'rgba(217, 205, 245, 0.65)',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
    marginTop: 1,
  },
  rewardCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(20, 8, 52, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 10,
    gap: 12,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.extraBold,
  },
  rewardChips: {
    flexDirection: 'row',
    gap: 6,
  },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  xpChipText: {
    color: '#7CF0C6',
    fontSize: 13,
    fontFamily: THEME.fonts.black,
  },
  coinChipText: {
    color: '#FFD66B',
    fontSize: 13,
    fontFamily: THEME.fonts.black,
  },
  rewardHint: {
    color: 'rgba(217, 205, 245, 0.7)',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  levelWrap: {
    gap: 6,
  },
  levelLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  levelText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  levelXpText: {
    color: 'rgba(217, 205, 245, 0.7)',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  levelTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(154, 107, 255, 0.18)',
    overflow: 'hidden',
  },
  levelFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5ADBB5',
  },
  reviewCard: {
    borderRadius: 18,
    backgroundColor: 'rgba(20, 8, 52, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 14,
    paddingBottom: 4,
    overflow: 'hidden',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  dotStrip: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reviewRowDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  reviewNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  reviewNumText: {
    fontSize: 12,
    fontFamily: THEME.fonts.black,
  },
  reviewQuestion: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    fontFamily: THEME.fonts.extraBold,
  },
  reviewMeta: {
    color: 'rgba(217, 205, 245, 0.7)',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    marginTop: 3,
  },
  explanationBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  explanationText: {
    color: 'rgba(235, 228, 252, 0.9)',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: THEME.fonts.bold,
  },
  reviewPts: {
    fontSize: 13,
    fontFamily: THEME.fonts.black,
    minWidth: 34,
    textAlign: 'right',
    marginTop: 4,
  },
  stickyBottomDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: 'rgba(12, 5, 32, 0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
});
