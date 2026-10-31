import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import {
  Button3D,
  TavrikoProgressBar,
  TrophyIcon,
  CoinIcon,
} from '../components/TavrikoIcons';
export interface PracticeStats {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  emptyAnswers: number;
  totalScore: number;
}
interface PracticeSummaryModalProps {
  visible: boolean;
  stats: PracticeStats;
  onPlayAgain: () => void;
  onHome: () => void;
}
export const PracticeSummaryModal: React.FC<PracticeSummaryModalProps> = ({
  visible,
  stats,
  onPlayAgain,
  onHome,
}) => {
  useEffect(() => {
    if (visible) {
      sound.playSound('victory');
      sound.triggerHaptic('success');
    }
  }, [visible]);
  if (!visible) return null;
  const accuracy =
    stats.totalQuestions > 0
      ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100)
      : 0;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <TrophyIcon size={58} />
          <Text style={styles.title}>TUR TAMAMLANDI!</Text>
          <Text style={styles.subtitle}>
            {stats.totalQuestions} soruda {stats.correctAnswers} doğru (%{accuracy})
          </Text>
          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: '#7CFC8A' }]}>
                {stats.correctAnswers}
              </Text>
              <Text style={styles.statLab}>Doğru</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: '#FF7A8A' }]}>
                {stats.wrongAnswers}
              </Text>
              <Text style={styles.statLab}>Yanlış</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: '#FFC43D' }]}>
                {stats.totalScore}
              </Text>
              <Text style={styles.statLab}>Puan</Text>
            </View>
          </View>
          {/* Reward Box */}
          <View style={styles.rewardCard}>
            <View style={styles.rewardTop}>
              <Text style={styles.xpText}>
                +{Math.max(50, stats.correctAnswers * 40)} XP
              </Text>
              <View style={styles.coinPill}>
                <CoinIcon size={18} />
                <Text style={styles.coinText}>
                  +{Math.max(10, stats.correctAnswers * 15)}
                </Text>
              </View>
            </View>
            <TavrikoProgressBar progress={82} height={10} />
          </View>
          <View style={styles.actionsRow}>
            <Button3D
              title="TEKRAR OYNA"
              onPress={onPlayAgain}
              style={{ flex: 1, paddingHorizontal: 8 }}
              textStyle={{ fontSize: 15 }}
            />
            <Button3D
              title="KATEGORİLER"
              variant="mint"
              onPress={onHome}
              style={{ flex: 1, paddingHorizontal: 8 }}
              textStyle={{ fontSize: 15 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 3, 20, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderRadius: 24,
    padding: 20,
    backgroundColor: '#241050',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 32,
    color: '#FFFFFF',
    marginTop: 8,
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 4,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
  },
  statVal: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
  },
  statLab: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  rewardCard: {
    width: '100%',
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 16,
  },
  rewardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  xpText: {
    fontFamily: THEME.fonts.display,
    fontSize: 20,
    color: '#7CFC8A',
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  coinText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
});