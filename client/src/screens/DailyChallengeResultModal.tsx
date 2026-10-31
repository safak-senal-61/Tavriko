import React from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { THEME } from '../theme/tokens';
import {
  Button3D,
  StreakFlameIcon,
  CoinIcon,
  GemIcon,
  ChestIcon,
} from '../components/TavrikoIcons';
interface DailyChallengeResultModalProps {
  visible: boolean;
  success: boolean;
  correctAnswers: number;
  totalQuestions: number;
  requiredCorrect: number;
  streak: number;
  rewards?: {
    xp?: number;
    coins?: number;
    gems?: number;
    chest?: string;
    newStreak?: number;
  };
  onContinue: () => void;
  onRetry: () => void;
}
export const DailyChallengeResultModal: React.FC<DailyChallengeResultModalProps> = ({
  visible,
  success,
  correctAnswers,
  totalQuestions,
  requiredCorrect,
  streak,
  rewards,
  onContinue,
  onRetry,
}) => {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onContinue}>
      <View style={styles.overlay}>
        <View style={[styles.card, success ? styles.cardSuccess : styles.cardFail]}>
          {/* Flame Icon */}
          <View style={styles.flameWrap}>
            <StreakFlameIcon size={76} active={success} />
          </View>
          {/* Title */}
          <Text style={styles.title}>
            {success ? 'GÜNLÜK SERİ ATEŞLENDİ! 🔥' : 'HEDEF TAMAMLANAMADI'}
          </Text>
          {/* Status Badge */}
          <View style={[styles.statusBadge, success ? styles.statusBadgeSuccess : styles.statusBadgeFail]}>
            <Text style={[styles.statusBadgeText, success ? styles.statusTextSuccess : styles.statusTextFail]}>
              {success
                ? `✓ ${rewards?.newStreak || streak} GÜNLÜK SERİ KORUNDU`
                : `⚠️ EN AZ ${requiredCorrect} DOĞRU GEREKLİYDİ`}
            </Text>
          </View>
          {/* Description */}
          <Text style={styles.description}>
            {success
              ? `Tebrikler! ${totalQuestions} soruda ${correctAnswers} doğru yaparak bugünkü meydan okumayı zaferle bitirdin.`
              : `${totalQuestions} soruda ${correctAnswers} doğru yaptın. Serini kaybetmemek için hemen tekrar dene!`}
          </Text>
          {/* Rewards Section (if success) */}
          {success && (
            <View style={styles.rewardsBox}>
              <Text style={styles.rewardsTitle}>KAZANILAN ÖDÜLLER</Text>
              <View style={styles.rewardsRow}>
                <View style={styles.rewardItem}>
                  <Text style={styles.rewardItemVal}>+{rewards?.xp || 75} XP</Text>
                </View>
                <View style={styles.rewardItem}>
                  <CoinIcon size={16} />
                  <Text style={styles.rewardItemVal}> +{rewards?.coins || 50}</Text>
                </View>
                <View style={styles.rewardItem}>
                  <GemIcon size={16} />
                  <Text style={styles.rewardItemVal}> +{rewards?.gems || 10}</Text>
                </View>
                {rewards?.chest && (
                  <View style={styles.rewardItem}>
                    <ChestIcon size={18} />
                    <Text style={styles.rewardItemVal}>
                      {rewards.chest === 'mega_chest' ? ' Mega Sandık' : ' Sandık'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
          {/* Actions */}
          <View style={styles.actionsWrap}>
            {success ? (
              <Button3D
                title="HARİKA! (SERİYİ GÖR) →"
                variant="gold"
                onPress={onContinue}
                style={{ width: '100%' }}
              />
            ) : (
              <>
                <Button3D
                  title="TEKRAR DENE ⚡"
                  variant="mint"
                  onPress={onRetry}
                  style={{ width: '100%' }}
                />
                <Button3D
                  title="MENÜYE DÖN"
                  variant="purple"
                  onPress={onContinue}
                  style={{ width: '100%' }}
                />
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 3, 20, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: '#1E0E45',
    borderRadius: 26,
    borderWidth: 2,
    padding: 22,
    alignItems: 'center',
  },
  cardSuccess: {
    borderColor: '#FFC43D',
  },
  cardFail: {
    borderColor: 'rgba(255, 92, 119, 0.55)',
  },
  flameWrap: {
    marginBottom: 10,
    alignItems: 'center',
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusBadgeSuccess: {
    backgroundColor: 'rgba(255, 196, 61, 0.2)',
    borderWidth: 1,
    borderColor: '#FFC43D',
  },
  statusBadgeFail: {
    backgroundColor: 'rgba(255, 92, 119, 0.2)',
    borderWidth: 1,
    borderColor: '#FF5C77',
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.8,
  },
  statusTextSuccess: {
    color: '#FFC43D',
  },
  statusTextFail: {
    color: '#FF7A8A',
  },
  description: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  rewardsBox: {
    width: '100%',
    backgroundColor: 'rgba(8, 3, 20, 0.65)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    marginBottom: 16,
  },
  rewardsTitle: {
    color: '#A992E2',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 1,
    marginBottom: 8,
  },
  rewardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  rewardItemVal: {
    color: '#FFC43D',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  actionsWrap: {
    width: '100%',
    gap: 10,
  },
});