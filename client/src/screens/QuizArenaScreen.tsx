import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { THEME, getCategoryTheme } from '../theme/tokens';
import { sound } from '../services/soundService';
import { ClientQuestion, QuestionOption } from '@trivia/shared';
import { Clock, Flame, Zap, ShieldCheck } from 'lucide-react-native';

interface QuizArenaScreenProps {
  question: ClientQuestion;
  selectedOptionId: string | null;
  isLocked: boolean;
  streak: number;
  currentScore: number;
  onSelectOption: (optionId: string) => void;
  onTimeExpired?: () => void;
}

export const QuizArenaScreen: React.FC<QuizArenaScreenProps> = ({
  question,
  selectedOptionId,
  isLocked,
  streak,
  currentScore,
  onSelectOption,
  onTimeExpired,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(question.timeLimitSec);
  const [timerAnim] = useState(new Animated.Value(1));
  const categoryTheme = getCategoryTheme(question.categoryId);

  useEffect(() => {
    setSecondsLeft(question.timeLimitSec);
    timerAnim.setValue(1);

    Animated.timing(timerAnim, {
      toValue: 0,
      duration: question.timeLimitSec * 1000,
      useNativeDriver: false,
    }).start();

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onTimeExpired) onTimeExpired();
          return 0;
        }
        if (prev <= 4) {
          sound.playSound('timer_tick');
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      timerAnim.stopAnimation();
    };
  }, [question]);

  const handleSelect = (optionId: string) => {
    if (isLocked) return;
    sound.playSound('tap');
    sound.triggerHaptic('medium');
    onSelectOption(optionId);
  };

  const optionLabels = ['A', 'B', 'C', 'D'];

  return (
    <View style={styles.container}>
      {/* Top HUD: Round Counter, Score, Streak */}
      <View style={styles.topHud}>
        <View style={styles.roundPill}>
          <Text style={styles.roundText}>
            Soru {question.roundNumber} / {question.totalRounds}
          </Text>
        </View>

        <View style={styles.hudRight}>
          {streak > 1 && (
            <View style={styles.streakBadge}>
              <Flame size={14} color="#FFF" />
              <Text style={styles.streakText}>{streak}x Seri!</Text>
            </View>
          )}

          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>{currentScore} Puan</Text>
          </View>
        </View>
      </View>

      {/* Authoritative Timer Bar */}
      <View style={styles.timerTrack}>
        <Animated.View
          style={[
            styles.timerFill,
            {
              width: timerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: secondsLeft <= 3 ? THEME.colors.timerCritical : categoryTheme.primary,
            },
          ]}
        />
      </View>

      <View style={styles.timerValueRow}>
        <Clock size={16} color={secondsLeft <= 3 ? THEME.colors.timerCritical : THEME.colors.textMuted} />
        <Text
          style={[
            styles.timerSeconds,
            secondsLeft <= 3 && { color: THEME.colors.timerCritical },
          ]}
        >
          {secondsLeft}s
        </Text>
      </View>

      {/* Question Card */}
      <View style={[styles.questionCard, { borderColor: categoryTheme.primary }]}>
        <View style={styles.categoryBadgeRow}>
          <Text style={[styles.categoryBadge, { color: categoryTheme.primary }]}>
            {question.categoryId.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
        <Text style={styles.questionText}>{question.text}</Text>
      </View>

      {/* 4 Options Grid */}
      <View style={styles.optionsContainer}>
        {question.options.map((opt, index) => {
          const isSelected = selectedOptionId === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.optionCard,
                isSelected && styles.optionSelected,
                isLocked && !isSelected && styles.optionDimmed,
              ]}
              disabled={isLocked}
              activeOpacity={0.8}
              onPress={() => handleSelect(opt.id)}
            >
              <View
                style={[
                  styles.optionLetterBox,
                  isSelected && styles.optionLetterBoxSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionLetter,
                    isSelected && styles.optionLetterSelected,
                  ]}
                >
                  {optionLabels[index]}
                </Text>
              </View>

              <Text
                style={[
                  styles.optionText,
                  isSelected && styles.optionTextSelected,
                ]}
              >
                {opt.text}
              </Text>

              {isSelected && (
                <View style={styles.lockIcon}>
                  <ShieldCheck size={18} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Lock status banner */}
      {isLocked && (
        <View style={styles.lockedBanner}>
          <Text style={styles.lockedText}>Cevabınız kilitlendi! Süre sonu bekleniyor...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    padding: THEME.spacing.lg,
    justifyContent: 'space-between',
  },
  topHud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roundPill: {
    backgroundColor: THEME.colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  roundText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  hudRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.streak,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
  },
  streakText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  scoreBadge: {
    backgroundColor: THEME.colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  scoreText: {
    color: THEME.colors.gold,
    fontSize: 13,
    fontWeight: '800',
  },
  timerTrack: {
    height: 6,
    backgroundColor: THEME.colors.card,
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 4,
  },
  timerFill: {
    height: '100%',
    borderRadius: 3,
  },
  timerValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginBottom: 8,
  },
  timerSeconds: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  questionCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.xl,
    padding: THEME.spacing.xl,
    borderWidth: 1.5,
    minHeight: 140,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  categoryBadgeRow: {
    marginBottom: 8,
  },
  categoryBadge: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    lineHeight: 26,
  },
  optionsContainer: {
    gap: 12,
    marginVertical: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: 14,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  optionSelected: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.cardHover,
  },
  optionDimmed: {
    opacity: 0.6,
  },
  optionLetterBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionLetterBoxSelected: {
    backgroundColor: THEME.colors.primary,
  },
  optionLetter: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  optionLetterSelected: {
    color: '#FFF',
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  optionTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },
  lockIcon: {
    marginLeft: 8,
  },
  lockedBanner: {
    backgroundColor: THEME.colors.card,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  lockedText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
});
