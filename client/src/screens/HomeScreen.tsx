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
          {/* Hero Quick Match (1v1 Duel) Card */}
          <View style={styles.heroMatchCard}>
            <Text style={styles.onlineSub}>
              {user.rankPoints ?? 1000} Lig Puanı · {user.stats?.totalMatches ?? 0} Düello Maçı
            </Text>
            <Text style={styles.heroMatchTitle}>HIZLI EŞLEŞME</Text>
            <Button3D
              title="OYNA"
              variant="mint"
              onPress={onQuickMatch}
              style={styles.heroPlayButton}
              textStyle={{ fontSize: 22 }}
            />
            <Animated.View
              style={[
                styles.heroBoltWrap,
                { transform: [{ translateY: boltFloat }] },
              ]}
              pointerEvents="none"
            >
              <SpeedBoltIcon size={110} />
            </Animated.View>
          </View>
          {/* 4 Mode Tiles Row */}
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
              <ModeSquircleIcon mode="custom_room" size={44} />
              <Text style={styles.modeTileText}>Özel Oda</Text>
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
              <ModeSquircleIcon mode="single_player" size={44} />
              <Text style={styles.modeTileText}>Tek Kişilik</Text>
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
              <ModeSquircleIcon mode="daily" size={44} />
              <Text style={styles.modeTileText}>Günlük</Text>
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
              <ModeSquircleIcon mode="friends" size={44} />
              <Text style={styles.modeTileText}>Arkadaşlar</Text>
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
    padding: 20,
    borderRadius: 26,
    backgroundColor: '#7A3FE0',
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.35)',
    position: 'relative',
    overflow: 'hidden',
  },
  onlineSub: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  heroMatchTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 32,
    color: '#FFFFFF',
    marginTop: 4,
    marginBottom: 14,
  },
  heroPlayButton: {
    alignSelf: 'flex-start',
    height: 54,
    paddingHorizontal: 44,
  },
  heroBoltWrap: {
    position: 'absolute',
    right: 6,
    top: 10,
  },
  modesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  modeTile: {
    flex: 1,
    height: 96,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modeTileText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
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