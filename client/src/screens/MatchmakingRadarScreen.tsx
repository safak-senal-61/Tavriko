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

export const MatchmakingRadarScreen: React.FC<MatchmakingRadarScreenProps> = ({
  category,
  userName = 'Sen',
  avatarSeed,
  onCancel,
}) => {
  const [elapsedSec, setElapsedSec] = useState(0);
  const catObj = ALL_CATEGORIES.find((c) => c.id === category);

  // Continuous 360-degree radar sweep rotation
  const rotateAnim = useRef(new Animated.Value(0)).current;
  // Expanding pulse sonar ring
  const sonarPulse = useRef(new Animated.Value(0)).current;
  // Radar center pulse
  const centerScale = useRef(new Animated.Value(1)).current;
  // Single 1v1 opponent scanning blip animation
  const opponentBlipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Play initial radar sonar ping
    sound.playSound('radar_ping');

    // Continuous 360° sweep
    const sweepLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2200,
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

    // Opponent beacon pulse on radar
    const blipLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(opponentBlipAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opponentBlipAnim, {
          toValue: 0.35,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    blipLoop.start();

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
      blipLoop.stop();
      clearInterval(timer);
    };
  }, [rotateAnim, sonarPulse, centerScale, opponentBlipAnim]);

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

  // Dynamic status text strictly according to specification:
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
            <CharacterAvatar seed={avatarSeed || userName} size={46} />
          </View>
          <View style={styles.playerInfo}>
            <Text style={styles.playerName} numberOfLines={1}>
              {userName.toUpperCase()}
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
              { opacity: opponentBlipAnim },
            ]}
          >
            <Text style={styles.questionMark}>?</Text>
          </Animated.View>
          <View style={styles.playerInfo}>
            <Text style={styles.playerName} numberOfLines={1}>
              {elapsedSec >= 7 ? 'BİLGİSAYAR' : 'RAKİP ARANIYOR'}
            </Text>
            <View
              style={[
                styles.searchingBadge,
                elapsedSec >= 7 && styles.botAssigningBadge,
              ]}
            >
              <Text style={styles.searchingBadgeText}>
                {elapsedSec >= 7 ? '🤖 BOT ATANIYOR' : '🔍 TARANIYOR'}
              </Text>
            </View>
          </View>
        </View>
      </View>

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
              borderColor: 'rgba(111, 227, 193, 0.28)',
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

        {/* Single Opponent Radar Blip / Candidate Ping */}
        <Animated.View
          style={[
            styles.opponentRadarBlip,
            {
              opacity: opponentBlipAnim,
              transform: [{ scale: opponentBlipAnim }],
            },
          ]}
        >
          <View style={styles.blipInnerDot} />
        </Animated.View>
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
    fontSize: 32,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginBottom: 12,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginBottom: 10,
    gap: 8,
  },
  playerCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 18,
    padding: 10,
    gap: 10,
  },
  opponentSearchingCard: {
    backgroundColor: 'rgba(111, 227, 193, 0.06)',
    borderColor: 'rgba(111, 227, 193, 0.3)',
  },
  myAvatarWrap: {
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#7CFC8A',
    overflow: 'hidden',
  },
  opponentAvatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 2,
    borderColor: '#6FE3C1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionMark: {
    color: '#6FE3C1',
    fontSize: 22,
    fontFamily: THEME.fonts.display,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontFamily: THEME.fonts.display,
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  readyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(124, 252, 138, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7CFC8A',
  },
  readyBadgeText: {
    color: '#7CFC8A',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  searchingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(111, 227, 193, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6FE3C1',
  },
  botAssigningBadge: {
    backgroundColor: 'rgba(255, 196, 61, 0.2)',
    borderColor: '#FFC43D',
  },
  searchingBadgeText: {
    color: '#6FE3C1',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  vsBadgeSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFB21E',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsBadgeText: {
    fontFamily: THEME.fonts.display,
    fontSize: 14,
    color: '#2A1558',
  },
  radarContainer: {
    width: 270,
    height: 270,
    alignSelf: 'center',
    marginVertical: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sonarWaveRing: {
    position: 'absolute',
    width: 270,
    height: 270,
    borderRadius: 135,
    borderWidth: 3,
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
    width: 3,
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
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2A1558',
    borderWidth: 2.5,
    borderColor: '#6FE3C1',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  center1v1Text: {
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    color: '#6FE3C1',
  },
  opponentRadarBlip: {
    position: 'absolute',
    top: 48,
    right: 58,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 196, 61, 0.3)',
    borderWidth: 2,
    borderColor: '#FFC43D',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  blipInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFC43D',
  },
  timerWrap: {
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 28,
  },
  timerText: {
    fontFamily: THEME.fonts.display,
    fontSize: 32,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  timerMaxText: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  remainingHint: {
    color: 'rgba(217, 205, 245, 0.8)',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 8,
  },
  progressContainer: {
    width: '100%',
    maxWidth: 280,
  },
  statusMessage: {
    color: '#6FE3C1',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  cancelWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
});
