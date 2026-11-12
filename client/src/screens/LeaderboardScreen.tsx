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
  CrownIcon,
} from '../components/TavrikoIcons';
import { formatNumberTR } from '../components/TavrikoGradient';
import { InfoHint } from '../components/InfoHint';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
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
  const myIndex = user
    ? sortedLeaders.findIndex((e) => e.userId === user.id || e.id === user.id)
    : -1;
  const valueOf = (e: LeaderboardEntry) => (activeTab === 'weekly' ? e.rankPoints : e.xp);
  const unitLabel = activeTab === 'weekly' ? 'LP' : 'XP';
  const podium = sortedLeaders.slice(0, 3);
  const rest = sortedLeaders.slice(3);
  // Görsel sıra: 2 - 1 - 3
  const podiumOrder = [podium[1], podium[0], podium[2]];

  const [segWidth, setSegWidth] = useState(0);
  const segX = useSharedValue(0);
  useEffect(() => {
    segX.value = withSpring(activeTab === 'weekly' ? 0 : segWidth / 2, { damping: 18, stiffness: 180 });
  }, [activeTab, segWidth]);
  const segStyle = useAnimatedStyle(() => ({ transform: [{ translateX: segX.value }] }));

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
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Liderler</Text>
            <Text style={styles.subtitle}>
              Canlı sıralama · {sortedLeaders.length} oyuncu
            </Text>
          </View>
          {myIndex >= 0 && (
            <View style={styles.myRankChip}>
              <Text style={styles.myRankLabel}>Sıran</Text>
              <Text style={styles.myRankValue}>#{myIndex + 1}</Text>
            </View>
          )}
        </View>

        <View
          style={styles.segment}
          onLayout={(e) => setSegWidth(e.nativeEvent.layout.width - 8)}
        >
          {segWidth > 0 && (
            <Animated.View style={[styles.segmentThumb, { width: segWidth / 2 }, segStyle]} />
          )}
          {(
            [
              ['weekly', 'Lig Puanı'],
              ['all_time', 'Toplam XP'],
            ] as const
          ).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={styles.segmentBtn}
              onPress={() => setActiveTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === key }}
            >
              <View style={styles.segmentLabelRow}>
                <Text style={[styles.segmentText, activeTab === key && styles.segmentTextActive]}>{label}</Text>
                <InfoHint
                  topic={key === 'weekly' ? 'lp' : 'xp'}
                  size={18}
                  color={activeTab === key ? '#FFFFFF' : '#FFC43D'}
                  label={key === 'weekly' ? 'Lig Puanı (LP) nedir, nasıl kazanılır?' : 'XP nedir, nasıl kazanılır?'}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color="#FFC43D" size="large" style={{ marginTop: 32 }} />
        ) : sortedLeaders.length === 0 ? (
          <Text style={styles.emptyText}>Henüz sıralamada oyuncu yok.</Text>
        ) : (
          <>
            <View style={styles.podiumRow} key={`podium-${activeTab}`}>
              {podiumOrder.map((item, slot) => {
                if (!item) return <View key={`empty-${slot}`} style={styles.podiumCol} />;
                const place = slot === 1 ? 1 : slot === 0 ? 2 : 3;
                const tone = PODIUM_TONES[place - 1];
                const isMe = user ? item.userId === user.id || item.id === user.id : false;
                const avatar = place === 1 ? 72 : 58;
                return (
                  <Animated.View
                    key={`${item.userId}-${place}`}
                    entering={FadeInUp.delay(place === 1 ? 80 : place === 2 ? 180 : 260).springify().damping(14)}
                    style={styles.podiumCol}
                  >
                    {place === 1 && <CrownIcon size={26} />}
                    <View style={[styles.podiumAvatarRing, { borderColor: tone.ring, width: avatar + 8, height: avatar + 8, borderRadius: (avatar + 8) / 2 }]}>
                      <CharacterAvatar seed={item.avatarUrl || item.displayName} size={avatar} />
                    </View>
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {isMe ? 'Sen' : item.displayName}
                    </Text>
                    <Text style={[styles.podiumValue, { color: tone.text }]}>
                      {formatNumberTR(valueOf(item))} <Text style={styles.podiumUnit}>{unitLabel}</Text>
                    </Text>
                    <View style={[styles.podiumBase, { height: tone.height, backgroundColor: tone.base, borderColor: tone.ring }]}>
                      <Text style={[styles.podiumPlace, { color: tone.ring }]}>{place}</Text>
                    </View>
                  </Animated.View>
                );
              })}
            </View>

            {rest.length > 0 && (
              <View style={styles.listCard}>
                {rest.map((item, idx) => {
                  const isMe = user ? item.userId === user.id || item.id === user.id : false;
                  const displayRank = idx + 4;
                  return (
                    <Animated.View
                      key={item.userId ? `${item.userId}_${activeTab}` : `leader_${idx}_${activeTab}`}
                      entering={FadeInDown.delay(Math.min(idx, 10) * 45 + 200).duration(320)}
                      style={[styles.playerRow, isMe && styles.playerRowMe, idx > 0 && styles.playerRowDivider]}
                    >
                      <Text style={styles.rankText}>{displayRank}</Text>
                      <CharacterAvatar seed={item.avatarUrl || item.displayName} size={38} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.nameText} numberOfLines={1}>
                          {item.displayName}
                          {isMe ? <Text style={styles.meTag}>  Sen</Text> : null}
                        </Text>
                        <Text style={styles.subRankText} numberOfLines={1}>
                          Seviye {item.level} · {item.rankTitle}
                        </Text>
                      </View>
                      <View style={styles.scoreBox}>
                        <Text style={styles.scoreText}>{formatNumberTR(valueOf(item))}</Text>
                        <Text style={styles.scoreUnit}>{unitLabel}</Text>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            )}
          </>
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

const PODIUM_TONES = [
  { ring: '#FFC43D', text: '#FFD66B', base: 'rgba(255, 196, 61, 0.16)', height: 92 },
  { ring: '#C9D3E6', text: '#E3E9F5', base: 'rgba(201, 211, 230, 0.12)', height: 68 },
  { ring: '#E39A5C', text: '#F2B988', base: 'rgba(227, 154, 92, 0.13)', height: 52 },
];

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 120,
    paddingHorizontal: 2,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
    marginBottom: 14,
  },
  title: {
    fontFamily: THEME.fonts.black,
    fontSize: 30,
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: 'rgba(217, 205, 245, 0.75)',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    marginTop: 2,
  },
  myRankChip: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  myRankLabel: {
    color: 'rgba(217, 205, 245, 0.7)',
    fontSize: 10,
    fontFamily: THEME.fonts.bold,
  },
  myRankValue: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: THEME.fonts.black,
  },
  segmentLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(10, 4, 30, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 18,
  },
  segmentThumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 10,
    backgroundColor: '#6B3CFF',
  },
  segmentBtn: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    color: 'rgba(217, 205, 245, 0.75)',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  emptyText: {
    color: '#D9CDF5',
    textAlign: 'center',
    marginTop: 32,
    fontFamily: THEME.fonts.bold,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  podiumCol: {
    flex: 1,
    alignItems: 'center',
  },
  podiumAvatarRing: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B0C38',
    marginBottom: 6,
  },
  podiumName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    maxWidth: '100%',
  },
  podiumValue: {
    fontSize: 13,
    fontFamily: THEME.fonts.black,
    marginTop: 1,
    marginBottom: 8,
  },
  podiumUnit: {
    fontSize: 10,
    fontFamily: THEME.fonts.bold,
    color: 'rgba(217, 205, 245, 0.7)',
  },
  podiumBase: {
    alignSelf: 'stretch',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 1,
    borderBottomWidth: 0,
    alignItems: 'center',
    paddingTop: 8,
  },
  podiumPlace: {
    fontSize: 24,
    fontFamily: THEME.fonts.black,
  },
  listCard: {
    backgroundColor: 'rgba(20, 8, 52, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingHorizontal: 14,
    gap: 12,
  },
  playerRowDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  playerRowMe: {
    backgroundColor: 'rgba(107, 60, 255, 0.28)',
  },
  rankText: {
    width: 22,
    color: 'rgba(217, 205, 245, 0.8)',
    fontSize: 14,
    fontFamily: THEME.fonts.black,
    textAlign: 'center',
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.extraBold,
  },
  meTag: {
    color: '#FFC43D',
    fontSize: 12,
    fontFamily: THEME.fonts.black,
  },
  subRankText: {
    color: 'rgba(217, 205, 245, 0.7)',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    marginTop: 1,
  },
  scoreBox: {
    alignItems: 'flex-end',
    minWidth: 52,
  },
  scoreText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.black,
  },
  scoreUnit: {
    color: 'rgba(217, 205, 245, 0.6)',
    fontSize: 10,
    fontFamily: THEME.fonts.bold,
  },
});
