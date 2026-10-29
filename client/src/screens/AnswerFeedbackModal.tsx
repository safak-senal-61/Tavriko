import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { CheckCircle2, XCircle, Zap, Flame, Info } from 'lucide-react-native';

interface AnswerFeedbackModalProps {
  visible: boolean;
  isCorrect: boolean;
  correctAnswerText: string;
  explanation: string;
  pointsEarned: number;
  speedBonus: number;
  streak: number;
}

export const AnswerFeedbackModal: React.FC<AnswerFeedbackModalProps> = ({
  visible,
  isCorrect,
  correctAnswerText,
  explanation,
  pointsEarned,
  speedBonus,
  streak,
}) => {
  useEffect(() => {
    if (visible) {
      if (isCorrect) {
        sound.playSound('correct');
        sound.triggerHaptic('success');
      } else {
        sound.playSound('wrong');
        sound.triggerHaptic('error');
      }
    }
  }, [visible, isCorrect]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.dialog, isCorrect ? styles.dialogCorrect : styles.dialogWrong]}>
          <View style={styles.iconCircle}>
            {isCorrect ? (
              <CheckCircle2 size={56} color={THEME.colors.correct} />
            ) : (
              <XCircle size={56} color={THEME.colors.wrong} />
            )}
          </View>

          <Text style={[styles.title, { color: isCorrect ? THEME.colors.correct : THEME.colors.wrong }]}>
            {isCorrect ? 'HARİKA! DOĞRU CEVAP' : 'MAALESEF YANLIŞ'}
          </Text>

          {isCorrect && (
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>KAZANILAN</Text>
                <Text style={styles.statValue}>+{pointsEarned}</Text>
              </View>

              {speedBonus > 0 && (
                <View style={styles.statBox}>
                  <View style={styles.badgeRow}>
                    <Zap size={12} color={THEME.colors.gold} />
                    <Text style={styles.statLabel}>HIZ BONUSU</Text>
                  </View>
                  <Text style={[styles.statValue, { color: THEME.colors.gold }]}>+{speedBonus}</Text>
                </View>
              )}

              {streak > 1 && (
                <View style={styles.statBox}>
                  <View style={styles.badgeRow}>
                    <Flame size={12} color={THEME.colors.streak} />
                    <Text style={styles.statLabel}>SERİ</Text>
                  </View>
                  <Text style={[styles.statValue, { color: THEME.colors.streak }]}>{streak}x</Text>
                </View>
              )}
            </View>
          )}

          {!isCorrect && (
            <View style={styles.correctAnswerBox}>
              <Text style={styles.correctAnswerLabel}>Doğru Seçenek:</Text>
              <Text style={styles.correctAnswerValue}>{correctAnswerText}</Text>
            </View>
          )}

          <View style={styles.explanationBox}>
            <View style={styles.explanationHeader}>
              <Info size={14} color={THEME.colors.textSecondary} />
              <Text style={styles.explanationTitle}>Açıklama</Text>
            </View>
            <Text style={styles.explanationText}>{explanation}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.lg,
  },
  dialog: {
    width: '100%',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.xl,
    padding: THEME.spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  dialogCorrect: {
    borderColor: THEME.colors.correct,
  },
  dialogWrong: {
    borderColor: THEME.colors.wrong,
  },
  iconCircle: {
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    backgroundColor: THEME.colors.backgroundSecondary,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.colors.correct,
    marginTop: 2,
  },
  correctAnswerBox: {
    width: '100%',
    backgroundColor: THEME.colors.wrongBackground,
    borderRadius: THEME.radius.md,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.colors.wrong,
  },
  correctAnswerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 2,
  },
  correctAnswerValue: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  explanationBox: {
    width: '100%',
    backgroundColor: THEME.colors.backgroundSecondary,
    borderRadius: THEME.radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  explanationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  explanationText: {
    fontSize: 13,
    color: THEME.colors.textPrimary,
    lineHeight: 18,
  },
});
