import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { PlayerScoreSummary } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import {
  TavrikoScreen,
  TavrikoProgressBar,
  CharacterAvatar,
  XpStarIcon,
} from '../components/TavrikoIcons';
interface IntermissionLeaderboardScreenProps {
  currentRound: number;
  totalRounds: number;
  leaderboard: PlayerScoreSummary[];
  currentUserId: string;
}
export const IntermissionLeaderboardScreen: React.FC<
  IntermissionLeaderboardScreenProps
> = ({ currentRound, leaderboard, currentUserId }) => {
  return (
    <TavrikoScreen>
      <Text style={styles.title}>SORU {currentRound} SONUÇLARI</Text>
      <Text style={styles.subtitle}>Canlı sıralama</Text>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.listCard}>
          {leaderboard.map((item, idx) => {
            const isMe = item.playerId === currentUserId;
            return (
              <View
                key={item.playerId}
                style={[styles.playerRow, isMe && styles.playerRowMe]}
              >
                <Text style={styles.rankText}>{item.rank || idx + 1}</Text>
                <CharacterAvatar
                  seed={item.avatarUrl || item.displayName}
                  index={idx}
                  size={34}
                />
                <Text style={styles.nameText} numberOfLines={1}>
                  {item.displayName}
                </Text>
                <Text
                  style={[
                    styles.deltaText,
                    { color: item.score > 0 ? '#7CFC8A' : '#CBBFE8' },
                  ]}
                >
                  {item.score > 0 ? `+120` : '0'}
                </Text>
                <XpStarIcon size={18} />
                <Text style={styles.scoreText}>{item.score}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.bottomTimerWrap}>
          <Text style={styles.nextQuestionText}>Sıradaki soru 3s</Text>
          <TavrikoProgressBar progress={60} height={12} />
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
  listCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 20,
    padding: 8,
    gap: 4,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    paddingHorizontal: 12,
    gap: 10,
    borderRadius: 14,
  },
  playerRowMe: {
    backgroundColor: '#6B3CFF',
  },
  rankText: {
    width: 18,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
  nameText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
  deltaText: {
    width: 44,
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  scoreText: {
    minWidth: 42,
    textAlign: 'right',
    color: '#FFC43D',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
  bottomTimerWrap: {
    marginTop: 30,
  },
  nextQuestionText: {
    fontFamily: THEME.fonts.display,
    fontSize: 20,
    color: '#FFA54A',
    textAlign: 'center',
    marginBottom: 10,
  },
});