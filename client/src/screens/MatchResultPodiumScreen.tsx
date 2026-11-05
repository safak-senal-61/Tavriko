import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { FinalMatchSummary, MatchQuestionReviewItem } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { loadStoredPreferences } from '../store/appPrefs';
import {
  TavrikoScreen,
  TavrikoProgressBar,
  Button3D,
  CharacterAvatar,
  CrownIcon,
  CoinIcon,
} from '../components/TavrikoIcons';

interface MatchResultPodiumScreenProps {
  summary: FinalMatchSummary;
  currentUserId: string;
  questionReviews?: MatchQuestionReviewItem[];
  onPlayAgain: () => void;
  onHome: () => void;
}

/** Eski 1000'lik ölçekten kalan puanları temiz 100-150 ölçeğine normalize eder */
const normalizeDisplayScore = (rawScore: number, totalRounds: number = 5): number => {
  const s = Math.max(0, Math.round(Number(rawScore) || 0));
  const threshold = Math.max(1, totalRounds) * 260;
  return s > threshold ? Math.round(s / 10) : s;
};

export const MatchResultPodiumScreen: React.FC<MatchResultPodiumScreenProps> = ({
  summary,
  currentUserId,
  questionReviews,
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
  const xpEarned = isWinner ? 160 : 60;
  const coinsEarned = isWinner ? 50 : 20;

  // Açılabilir Soru Cevapları Menüsü (Varsayılan olarak kapalı; tek dokunuşla açılır/kapanır)
  const [isQuestionsMenuOpen, setIsQuestionsMenuOpen] = useState<boolean>(false);
  const [expandedQuestionIdx, setExpandedQuestionIdx] = useState<number | null>(0);

  // Podium rising animations
  const col1Anim = useRef(new Animated.Value(60)).current;
  const col2Anim = useRef(new Animated.Value(60)).current;
  const col3Anim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loadStoredPreferences().victoryMelody !== false) {
      sound.playSound('victory');
    }
    sound.triggerHaptic('success');
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 320,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.stagger(120, [
        Animated.spring(col3Anim, {
          toValue: 0,
          friction: 6,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(col2Anim, {
          toValue: 0,
          friction: 6,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(col1Anim, {
          toValue: 0,
          friction: 5,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    ]).start();
  }, [col1Anim, col2Anim, col3Anim, fadeAnim]);

  const correctCount =
    typeof myRanking?.correctAnswersCount === 'number'
      ? myRanking.correctAnswersCount
      : reviews.filter((r) => r.isCorrect).length;
  const accuracyPct = Math.round((correctCount / totalRounds) * 100);

  const toggleQuestionsMenu = () => {
    sound.playSound('tap');
    sound.triggerHaptic('light');
    setIsQuestionsMenuOpen((prev) => !prev);
  };

  const handleSelectQuestionPill = (idx: number) => {
    sound.playSound('tap');
    sound.triggerHaptic('light');
    setIsQuestionsMenuOpen(true);
    setExpandedQuestionIdx((prev) => (prev === idx && isQuestionsMenuOpen ? null : idx));
  };

  return (
    <TavrikoScreen>
      <View style={styles.screenWrapper}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Üst Zafer / Maç Sonucu Rozeti */}
          <View style={styles.headerWrap}>
            <View
              style={[
                styles.resultBadgePill,
                isWinner ? styles.resultBadgeWinner : styles.resultBadgeComplete,
              ]}
            >
              <Text
                style={[
                  styles.resultBadgeText,
                  isWinner ? styles.resultBadgeTextWinner : styles.resultBadgeTextComplete,
                ]}
              >
                {isWinner ? '🏆 ZAFER SENİN!' : '⚔️ KARŞILAŞMA TAMAMLANDI'}
              </Text>
            </View>
            <Text style={styles.title}>MAÇ SONUCU</Text>
            <Text style={styles.subtitle}>
              {totalRounds} Soruluk Arena · %{accuracyPct} İsabet Oranı
            </Text>
          </View>

          {/* Şık Modern Podyum Kartı (2 - 1 - 3) */}
          <Animated.View style={[styles.podiumShowcaseCard, { opacity: fadeAnim }]}>
            <View style={styles.podiumRow}>
              {/* 2nd Place */}
              {second && (
                <Animated.View
                  style={[
                    styles.podiumCol,
                    { transform: [{ translateY: col2Anim }] },
                  ]}
                >
                  <View style={styles.avatarMedalSilver}>
                    <CharacterAvatar
                      seed={second.avatarUrl || second.displayName}
                      index={2}
                      size={46}
                    />
                  </View>
                  <Text style={styles.podiumName} numberOfLines={1}>
                    {second.displayName}
                  </Text>
                  <View style={styles.podiumScorePill}>
                    <Text style={styles.podiumScore}>
                      {normalizeDisplayScore(second.score, totalRounds)}p
                    </Text>
                  </View>
                  <View style={[styles.pillar, styles.pillar2]}>
                    <Text style={styles.pillarNumber}>2</Text>
                    {typeof second.correctAnswersCount === 'number' && (
                      <Text style={styles.pillarSubText}>
                        {second.correctAnswersCount}/{totalRounds} Doğru
                      </Text>
                    )}
                  </View>
                </Animated.View>
              )}

              {/* 1st Place */}
              {first && (
                <Animated.View
                  style={[
                    styles.podiumCol,
                    styles.podiumColFirst,
                    { transform: [{ translateY: col1Anim }] },
                  ]}
                >
                  <View style={styles.crownFloater}>
                    <CrownIcon size={28} />
                  </View>
                  <View style={styles.avatarMedalGold}>
                    <CharacterAvatar
                      seed={first.avatarUrl || first.displayName}
                      index={1}
                      size={56}
                    />
                  </View>
                  <Text style={[styles.podiumName, styles.podiumNameFirst]} numberOfLines={1}>
                    {first.displayName}
                  </Text>
                  <View style={[styles.podiumScorePill, styles.podiumScorePillFirst]}>
                    <Text style={[styles.podiumScore, styles.podiumScoreFirst]}>
                      {normalizeDisplayScore(first.score, totalRounds)}p
                    </Text>
                  </View>
                  <View style={[styles.pillar, styles.pillar1]}>
                    <Text style={styles.pillarNumber}>1</Text>
                    {typeof first.correctAnswersCount === 'number' && (
                      <Text style={styles.pillarSubText}>
                        {first.correctAnswersCount}/{totalRounds} Doğru
                      </Text>
                    )}
                  </View>
                </Animated.View>
              )}

              {/* 3rd Place */}
              {third && (
                <Animated.View
                  style={[
                    styles.podiumCol,
                    { transform: [{ translateY: col3Anim }] },
                  ]}
                >
                  <View style={styles.avatarMedalBronze}>
                    <CharacterAvatar
                      seed={third.avatarUrl || third.displayName}
                      index={3}
                      size={42}
                    />
                  </View>
                  <Text style={styles.podiumName} numberOfLines={1}>
                    {third.displayName}
                  </Text>
                  <View style={styles.podiumScorePill}>
                    <Text style={styles.podiumScore}>
                      {normalizeDisplayScore(third.score, totalRounds)}p
                    </Text>
                  </View>
                  <View style={[styles.pillar, styles.pillar3]}>
                    <Text style={styles.pillarNumber}>3</Text>
                    {typeof third.correctAnswersCount === 'number' && (
                      <Text style={styles.pillarSubText}>
                        {third.correctAnswersCount}/{totalRounds} Doğru
                      </Text>
                    )}
                  </View>
                </Animated.View>
              )}
            </View>
          </Animated.View>

          {/* Ödül & İstatistik Kartı */}
          <View style={styles.rewardCard}>
            <View style={styles.rewardTopRow}>
              <View style={styles.xpBadgeGroup}>
                <Text style={styles.xpAwardText}>+{xpEarned} XP</Text>
                <Text style={styles.levelSubText}>Seviye İlerlemesi</Text>
              </View>
              <View style={styles.rewardRightGroup}>
                <View style={styles.accuracyPill}>
                  <Text style={styles.accuracyPillText}>
                    🎯 {correctCount}/{totalRounds} Doğru
                  </Text>
                </View>
                <View style={styles.coinPill}>
                  <CoinIcon size={18} />
                  <Text style={styles.coinPillText}>+{coinsEarned}</Text>
                </View>
              </View>
            </View>
            <TavrikoProgressBar progress={isWinner ? 92 : 68} height={10} />
          </View>

          {/* Açılabilir Soru Cevapları & Analiz Menüsü (Accordion) */}
          {reviews.length > 0 && (
            <View style={styles.accordionContainer}>
              {/* Tıklanabilir Açılır/Kapanır Menü Başlığı */}
              <TouchableOpacity
                style={[
                  styles.accordionHeader,
                  isQuestionsMenuOpen && styles.accordionHeaderActive,
                ]}
                activeOpacity={0.85}
                onPress={toggleQuestionsMenu}
              >
                <View style={styles.accordionHeaderTop}>
                  <View style={styles.accordionTitleGroup}>
                    <View style={styles.accordionIconCircle}>
                      <Text style={styles.accordionIconText}>📋</Text>
                    </View>
                    <View>
                      <Text style={styles.accordionTitle}>SORU CEVAPLARI & ANALİZ</Text>
                      <Text style={styles.accordionSubtitle}>
                        {isQuestionsMenuOpen
                          ? 'Menüyü gizlemek için dokun'
                          : 'Soruları ve doğru çözümleri görmek için dokun'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.accordionRightGroup}>
                    <View style={styles.reviewScorePill}>
                      <Text style={styles.reviewScoreText}>
                        {correctCount}/{reviews.length} DOĞRU
                      </Text>
                    </View>
                    <View style={styles.chevronBadge}>
                      <Text style={styles.chevronText}>
                        {isQuestionsMenuOpen ? '▴ GİZLE' : '▾ AÇ'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Hızlı Soru Adım Rozetleri (Her birine tıklanabilir) */}
                <View style={styles.quickPillsRow}>
                  {reviews.map((item, idx) => {
                    const isSelected = isQuestionsMenuOpen && expandedQuestionIdx === idx;
                    const pillBg = item.isCorrect
                      ? 'rgba(63, 208, 138, 0.2)'
                      : item.isTimeout
                      ? 'rgba(255, 196, 61, 0.2)'
                      : 'rgba(255, 107, 107, 0.2)';
                    const pillBorder = item.isCorrect
                      ? '#3FD08A'
                      : item.isTimeout
                      ? '#FFC43D'
                      : '#FF6B6B';
                    const pillIcon = item.isCorrect ? '✓' : item.isTimeout ? '⏱' : '✕';

                    return (
                      <TouchableOpacity
                        key={`qpill_${idx}`}
                        style={[
                          styles.quickQuestionPill,
                          { backgroundColor: pillBg, borderColor: pillBorder },
                          isSelected && styles.quickQuestionPillSelected,
                        ]}
                        activeOpacity={0.8}
                        onPress={() => handleSelectQuestionPill(idx)}
                      >
                        <Text style={[styles.quickQuestionPillText, { color: pillBorder }]}>
                          S{item.roundNumber || idx + 1} {pillIcon}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </TouchableOpacity>

              {/* Açılır Soru Listesi */}
              {isQuestionsMenuOpen && (
                <View style={styles.reviewList}>
                  {reviews.map((item, idx) => {
                    const isItemOpen = expandedQuestionIdx === null || expandedQuestionIdx === idx;
                    const statusColor = item.isCorrect
                      ? '#3FD08A'
                      : item.isTimeout
                      ? '#FFC43D'
                      : '#FF6B6B';
                    const cleanPts = normalizeDisplayScore(item.pointsEarned || 0, 1);
                    const statusBadge = item.isCorrect
                      ? `✓ DOĞRU (+${cleanPts}p)`
                      : item.isTimeout
                      ? '⏱️ SÜRE DOLDU'
                      : '✕ YANLIŞ';

                    return (
                      <TouchableOpacity
                        key={`review_${idx}`}
                        activeOpacity={0.88}
                        onPress={() =>
                          setExpandedQuestionIdx((prev) => (prev === idx ? null : idx))
                        }
                        style={[
                          styles.reviewCard,
                          { borderLeftColor: statusColor },
                          isItemOpen && styles.reviewCardExpanded,
                        ]}
                      >
                        <View style={styles.reviewCardTop}>
                          <View style={styles.reviewRoundBadge}>
                            <Text style={styles.reviewRoundText}>
                              SORU {item.roundNumber || idx + 1}
                            </Text>
                          </View>
                          <View style={styles.reviewCardRightMeta}>
                            <View
                              style={[
                                styles.reviewStatusBadge,
                                { backgroundColor: statusColor + '22', borderColor: statusColor },
                              ]}
                            >
                              <Text style={[styles.reviewStatusText, { color: statusColor }]}>
                                {statusBadge}
                              </Text>
                            </View>
                            <Text style={styles.itemChevron}>
                              {isItemOpen ? '▴' : '▾'}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={styles.reviewQuestionText}
                          numberOfLines={isItemOpen ? undefined : 2}
                        >
                          {item.questionText}
                        </Text>

                        {isItemOpen && (
                          <View style={styles.reviewAnswersCol}>
                            {item.userAnswerText && !item.isCorrect && (
                              <View style={styles.answerRow}>
                                <Text style={styles.answerLabel}>Senin cevabın:</Text>
                                <Text style={styles.wrongAnswerValue}>
                                  {item.userAnswerText}
                                </Text>
                              </View>
                            )}
                            <View style={styles.answerRow}>
                              <Text style={styles.answerLabel}>Doğru cevap:</Text>
                              <Text style={styles.correctAnswerValue}>
                                {item.correctAnswerText}
                              </Text>
                            </View>
                            {item.explanation ? (
                              <View style={styles.explanationBox}>
                                <Text style={styles.reviewExplanation}>
                                  💡 {item.explanation}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Sabit Alt Aksiyon Çubuğu (Kaydırmaya Gerek Kalmadan Her Zaman Görünür!) */}
        <View style={styles.stickyBottomDock}>
          <Button3D
            title="TEKRAR OYNA"
            onPress={onPlayAgain}
            style={{ flex: 1 }}
            textStyle={{ fontSize: 14 }}
          />
          <Button3D
            title="ANA SAYFA"
            variant="mint"
            onPress={onHome}
            style={{ flex: 1 }}
            textStyle={{ fontSize: 14 }}
          />
        </View>
      </View>
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 105,
    paddingHorizontal: 10,
  },
  headerWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  resultBadgePill: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 6,
  },
  resultBadgeWinner: {
    backgroundColor: 'rgba(255, 196, 61, 0.18)',
    borderColor: '#FFC43D',
  },
  resultBadgeComplete: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: '#A78BFA',
  },
  resultBadgeText: {
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 1,
  },
  resultBadgeTextWinner: {
    color: '#FFC43D',
  },
  resultBadgeTextComplete: {
    color: '#DDD6FE',
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 30,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginTop: 2,
  },
  podiumShowcaseCard: {
    backgroundColor: 'rgba(24, 10, 52, 0.85)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 139, 250, 0.28)',
    paddingTop: 18,
    paddingHorizontal: 12,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 10,
  },
  podiumCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  podiumColFirst: {
    zIndex: 5,
  },
  crownFloater: {
    marginBottom: -2,
  },
  avatarMedalGold: {
    padding: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 196, 61, 0.25)',
    borderWidth: 2,
    borderColor: '#FFC43D',
  },
  avatarMedalSilver: {
    padding: 2.5,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  avatarMedalBronze: {
    padding: 2.5,
    borderRadius: 999,
    backgroundColor: 'rgba(217, 119, 6, 0.2)',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  podiumName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 2,
  },
  podiumNameFirst: {
    color: '#FFFBEB',
    fontSize: 13,
  },
  podiumScorePill: {
    backgroundColor: 'rgba(15, 7, 34, 0.8)',
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    marginBottom: 4,
  },
  podiumScorePillFirst: {
    borderColor: '#FFC43D',
    backgroundColor: 'rgba(255, 196, 61, 0.16)',
  },
  podiumScore: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  podiumScoreFirst: {
    color: '#FFC43D',
  },
  pillar: {
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  pillar1: {
    height: 98,
    backgroundColor: '#D4982A',
    borderTopWidth: 2,
    borderColor: '#FFE082',
  },
  pillar2: {
    height: 76,
    backgroundColor: '#64748B',
    borderTopWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  pillar3: {
    height: 62,
    backgroundColor: '#985E3E',
    borderTopWidth: 1.5,
    borderColor: '#FBBF24',
  },
  pillarNumber: {
    fontFamily: THEME.fonts.display,
    fontSize: 28,
    color: '#FFFFFF',
  },
  pillarSubText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 2,
  },
  rewardCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(28, 12, 62, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  rewardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  xpBadgeGroup: {
    gap: 2,
  },
  xpAwardText: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
    color: '#7CFC8A',
  },
  levelSubText: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  rewardRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accuracyPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  accuracyPillText: {
    color: '#38BDF8',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(10, 4, 24, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  coinPillText: {
    color: '#FFC43D',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },

  // Açılabilir Soru Analizi Menüsü (Accordion)
  accordionContainer: {
    marginTop: 12,
    width: '100%',
  },
  accordionHeader: {
    backgroundColor: 'rgba(30, 14, 61, 0.92)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 139, 250, 0.32)',
    padding: 14,
  },
  accordionHeaderActive: {
    borderColor: '#FFC43D',
    backgroundColor: 'rgba(38, 18, 76, 0.96)',
  },
  accordionHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  accordionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  accordionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 196, 61, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionIconText: {
    fontSize: 17,
  },
  accordionTitle: {
    color: '#FFC43D',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.6,
  },
  accordionSubtitle: {
    color: '#C4B5FD',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
    marginTop: 1,
  },
  accordionRightGroup: {
    alignItems: 'flex-end',
    gap: 5,
  },
  reviewScorePill: {
    backgroundColor: 'rgba(63, 208, 138, 0.16)',
    borderWidth: 1,
    borderColor: '#3FD08A',
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 10,
  },
  reviewScoreText: {
    color: '#3FD08A',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  chevronBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  chevronText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  quickPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  quickQuestionPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickQuestionPillSelected: {
    transform: [{ scale: 1.05 }],
    borderWidth: 2,
  },
  quickQuestionPillText: {
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  reviewList: {
    marginTop: 10,
    gap: 10,
  },
  reviewCard: {
    backgroundColor: 'rgba(30, 14, 61, 0.9)',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: 'rgba(154, 107, 255, 0.25)',
    padding: 13,
  },
  reviewCardExpanded: {
    borderColor: 'rgba(255, 196, 61, 0.4)',
    backgroundColor: 'rgba(36, 17, 72, 0.96)',
  },
  reviewCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reviewRoundBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 7,
  },
  reviewRoundText: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  reviewCardRightMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  reviewStatusText: {
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  itemChevron: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  reviewQuestionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    lineHeight: 19,
  },
  reviewAnswersCol: {
    marginTop: 8,
    gap: 5,
    backgroundColor: 'rgba(8, 3, 20, 0.55)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  answerLabel: {
    color: '#BDB3DC',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  wrongAnswerValue: {
    color: '#FF7A8A',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  correctAnswerValue: {
    color: '#3FD08A',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  explanationBox: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  reviewExplanation: {
    color: '#DDD6FE',
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
    lineHeight: 16,
  },

  // Sabit Alt Buton Barı
  stickyBottomDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: 'rgba(18, 7, 41, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.14)',
  },
});
