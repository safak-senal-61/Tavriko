import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import {
  TavrikoScreen,
  TavrikoProgressBar,
  CharacterAvatar,
  CategorySquircleIcon,
  SpeedBoltIcon,
} from '../components/TavrikoIcons';

interface DuelVersusScreenProps {
  myProfile: {
    displayName: string;
    avatarUrl?: string;
    rankTitle?: string;
  };
  opponentProfile: {
    displayName: string;
    avatarUrl?: string;
    rankTitle?: string;
    isBot?: boolean;
  };
  categoryName?: string;
  onCancel?: () => void;
}

export const DuelVersusScreen: React.FC<DuelVersusScreenProps> = ({
  myProfile,
  opponentProfile,
  categoryName = 'Hızlı Düello',
  onCancel,
}) => {
  const [countdown, setCountdown] = useState(3);
  const [progress, setProgress] = useState(70);

  // Slide-in collision animations
  const myCardTranslateX = useRef(new Animated.Value(-320)).current;
  const oppCardTranslateX = useRef(new Animated.Value(320)).current;
  const vsScale = useRef(new Animated.Value(0)).current;

  const isBot = !!opponentProfile.isBot;

  useEffect(() => {
    sound.playSound('match_found');
    sound.triggerHaptic('success');

    Animated.sequence([
      Animated.parallel([
        Animated.spring(myCardTranslateX, {
          toValue: 0,
          friction: 6,
          tension: 75,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(oppCardTranslateX, {
          toValue: 0,
          friction: 6,
          tension: 75,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.spring(vsScale, {
        toValue: 1,
        friction: 4,
        tension: 110,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    const interval = setInterval(() => {
      sound.playSound('timer_tick');
      setCountdown((prev) => (prev > 1 ? prev - 1 : 1));
      setProgress((prev) => Math.min(100, prev + 15));
    }, 1000);

    return () => clearInterval(interval);
  }, [myCardTranslateX, oppCardTranslateX, vsScale]);

  return (
    <TavrikoScreen>
      {/* Top Bar */}
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {
            sound.playSound('tap');
            if (onCancel) onCancel();
          }}
        >
          <Text style={styles.iconBtnText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.modePill}>
          <CategorySquircleIcon category={categoryName} size={28} />
          <Text style={styles.modePillText}>
            {isBot ? '1v1 Bot Karşılaşması' : '1v1 Canlı Düello'}
            {'\n'}
            {categoryName}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => sound.playSound('tap')}
        >
          <Text style={styles.iconBtnText}>♪</Text>
        </TouchableOpacity>
      </View>

      {/* Center Versus Cards */}
      <View style={styles.centerCardsWrap}>
        {/* Player Card (Purple) */}
        <Animated.View
          style={[
            styles.myCard,
            { transform: [{ translateX: myCardTranslateX }] },
          ]}
        >
          <View style={styles.avatarRing}>
            <CharacterAvatar
              seed={myProfile.avatarUrl || myProfile.displayName}
              size={54}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardNameText} numberOfLines={1}>
              {(myProfile.displayName || 'SEN').toUpperCase()}
            </Text>
            <View style={styles.readyRow}>
              <View style={styles.myReadyBadge}>
                <Text style={styles.myReadyBadgeText}>✓ HAZIR</Text>
              </View>
              <Text style={styles.rankText}>{myProfile.rankTitle || 'Çaylak'}</Text>
            </View>
          </View>
          <SpeedBoltIcon size={28} />
        </Animated.View>

        {/* Overlapping VS Badge */}
        <Animated.View
          style={[styles.vsBadge, { transform: [{ scale: vsScale }] }]}
        >
          <Text style={styles.vsText}>VS</Text>
        </Animated.View>

        {/* Opponent Card (Crimson for Live, Dark Purple/Amber for Bot) */}
        <Animated.View
          style={[
            styles.opponentCard,
            isBot ? styles.botOpponentCard : styles.liveOpponentCard,
            { transform: [{ translateX: oppCardTranslateX }] },
          ]}
        >
          <View style={[styles.avatarRing, isBot && styles.botAvatarRing]}>
            <CharacterAvatar
              seed={opponentProfile.avatarUrl || opponentProfile.displayName}
              size={54}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardNameText} numberOfLines={1}>
              {(opponentProfile.displayName || (isBot ? 'BİLGİSAYAR' : 'RAKİP')).toUpperCase()}
            </Text>

            <View style={styles.opponentBadgeRow}>
              {isBot ? (
                <View style={styles.botBadge}>
                  <Text style={styles.botBadgeText}>🤖 BİLGİSAYAR RAKİP</Text>
                </View>
              ) : (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>⚡ 1v1 CANLI RAKİP</Text>
                </View>
              )}
            </View>

            <Text style={styles.opponentFoundSub}>
              {isBot ? 'Bilgisayar rakip bulundu!' : 'Gerçek rakip bulundu!'}
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* Bottom Countdown Bar */}
      <View style={styles.bottomCountdownWrap}>
        <Text style={styles.startingText}>
          {countdown} sn içinde başlıyor...
        </Text>
        <TavrikoProgressBar progress={progress} height={10} />
      </View>
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: THEME.fonts.extraBold,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingVertical: 5,
    paddingLeft: 6,
    paddingRight: 14,
  },
  modePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  centerCardsWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  myCard: {
    height: 114,
    borderRadius: 26,
    paddingHorizontal: 20,
    backgroundColor: '#5426C8',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.24)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  opponentCard: {
    height: 114,
    borderRadius: 26,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  liveOpponentCard: {
    backgroundColor: '#C20F2C',
    borderColor: 'rgba(255,255,255,0.24)',
  },
  botOpponentCard: {
    backgroundColor: '#381A6E',
    borderColor: '#FFC43D',
  },
  avatarRing: {
    padding: 3,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  botAvatarRing: {
    backgroundColor: 'rgba(255, 196, 61, 0.3)',
    borderColor: '#FFC43D',
    borderWidth: 1,
  },
  cardNameText: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
    color: '#FFFFFF',
  },
  readyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  myReadyBadge: {
    backgroundColor: 'rgba(124, 252, 138, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7CFC8A',
  },
  myReadyBadgeText: {
    color: '#7CFC8A',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  rankText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  opponentBadgeRow: {
    marginTop: 4,
    marginBottom: 2,
  },
  liveBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 227, 231, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE3E7',
  },
  liveBadgeText: {
    color: '#FFE3E7',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  botBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 196, 61, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFC43D',
  },
  botBadgeText: {
    color: '#FFC43D',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  opponentFoundSub: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 2,
  },
  vsBadge: {
    zIndex: 10,
    alignSelf: 'center',
    marginVertical: -18,
    width: 72,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFB21E',
    borderBottomWidth: 3,
    borderBottomColor: '#B8560A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
    color: '#2A1558',
  },
  bottomCountdownWrap: {
    marginBottom: 42,
  },
  startingText: {
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    color: '#FFA54A',
    textAlign: 'center',
    marginBottom: 10,
  },
});
