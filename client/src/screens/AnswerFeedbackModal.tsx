import React from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { THEME } from '../theme/tokens';
import {
  Button3D,
  CheckMarkSvg,
  CrossMarkSvg,
  SpeedBoltIcon,
} from '../components/TavrikoIcons';
interface AnswerFeedbackModalProps {
  visible: boolean;
  isCorrect: boolean;
  isTimeout?: boolean;
  correctAnswerText: string;
  explanation: string;
  pointsEarned: number;
  speedBonus: number;
  streak: number;
  onContinue?: () => void;
}
export const AnswerFeedbackModal: React.FC<AnswerFeedbackModalProps> = ({
  visible,
  isCorrect,
  isTimeout = false,
  correctAnswerText,
  explanation,
  pointsEarned,
  speedBonus,
  onContinue,
}) => {
  if (!visible) return null;
  const badgeBg = isTimeout
    ? '#FFB21E'
    : isCorrect
    ? '#28B46E'
    : '#D81E3C';
  const titleText = isTimeout
    ? 'SÜRE DOLDU!'
    : isCorrect
    ? 'DOĞRU!'
    : 'YANLIŞ!';
  const titleColor = isTimeout
    ? '#FFC43D'
    : isCorrect
    ? '#7CFC8A'
    : '#FF7A8A';
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Floating Top Circle Icon */}
          <View style={[styles.topCircle, { backgroundColor: badgeBg }]}>
            {isCorrect ? (
              <CheckMarkSvg size={34} />
            ) : (
              <CrossMarkSvg size={32} />
            )}
          </View>
          <Text style={[styles.title, { color: titleColor }]}>{titleText}</Text>
          {/* Reward Pills */}
          <View style={styles.pillsRow}>
            <View style={styles.pill}>
              <Text style={styles.pointsText}>+{pointsEarned} puan</Text>
            </View>
            {speedBonus > 0 && (
              <View style={styles.pill}>
                <SpeedBoltIcon size={16} />
                <Text style={styles.speedText}>Hız bonusu +{speedBonus}</Text>
              </View>
            )}
          </View>
          {!isCorrect && correctAnswerText ? (
            <Text style={styles.correctLine}>
              Doğru Cevap: {correctAnswerText}
            </Text>
          ) : null}
          {/* Explanation Glass Box */}
          <View style={styles.explanationBox}>
            <Text style={styles.explanationText}>
              {explanation ||
                'Doğru cevap sistem tarafından doğrulandı. Sıradaki soruya hazırlan!'}
            </Text>
          </View>
          {onContinue && (
            <View style={{ marginTop: 16, width: '100%' }}>
              <Button3D title="DEVAM" onPress={onContinue} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 3, 20, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    width: '100%',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 24,
    backgroundColor: '#28164D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
  },
  topCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginTop: -60,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 36,
  },
  pillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
    marginBottom: 14,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pointsText: {
    color: '#FFC43D',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  speedText: {
    color: '#7FD0FF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  correctLine: {
    color: '#7CFC8A',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    marginBottom: 8,
  },
  explanationBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 16,
    padding: 12,
  },
  explanationText: {
    color: '#E6DCFF',
    fontSize: 13,
    fontFamily: THEME.fonts.body,
  },
});