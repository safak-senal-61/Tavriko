import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform, Image, ScrollView } from 'react-native';
import { Radio, ShieldCheck, Swords } from 'lucide-react-native';
import { CategoryId, DifficultyLevel, ALL_CATEGORIES } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { DISCOVERY_IMG, useReducedMotion } from '../components/DiscoveryArtwork';
import { GradientFill } from '../components/TavrikoGradient';
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

// 12 farklı koordinat havuzu (merkez = 135, 135)
interface SonarCoordinate {
  x: number;
  y: number;
  color: string;
  glow: string;
  size: number;
}

const SONAR_POOL: SonarCoordinate[] = [
  // 1. Kadran (Kuzeydoğu)
  { x: 198, y: 72, color: '#FFC43D', glow: 'rgba(255, 196, 61, 0.6)', size: 20 },
  { x: 220, y: 130, color: '#6FE3C1', glow: 'rgba(111, 227, 193, 0.6)', size: 18 },
  { x: 172, y: 104, color: '#38BDF8', glow: 'rgba(56, 189, 248, 0.6)', size: 16 },

  // 2. Kadran (Güneydoğu)
  { x: 186, y: 196, color: '#C084FC', glow: 'rgba(192, 132, 252, 0.6)', size: 20 },
  { x: 142, y: 222, color: '#FFC43D', glow: 'rgba(255, 196, 61, 0.6)', size: 18 },
  { x: 206, y: 162, color: '#FBBF24', glow: 'rgba(251, 191, 36, 0.6)', size: 16 },

  // 3. Kadran (Güneybatı)
  { x: 76, y: 200, color: '#6FE3C1', glow: 'rgba(111, 227, 193, 0.6)', size: 20 },
  { x: 52, y: 140, color: '#38BDF8', glow: 'rgba(56, 189, 248, 0.6)', size: 18 },
  { x: 96, y: 168, color: '#F43F5E', glow: 'rgba(244, 63, 94, 0.6)', size: 16 },

  // 4. Kadran (Kuzeybatı)
  { x: 68, y: 78, color: '#FFC43D', glow: 'rgba(255, 196, 61, 0.6)', size: 18 },
  { x: 126, y: 54, color: '#6FE3C1', glow: 'rgba(111, 227, 193, 0.6)', size: 16 },
  { x: 92, y: 110, color: '#C084FC', glow: 'rgba(192, 132, 252, 0.6)', size: 18 },
];

