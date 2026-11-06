import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { UserProfile, calculateLevelFromXp } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import {
  TavrikoScreen,
  TavrikoTopBar,
  TavrikoBottomNav,
  TavrikoProgressBar,
  Button3D,
  CharacterAvatar,
  ModeSquircleIcon,
  StreakFlameIcon,
  SpeedBoltIcon,
  CrownIcon,
  ChestIcon,
  TrophyIcon,
  InventoryCubeIcon,
  TavrikoHeroLogo,
} from '../components/TavrikoIcons';
interface HomeScreenProps {
  user: UserProfile;
  isGuest?: boolean;
  onQuickMatch: () => void;
  onCustomRoom: () => void;
  onExploreCategories: () => void;
  onDailyChallenge: () => void;
  onPractice: () => void;
  onLeaderboard: () => void;
  onFriends: () => void;
  onProfile: () => void;
  onNotifications: () => void;
  onSettings: () => void;
  onSeason?: () => void;
  onShop?: () => void;
  onEvents?: () => void;
  onInventory?: () => void;
  onProLeague?: () => void;
  onLoginPrompt?: () => void;
}
export const HomeScreen: React.FC<HomeScreenProps> = ({
  user,
  isGuest = false,
  onQuickMatch,
  onCustomRoom,
  onExploreCategories,
  onDailyChallenge,
  onPractice,
  onLeaderboard,
  onFriends,
  onProfile,
  onNotifications,
  onSeason,
  onShop,
  onEvents,
  onInventory,
  onProLeague,
  onLoginPrompt,
}) => {
  // Entrance & Floating Bolt Animation
  const boltFloat = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(boltFloat, {
          toValue: -8,
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(boltFloat, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [boltFloat, fadeAnim, slideAnim]);
  return (
    <TavrikoScreen>
      {/* Top HUD Bar */}
      <TavrikoTopBar
        leftType="bell"
        onLeftPress={onNotifications}
        coins={user.coins ?? 0}
        gems={user.gems ?? 0}
        avatarSeed={user.avatarUrl || user.displayName}
        onAvatarPress={onProfile}
        onCurrencyPress={onShop}
        isGuest={isGuest}
        onGuestLoginPress={onLoginPrompt}
      />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isGuest && { paddingBottom: 36 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Center Seamless Vector Tavriko Logo (No Square Box!) */}
          <View style={styles.bannerWrap}>
            <TavrikoHeroLogo width={165} height={92} />
          </View>
          {/* Guest Mode Notice Pill */}
          {isGuest && (
            <TouchableOpacity
              style={styles.guestNoticeBanner}
              onPress={() => {
                sound.playSound('tap');
                if (onLoginPrompt) onLoginPrompt();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.guestNoticeText}>
                MİSAFİR MODU · Sadece Keşfet açık · Giriş yapmak için dokun →
              </Text>
            </TouchableOpacity>
          )}
          {/* User Level & XP Card */}
          <TouchableOpacity
            style={styles.userXpCard}
            onPress={() => {
              sound.playSound('tap');
              if (onSeason) onSeason();
              else onProfile();
            }}
            activeOpacity={0.85}
          >
            <CharacterAvatar
              seed={user.avatarUrl || user.displayName}
              size={48}
            />
            {(() => {
              const prog = calculateLevelFromXp(user.xp ?? 0);
              return (
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{user.displayName}</Text>
                  <Text style={styles.userXpSub}>
                    Seviye {prog.level} · {prog.currentLevelXp} / {prog.nextLevelXpRequired} XP · {prog.rankTitle}
                  </Text>
                  <TavrikoProgressBar
                    progress={prog.progressPct}
                    height={10}
                    style={{ marginTop: 6 }}
                  />
                </View>
              );
            })()}
          </TouchableOpacity>
          {/* Hero Quick Match (1v1 Duel) Card - Full bleed 3D duel banner */}
          <View style={styles.heroMatchCard}>
            <Image
              source={require('../../assets/images/duel_arena_banner.jpg')}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
            <View style={styles.heroMatchScrim} pointerEvents="none" />
            <View style={styles.heroMatchContent}>
              <View style={styles.heroMatchBadge}>
                <Text style={styles.heroMatchBadgeText}>⚔️ 1v1 DÜELLO</Text>
              </View>
              <Text
                style={styles.heroMatchTitle}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                HIZLI EŞLEŞME
              </Text>
              <Text style={styles.onlineSub}>
                {user.rankPoints ?? 1000} Lig Puanı · {user.stats?.totalMatches ?? 0} Düello Maçı
              </Text>
              <Button3D
                title="OYNA"
                variant="mint"
                onPress={onQuickMatch}
                style={styles.heroPlayButton}
                textStyle={{ fontSize: 20 }}
              />
            </View>
          </View>
          {/* 4 Mode Tiles Row with Enriched 3D Visuals and Embedded Inside Labels */}
          <View style={styles.modesRow}>
            <TouchableOpacity
              style={styles.modeTile}
              onPress={() => {
                sound.playSound('tap');
                sound.triggerHaptic('light');
                onCustomRoom();
              }}
              activeOpacity={0.85}
            >
              <Image
                source={require('../../assets/images/custom_room_3d.jpg')}
                style={styles.modeTileImg}
                resizeMode="cover"
              />
              <View style={styles.modeTileLabelWrap}>
                <Text style={styles.modeTileText} numberOfLines={1} adjustsFontSizeToFit>
                  Özel Oda
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modeTile}
              onPress={() => {
                sound.playSound('tap');
                sound.triggerHaptic('light');
                onPractice();
              }}
              activeOpacity={0.85}
            >
              <Image
                source={require('../../assets/images/single_player_3d.jpg')}
                style={styles.modeTileImg}
                resizeMode="cover"
              />
              <View style={styles.modeTileLabelWrap}>
                <Text style={styles.modeTileText} numberOfLines={1} adjustsFontSizeToFit>
                  Tek Kişilik
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modeTile}
              onPress={() => {
                sound.playSound('tap');
                sound.triggerHaptic('light');
                onDailyChallenge();
              }}
              activeOpacity={0.85}
            >
              <Image
                source={require('../../assets/images/daily_challenge_3d.jpg')}
                style={styles.modeTileImg}
                resizeMode="cover"
              />
              <View style={styles.modeTileLabelWrap}>
                <Text style={styles.modeTileText} numberOfLines={1} adjustsFontSizeToFit>
                  Günlük
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modeTile}
              onPress={() => {
                sound.playSound('tap');
                sound.triggerHaptic('light');
                onFriends();
              }}
              activeOpacity={0.85}
            >
              <Image
                source={require('../../assets/images/friends_3d.jpg')}
                style={styles.modeTileImg}
                resizeMode="cover"
              />
              <View style={styles.modeTileLabelWrap}>
                <Text style={styles.modeTileText} numberOfLines={1} adjustsFontSizeToFit>
                  Arkadaşlar
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          {/* Daily Streak Card */}
          <View style={styles.streakCard}>
            <StreakFlameIcon size={38} active={Boolean(user.dailyChallenge?.completedToday)} />
            <View style={{ flex: 1 }}>
              <Text style={styles.streakTitle}>
                {user.dailyStreak ?? 1} günlük seri {user.dailyChallenge?.completedToday ? '🔥' : ''}
              </Text>
              <Text style={styles.streakSub}>
                {user.dailyChallenge?.completedToday
                  ? '✓ Bugünkü görev tamamlandı! Seri korundu.'
                  : `En iyi seri: ${user.stats?.bestStreak ?? 0} · Bugünkü meydan okuma 2x XP`}
              </Text>
            </View>
            <Button3D
              title={user.dailyChallenge?.completedToday ? 'GÖR' : 'BAŞLA'}
              variant={user.dailyChallenge?.completedToday ? 'gold' : 'mint'}
              onPress={onDailyChallenge}
              style={{ minHeight: 40, paddingHorizontal: 18 }}
              textStyle={{ fontSize: 14 }}
            />
          </View>
          {/* Extra UI Kit Features Row (Season 1, Pro League, Shop, Events, Inventory) */}
          <View style={styles.extraFeaturesRow}>
            {onSeason && (
              <TouchableOpacity
                style={styles.extraChip}
                onPress={() => {
                  sound.playSound('tap');
                  onSeason();
                }}
              >
                <CrownIcon size={18} />
                <Text style={styles.extraChipText}>Sezon 1</Text>
              </TouchableOpacity>
            )}
            {onProLeague && (
              <TouchableOpacity
                style={styles.extraChip}
                onPress={() => {
                  sound.playSound('tap');
                  onProLeague();
                }}
              >
                <TrophyIcon size={18} />
                <Text style={styles.extraChipText}>Pro Lig</Text>
              </TouchableOpacity>
            )}
            {onShop && (
              <TouchableOpacity
                style={styles.extraChip}
                onPress={() => {
                  sound.playSound('tap');
                  onShop();
                }}
              >
                <ChestIcon size={18} />
                <Text style={styles.extraChipText}>Mağaza</Text>
              </TouchableOpacity>
            )}
            {onEvents && (
              <TouchableOpacity
                style={styles.extraChip}
                onPress={() => {
                  sound.playSound('tap');
                  onEvents();
                }}
              >
                <StreakFlameIcon size={18} />
                <Text style={styles.extraChipText}>Etkinlik</Text>
              </TouchableOpacity>
            )}
            {onInventory && (
              <TouchableOpacity
                style={styles.extraChip}
                onPress={() => {
                  sound.playSound('tap');
                  onInventory();
                }}
              >
                <InventoryCubeIcon size={18} />
                <Text style={styles.extraChipText}>Envanter</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </ScrollView>
      {/* Floating Bottom Navigation */}
      {!isGuest && (
        <TavrikoBottomNav
          activeTab="play"
          onSelectTab={(tab) => {
            if (tab === 'explore') onExploreCategories();
            else if (tab === 'leaders') onLeaderboard();
            else if (tab === 'friends') onFriends();
            else if (tab === 'profile') onProfile();
          }}
        />
      )}
    </TavrikoScreen>
  );
};
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 110,
  },
  bannerWrap: {
    alignItems: 'center',
    marginTop: 6,
  },
  bannerImage: {
    width: 150,
    height: 46,
    borderRadius: 14,
  },
  guestNoticeBanner: {
    marginTop: 10,
    backgroundColor: 'rgba(255, 196, 61, 0.18)',
    borderWidth: 1,
    borderColor: '#FFC43D',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  guestNoticeText: {
    color: '#FFC43D',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
  },
  userXpCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userName: {
    fontFamily: THEME.fonts.display,
    fontSize: 19,
    color: '#FFFFFF',
  },
  userXpSub: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  heroMatchCard: {
    marginTop: 16,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 196, 61, 0.45)',
    position: 'relative',
    overflow: 'hidden',
    height: 170,
    backgroundColor: '#0F0624',
    shadowColor: '#6B3CFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  heroMatchScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 4, 24, 0.65)',
  },
  heroMatchContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
    zIndex: 2,
    maxWidth: '75%',
  },
  heroMatchBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 196, 61, 0.22)',
    borderWidth: 1,
    borderColor: '#FFC43D',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  heroMatchBadgeText: {
    color: '#FFC43D',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.5,
  },
  onlineSub: {
    color: '#E2D9F3',
    fontSize: 11.5,
    fontFamily: THEME.fonts.bold,
    marginTop: 2,
    marginBottom: 6,
  },
  heroMatchTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  heroPlayButton: {
    alignSelf: 'flex-start',
    height: 48,
    paddingHorizontal: 32,
  },
  modesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  modeTile: {
    flex: 1,
    minWidth: 0,
    height: 112,
    borderRadius: 18,
    backgroundColor: '#1E0E3D',
    borderWidth: 1.5,
    borderColor: 'rgba(154, 107, 255, 0.32)',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  modeTileImg: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  modeTileLabelWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 5,
    paddingHorizontal: 2,
    backgroundColor: 'rgba(12, 5, 28, 0.82)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTileText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  streakCard: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  streakTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 16,
    color: '#FFFFFF',
  },
  streakSub: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  extraFeaturesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    justifyContent: 'center',
  },
  extraChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(10, 4, 24, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  extraChipText: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
});