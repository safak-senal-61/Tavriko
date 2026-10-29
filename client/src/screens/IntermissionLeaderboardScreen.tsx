import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { THEME } from '../theme/tokens';
import { PlayerScoreSummary } from '@trivia/shared';
import { Trophy, Flame, Crown } from 'lucide-react-native';

interface IntermissionLeaderboardScreenProps {
  currentRound: number;
  totalRounds: number;
  leaderboard: PlayerScoreSummary[];
  currentUserId: string;
}

export const IntermissionLeaderboardScreen: React.FC<IntermissionLeaderboardScreenProps> = ({
  currentRound,
  totalRounds,
  leaderboard,
  currentUserId,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.roundPill}>
          <Text style={styles.roundText}>
            {currentRound}. Tur Tamamlandı
          </Text>
        </View>
        <Text style={styles.title}>Canlı Puan Durumu</Text>
        <Text style={styles.subtitle}>Sonraki soru birkaç saniye içinde başlıyor...</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {leaderboard.map((player) => {
          const isMe = player.playerId === currentUserId;
          const isFirst = player.rank === 1;

          return (
            <View
              key={player.playerId}
              style={[
                styles.playerRow,
                isMe && styles.playerRowMe,
                isFirst && styles.playerRowFirst,
              ]}
            >
              <View style={styles.rankCol}>
                {isFirst ? (
                  <Crown size={20} color={THEME.colors.gold} />
                ) : (
                  <Text style={[styles.rankText, isMe && styles.rankTextMe]}>
                    #{player.rank}
                  </Text>
                )}
              </View>

              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {player.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={styles.nameCol}>
                <Text style={[styles.playerName, isMe && styles.playerNameMe]}>
                  {player.displayName} {isMe ? '(Sen)' : ''}
                </Text>
                {player.streak > 1 && (
                  <View style={styles.streakRow}>
                    <Flame size={12} color={THEME.colors.streak} />
                    <Text style={styles.streakText}>{player.streak}x Seri</Text>
                  </View>
                )}
              </View>

              <View style={styles.scoreCol}>
                <Text style={styles.scoreText}>{player.score}</Text>
                <Text style={styles.scoreLabel}>PUAN</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    padding: THEME.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginVertical: 16,
  },
  roundPill: {
    backgroundColor: THEME.colors.card,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 8,
  },
  roundText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    marginTop: 4,
  },
  list: {
    gap: 10,
    paddingTop: 12,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  playerRowMe: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.cardHover,
  },
  playerRowFirst: {
    borderColor: THEME.colors.gold,
  },
  rankCol: {
    width: 32,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textMuted,
  },
  rankTextMe: {
    color: THEME.colors.primaryLight,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  nameCol: {
    flex: 1,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  playerNameMe: {
    color: '#FFF',
    fontWeight: '800',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  streakText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.streak,
  },
  scoreCol: {
    alignItems: 'flex-end',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.colors.gold,
  },
  scoreLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.textMuted,
  },
});
