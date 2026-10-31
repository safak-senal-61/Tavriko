import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { CategoryId, DifficultyLevel, ALL_CATEGORIES } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import {
  TavrikoScreen,
  Button3D,
  CharacterAvatar,
} from '../components/TavrikoIcons';
interface MatchmakingRadarScreenProps {
  category: CategoryId;
  difficulty: DifficultyLevel;
  avatarSeed?: string;
  onCancel: () => void;
}
export const MatchmakingRadarScreen: React.FC<MatchmakingRadarScreenProps> = ({
  category,
  avatarSeed,
  onCancel,
}) => {
  const [elapsedSec, setElapsedSec] = useState(1);
  const catObj = ALL_CATEGORIES.find((c) => c.id === category);
  // Continuous 360-degree radar sweep rotation
  const rotateAnim = useRef(new Animated.Value(0)).current;
  // Expanding pulse sonar ring
  const sonarPulse = useRef(new Animated.Value(0)).current;
  // Center player avatar heartbeat pulse
  const centerScale = useRef(new Animated.Value(1)).current;
  // Blip pop-in animations
  const blip1Scale = useRef(new Animated.Value(0)).current;
  const blip2Scale = useRef(new Animated.Value(0)).current;
  const blip3Scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // Play initial radar sonar ping
    sound.playSound('radar_ping');
    // Continuous 360° sweep
    const sweepLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    sweepLoop.start();
    // Expanding sonar wave
    const sonarLoop = Animated.loop(
      Animated.timing(sonarPulse, {
        toValue: 1,
        duration: 2000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );
    sonarLoop.start();
    // Center avatar subtle pulse
    const avatarLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(centerScale, {
          toValue: 1.09,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(centerScale, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    avatarLoop.start();
    // Staggered blip detection pop-ins
    const tBlip1 = setTimeout(() => {
      Animated.spring(blip1Scale, {
        toValue: 1,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }).start();
    }, 600);
    const tBlip2 = setTimeout(() => {
      Animated.spring(blip2Scale, {
        toValue: 1,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }).start();
    }, 1500);
    const tBlip3 = setTimeout(() => {
      Animated.spring(blip3Scale, {
        toValue: 1,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }).start();
    }, 2600);
    const timer = setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        if (next % 2 === 0) {
          sound.playSound('radar_ping');
        }
        return next;
      });
    }, 1000);
    return () => {
      sweepLoop.stop();
      sonarLoop.stop();
      avatarLoop.stop();
      clearTimeout(tBlip1);
      clearTimeout(tBlip2);
      clearTimeout(tBlip3);
      clearInterval(timer);
    };
  }, [rotateAnim, sonarPulse, centerScale, blip1Scale, blip2Scale, blip3Scale]);
  const spinInterpolation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const sonarScale = sonarPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 1.05],
  });
  const sonarOpacity = sonarPulse.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.65, 0.25, 0],
  });
  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  return (
    <TavrikoScreen>
      <Text style={styles.title}>RAKİP ARANIYOR</Text>
      <Text style={styles.subtitle}>
        Hızlı eşleşme · {catObj?.name || 'Genel Kültür'}
      </Text>
      {/* Circular Animated Radar */}
      <View style={styles.radarContainer}>
        {/* Expanding Sonar Wave Ring */}
        <Animated.View
          style={[
            styles.sonarWaveRing,
            {
              opacity: sonarOpacity,
              transform: [{ scale: sonarScale }],
            },
          ]}
        />
        {/* Rotating Radar Sweep Container */}
        <Animated.View
          style={[
            styles.rotatingSweepWrap,
            { transform: [{ rotate: spinInterpolation }] },
          ]}
          pointerEvents="none"
        >
          <View style={styles.radarGlowSector} />
          <View style={styles.radarBeamLine} />
        </Animated.View>
        {/* 4 Concentric Rings */}
        <View
          style={[
            styles.ring,
            {
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderColor: 'rgba(255,255,255,0.22)',
            },
          ]}
        />
        <View
          style={[
            styles.ring,
            {
              top: 38,
              left: 38,
              right: 38,
              bottom: 38,
              borderColor: 'rgba(255,255,255,0.18)',
            },
          ]}
        />
        <View
          style={[
            styles.ring,
            {
              top: 76,
              left: 76,
              right: 76,
              bottom: 76,
              borderColor: 'rgba(255,255,255,0.14)',
            },
          ]}
        />
        <View
          style={[
            styles.ring,
            {
              top: 114,
              left: 114,
              right: 114,
              bottom: 114,
              borderColor: 'rgba(255,255,255,0.10)',
            },
          ]}
        />
        {/* Center Player Avatar with Pulse */}
        <Animated.View
          style={[
            styles.centerAvatarWrap,
            { transform: [{ scale: centerScale }] },
          ]}
        >
          <CharacterAvatar seed={avatarSeed} index={1} size={58} />
        </Animated.View>
        {/* Detected Radar Blips (Animated Pop-In) */}
        <Animated.View
          style={[
            styles.blipTopLeft,
            { transform: [{ scale: blip1Scale }] },
          ]}
        >
          <CharacterAvatar index={0} size={36} />
        </Animated.View>
        <Animated.View
          style={[
            styles.blipBottomRight,
            { transform: [{ scale: blip2Scale }] },
          ]}
        >
          <CharacterAvatar index={5} size={36} />
        </Animated.View>
        <Animated.View
          style={[
            styles.blipTopRight,
            { transform: [{ scale: blip3Scale }] },
          ]}
        >
          <CharacterAvatar index={3} size={32} />
        </Animated.View>
      </View>
      <Text style={styles.timerText}>{formatTimer(elapsedSec)}</Text>
      <Text style={styles.playersFoundText}>
        {elapsedSec < 2
          ? 'Aday rakipler taranıyor...'
          : elapsedSec < 4
          ? '2 aday oyuncu tespit edildi...'
          : '3 oyuncu bulundu · Eşleştiriliyor!'}
      </Text>
      <View style={{ alignItems: 'center' }}>
        <Button3D
          title="İPTAL"
          variant="red"
          onPress={onCancel}
          style={{ width: 200 }}
        />
      </View>
    </TavrikoScreen>
  );
};
const styles = StyleSheet.create({
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 36,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 4,
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginBottom: 14,
  },
  radarContainer: {
    width: 310,
    height: 310,
    alignSelf: 'center',
    marginVertical: 10,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sonarWaveRing: {
    position: 'absolute',
    width: 310,
    height: 310,
    borderRadius: 155,
    borderWidth: 3,
    borderColor: '#6FE3C1',
    backgroundColor: 'rgba(111, 227, 193, 0.08)',
  },
  rotatingSweepWrap: {
    position: 'absolute',
    width: 310,
    height: 310,
    borderRadius: 155,
  },
  radarGlowSector: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 155,
    height: 155,
    borderTopRightRadius: 155,
    backgroundColor: 'rgba(111, 227, 193, 0.28)',
  },
  radarBeamLine: {
    position: 'absolute',
    top: 0,
    left: 154,
    width: 3,
    height: 155,
    backgroundColor: '#6FE3C1',
    borderRadius: 2,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
  },
  centerAvatarWrap: {
    borderRadius: 34,
    borderWidth: 3,
    borderColor: '#FFC43D',
    overflow: 'hidden',
  },
  blipTopLeft: {
    position: 'absolute',
    left: 44,
    top: 82,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#6FE3C1',
    overflow: 'hidden',
  },
  blipBottomRight: {
    position: 'absolute',
    right: 48,
    top: 186,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFC43D',
    overflow: 'hidden',
  },
  blipTopRight: {
    position: 'absolute',
    right: 62,
    top: 52,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FF7A8A',
    overflow: 'hidden',
  },
  timerText: {
    fontFamily: THEME.fonts.display,
    fontSize: 44,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 14,
  },
  playersFoundText: {
    color: '#6FE3C1',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
});