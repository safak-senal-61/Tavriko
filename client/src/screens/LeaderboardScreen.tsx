import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { UserProfile } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { DEFAULT_API_BASE } from '../config';
import {
  TavrikoScreen,
  TavrikoTopBar,
  TavrikoBottomNav,
  CharacterAvatar,
  TrophyIcon,
} from '../components/TavrikoIcons';
interface LeaderboardScreenProps {
  user?: UserProfile;
  apiBaseUrl?: string;
  onBack: () => void;
  onNavigateTab?: (tab: 'play' | 'explore' | 'leaders' | 'friends' | 'profile') => void;
  onNotifications?: () => void;
}
interface LeaderboardEntry {
  rank: number;
  id?: string;
  userId: string;
  username?: string;
  displayName: string;
  avatarUrl?: string;
  rankPoints: number;
  level: number;
  xp: number;
  rankTitle: string;
  winRate?: number;
}

const normalizeLeaderName = (name?: string) =>
  (name || '')
    .toLowerCase()
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]/g, '')
    .trim();

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  user,
  apiBaseUrl,
  onBack,
  onNavigateTab,
  onNotifications,
}) => {
  const [activeTab, setActiveTab] = useState<'weekly' | 'all_time'>('weekly');
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const base = apiBaseUrl || DEFAULT_API_BASE;
    let isMounted = true;
    setLoading(true);
    fetch(`${base}/social/leaderboard`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        const list = Array.isArray(data) ? data : data?.topPlayers || data?.leaders;
        if (Array.isArray(list)) {
          const normalized: LeaderboardEntry[] = list.map((item: any, idx: number) => ({
            rank: idx + 1,
            id: item.id || item.userId,
            userId: item.userId || item.id || `u_${idx}`,
            username: item.username,
            displayName: item.displayName || item.username || 'Oyuncu',
            avatarUrl: item.avatarUrl,
            rankPoints: Number(item.rankPoints) || 1000,
            level: Number(item.level) || 1,
            xp: Number(item.xp) || 0,
            rankTitle: item.rankTitle || 'Acemi Kaşif',
          }));
          setLeaders(normalized);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl, user?.rankPoints, user?.xp]);

  const sortedLeaders = React.useMemo(() => {
    const sorted = [...leaders].sort((a, b) =>
      activeTab === 'weekly' ? b.rankPoints - a.rankPoints || b.xp - a.xp : b.xp - a.xp || b.rankPoints - a.rankPoints
    );
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const unique: LeaderboardEntry[] = [];
    for (const entry of sorted) {
      const uid = (entry.userId || entry.id || '').trim();
      const nameKey = normalizeLeaderName(entry.displayName || entry.username);
      if (uid && seenIds.has(uid)) continue;
      if (nameKey && seenNames.has(nameKey)) continue;
      if (uid) seenIds.add(uid);
      if (nameKey) seenNames.add(nameKey);
      unique.push(entry);
    }
    return unique;
  }, [leaders, activeTab]);
  return (
    <TavrikoScreen>
      <TavrikoTopBar
        leftType="bell"
        onLeftPress={onNotifications || onBack}
        coins={user?.coins ?? 0}
        gems={user?.gems ?? 0}
        avatarSeed={user?.avatarUrl || user?.displayName}
        onAvatarPress={() => onNavigateTab && onNavigateTab('profile')}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>LİDERLER</Text>
        <Text style={styles.subtitle}>
          Canlı Veritabanı Sıralaması · {sortedLeaders.length} Kayıtlı Oyuncu
        </Text>
        {/* Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'weekly' && styles.tabPillActive,
            ]}
            onPress={() => setActiveTab('weekly')}
          >
            <Text style={styles.tabText}>Lig Puanı</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'all_time' && styles.tabPillActive,
            ]}
            onPress={() => setActiveTab('all_time')}
          >
            <Text style={styles.tabText}>Toplam XP</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator color="#FFC43D" size="large" style={{ marginTop: 32 }} />
        ) : (
          <View style={styles.listCard}>
            {sortedLeaders.map((item, idx) => {
              const isMe = user ? item.userId === user.id || item.id === user.id : false;
              const displayRank = idx + 1;
              return (
                <View
                  key={item.userId ? `${item.userId}_${idx}` : `leader_${idx}`}
                  style={[styles.playerRow, isMe && styles.playerRowMe]}
                >
                  <Text style={styles.rankText}>{displayRank}</Text>
                  <CharacterAvatar
                    seed={item.avatarUrl || item.displayName}
                    size={36}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.nameText} numberOfLines={1}>
                      {item.displayName} {isMe ? '(Sen)' : ''}
                    </Text>
                    <Text style={styles.subRankText} numberOfLines={1}>
                      Seviye {item.level} · {item.rankTitle}
                    </Text>
                  </View>
                  <TrophyIcon size={18} />
                  <Text style={styles.scoreText}>
                    {activeTab === 'weekly' ? item.rankPoints : item.xp}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      <TavrikoBottomNav
        activeTab="leaders"
        onSelectTab={(tab) => {
          if (tab === 'play') onBack();
          else if (onNavigateTab) onNavigateTab(tab);
        }}
      />
    </TavrikoScreen>
  );
};
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 110,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 36,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginBottom: 14,
  },
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  tabPill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabPillActive: {
    backgroundColor: '#6B3CFF',
  },
  tabText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  listCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 20,
    padding: 8,
    gap: 6,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 10,
    borderRadius: 14,
  },
  playerRowMe: {
    backgroundColor: '#6B3CFF',
    borderWidth: 1,
    borderColor: '#FFC43D',
  },
  rankText: {
    width: 22,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
  subRankText: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
  },
  scoreText: {
    minWidth: 46,
    textAlign: 'right',
    color: '#FFC43D',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
});