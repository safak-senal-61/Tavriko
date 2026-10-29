import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { FinalMatchSummary } from '@trivia/shared';
import { Trophy, Crown, Award, RotateCcw, Home, Sparkles } from 'lucide-react-native';

interface MatchResultPodiumProps {
  summary: FinalMatchSummary;
  currentUserId: string;
  onPlayAgain: () => void;
  onHome: () => void;
}

export const MatchResultPodiumScreen: React.FC<MatchResultPodiumProps> = ({
  summary,
  currentUserId,
  onPlayAgain,
  onHome,
}) => {
  const { podium, rankings } = summary;

  useEffect(() => {
    sound.playSound('victory');
    sound.triggerHaptic('success');
  }, []);

  const myResult = rankings.find((p) => p.playerId === currentUserId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.trophyCircle}>
          <Trophy size={48} color={THEME.colors.gold} />
        </View>
        <Text style={styles.title}>MAÇ TAMAMLANDI!</Text>
        <Text style={styles.subtitle}>
          {myResult?.rank === 1 ? 'Tebrikler! Arenanın Şampiyonu Oldun!' : `Tebrikler! Yarışmayı #${myResult?.rank || 1} olarak tamamladın.`}
        </Text>
      </View>

      {/* 3D-feel Podium: 2nd, 1st, 3rd */}
      <View style={styles.podiumContainer}>
        {/* 2nd Place */}
        {podium.second && (
          <View style={styles.podiumColumn}>
            <View style={styles.podiumAvatar}>
              <Text style={styles.avatarInitial}>
                {podium.second.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.podiumName} numberOfLines={1}>{podium.second.displayName}</Text>
            <Text style={styles.podiumScore}>{podium.second.score}</Text>
            <View style={[styles.podiumBlock, styles.blockSecond]}>
              <Text style={styles.blockNumber}>2</Text>
            </View>
          </View>
        )}

        {/* 1st Place */}
        {podium.first && (
          <View style={styles.podiumColumn}>
            <View style={styles.crownWrapper}>
              <Crown size={24} color={THEME.colors.gold} />
            </View>
            <View style={[styles.podiumAvatar, styles.avatarFirst]}>
              <Text style={styles.avatarInitial}>
                {podium.first.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.podiumName} numberOfLines={1}>{podium.first.displayName}</Text>
            <Text style={[styles.podiumScore, { color: THEME.colors.gold }]}>
              {podium.first.score}
            </Text>
            <View style={[styles.podiumBlock, styles.blockFirst]}>
              <Text style={styles.blockNumber}>1</Text>
            </View>
          </View>
        )}

        {/* 3rd Place */}
        {podium.third && (
          <View style={styles.podiumColumn}>
            <View style={styles.podiumAvatar}>
              <Text style={styles.avatarInitial}>
                {podium.third.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.podiumName} numberOfLines={1}>{podium.third.displayName}</Text>
            <Text style={styles.podiumScore}>{podium.third.score}</Text>
            <View style={[styles.podiumBlock, styles.blockThird]}>
              <Text style={styles.blockNumber}>3</Text>
            </View>
          </View>
        )}
      </View>

      {/* Match Rewards */}
      <View style={styles.rewardsCard}>
        <View style={styles.rewardRow}>
          <Sparkles size={20} color={THEME.colors.primaryLight} />
          <Text style={styles.rewardTitle}>Kazanılan Ödüller</Text>
        </View>

        <View style={styles.rewardBadges}>
          <View style={styles.rewardBadge}>
            <Text style={styles.rewardLabel}>DENEYİM (XP)</Text>
            <Text style={styles.rewardValue}>+350 XP</Text>
          </View>
          <View style={styles.rewardBadge}>
            <Text style={styles.rewardLabel}>ALTIN COIN</Text>
            <Text style={[styles.rewardValue, { color: THEME.colors.gold }]}>+75</Text>
          </View>
          <View style={styles.rewardBadge}>
            <Text style={styles.rewardLabel}>SIRALAMA PUANI</Text>
            <Text style={[styles.rewardValue, { color: THEME.colors.correct }]}>+25 LP</Text>
          </View>
        </View>
      </View>

      {/* Rankings Table */}
      <Text style={styles.rankingsHeader}>Tüm Yarışmacılar</Text>
      <View style={styles.rankingsList}>
        {rankings.map((p) => (
          <View key={p.playerId} style={styles.tableRow}>
            <Text style={styles.tableRank}>#{p.rank}</Text>
            <Text style={styles.tableName}>{p.displayName}</Text>
            <Text style={styles.tableScore}>{p.score} Puan</Text>
          </View>
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.playAgainBtn}
          onPress={() => {
            sound.playSound('tap');
            onPlayAgain();
          }}
        >
          <RotateCcw size={18} color="#FFF" />
          <Text style={styles.btnText}>Tekrar Oyna</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => {
            sound.playSound('tap');
            onHome();
          }}
        >
          <Home size={18} color={THEME.colors.textPrimary} />
          <Text style={styles.btnTextSecondary}>Ana Sayfa</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  content: {
    padding: THEME.spacing.lg,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  trophyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  podiumContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    width: '100%',
    height: 220,
    marginBottom: 24,
  },
  podiumColumn: {
    flex: 1,
    alignItems: 'center',
  },
  crownWrapper: {
    marginBottom: 2,
  },
  podiumAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.cardHover,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: THEME.colors.border,
  },
  avatarFirst: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderColor: THEME.colors.gold,
    backgroundColor: THEME.colors.primary,
  },
  avatarInitial: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  podiumName: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginTop: 4,
  },
  podiumScore: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    marginBottom: 6,
  },
  podiumBlock: {
    width: '85%',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: THEME.radius.md,
    borderTopRightRadius: THEME.radius.md,
  },
  blockFirst: {
    height: 110,
    backgroundColor: 'rgba(251, 191, 36, 0.25)',
    borderWidth: 1.5,
    borderColor: THEME.colors.gold,
  },
  blockSecond: {
    height: 80,
    backgroundColor: 'rgba(203, 213, 225, 0.2)',
    borderWidth: 1.5,
    borderColor: THEME.colors.silver,
  },
  blockThird: {
    height: 55,
    backgroundColor: 'rgba(217, 119, 6, 0.2)',
    borderWidth: 1.5,
    borderColor: THEME.colors.bronze,
  },
  blockNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFF',
  },
  rewardsCard: {
    width: '100%',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 20,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  rewardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  rewardBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  rewardBadge: {
    flex: 1,
    backgroundColor: THEME.colors.backgroundSecondary,
    borderRadius: THEME.radius.md,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  rewardLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  rewardValue: {
    fontSize: 14,
    fontWeight: '900',
    color: THEME.colors.primaryLight,
    marginTop: 2,
  },
  rankingsHeader: {
    alignSelf: 'flex-start',
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 10,
  },
  rankingsList: {
    width: '100%',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
    marginBottom: 24,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  tableRank: {
    width: 36,
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textMuted,
  },
  tableName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  tableScore: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.gold,
  },
  actionButtons: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  playAgainBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.md,
    paddingVertical: 14,
  },
  homeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  btnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  btnTextSecondary: {
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
