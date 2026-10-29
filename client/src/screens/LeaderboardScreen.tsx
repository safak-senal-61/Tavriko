import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { ArrowLeft, Trophy, Crown, Flame, Shield, Calendar } from 'lucide-react-native';

interface LeaderboardScreenProps {
  onBack: () => void;
}

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({ onBack }) => {
  const [tab, setTab] = useState<'weekly' | 'all_time'>('weekly');

  const leaderboards = [
    { rank: 1, name: 'Zeka Fırtınası', points: 4850, level: 24, winRate: 78 },
    { rank: 2, name: 'Bilgi Avcısı', points: 4320, level: 21, winRate: 74 },
    { rank: 3, name: 'Selin Trivia', points: 3950, level: 19, winRate: 71 },
    { rank: 4, name: 'QuizMaster 3000', points: 3410, level: 16, winRate: 65 },
    { rank: 5, name: 'Canberk_06', points: 3100, level: 15, winRate: 62 },
    { rank: 6, name: 'Ayşe_Gamer', points: 2890, level: 14, winRate: 59 },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            sound.playSound('tap');
            onBack();
          }}
        >
          <ArrowLeft size={22} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Liderler Tablosu</Text>
      </View>

      {/* Season Banner */}
      <View style={styles.seasonBanner}>
        <View style={styles.seasonRow}>
          <Calendar size={16} color={THEME.colors.gold} />
          <Text style={styles.seasonTitle}>Sezon 1: Bilgi Çağı</Text>
        </View>
        <Text style={styles.seasonTimer}>Sezonun bitmesine 12 gün kaldı</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, tab === 'weekly' && styles.tabActive]}
          onPress={() => {
            sound.playSound('tap');
            setTab('weekly');
          }}
        >
          <Text style={[styles.tabText, tab === 'weekly' && styles.tabTextActive]}>Haftalık Lig</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, tab === 'all_time' && styles.tabActive]}
          onPress={() => {
            sound.playSound('tap');
            setTab('all_time');
          }}
        >
          <Text style={[styles.tabText, tab === 'all_time' && styles.tabTextActive]}>Tüm Zamanlar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {leaderboards.map((player) => {
          const isTop3 = player.rank <= 3;
          return (
            <View
              key={player.rank}
              style={[
                styles.playerCard,
                player.rank === 1 && styles.cardFirst,
                player.rank === 2 && styles.cardSecond,
                player.rank === 3 && styles.cardThird,
              ]}
            >
              <View style={styles.rankBox}>
                {player.rank === 1 ? (
                  <Crown size={22} color={THEME.colors.gold} />
                ) : (
                  <Text style={[styles.rankNumber, isTop3 && styles.rankTop3]}>
                    #{player.rank}
                  </Text>
                )}
              </View>

              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{player.name.charAt(0)}</Text>
              </View>

              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{player.name}</Text>
                <Text style={styles.playerMeta}>Lv. {player.level} • %{player.winRate} Win</Text>
              </View>

              <View style={styles.scoreBox}>
                <Text style={styles.scoreText}>{player.points}</Text>
                <Text style={styles.scoreLabel}>LP</Text>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    backgroundColor: THEME.colors.card,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  seasonBanner: {
    backgroundColor: THEME.colors.card,
    margin: THEME.spacing.lg,
    padding: 14,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  seasonTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.gold,
  },
  seasonTimer: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.lg,
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  tabActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  tabTextActive: {
    color: '#FFF',
  },
  list: {
    padding: THEME.spacing.lg,
    gap: 10,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  cardFirst: {
    borderColor: THEME.colors.gold,
  },
  cardSecond: {
    borderColor: THEME.colors.silver,
  },
  cardThird: {
    borderColor: THEME.colors.bronze,
  },
  rankBox: {
    width: 32,
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textMuted,
  },
  rankTop3: {
    color: THEME.colors.textPrimary,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  playerMeta: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  scoreBox: {
    alignItems: 'flex-end',
  },
  scoreText: {
    fontSize: 17,
    fontWeight: '900',
    color: THEME.colors.gold,
  },
  scoreLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.textMuted,
  },
});
