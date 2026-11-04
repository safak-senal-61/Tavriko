import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { CategoryId, DifficultyLevel, ALL_CATEGORIES } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import {
  TavrikoScreen,
  Button3D,
  CharacterAvatar,
  TavrikoProgressBar,
} from '../components/TavrikoIcons';

interface MatchmakingRadarScreenProps {
  category: CategoryId;
  difficulty?: DifficultyLevel;
  userName?: string;
  avatarSeed?: string;
  onCancel: () => void;
}

// Radar target configuration around a 270x270 circle (center = 135, 135)
// theta is clock angle in degrees (0° = 12 o'clock, 90° = 3 o'clock, etc.)
interface RadarTargetConfig {
  id: string;
  clockAngleDeg: number;
  radius: number;
  color: string;
  glowColor: string;
  size: number;
  label?: string;
}

const RADAR_TARGETS: RadarTargetConfig[] = [
  {
    id: 't1_gold',
    clockAngleDeg: 48,
    radius: 86,
    color: '#FFC43D',
    glowColor: 'rgba(255, 196, 61, 0.45)',
    size: 24,
    label: 'TR',
  },
  {
    id: 't2_mint',
    clockAngleDeg: 115,
    radius: 98,
    color: '#6FE3C1',
    glowColor: 'rgba(111, 227, 193, 0.45)',
    size: 20,
    label: 'EU',
  },
  {
    id: 't3_cyan',
    clockAngleDeg: 165,
    radius: 68,
    color: '#38BDF8',
    glowColor: 'rgba(56, 189, 248, 0.45)',
    size: 18,
  },
  {
    id: 't4_purple',
    clockAngleDeg: 215,
    radius: 92,
    color: '#C084FC',
    glowColor: 'rgba(192, 132, 252, 0.45)',
    size: 22,
    label: 'AZ',
  },
  {
    id: 't5_rose',
    clockAngleDeg: 285,
    radius: 78,
    color: '#F43F5E',
    glowColor: 'rgba(244, 63, 94, 0.45)',
    size: 18,
  },
  {
    id: 't6_amber',
    clockAngleDeg: 340,
    radius: 54,
    color: '#FBBF24',
    glowColor: 'rgba(251, 191, 36, 0.45)',
    size: 16,
  },
];

// Single animated radar ping target component
const DynamicSonarBlip: React.FC<{
  target: RadarTargetConfig;
  sweepDurationMs: number;
}> = ({ target, sweepDurationMs }) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;

  // Calculate position in 270x270 container
  const rad = (target.clockAngleDeg * Math.PI) / 180;
  const posX = 135 + target.radius * Math.sin(rad) - target.size / 2;
  const posY = 135 - target.radius * Math.cos(rad) - target.size / 2;

  // Delay trigger to synchronize with 360° sweep beam arrival
  const triggerDelay = Math.round(sweepDurationMs * (target.clockAngleDeg / 360));

  useEffect(() => {
    let isMounted = true;
    let timerId: any = null;
    let loopPulse: Animated.CompositeAnimation | null = null;
    let loopRipple: Animated.CompositeAnimation | null = null;

    timerId = setTimeout(() => {
      if (!isMounted) return;

      // Pulse sequence: sharp flash as beam sweeps, gentle glow decay
      loopPulse = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 320,
              easing: Easing.out(Easing.back(1.5)),
              useNativeDriver: Platform.OS !== 'web',
            }),
            Animated.timing(rippleAnim, {
              toValue: 1,
              duration: 850,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: Platform.OS !== 'web',
            }),
          ]),
          Animated.timing(pulseAnim, {
            toValue: 0.25,
            duration: sweepDurationMs - 320,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
      loopPulse.start();
    }, triggerDelay);

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
      if (loopPulse) loopPulse.stop();
      if (loopRipple) loopRipple.stop();
    };
  }, [pulseAnim, rippleAnim, sweepDurationMs, triggerDelay]);

  const rippleScale = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 2.6],
  });

  const rippleOpacity = rippleAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.9, 0.4, 0],
  });

  const blipScale = pulseAnim.interpolate({
    inputRange: [0.25, 1],
    outputRange: [0.75, 1.15],
  });

  return (
    <View
      style={[
        styles.blipWrapper,
        {
          left: posX,
          top: posY,
          width: target.size,
          height: target.size,
        },
      ]}
      pointerEvents="none"
    >
      {/* Expanding shockwave ripple */}
      <Animated.View
        style={[
          styles.blipRippleRing,
          {
            borderColor: target.color,
            backgroundColor: target.glowColor,
            transform: [{ scale: rippleScale }],
            opacity: rippleOpacity,
          },
        ]}
      />

      {/* Core glowing target badge */}
      <Animated.View
        style={[
          styles.blipCore,
          {
            borderColor: target.color,
            backgroundColor: target.glowColor,
            opacity: pulseAnim,
            transform: [{ scale: blipScale }],
          },
        ]}
      >
        <View style={[styles.blipInnerDot, { backgroundColor: target.color }]} />
      </Animated.View>
    </View>
  );
};