/** TEK ANLIK SONAR IŞIĞI: Sadece aktifken parlar, dalga yayar, tamamen söner ve bittiğini bildirir */
const SingleActiveSonarPing: React.FC<{
  coord: SonarCoordinate;
  onFinished: () => void;
}> = ({ coord, onFinished }) => {
  const flashAnim = useRef(new Animated.Value(0)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    flashAnim.setValue(0);
    rippleAnim.setValue(0);

    const anim = Animated.parallel([
      Animated.sequence([
        // Parlayarak uyanma (150ms)
        Animated.timing(flashAnim, {
          toValue: 1,
          duration: 150,
          easing: Easing.out(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        // Tamamen sönme (650ms)
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: 650,
          easing: Easing.in(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      // Dışa doğru genişleyen ve kaybolan sonar şok dalgası (800ms)
      Animated.timing(rippleAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]);

    anim.start(({ finished }) => {
      if (finished) {
        onFinished();
      }
    });

    return () => {
      anim.stop();
    };
  }, [coord, flashAnim, rippleAnim, onFinished]);

  const rippleScale = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 2.8],
  });

  const rippleOpacity = rippleAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.95, 0.45, 0],
  });

  const blipScale = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1.25],
  });

  return (
    <View
      style={[
        styles.blipWrapper,
        {
          left: coord.x - coord.size / 2,
          top: coord.y - coord.size / 2,
          width: coord.size,
          height: coord.size,
        },
      ]}
      pointerEvents="none"
    >
      {/* Genişleyen şok halkası */}
      <Animated.View
        style={[
          styles.blipRippleRing,
          {
            borderColor: coord.color,
            backgroundColor: coord.glow,
            transform: [{ scale: rippleScale }],
            opacity: rippleOpacity,
          },
        ]}
      />

      {/* Parlayan ve tamamen sönen çekirdek */}
      <Animated.View
        style={[
          styles.blipCore,
          {
            borderColor: coord.color,
            backgroundColor: coord.glow,
            opacity: flashAnim,
            transform: [{ scale: blipScale }],
          },
        ]}
      >
        <View style={[styles.blipInnerDot, { backgroundColor: coord.color }]} />
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
  const reducedMotion = useReducedMotion();
  const pingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ekranda SADECE tek bir aktif ışık tutulur: biri sönünce diğeri farklı noktada yanar!
  const [activeCoord, setActiveCoord] = useState<{ coord: SonarCoordinate; key: number } | null>(null);
  const lastIndexRef = useRef<number>(-1);

  const catObj = ALL_CATEGORIES.find((c) => c.id === category);

  const SWEEP_DURATION_MS = 2400;

  // 360 derece dönen radar ışını
  const rotateAnim = useRef(new Animated.Value(0)).current;
  // Merkezden genişleyen ana sonar halkası
  const sonarPulse = useRef(new Animated.Value(0)).current;
  // Merkez çekirdeğin nefes alma animasyonu
  const centerScale = useRef(new Animated.Value(1)).current;
  // Rakip aranıyor puls
  const opponentPulseAnim = useRef(new Animated.Value(1)).current;

  // Sıradaki rastgele tek ışığı tetikleyen mekanizma:
  const triggerNextPing = useCallback(() => {
    let nextIdx = Math.floor(Math.random() * SONAR_POOL.length);
    if (nextIdx === lastIndexRef.current) {
      nextIdx = (nextIdx + 1) % SONAR_POOL.length;
    }
    lastIndexRef.current = nextIdx;
    setActiveCoord({ coord: SONAR_POOL[nextIdx], key: Date.now() });
  }, []);

  useEffect(() => {
    sound.playSound('radar_ping');

    // 360° döngü
    const sweepLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: SWEEP_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    if (!reducedMotion) sweepLoop.start();

    // Genişleyen sonar dalgası
    const sonarLoop = Animated.loop(
      Animated.timing(sonarPulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    if (!reducedMotion) sonarLoop.start();

    // Merkez 1v1 çekirdek nabzı
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
    if (!reducedMotion) centerLoop.start();

    // Rakip kutusu puls
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
    if (!reducedMotion) oppLoop.start();
    else {
      opponentPulseAnim.setValue(1);
      centerScale.setValue(1);
      sonarPulse.setValue(0);
    }

    // Süre sayacı
    const timer = setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        if (next % 2 === 0) {
          sound.playSound('radar_ping');
        }
        return next;
      });
    }, 1000);

    // İlk ışığı başlat
    const firstTimeout = !reducedMotion ? setTimeout(triggerNextPing, 400) : undefined;

    return () => {
      sweepLoop.stop();
      sonarLoop.stop();
      centerLoop.stop();
      oppLoop.stop();
      clearInterval(timer);
      clearTimeout(firstTimeout);
      if (pingTimeout.current) clearTimeout(pingTimeout.current);
    };
  }, [rotateAnim, sonarPulse, centerScale, opponentPulseAnim, reducedMotion, triggerNextPing]);

  // Işık tamamen söndüğünde çağrılır: kısa bir karanlık bekleme sonrası farklı noktada yeni ışığı yakar
  const handlePingFinished = useCallback(() => {
    setActiveCoord(null);
    const delay = 250 + Math.random() * 350; // 250-600ms aralık
    pingTimeout.current = setTimeout(triggerNextPing, delay);
  }, [triggerNextPing]);

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

  const clampedSec = Math.min(elapsedSec, 7);
  const searchProgress = Math.min(100, (clampedSec / 7) * 100);
  const remainingSec = Math.max(0, 7 - clampedSec);

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View style={styles.liveLabel}><Radio size={14} color="#B7F5E1" /><Text style={styles.liveLabelText}>DÜELLO ARENASI</Text></View>
      <Text style={styles.title}>Rakibin arenaya geliyor.</Text>
      <Text style={styles.subtitle}>
        {catObj?.name || 'Genel Kültür'} · Canlı Düello
      </Text>

      {/* 1v1 Önizleme Kartları */}
      <View style={styles.matchupRow}>
        {/* Oyuncu 1 (Sen) */}
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

        {/* Orta VS Rozeti */}
        <View style={styles.vsBadgeSmall}>
          <Text style={styles.vsBadgeText}>VS</Text>
        </View>

        {/* Oyuncu 2 (Aranıyor) */}
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
            <Text style={styles.playerName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
              {elapsedSec >= 7 ? 'Bilgisayar' : 'Rakip aranıyor'}
            </Text>
            <View
              style={[
                styles.searchingBadge,
                elapsedSec >= 7 && styles.botAssigningBadge,
              ]}
            >
              <Text style={styles.searchingBadgeText} numberOfLines={1}>
                {elapsedSec >= 7 ? 'BOT RAKİP' : 'TARANIYOR'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Dairesel Radar Ekranı */}
      <View style={styles.radarContainer}>
        <Image source={DISCOVERY_IMG.arena} style={styles.arenaImage} resizeMode="cover" />
        <GradientFill colors={['rgba(22,12,48,0)', 'rgba(22,12,48,0.55)']} style={{ borderRadius: 135 }} />
        {/* Genişleyen Sonar Dalgası */}
        <Animated.View
          style={[
            styles.sonarWaveRing,
            {
              opacity: sonarOpacity,
              transform: [{ scale: sonarScale }],
            },
          ]}
        />

        {/* 360° Dönen Radar Işını */}
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

        {/* Eşmerkezli Kılavuz Çemberler */}
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

        {/* Radar Kılavuz Çizgileri */}
        <View style={styles.radarCrossHorizontal} />
        <View style={styles.radarCrossVertical} />

        {/* Merkez 1v1 Çekirdek */}
        <Animated.View
          style={[
            styles.centerCoreWrap,
            { transform: [{ scale: centerScale }] },
          ]}
        >
          <Swords size={16} color="#FFC43D" />
          <Text style={styles.center1v1Text}>1v1</Text>
        </Animated.View>

        {/* SADECE TEK VE AKTİF OLAN IŞIK: Biri söndüğünde diğeri farklı koordinatta yanar! */}
        {!reducedMotion && activeCoord && (
          <SingleActiveSonarPing
            key={activeCoord.key}
            coord={activeCoord.coord}
            onFinished={handlePingFinished}
          />
        )}
      </View>

      <View style={styles.searchSteps}>
        {['Hazırsın', 'Canlı rakip', 'Bot alternatifi'].map((label, index) => (
          <View key={label} style={styles.searchStep}>
            <View style={[styles.stepDot, index <= (elapsedSec >= 7 ? 2 : 1) && styles.stepDotActive]} />
            <Text style={styles.stepLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* 7 Saniyelik Arama Sayacı ve İlerleme Çubuğu */}
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

      {/* Dinamik Durum Metni */}
      <Text style={styles.statusMessage}>{getStatusText()}</Text>
      <View style={styles.fairPlay}><ShieldCheck size={16} color="#B7F5E1" /><Text style={styles.fairPlayText}>Aynı sorular. Eşit şans. Bilgini konuştur.</Text></View>

      {/* İptal Butonu */}
      <View style={styles.cancelWrap}>
        <Button3D
          title="ARAMAYI İPTAL ET"
          variant="glass"
          onPress={onCancel}
          style={{ width: '100%', maxWidth: 280 }}
        />
      </View>
      </ScrollView>
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: { paddingTop: 8, paddingBottom: 24, width: '100%', maxWidth: 580, alignSelf: 'center' },
  liveLabel: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, marginBottom: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(111,227,193,0.1)' },
  liveLabelText: { color: '#B7F5E1', fontSize: 12, fontFamily: THEME.fonts.extraBold, letterSpacing: 1 },
  arenaImage: { position: 'absolute', top: 0, left: 0, width: 270, height: 270, borderRadius: 135, opacity: 0.85 },
  searchSteps: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 8, marginBottom: 12 },
  searchStep: { alignItems: 'center', gap: 6, flex: 1 },
  stepDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#6C5C83' },
  stepDotActive: { backgroundColor: '#B7F5E1' },
  stepLabel: { color: '#E2D7F5', fontFamily: THEME.fonts.bold, fontSize: 12, textAlign: 'center' },
  fairPlay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 },
  fairPlayText: { color: '#D9CDF5', fontFamily: THEME.fonts.body, fontSize: 12, flexShrink: 1 },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 26,
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
    marginBottom: 16,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 8,
    marginBottom: 8,
    gap: 5,
  },
  playerCard: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#2B1A46',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 7,
    gap: 6,
    minHeight: 96,
  },
  opponentSearchingCard: {
    backgroundColor: 'rgba(111, 227, 193, 0.06)',
    borderColor: 'rgba(111, 227, 193, 0.3)',
  },
  myAvatarWrap: {
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#7CFC8A',
    overflow: 'hidden',
    flexShrink: 0,
  },
  opponentAvatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 2,
    borderColor: '#6FE3C1',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  questionMark: {
    color: '#6FE3C1',
    fontSize: 16,
    fontFamily: THEME.fonts.display,
  },
  playerInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerName: {
    fontFamily: THEME.fonts.display,
    fontSize: 13,
    color: '#FFFFFF',
    marginBottom: 3,
  },
  readyBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(124, 252, 138, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#7CFC8A',
  },
  readyBadgeText: {
    color: '#7CFC8A',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  searchingBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(111, 227, 193, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#6FE3C1',
    maxWidth: '100%',
  },
  botAssigningBadge: {
    backgroundColor: 'rgba(255, 196, 61, 0.2)',
    borderColor: '#FFC43D',
  },
  searchingBadgeText: {
    color: '#6FE3C1',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  vsBadgeSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFB21E',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    flexShrink: 0,
  },
  vsBadgeText: {
    fontFamily: THEME.fonts.display,
    fontSize: 11.5,
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
    backgroundColor: 'rgba(111, 227, 193, 0.10)',
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
    position: 'absolute',
    bottom: 20,
    width: 76,
    height: 36,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#26183C',
    borderWidth: 1,
    borderColor: '#FFC43D',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  center1v1Text: {
    fontFamily: THEME.fonts.display,
    fontSize: 17,
    color: '#FFC43D',
  },

  // Tekil Parlayan Sonar Işığı
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
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blipInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
    color: '#D9CDF5',
  },
  remainingHint: {
    color: '#E2D7F5',
    fontSize: 12,
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
