import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
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
  useEffect(() => {
    sound.playSound('match_found');
    sound.triggerHaptic('success');
    Animated.sequence([
      Animated.parallel([
        Animated.spring(myCardTranslateX, {
          toValue: 0,
          friction: 6,
          tension: 75,
          useNativeDriver: true,
        }),
        Animated.spring(oppCardTranslateX, {
          toValue: 0,
          friction: 6,
          tension: 75,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(vsScale, {
        toValue: 1,
        friction: 4,
        tension: 110,
        useNativeDriver: true,
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
            1v1 Canlı{'\n'}
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
            <Text style={styles.myReadySub}>Hazır!</Text>
          </View>
          <SpeedBoltIcon size={28} />
        </Animated.View>
        {/* Overlapping VS Badge */}
        <Animated.View
          style={[styles.vsBadge, { transform: [{ scale: vsScale }] }]}
        >
          <Text style={styles.vsText}>VS</Text>
        </Animated.View>
        {/* Opponent Card (Crimson) */}
        <Animated.View
          style={[
            styles.opponentCard,
            { transform: [{ translateX: oppCardTranslateX }] },
          ]}
        >
          <View style={styles.avatarRing}>
            <CharacterAvatar
              seed={opponentProfile.avatarUrl || opponentProfile.displayName}
              size={54}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardNameText} numberOfLines={1}>
              {(opponentProfile.displayName || 'RAKİP').toUpperCase()}
            </Text>
            <Text style={styles.opponentFoundSub}>Rakip bulundu!</Text>
          </View>
        </Animated.View>
      </View>
      {/* Bottom Countdown Bar */}
      <View style={styles.bottomCountdownWrap}>
        <Text style={styles.startingText}>{countdown} sn içinde başlıyor...</Text>
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
    height: 112,
    borderRadius: 26,
    paddingHorizontal: 20,
    backgroundColor: '#5426C8',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  opponentCard: {
    height: 112,
    borderRadius: 26,
    paddingHorizontal: 20,
    backgroundColor: '#C20F2C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  cardNameText: {
    fontFamily: THEME.fonts.display,
    fontSize: 24,
    color: '#FFFFFF',
  },
  myReadySub: {
    color: '#7CFC8A',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  opponentFoundSub: {
    color: '#FFE3E7',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  vsBadge: {
    zIndex: 10,
    alignSelf: 'center',
    marginVertical: -16,
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