export const MatchmakingRadarScreen: React.FC<MatchmakingRadarScreenProps> = ({
  category,
  userName = 'Sen',
  avatarSeed,
  onCancel,
}) => {
  const [elapsedSec, setElapsedSec] = useState(0);
  const catObj = ALL_CATEGORIES.find((c) => c.id === category);

  const SWEEP_DURATION_MS = 2200;

  // Continuous 360-degree radar sweep rotation
  const rotateAnim = useRef(new Animated.Value(0)).current;
  // Expanding pulse sonar ring
  const sonarPulse = useRef(new Animated.Value(0)).current;
  // Radar center pulse
  const centerScale = useRef(new Animated.Value(1)).current;
  // Opponent avatar pulse
  const opponentPulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Play initial radar sonar ping
    sound.playSound('radar_ping');

    // Continuous 360° sweep
    const sweepLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: SWEEP_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    sweepLoop.start();

    // Expanding sonar wave
    const sonarLoop = Animated.loop(
      Animated.timing(sonarPulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    sonarLoop.start();

    // Center icon pulse
    const centerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(centerScale, {
          toValue: 1.12,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(centerScale, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    centerLoop.start();

    // Opponent searching badge pulse
    const oppLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(opponentPulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opponentPulseAnim, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    oppLoop.start();

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
      centerLoop.stop();
      oppLoop.stop();
      clearInterval(timer);
    };
  }, [rotateAnim, sonarPulse, centerScale, opponentPulseAnim]);

  const spinInterpolation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const sonarScale = sonarPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 1.05],
  });

  const sonarOpacity = sonarPulse.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.7, 0.25, 0],
  });

  // Calculate 7-second search countdown and progress
  const clampedSec = Math.min(elapsedSec, 7);
  const searchProgress = Math.min(100, (clampedSec / 7) * 100);
  const remainingSec = Math.max(0, 7 - clampedSec);

  // Dynamic status text according to specification:
  // 0-3 sn: "Gerçek 1v1 rakip aranıyor..."
  // 4-6 sn: "Adaylar taranıyor..."
  // 7. sn: "Bilgisayar rakip atanıyor..."
  const getStatusText = () => {
    if (elapsedSec < 4) {
      return 'Gerçek 1v1 rakip aranıyor...';
    }
    if (elapsedSec < 7) {
      return 'Adaylar taranıyor...';
    }
    return 'Bilgisayar rakip atanıyor...';
  };

  return (
    <TavrikoScreen>
      <Text style={styles.title}>1v1 HIZLI EŞLEŞME</Text>
      <Text style={styles.subtitle}>
        {catObj?.name || 'Genel Kültür'} · Canlı Düello
      </Text>

      {/* 1v1 Matchup Preview Cards */}
      <View style={styles.matchupRow}>
        {/* Player 1 Card (You) */}
        <View style={styles.playerCard}>
          <View style={styles.myAvatarWrap}>
            <CharacterAvatar seed={avatarSeed || userName} size={38} />
          </View>
          <View style={styles.playerInfo}>
            <Text style={styles.playerName} numberOfLines={1} ellipsizeMode="tail">
              {userName}
            </Text>
            <View style={styles.readyBadge}>
              <Text style={styles.readyBadgeText}>✓ HAZIR</Text>
            </View>
          </View>
        </View>

        {/* Central VS Badge */}
        <View style={styles.vsBadgeSmall}>
          <Text style={styles.vsBadgeText}>VS</Text>
        </View>

        {/* Player 2 Card (Opponent Searching) */}
        <View style={[styles.playerCard, styles.opponentSearchingCard]}>
          <Animated.View
            style={[
              styles.opponentAvatarWrap,
              { opacity: opponentPulseAnim },
            ]}
          >
            <Text style={styles.questionMark}>?</Text>
          </Animated.View>
          <View style={styles.playerInfo}>
            <Text style={styles.playerName} numberOfLines={1} ellipsizeMode="tail">
              {elapsedSec >= 7 ? 'Bilgisayar' : 'Rakip Aranıyor'}
            </Text>
            <View
              style={[
                styles.searchingBadge,
                elapsedSec >= 7 && styles.botAssigningBadge,
              ]}
            >
              <Text style={styles.searchingBadgeText}>
                {elapsedSec >= 7 ? '🤖 BOT' : '🔍 TARANIYOR'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Circular Animated Radar with Multi-Target Motion Sonar */}
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

        {/* 4 Concentric Radar Distance Rings */}
        <View
          style={[
            styles.ring,
            {
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderColor: 'rgba(111, 227, 193, 0.32)',
            },
          ]}
        />
        <View
          style={[
            styles.ring,
            {
              top: 34,
              left: 34,
              right: 34,
              bottom: 34,
              borderColor: 'rgba(255, 255, 255, 0.16)',
            },
          ]}
        />
        <View
          style={[
            styles.ring,
            {
              top: 68,
              left: 68,
              right: 68,
              bottom: 68,
              borderColor: 'rgba(255, 255, 255, 0.12)',
            },
          ]}
        />
        <View
          style={[
            styles.ring,
            {
              top: 102,
              left: 102,
              right: 102,
              bottom: 102,
              borderColor: 'rgba(255, 255, 255, 0.08)',
            },
          ]}
        />

        {/* Radar Crosshairs */}
        <View style={styles.radarCrossHorizontal} />
        <View style={styles.radarCrossVertical} />

        {/* Center Scanner Core */}
        <Animated.View
          style={[
            styles.centerCoreWrap,
            { transform: [{ scale: centerScale }] },
          ]}
        >
          <Text style={styles.center1v1Text}>1v1</Text>
        </Animated.View>

        {/* DYNAMIC MULTI-TARGET SONAR BLIPS ACROSS ALL QUADRANTS */}
        {RADAR_TARGETS.map((target) => (
          <DynamicSonarBlip
            key={target.id}
            target={target}
            sweepDurationMs={SWEEP_DURATION_MS}
          />
        ))}
      </View>

      {/* 7-Second Search Countdown and Progress */}
      <View style={styles.timerWrap}>
        <Text style={styles.timerText}>
          00:0{clampedSec} <Text style={styles.timerMaxText}>/ 00:07</Text>
        </Text>
        <Text style={styles.remainingHint}>
          {remainingSec > 0
            ? `${remainingSec} sn içinde gerçek rakip bulunamazsa bot bağlanır`
            : 'Bot rakip odaya bağlanıyor...'}
        </Text>
        <View style={styles.progressContainer}>
          <TavrikoProgressBar progress={searchProgress} height={8} />
        </View>
      </View>

      {/* Dynamic Status Message */}
      <Text style={styles.statusMessage}>{getStatusText()}</Text>

      {/* Cancel Button */}
      <View style={styles.cancelWrap}>
        <Button3D
          title="İPTAL"
          variant="red"
          onPress={onCancel}
          style={{ width: 220 }}
        />
      </View>
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 28,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginBottom: 10,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginBottom: 8,
    gap: 6,
  },
  playerCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 8,
    minHeight: 56,
  },
  opponentSearchingCard: {
    backgroundColor: 'rgba(111, 227, 193, 0.06)',
    borderColor: 'rgba(111, 227, 193, 0.3)',
  },
  myAvatarWrap: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#7CFC8A',
    overflow: 'hidden',
  },
  opponentAvatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 2,
    borderColor: '#6FE3C1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionMark: {
    color: '#6FE3C1',
    fontSize: 18,
    fontFamily: THEME.fonts.display,
  },
  playerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  playerName: {
    fontFamily: THEME.fonts.display,
    fontSize: 12.5,
    color: '#FFFFFF',
    marginBottom: 3,
  },
  readyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(124, 252, 138, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#7CFC8A',
  },
  readyBadgeText: {
    color: '#7CFC8A',
    fontSize: 9.5,
    fontFamily: THEME.fonts.extraBold,
  },
  searchingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(111, 227, 193, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#6FE3C1',
  },
  botAssigningBadge: {
    backgroundColor: 'rgba(255, 196, 61, 0.2)',
    borderColor: '#FFC43D',
  },
  searchingBadgeText: {
    color: '#6FE3C1',
    fontSize: 9.5,
    fontFamily: THEME.fonts.extraBold,
  },
  vsBadgeSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFB21E',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  vsBadgeText: {
    fontFamily: THEME.fonts.display,
    fontSize: 13,
    color: '#2A1558',
  },
  radarContainer: {
    width: 270,
    height: 270,
    alignSelf: 'center',
    marginVertical: 6,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sonarWaveRing: {
    position: 'absolute',
    width: 270,
    height: 270,
    borderRadius: 135,
    borderWidth: 2.5,
    borderColor: '#6FE3C1',
    backgroundColor: 'rgba(111, 227, 193, 0.08)',
  },
  rotatingSweepWrap: {
    position: 'absolute',
    width: 270,
    height: 270,
    borderRadius: 135,
  },
  radarGlowSector: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 135,
    height: 135,
    borderTopRightRadius: 135,
    backgroundColor: 'rgba(111, 227, 193, 0.26)',
  },
  radarBeamLine: {
    position: 'absolute',
    top: 0,
    left: 134,
    width: 2.5,
    height: 135,
    backgroundColor: '#6FE3C1',
    borderRadius: 2,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.5,
  },
  radarCrossHorizontal: {
    position: 'absolute',
    width: 270,
    height: 1,
    backgroundColor: 'rgba(111, 227, 193, 0.15)',
  },
  radarCrossVertical: {
    position: 'absolute',
    height: 270,
    width: 1,
    backgroundColor: 'rgba(111, 227, 193, 0.15)',
  },
  centerCoreWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2A1558',
    borderWidth: 2.5,
    borderColor: '#6FE3C1',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  center1v1Text: {
    fontFamily: THEME.fonts.display,
    fontSize: 17,
    color: '#6FE3C1',
  },

  // Dynamic Sonar Target Elements
  blipWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  blipRippleRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 1.5,
  },
  blipCore: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blipInnerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },

  timerWrap: {
    alignItems: 'center',
    marginTop: 2,
    paddingHorizontal: 28,
  },
  timerText: {
    fontFamily: THEME.fonts.display,
    fontSize: 30,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  timerMaxText: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  remainingHint: {
    color: 'rgba(217, 205, 245, 0.8)',
    fontSize: 11.5,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 6,
  },
  progressContainer: {
    width: '100%',
    maxWidth: 280,
  },
  statusMessage: {
    color: '#6FE3C1',
    fontSize: 13.5,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 12,
  },
  cancelWrap: {
    alignItems: 'center',
    marginBottom: 14,
  },
});
