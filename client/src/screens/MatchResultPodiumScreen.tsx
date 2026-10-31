import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { FinalMatchSummary } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
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
  onPlayAgain: () => void;
  onHome: () => void;
}
export const MatchResultPodiumScreen: React.FC<MatchResultPodiumScreenProps> = ({
  summary,
  currentUserId,
  onPlayAgain,
  onHome,
}) => {
  const first = summary.podium?.first || { displayName: 'DenizPro', score: 780 };
  const second = summary.podium?.second || { displayName: 'Ece', score: 610 };
  const third = summary.podium?.third || { displayName: 'Mert', score: 540 };
  const myRanking = summary.rankings?.find((r) => r.playerId === currentUserId);
  const xpEarned = myRanking && myRanking.rank === 1 ? 160 : 60;
  const coinsEarned = myRanking && myRanking.rank === 1 ? 50 : 20;
  // Podium rising animations
  const col1Anim = useRef(new Animated.Value(80)).current;
  const col2Anim = useRef(new Animated.Value(80)).current;
  const col3Anim = useRef(new Animated.Value(80)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    sound.playSound('victory');
    sound.triggerHaptic('success');
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.stagger(140, [
        Animated.spring(col3Anim, {
          toValue: 0,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.spring(col2Anim, {
          toValue: 0,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.spring(col1Anim, {
          toValue: 0,
          friction: 5,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [col1Anim, col2Anim, col3Anim, fadeAnim]);
  return (
    <TavrikoScreen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>MAÇ BİTTİ</Text>
        <Text style={styles.subtitle}>Düello · Tamamlandı</Text>
        {/* 3-Column Podium (2 - 1 - 3) */}
        <Animated.View style={[styles.podiumRow, { opacity: fadeAnim }]}>
          {/* 2nd Place */}
          <Animated.View
            style={[
              styles.podiumCol,
              { transform: [{ translateY: col2Anim }] },
            ]}
          >
            <CharacterAvatar seed={second.displayName} index={2} size={46} />
            <Text style={styles.podiumName} numberOfLines={1}>
              {second.displayName}
            </Text>
            <Text style={styles.podiumScore}>{second.score}</Text>
            <View style={[styles.pillar, styles.pillar2]}>
              <Text style={styles.pillarNumber}>2</Text>
            </View>
          </Animated.View>
          {/* 1st Place */}
          <Animated.View
            style={[
              styles.podiumCol,
              { transform: [{ translateY: col1Anim }] },
            ]}
          >
            <CrownIcon size={28} />
            <CharacterAvatar seed={first.displayName} index={1} size={54} />
            <Text style={styles.podiumName} numberOfLines={1}>
              {first.displayName}
            </Text>
            <Text style={styles.podiumScore}>{first.score}</Text>
            <View style={[styles.pillar, styles.pillar1]}>
              <Text style={styles.pillarNumber}>1</Text>
            </View>
          </Animated.View>
          {/* 3rd Place */}
          <Animated.View
            style={[
              styles.podiumCol,
              { transform: [{ translateY: col3Anim }] },
            ]}
          >
            <CharacterAvatar seed={third.displayName} index={3} size={44} />
            <Text style={styles.podiumName} numberOfLines={1}>
              {third.displayName}
            </Text>
            <Text style={styles.podiumScore}>{third.score}</Text>
            <View style={[styles.pillar, styles.pillar3]}>
              <Text style={styles.pillarNumber}>3</Text>
            </View>
          </Animated.View>
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
    paddingBottom: 32,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 36,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 4,
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginBottom: 14,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 16,
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
    height: 150,
    backgroundColor: '#D4982A',
  },
  pillar2: {
    height: 110,
    backgroundColor: '#7C84A8',
  },
  pillar3: {
    height: 86,
    backgroundColor: '#985E3E',
  },
  pillarNumber: {
    fontFamily: THEME.fonts.display,
    fontSize: 38,
    color: '#FFFFFF',
  },
  rewardCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  rewardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
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
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
});