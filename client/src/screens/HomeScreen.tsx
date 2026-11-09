import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ImageSourcePropType,
  Animated,
  Easing,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { UserProfile, calculateLevelFromXp } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import {
  TavrikoScreen,
  TavrikoTopBar,
  TavrikoBottomNav,
  CharacterAvatar,
  CoinIcon,
  GemIcon,
  CrownIcon,
  StreakFlameIcon,
} from '../components/TavrikoIcons';
import { GradientFill, formatNumberTR } from '../components/TavrikoGradient';
import { UI_IMG } from '../components/StoreKit';
import { NotificationBell } from '../components/NotificationUI';
import { useUnreadCount } from '../store/notificationStore';

const LOGO_MARK = require('../../assets/images/logo_mark.png');
const DUEL_BANNER = require('../../assets/images/duel_arena_banner.jpg');
const MODE_IMAGES = {
  customRoom: require('../../assets/images/modes/custom_room.png'),
  singlePlayer: require('../../assets/images/modes/single_player.png'),
  daily: require('../../assets/images/modes/daily.png'),
  friends: require('../../assets/images/modes/friends.png'),
};

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

const useNative = Platform.OS !== 'web';

/** 2x2 ızgaradaki tek bir mod kartı (sol: 3D görsel, sağ: başlık + ok) */
const ModeTile: React.FC<{
  label: string;
  image: ImageSourcePropType;
  colors: string[];
  borderColor: string;
  glowColor: string;
  onPress: () => void;
}> = ({ label, image, colors, borderColor, glowColor, onPress }) => (
  <TouchableOpacity
    style={[styles.modeTile, { borderColor, shadowColor: glowColor }]}
    onPress={() => {
      sound.playSound('tap');
      sound.triggerHaptic('light');
      onPress();
    }}
    activeOpacity={0.85}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <GradientFill colors={colors} direction="diagonal" />
    <View style={styles.modeTileShine} pointerEvents="none" />
    <Image source={image} style={styles.modeTileImg} resizeMode="contain" />
    <View style={styles.modeTileLabelRow}>
      <Text style={styles.modeTileText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {label}
      </Text>
      <Text style={styles.modeTileChevron}>›</Text>
    </View>
  </TouchableOpacity>
);

/** Alt menü üstündeki premium özellik döşemesi: 3D ikon görseli + eşit ölçü */
const FeatureTile: React.FC<{
  label: string;
  icon: ImageSourcePropType;
  colors: string[];
  borderColor: string;
  glowColor: string;
  onPress: () => void;
}> = ({ label, icon, colors, borderColor, glowColor, onPress }) => (
  <TouchableOpacity
    style={[styles.featureTile, { borderColor, shadowColor: glowColor }]}
    onPress={() => {
      sound.playSound('tap');
      sound.triggerHaptic('light');
      onPress();
    }}
    activeOpacity={0.85}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <GradientFill colors={colors} direction="diagonal" />
    <View style={styles.featureTileShine} pointerEvents="none" />
    <Image source={icon} style={styles.featureTileIcon} resizeMode="contain" />
    <Text style={styles.featureTileText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
      {label}
    </Text>
  </TouchableOpacity>
);

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
  // Giriş animasyonu + OYNA butonu nabız efekti
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: useNative,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        useNativeDriver: useNative,
      }),
    ]).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.035,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: useNative,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: useNative,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [fadeAnim, slideAnim, pulseAnim]);

  const { width: windowWidth } = useWindowDimensions();
  const narrow = windowWidth < 390;
  const prog = calculateLevelFromXp(user.xp ?? 0);
  const completedToday = Boolean(user.dailyChallenge?.completedToday);
  const streakDays = Math.max(1, user.dailyStreak ?? 1);
  const unread = useUnreadCount();

  return (
    <TavrikoScreen>
      {/* Üst Bar: Logo + Altın + Elmas + Bildirim */}
      {isGuest ? (
        <TavrikoTopBar
          leftType="bell"
          onLeftPress={onNotifications}
          isGuest
          onGuestLoginPress={onLoginPrompt}
          onAvatarPress={onProfile}
        />
      ) : (
        <View style={styles.headerRow}>
          <View style={styles.brandGroup}>
            <Image source={LOGO_MARK} style={[styles.brandMark, narrow && styles.brandMarkNarrow]} resizeMode="contain" />
            <Text style={[styles.brandText, narrow && styles.brandTextNarrow]} numberOfLines={1}>
              Tavriko
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.currencyPill, narrow && styles.currencyPillNarrow]}
              onPress={() => {
                if (onShop) {
                  sound.playSound('reward');
                  sound.triggerHaptic('light');
                  onShop();
                }
              }}
              activeOpacity={onShop ? 0.8 : 1}
              accessibilityLabel={`Altın: ${user.coins ?? 0}`}
            >
              <CoinIcon size={22} />
              <Text style={[styles.currencyText, narrow && styles.currencyTextNarrow]}>{formatNumberTR(user.coins)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.currencyPill, narrow && styles.currencyPillNarrow]}
              onPress={() => {
                if (onShop) {
                  sound.playSound('reward');
                  sound.triggerHaptic('light');
                  onShop();
                }
              }}
              activeOpacity={onShop ? 0.8 : 1}
              accessibilityLabel={`Elmas: ${user.gems ?? 0}`}
            >
              <GemIcon size={20} />
              <Text style={[styles.currencyText, narrow && styles.currencyTextNarrow]}>{formatNumberTR(user.gems)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bellButton}
              onPress={() => {
                sound.playSound('tap');
                sound.triggerHaptic('light');
                onNotifications();
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Bildirimler, ${unread} okunmamış`}
            >
              <NotificationBell />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isGuest && { paddingBottom: 36 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Misafir modu bilgilendirmesi */}
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

          <Reanimated.View entering={FadeInDown.delay(60).duration(380)}>
          {/* Profil Kartı: Avatar + İsim + Seviye + XP */}
          <TouchableOpacity
            style={styles.profileCard}
            onPress={() => {
              sound.playSound('tap');
              if (onSeason) onSeason();
              else onProfile();
            }}
            activeOpacity={0.85}
          >
            <GradientFill
              colors={['rgba(107, 60, 255, 0.38)', 'rgba(36, 16, 80, 0.55)', 'rgba(56, 189, 248, 0.16)']}
              direction="diagonal"
            />
            <View style={styles.profileAvatarWrap}>
              <View style={styles.profileAvatarRing}>
                <CharacterAvatar seed={user.avatarUrl || user.displayName} size={62} />
              </View>
              <View style={styles.profileCrown} pointerEvents="none">
                <CrownIcon size={26} />
              </View>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {user.displayName}
              </Text>
              <View style={styles.levelRow}>
                <Text style={styles.levelText}>Seviye {prog.level}</Text>
                <Text style={styles.levelDot}>·</Text>
                <CrownIcon size={15} />
                <Text style={styles.levelText} numberOfLines={1}>
                  {prog.rankTitle}
                </Text>
              </View>
              <View style={styles.xpRow}>
                <View style={styles.xpTrack}>
                  <View style={[styles.xpFill, { width: `${Math.max(4, prog.progressPct)}%` }]}>
                    <GradientFill colors={['#9A6BFF', '#38BDF8', '#5ADBB5']} direction="horizontal" />
                  </View>
                </View>
                <Text style={styles.xpText} numberOfLines={1}>
                  {formatNumberTR(prog.currentLevelXp)} / {formatNumberTR(prog.nextLevelXpRequired)} XP
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          </Reanimated.View>

          <Reanimated.View entering={FadeInDown.delay(130).duration(380)}>
          {/* Hızlı Eşleşme (1v1 Düello) Hero Kartı */}
          <View style={styles.heroCard}>
            <Image source={DUEL_BANNER} style={styles.heroImage} resizeMode="cover" />
            <GradientFill
              colors={['rgba(15, 6, 36, 0)', 'rgba(15, 6, 36, 0)', 'rgba(15, 6, 36, 0.7)', 'rgba(15, 6, 36, 0.96)']}
              stops={[0, 0.45, 0.72, 0.85]}
            />
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>⚔️ 1v1 DÜELLO</Text>
            </View>
            <View style={styles.heroBottom}>
              <Text
                style={[styles.heroTitle, narrow && styles.heroTitleNarrow]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                HIZLI EŞLEŞME
              </Text>
              <View style={styles.heroSubRow}>
                <CrownIcon size={16} />
                <Text style={styles.heroSub} numberOfLines={1}>
                  {formatNumberTR(user.rankPoints ?? 1000)} Lig Puanı · {formatNumberTR(user.stats?.totalMatches ?? 0)} Düello Maçı
                </Text>
              </View>
              <Animated.View style={{ transform: [{ scale: pulseAnim }], alignSelf: 'stretch' }}>
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={() => {
                    sound.playSound('tap');
                    sound.triggerHaptic('medium');
                    onQuickMatch();
                  }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Hızlı eşleşme oyna"
                >
                  <GradientFill colors={['#8FF0CF', '#5ADBB5', '#2FBF95']} stops={[0, 0.5, 1]} />
                  <View style={styles.playButtonShine} pointerEvents="none" />
                  <Text style={styles.playButtonText}>OYNA</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>

          </Reanimated.View>

          <Reanimated.View entering={FadeInDown.delay(200).duration(380)}>
          {/* 2x2 Mod Kartları */}
          <View style={styles.modesGrid}>
            <View style={styles.modesRow}>
              <ModeTile
                label="Özel Oda"
                image={MODE_IMAGES.customRoom}
                colors={['#5B2CC4', '#3A1690', '#24105A']}
                borderColor="rgba(186, 150, 255, 0.55)"
                glowColor="#6B3CFF"
                onPress={onCustomRoom}
              />
              <ModeTile
                label="Tek Kişilik"
                image={MODE_IMAGES.singlePlayer}
                colors={['#1F5FE0', '#16388F', '#0F1E5A']}
                borderColor="rgba(96, 196, 255, 0.6)"
                glowColor="#38BDF8"
                onPress={onPractice}
              />
            </View>
            <View style={styles.modesRow}>
              <ModeTile
                label="Günlük"
                image={MODE_IMAGES.daily}
                colors={['#7A4A0E', '#4A2A10', '#2A1636']}
                borderColor="rgba(255, 196, 61, 0.65)"
                glowColor="#FFC43D"
                onPress={onDailyChallenge}
              />
              <ModeTile
                label="Arkadaşlar"
                image={MODE_IMAGES.friends}
                colors={['#8A1F55', '#5A1440', '#2C0E36']}
                borderColor="rgba(255, 122, 160, 0.6)"
                glowColor="#FF5A8A"
                onPress={onFriends}
              />
            </View>
          </View>

          </Reanimated.View>

          <Reanimated.View entering={FadeInDown.delay(270).duration(380)}>
          {/* Günlük Seri Bandı */}
          <TouchableOpacity
            style={styles.streakCard}
            onPress={() => {
              sound.playSound('tap');
              onDailyChallenge();
            }}
            activeOpacity={0.9}
          >
            <GradientFill
              colors={['rgba(107, 60, 255, 0.45)', 'rgba(36, 16, 80, 0.6)', 'rgba(107, 60, 255, 0.3)']}
              direction="horizontal"
            />
            <StreakFlameIcon size={46} active />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.streakTitle} numberOfLines={1}>
                {streakDays} Günlük Seri!
              </Text>
              <Text style={styles.streakSub} numberOfLines={2}>
                {completedToday
                  ? '✓ Bugünkü görev tamamlandı! Seri korundu.'
                  : 'Günün Meydan Okuması seni bekliyor'}
              </Text>
            </View>
            <View style={styles.streakButton}>
              <GradientFill colors={['#FFE27A', '#FFC43D', '#FF9B2F']} stops={[0, 0.45, 1]} />
              <Text style={styles.streakButtonText}>{completedToday ? 'GÖR ›' : 'BAŞLA ›'}</Text>
            </View>
          </TouchableOpacity>

          </Reanimated.View>

          <Reanimated.View entering={FadeInDown.delay(340).duration(380)}>
          {/* Ek Özellikler (Sezon, Pro Lig, Mağaza, Etkinlik, Envanter) */}
          <View style={styles.extraFeaturesRow}>
            {onSeason && (
              <FeatureTile
                label="Sezon 1"
                icon={UI_IMG.season}
                colors={['#7C4DFF', '#3A1690', '#24105A']}
                borderColor="rgba(186, 150, 255, 0.6)"
                glowColor="#9A6BFF"
                onPress={onSeason}
              />
            )}
            {onProLeague && (
              <FeatureTile
                label="Pro Lig"
                icon={UI_IMG.prolig}
                colors={['#2F7BE8', '#16388F', '#0F1E5A']}
                borderColor="rgba(96, 196, 255, 0.6)"
                glowColor="#38BDF8"
                onPress={onProLeague}
              />
            )}
            {onShop && (
              <FeatureTile
                label="Mağaza"
                icon={UI_IMG.shop}
                colors={['#D98A1F', '#8A4A12', '#4A2A10']}
                borderColor="rgba(255, 196, 61, 0.6)"
                glowColor="#FFC43D"
                onPress={onShop}
              />
            )}
            {onEvents && (
              <FeatureTile
                label="Etkinlik"
                icon={UI_IMG.events}
                colors={['#FF6A2F', '#B02E10', '#5A1408']}
                borderColor="rgba(255, 150, 90, 0.65)"
                glowColor="#FF7A3D"
                onPress={onEvents}
              />
            )}
            {onInventory && (
              <FeatureTile
                label="Envanter"
                icon={UI_IMG.inventory}
                colors={['#8A2E9E', '#5A1D6E', '#2C0E36']}
                borderColor="rgba(200, 140, 255, 0.55)"
                glowColor="#A855F7"
                onPress={onInventory}
              />
            )}
          </View>
          </Reanimated.View>
        </Animated.View>
      </ScrollView>

      {/* Alt Navigasyon */}
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

const glow = (color: string, radius = 14, opacity = 0.45) =>
  Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    android: { elevation: 6 },
    default: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
  });

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 104,
  },
  // ---- Üst Bar ----
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
  },
  brandMark: {
    width: 44,
    height: 44,
  },
  brandMarkNarrow: {
    width: 36,
    height: 36,
  },
  brandTextNarrow: {
    fontSize: 20,
  },
  brandText: {
    fontFamily: THEME.fonts.display,
    fontSize: 24,
    color: '#FFFFFF',
    letterSpacing: 0.3,
    flexShrink: 1,
    textShadowColor: 'rgba(107, 60, 255, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    paddingLeft: 5,
    paddingRight: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(20, 8, 46, 0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(154, 107, 255, 0.55)',
  },
  currencyPillNarrow: {
    height: 32,
    paddingRight: 9,
    gap: 3,
  },
  currencyTextNarrow: {
    fontSize: 12.5,
  },
  currencyText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.black,
  },
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 8, 46, 0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(154, 107, 255, 0.55)',
  },
  bellDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B5C',
    borderWidth: 1.5,
    borderColor: '#14082E',
  },
  // ---- Misafir ----
  guestNoticeBanner: {
    marginBottom: 10,
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
  // ---- Profil Kartı ----
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(36, 16, 80, 0.7)',
    borderWidth: 1.5,
    borderColor: 'rgba(120, 140, 255, 0.55)',
  },
  profileAvatarWrap: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFC43D',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#241050',
    overflow: 'hidden',
    ...glow('#FFC43D', 10, 0.6),
  },
  profileCrown: {
    position: 'absolute',
    top: -12,
    left: 4,
    transform: [{ rotate: '-18deg' }],
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  userName: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
    color: '#FFFFFF',
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  levelText: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    flexShrink: 1,
  },
  levelDot: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.black,
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  xpTrack: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(8, 3, 22, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(154, 107, 255, 0.45)',
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 7,
    overflow: 'hidden',
  },
  xpText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  // ---- Hero Kartı ----
  heroCard: {
    marginTop: 14,
    height: 330,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0F0624',
    borderWidth: 2,
    borderColor: 'rgba(130, 120, 255, 0.75)',
    ...glow('#6B3CFF', 18, 0.55),
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 250,
  },
  heroBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(60, 26, 150, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(186, 150, 255, 0.8)',
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.black,
    letterSpacing: 0.4,
  },
  heroBottom: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    alignItems: 'center',
  },
  heroTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 38,
    color: '#FFFFFF',
    letterSpacing: 0.6,
    textAlign: 'center',
    textShadowColor: 'rgba(107, 60, 255, 0.95)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 12,
  },
  heroTitleNarrow: {
    fontSize: 31,
  },
  heroSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    marginBottom: 12,
  },
  heroSub: {
    color: '#E9E1FF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    flexShrink: 1,
  },
  playButton: {
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#B6FFE6',
    borderBottomWidth: 5,
    borderBottomColor: '#1D7A6B',
    marginHorizontal: 10,
    ...glow('#5ADBB5', 16, 0.75),
  },
  playButtonShine: {
    position: 'absolute',
    top: 4,
    left: 24,
    right: 24,
    height: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  playButtonText: {
    fontFamily: THEME.fonts.display,
    fontSize: 30,
    color: '#FFFFFF',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(12, 58, 51, 0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  // ---- Mod Kartları ----
  modesGrid: {
    marginTop: 14,
    gap: 10,
  },
  modesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeTile: {
    flex: 1,
    minWidth: 0,
    height: 104,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 5,
  },
  modeTileShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  modeTileImg: {
    position: 'absolute',
    left: 2,
    top: 8,
    width: 88,
    height: 88,
  },
  modeTileLabelRow: {
    position: 'absolute',
    left: 56,
    right: 10,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
  },
  modeTileText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.black,
    textAlign: 'right',
    flexShrink: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  modeTileChevron: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: THEME.fonts.black,
    marginTop: -3,
  },
  // ---- Seri Bandı ----
  streakCard: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(36, 16, 80, 0.75)',
    borderWidth: 1.5,
    borderColor: 'rgba(154, 107, 255, 0.6)',
  },
  streakTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 19,
    color: '#FFFFFF',
  },
  streakSub: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  streakButton: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF1A8',
    borderBottomWidth: 4,
    borderBottomColor: '#B8560A',
  },
  streakButtonText: {
    fontFamily: THEME.fonts.black,
    fontSize: 16,
    color: '#3B1500',
    letterSpacing: 0.5,
  },
  // ---- Ek Özellikler ----
  extraFeaturesRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 14,
  },
  featureTile: {
    flex: 1,
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 3,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 9,
    elevation: 4,
  },
  featureTileShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
  featureTileIcon: {
    width: 38,
    height: 38,
  },
  featureTileText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontFamily: THEME.fonts.black,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
