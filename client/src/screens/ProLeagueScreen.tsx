import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
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
  CrownIcon,
} from '../components/TavrikoIcons';
import Reanimated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { KitHero, STORE_IMG, KIT } from '../components/StoreKit';
import { UserProfileModal } from '../components/UserProfileModal';
import { sound } from '../services/soundService';

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
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

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

  const top1 = players[0];
  const top2 = players[1];
  const top3 = players[2];
  const restPlayers = players.slice(3);

  const handleOpenProfile = (playerId: string) => {
    sound.playSound('tap');
    setSelectedPlayerId(playerId);
  };

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
        <KitHero
          art={STORE_IMG.trophy}
          artSize={128}
          eyebrow="SEZON SIRALAMASI"
          title="Pro Lig"
          subtitle={`${user?.rankTitle || 'Acemi Kaşif'} · Canlı lig tablosu`}
          height={160}
          delay={0}
        >
          <View style={styles.pillsRow}>
            <View style={[styles.pill, styles.rankPill]}>
              <Text style={styles.pillTextWhite}>{myRank}. sıra</Text>
            </View>
            <View style={styles.pill}>
              <TrophyIcon size={16} />
              <Text style={styles.pillTextGold}>{user?.rankPoints ?? 1000} LP</Text>
            </View>
          </View>
        </KitHero>

        {loading ? (
          <ActivityIndicator color="#FFC43D" size="large" style={{ marginTop: 32 }} />
        ) : (
          <>
            {/* Top 3 Podium */}
            {players.length >= 3 && (
              <Reanimated.View entering={FadeInUp.delay(120).duration(480)} style={styles.podiumContainer}>
                {/* 2nd Place (Silver) */}
                {top2 && (
                  <TouchableOpacity
                    style={[styles.podiumCol, styles.podiumCol2]}
                    activeOpacity={0.8}
                    onPress={() => handleOpenProfile(top2.userId)}
                  >
                    <View style={styles.podiumAvatarWrap}>
                      <View style={[styles.podiumRing, styles.silverRing]}>
                        <CharacterAvatar seed={top2.avatarUrl || top2.displayName} size={50} />
                      </View>
                      <View style={[styles.podiumBadge, styles.silverBadge]}>
                        <Text style={styles.podiumBadgeText}>2</Text>
                      </View>
                    </View>
                    <Text style={styles.podiumName} numberOfLines={1}>{top2.displayName}</Text>
                    <Text style={styles.podiumScore}>{top2.rankPoints} LP</Text>
                    <View style={[styles.pedestal, styles.pedestal2]}>
                      <Text style={styles.pedestalText}>2</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* 1st Place (Gold) */}
                {top1 && (
                  <TouchableOpacity
                    style={[styles.podiumCol, styles.podiumCol1]}
                    activeOpacity={0.8}
                    onPress={() => handleOpenProfile(top1.userId)}
                  >
                    <View style={styles.crownWrap}>
                      <CrownIcon size={26} />
                    </View>
                    <View style={styles.podiumAvatarWrap}>
                      <View style={[styles.podiumRing, styles.goldRing]}>
                        <CharacterAvatar seed={top1.avatarUrl || top1.displayName} size={64} />
                      </View>
                      <View style={[styles.podiumBadge, styles.goldBadge]}>
                        <Text style={styles.podiumBadgeText}>1</Text>
                      </View>
                    </View>
                    <Text style={[styles.podiumName, styles.goldName]} numberOfLines={1}>{top1.displayName}</Text>
                    <Text style={[styles.podiumScore, styles.goldScore]}>{top1.rankPoints} LP</Text>
                    <View style={[styles.pedestal, styles.pedestal1]}>
                      <Text style={[styles.pedestalText, { color: '#FFEAA7' }]}>1</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* 3rd Place (Bronze) */}
                {top3 && (
                  <TouchableOpacity
                    style={[styles.podiumCol, styles.podiumCol3]}
                    activeOpacity={0.8}
                    onPress={() => handleOpenProfile(top3.userId)}
                  >
                    <View style={styles.podiumAvatarWrap}>
                      <View style={[styles.podiumRing, styles.bronzeRing]}>
                        <CharacterAvatar seed={top3.avatarUrl || top3.displayName} size={46} />
                      </View>
                      <View style={[styles.podiumBadge, styles.bronzeBadge]}>
                        <Text style={styles.podiumBadgeText}>3</Text>
                      </View>
                    </View>
                    <Text style={styles.podiumName} numberOfLines={1}>{top3.displayName}</Text>
                    <Text style={styles.podiumScore}>{top3.rankPoints} LP</Text>
                    <View style={[styles.pedestal, styles.pedestal3]}>
                      <Text style={styles.pedestalText}>3</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </Reanimated.View>
            )}

            {/* Zone Legend */}
            <Reanimated.View entering={FadeInDown.delay(220).duration(380)} style={styles.zoneLegend}>
              <View style={styles.zoneItem}>
                <View style={[styles.zoneDot, { backgroundColor: '#6FE3C1' }]} />
                <Text style={styles.zoneLabel}>İlk 5: Yükselme</Text>
              </View>
              <View style={styles.zoneItem}>
                <View style={[styles.zoneDot, { backgroundColor: '#FFC43D' }]} />
                <Text style={styles.zoneLabel}>Güvenli Bölge</Text>
              </View>
              <View style={styles.zoneItem}>
                <View style={[styles.zoneDot, { backgroundColor: '#FF5C77' }]} />
                <Text style={styles.zoneLabel}>Son 5: Düşme</Text>
              </View>
            </Reanimated.View>

            {/* Leaderboard Table */}
            <View style={styles.listCard}>
              {restPlayers.map((item, index) => {
                const isMe = user ? item.userId === user.id : false;
                const actualRank = item.rank || index + 4;
                const isPromotion = actualRank <= 5;
                const isRelegation = actualRank >= Math.max(6, players.length - 4);

                return (
                  <Reanimated.View
                    key={item.userId}
                    entering={FadeInDown.delay(260 + Math.min(index, 10) * 45).duration(340)}
                  >
                  <TouchableOpacity
                    style={[
                      styles.playerRow,
                      isMe && styles.playerRowActive,
                      isPromotion && styles.promotionRow,
                      isRelegation && styles.relegationRow,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleOpenProfile(item.userId)}
                  >
                    <Text style={[styles.rankNum, isPromotion && styles.promoRank]}>
                      {actualRank}
                    </Text>
                    <CharacterAvatar
                      seed={item.avatarUrl || item.displayName}
                      size={36}
                    />
                    <View style={styles.playerInfo}>
                      <Text style={styles.playerName} numberOfLines={1}>
                        {item.displayName} {isMe ? '(Sen)' : ''}
                      </Text>
                      <Text style={styles.playerTitle}>{item.rankTitle || 'Lig Oyuncusu'}</Text>
                    </View>
                    <TrophyIcon size={16} />
                    <Text style={styles.playerScore}>{item.rankPoints}</Text>
                  </TouchableOpacity>
                  </Reanimated.View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* User Profile Modal on Avatar Click */}
      <UserProfileModal
        visible={!!selectedPlayerId}
        userId={selectedPlayerId}
        currentUserId={user?.id}
        onClose={() => setSelectedPlayerId(null)}
        apiBaseUrl={apiBaseUrl}
      />

      <TavrikoSecondaryBottomNav
        activeTab="leagues"
        onSelectTab={(tab) => onNavigateSecondary && onNavigateSecondary(tab)}
      />
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 140,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  heroWrap: {
    alignItems: 'center',
    marginTop: 8,
  },
  trophyGlowWrap: {
    marginBottom: -8,
  },
  proText: {
    fontFamily: THEME.fonts.display,
    fontSize: 44,
    color: '#FFC43D',
    lineHeight: 46,
  },
  leagueText: {
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    letterSpacing: 3,
    color: '#FFC43D',
  },
  endsText: {
    marginTop: 4,
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  crownWrap: {
    marginBottom: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
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
  podiumContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 16,
    paddingHorizontal: 4,
  },
  podiumCol: {
    flex: 1,
    alignItems: 'center',
  },
  podiumCol1: {
    zIndex: 3,
    marginBottom: 0,
  },
  podiumCol2: {
    zIndex: 2,
    marginBottom: 0,
  },
  podiumCol3: {
    zIndex: 1,
    marginBottom: 0,
  },
  crownText: {
    fontSize: 22,
    marginBottom: -4,
  },
  podiumAvatarWrap: {
    position: 'relative',
    alignItems: 'center',
  },
  podiumRing: {
    padding: 3,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  goldRing: {
    borderWidth: 3,
    borderColor: '#FFC43D',
    backgroundColor: 'rgba(255, 196, 61, 0.2)',
  },
  silverRing: {
    borderWidth: 2.5,
    borderColor: '#C0C0C0',
    backgroundColor: 'rgba(192, 192, 192, 0.15)',
  },
  bronzeRing: {
    borderWidth: 2,
    borderColor: '#CD7F32',
    backgroundColor: 'rgba(205, 127, 50, 0.15)',
  },
  podiumBadge: {
    position: 'absolute',
    bottom: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  goldBadge: {
    backgroundColor: '#FFC43D',
  },
  silverBadge: {
    backgroundColor: '#A0A0A0',
  },
  bronzeBadge: {
    backgroundColor: '#B87333',
  },
  podiumBadgeText: {
    color: '#12052C',
    fontSize: 11,
    fontFamily: THEME.fonts.display,
  },
  podiumName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    marginTop: 10,
    textAlign: 'center',
  },
  goldName: {
    fontSize: 14,
    color: '#FFEAA7',
    fontFamily: THEME.fonts.extraBold,
  },
  podiumScore: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 2,
  },
  goldScore: {
    color: '#FFC43D',
    fontSize: 13,
  },
  pedestal: {
    width: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderWidth: 1,
  },
  pedestal1: {
    height: 64,
    backgroundColor: 'rgba(255, 196, 61, 0.22)',
    borderColor: 'rgba(255, 196, 61, 0.5)',
  },
  pedestal2: {
    height: 50,
    backgroundColor: 'rgba(192, 192, 192, 0.18)',
    borderColor: 'rgba(192, 192, 192, 0.4)',
  },
  pedestal3: {
    height: 40,
    backgroundColor: 'rgba(205, 127, 50, 0.18)',
    borderColor: 'rgba(205, 127, 50, 0.4)',
  },
  pedestalText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 22,
    fontFamily: THEME.fonts.black,
  },
  zoneLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(10, 4, 24, 0.6)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  zoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  zoneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  zoneLabel: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
  },
  listCard: {
    backgroundColor: KIT.card,
    borderWidth: 1,
    borderColor: KIT.border,
    borderRadius: 18,
    padding: 6,
    gap: 4,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    paddingHorizontal: 12,
    gap: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  playerRowActive: {
    backgroundColor: 'rgba(107, 60, 255, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 55, 0.6)',
  },
  promotionRow: {
    borderLeftWidth: 3.5,
    borderLeftColor: '#6FE3C1',
  },
  relegationRow: {
    borderLeftWidth: 3.5,
    borderLeftColor: '#FF5C77',
  },
  rankNum: {
    width: 24,
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
  },
  promoRank: {
    color: '#6FE3C1',
  },
  playerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  playerTitle: {
    color: '#D9CDF5',
    fontSize: 10,
    fontFamily: THEME.fonts.medium,
  },
  playerScore: {
    minWidth: 42,
    textAlign: 'right',
    color: '#FFC43D',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
});
