import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Platform } from 'react-native';
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

export const MatchResultPodiumScreen: React.FC<MatchResultPodiumScreenProps> = ({
  summary,
  currentUserId,
  questionReviews,
  onPlayAgain,
  onHome,
}) => {
  const reviews = questionReviews || summary.questionReviews || [];
  // Sadece gerçek oyuncular gösterilir — sahte dolgu isimleri yok!
  const first = summary.podium?.first || null;
  const second = summary.podium?.second || null;
  const third = summary.podium?.third || null;

  const myRanking = summary.rankings?.find((r) => r.playerId === currentUserId);
  const xpEarned = myRanking && myRanking.rank === 1 ? 160 : 60;
  const coinsEarned = myRanking && myRanking.rank === 1 ? 50 : 20;

  // Podium rising animations
  const col1Anim = useRef(new Animated.Value(80)).current;
  const col2Anim = useRef(new Animated.Value(80)).current;
  const col3Anim = useRef(new Animated.Value(80)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Settings > "Zafer & Podyum Melodisi" — kapalıysa zafer melodisi çalınmaz
    if (loadStoredPreferences().victoryMelody !== false) {
      sound.playSound('victory');
    }
    sound.triggerHaptic('success');
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.stagger(140, [
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

  const correctCount = reviews.filter((r) => r.isCorrect).length;

  return (
    <TavrikoScreen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>MAÇ BİTTİ</Text>
        <Text style={styles.subtitle}>Tavriko Arena · Sonuçlar</Text>

        {/* 3-Column Podium (2 - 1 - 3) — SADECE gerçek oyuncular gösterilir */}
        <Animated.View style={[styles.podiumRow, { opacity: fadeAnim }]}>
          {/* 2nd Place */}
          {second && (
            <Animated.View
              style={[
                styles.podiumCol,
                { transform: [{ translateY: col2Anim }] },
              ]}
            >
              <CharacterAvatar seed={second.avatarUrl || second.displayName} index={2} size={46} />
              <Text style={styles.podiumName} numberOfLines={1}>
                {second.displayName}
              </Text>
              <Text style={styles.podiumScore}>{second.score}</Text>
              <View style={[styles.pillar, styles.pillar2]}>
                <Text style={styles.pillarNumber}>2</Text>
              </View>
            </Animated.View>
          )}

          {/* 1st Place */}
          {first && (
            <Animated.View
              style={[
                styles.podiumCol,
                { transform: [{ translateY: col1Anim }] },
              ]}
            >
              <CrownIcon size={28} />
              <CharacterAvatar seed={first.avatarUrl || first.displayName} index={1} size={54} />
              <Text style={styles.podiumName} numberOfLines={1}>
                {first.displayName}
              </Text>
              <Text style={styles.podiumScore}>{first.score}</Text>
              <View style={[styles.pillar, styles.pillar1]}>
                <Text style={styles.pillarNumber}>1</Text>
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
              <CharacterAvatar seed={third.avatarUrl || third.displayName} index={3} size={44} />
              <Text style={styles.podiumName} numberOfLines={1}>
                {third.displayName}
              </Text>
              <Text style={styles.podiumScore}>{third.score}</Text>
              <View style={[styles.pillar, styles.pillar3]}>
                <Text style={styles.pillarNumber}>3</Text>
              </View>
            </Animated.View>
          )}
        </Animated.View>

        {/* XP & Coin Reward Card */}
        <View style={styles.rewardCard}>
          <View style={styles.rewardTopRow}>
            <Text style={styles.xpAwardText}>+{xpEarned} XP</Text>
            <View style={styles.coinPill}>
              <CoinIcon size={20} />
              <Text style={styles.coinPillText}>+{coinsEarned}</Text>
            </View>
          </View>
          <View style={styles.levelSubRow}>
            <Text style={styles.levelSubText}>Seviye 12 → 13</Text>
          </View>
          <TavrikoProgressBar progress={92} height={12} />
        </View>

        {/* Soru Detayları / Yapılan Doğru & Yanlışlar Listesi (En Son Görüntülenir) */}
        {reviews.length > 0 && (
          <View style={styles.reviewSection}>
            <View style={styles.reviewHeaderRow}>
              <Text style={styles.reviewSectionTitle}>SORU CEVAPLARI</Text>
              <View style={styles.reviewScorePill}>
                <Text style={styles.reviewScoreText}>
                  {correctCount}/{reviews.length} DOĞRU
                </Text>
              </View>
            </View>

            <View style={styles.reviewList}>
              {reviews.map((item, idx) => {
                const statusColor = item.isCorrect
                  ? '#5ADBB5'
                  : item.isTimeout
                  ? '#FFC43D'
                  : '#FF6B6B';
                const statusBadge = item.isCorrect
                  ? `✓ DOĞRU (+${item.pointsEarned}p)`
                  : item.isTimeout
                  ? '⏱️ SÜRE DOLDU'
                  : '✕ YANLIŞ';

                return (
                  <View
                    key={`review_${idx}`}
                    style={[styles.reviewCard, { borderLeftColor: statusColor }]}
                  >
                    <View style={styles.reviewCardTop}>
                      <Text style={styles.reviewRoundText}>
                        Soru {item.roundNumber || idx + 1}
                      </Text>
                      <View
                        style={[
                          styles.reviewStatusBadge,
                          { backgroundColor: statusColor + '22' },
                        ]}
                      >
                        <Text style={[styles.reviewStatusText, { color: statusColor }]}>
                          {statusBadge}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.reviewQuestionText}>{item.questionText}</Text>

                    <View style={styles.reviewAnswersCol}>
                      {item.userAnswerText && !item.isCorrect && (
                        <Text style={styles.reviewYourAnswer}>
                          Senin cevabın:{' '}
                          <Text style={{ color: '#FF7A8A', fontWeight: 'bold' }}>
                            {item.userAnswerText}
                          </Text>
                        </Text>
                      )}
                      <Text style={styles.reviewCorrectAnswer}>
                        Doğru cevap:{' '}
                        <Text style={{ color: '#5ADBB5', fontWeight: 'bold' }}>
                          {item.correctAnswerText}
                        </Text>
                      </Text>
                      {item.explanation ? (
                        <Text style={styles.reviewExplanation}>
                          💡 {item.explanation}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <Button3D
            title="TEKRAR OYNA"
            onPress={onPlayAgain}
            style={{ flex: 1, paddingHorizontal: 8 }}
          />
          <Button3D
            title="ANA SAYFA"
            variant="mint"
            onPress={onHome}
            style={{ flex: 1, paddingHorizontal: 8 }}
          />
        </View>
      </ScrollView>
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 34,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 2,
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginBottom: 12,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  podiumCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  podiumName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  podiumScore: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  pillar: {
    width: '100%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillar1: {
    height: 140,
    backgroundColor: '#D4982A',
  },
  pillar2: {
    height: 105,
    backgroundColor: '#7C84A8',
  },
  pillar3: {
    height: 80,
    backgroundColor: '#985E3E',
  },
  pillarNumber: {
    fontFamily: THEME.fonts.display,
    fontSize: 36,
    color: '#FFFFFF',
  },
  rewardCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  rewardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  xpAwardText: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
    color: '#7CFC8A',
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  coinPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  levelSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  levelSubText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },

  // Soru Detayları / Doğru - Yanlışlar Stili
  reviewSection: {
    marginTop: 20,
    width: '100%',
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  reviewSectionTitle: {
    color: '#FFC837',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    letterSpacing: 1.5,
  },
  reviewScorePill: {
    backgroundColor: 'rgba(90, 219, 181, 0.15)',
    borderWidth: 1,
    borderColor: '#5ADBB5',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  reviewScoreText: {
    color: '#5ADBB5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  reviewList: {
    gap: 10,
  },
  reviewCard: {
    backgroundColor: '#1E0E3D',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: 'rgba(154, 107, 255, 0.25)',
    padding: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#6B3CFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      },
    }),
  },
  reviewCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reviewRoundText: {
    color: '#9A8BC2',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  reviewStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  reviewStatusText: {
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  reviewQuestionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.bold,
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewAnswersCol: {
    gap: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    padding: 10,
    borderRadius: 10,
  },
  reviewYourAnswer: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.medium,
  },
  reviewCorrectAnswer: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.medium,
  },
  reviewExplanation: {
    color: '#BDB3DC',
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 16,
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
});
