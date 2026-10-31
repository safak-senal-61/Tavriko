import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { UserProfile } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { DEFAULT_API_BASE } from '../config';
import {
  TavrikoScreen,
  TavrikoTopBar,
  TavrikoSecondaryBottomNav,
  SecondaryNavTab,
  TrophyIcon,
  CharacterAvatar,
} from '../components/TavrikoIcons';
interface ProLeagueScreenProps {
  user?: UserProfile;
  apiBaseUrl?: string;
  onBack?: () => void;
  onNavigateSecondary?: (tab: SecondaryNavTab) => void;
  onNotifications?: () => void;
  onProfile?: () => void;
}
interface LeaguePlayer {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  rankPoints: number;
  rankTitle: string;
}
export const ProLeagueScreen: React.FC<ProLeagueScreenProps> = ({
  user,
  apiBaseUrl,
  onBack,
  onNavigateSecondary,
  onNotifications,
  onProfile,
}) => {
  const [players, setPlayers] = useState<LeaguePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const base = apiBaseUrl || DEFAULT_API_BASE;
    let isMounted = true;
    setLoading(true);
    fetch(`${base}/social/leaderboard`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        const list = Array.isArray(data) ? data : data?.topPlayers;
        if (Array.isArray(list)) {
          setPlayers(list);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl, user?.rankPoints]);
  const myEntry = players.find((p) => p.userId === user?.id);
  const myRank = myEntry ? myEntry.rank : 1;
  return (
    <TavrikoScreen>
      <TavrikoTopBar
        leftType={onBack ? 'back' : 'bell'}
        onLeftPress={onBack || onNotifications}
        coins={user?.coins ?? 0}
        gems={user?.gems ?? 0}
        avatarSeed={user?.avatarUrl || user?.displayName}
        onAvatarPress={onProfile}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          <View style={styles.trophyGlowWrap}>
            <TrophyIcon size={86} />
          </View>
          <Text style={styles.proText}>PRO</Text>
          <Text style={styles.leagueText}>LİG SIRALAMASI</Text>
          <Text style={styles.endsText}>
            {user?.rankTitle || 'Acemi Kaşif'} · Canlı Lig Tablosu
          </Text>
        </View>
        <View style={styles.pillsRow}>
          <View style={[styles.pill, styles.rankPill]}>
            <Text style={styles.pillTextWhite}>{myRank}. Sıra</Text>
          </View>
          <View style={styles.pill}>
            <TrophyIcon size={18} />
            <Text style={styles.pillTextGold}>{user?.rankPoints ?? 1000}</Text>
          </View>
        </View>
        {loading ? (
          <ActivityIndicator color="#FFC43D" size="large" style={{ marginTop: 24 }} />
        ) : (
          <View style={styles.listCard}>
            {players.map((item) => {
              const isMe = user ? item.userId === user.id : false;
              return (
                <View
                  key={item.userId}
                  style={[styles.playerRow, isMe && styles.playerRowActive]}
                >
                  <Text style={styles.rankNum}>{item.rank}</Text>
                  <CharacterAvatar
                    seed={item.avatarUrl || item.displayName}
                    size={32}
                  />
                  <Text style={styles.playerName}>
                    {item.displayName} {isMe ? '(Sen)' : ''}
                  </Text>
                  <TrophyIcon size={18} />
                  <Text style={styles.playerScore}>{item.rankPoints}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      <TavrikoSecondaryBottomNav
        activeTab="leagues"
        onSelectTab={(tab) => onNavigateSecondary && onNavigateSecondary(tab)}
      />
    </TavrikoScreen>
  );
};
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 110,
  },
  heroWrap: {
    alignItems: 'center',
    marginTop: 8,
  },
  trophyGlowWrap: {
    marginBottom: -12,
  },
  proText: {
    fontFamily: THEME.fonts.display,
    fontSize: 52,
    color: '#FFC43D',
    lineHeight: 54,
  },
  leagueText: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
    letterSpacing: 4,
    color: '#FFC43D',
  },
  endsText: {
    marginTop: 6,
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  pillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 16,
  },
  pill: {
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
  rankPill: {
    backgroundColor: '#6B3CFF',
  },
  pillTextWhite: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  pillTextGold: {
    color: '#FFC43D',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
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
    height: 48,
    paddingHorizontal: 12,
    gap: 10,
    borderRadius: 14,
  },
  playerRowActive: {
    backgroundColor: '#6B3CFF',
    borderWidth: 1,
    borderColor: '#FFC43D',
  },
  rankNum: {
    width: 22,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
  playerName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
  playerScore: {
    minWidth: 42,
    textAlign: 'right',
    color: '#FFC43D',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
});