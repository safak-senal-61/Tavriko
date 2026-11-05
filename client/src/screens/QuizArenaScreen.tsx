import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AppState,
  AppStateStatus,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  Circle,
  Line,
  Rect,
  G,
} from 'react-native-svg';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { loadStoredPreferences } from '../store/appPrefs';
import { ClientQuestion, ALL_CATEGORIES } from '@trivia/shared';
import {
  TavrikoScreen,
  XpStarIcon,
  StreakFlameIcon,
  CheckMarkSvg,
  CrossMarkSvg,
  CharacterAvatar,
} from '../components/TavrikoIcons';
export type QuestionAnswerState =
  | 'answerable'
  | 'submitting'
  | 'correct'
  | 'incorrect'
  | 'timed_out';
export interface RoundFeedback {
  isCorrect: boolean;
  isTimeout: boolean;
  correctOptionId: string;
  explanation: string;
  pointsAwarded: number;
  speedBonus: number;
  streak: number;
}
interface QuizArenaScreenProps {
  question: ClientQuestion;
  selectedOptionId: string | null;
  isLocked: boolean;
  streak: number;
  currentScore: number;
  feedback?: RoundFeedback | null;
  onSelectOption: (optionId: string, timeRemainingMs: number) => void;
  onTimeExpired?: () => void;
  onExit?: () => void;
  isDuelMode?: boolean;
  myDisplayName?: string;
  opponent?: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    score: number;
    hasAnswered?: boolean;
  } | null;
  dailyChallengeInfo?: {
    requiredCorrect: number;
    totalQuestions: number;
    currentCorrect: number;
  } | null;
  /** Canlı yarış pisti: hem 1v1 eşleşmeli hem özel oda yarışçıları */
  racers?: RacerInfo[];
  /**
   * @deprecated Pist artık puana göre değil doğru cevap sayısına göre ilerler;
   * bitiş = question.totalRounds. Geriye dönük uyumluluk için tutuluyor.
   */
  targetScore?: number;
}
// ---------------------------------------------------------------------------
// Smooth, 100% Reliable 30 FPS Timer Bar for Android & iOS
// ---------------------------------------------------------------------------
interface SmoothTimerBarProps {
  totalMs: number;
  endTime: number;
  isActive: boolean;
  themeColor: string;
  criticalColor: string;
  onTimeExpired: () => void;
  onSecondChange: (sec: number) => void;
}
const SmoothTimerBar: React.FC<SmoothTimerBarProps> = React.memo(
  ({
    totalMs,
    endTime,
    isActive,
    themeColor,
    criticalColor,
    onTimeExpired,
    onSecondChange,
  }) => {
    const [progressPct, setProgressPct] = useState<number>(100);
    const [trackWidth, setTrackWidth] = useState<number>(0);
    const [isCritical, setIsCritical] = useState<boolean>(false);
    const hasExpiredRef = useRef<boolean>(false);
    const onTimeExpiredRef = useRef(onTimeExpired);
    onTimeExpiredRef.current = onTimeExpired;
    const onSecondChangeRef = useRef(onSecondChange);
    onSecondChangeRef.current = onSecondChange;
    const lastSecRef = useRef<number>(Math.ceil(totalMs / 1000));
    useEffect(() => {
      hasExpiredRef.current = false;
      lastSecRef.current = Math.ceil(totalMs / 1000);
      const initialNow = Date.now();
      const initRemMs = Math.max(0, endTime - initialNow);
      const initPct = Math.max(0, Math.min(100, (initRemMs / totalMs) * 100));
      setProgressPct(initPct);
      setIsCritical(initRemMs <= 3000);
      if (!isActive) return;
      // 33ms interval = 30 FPS ultra-smooth bar movement
      const interval = setInterval(() => {
        const now = Date.now();
        const remainingMs = Math.max(0, endTime - now);
        const pct = (remainingMs / totalMs) * 100;
        const clampedPct = Math.max(0, Math.min(100, pct));
        setProgressPct(clampedPct);
        const sec = Math.ceil(remainingMs / 1000);
        if (sec !== lastSecRef.current) {
          lastSecRef.current = sec;
          onSecondChangeRef.current(sec);
        }
        setIsCritical(remainingMs <= 3000);
        if (remainingMs <= 0) {
          clearInterval(interval);
          setProgressPct(0);
          if (!hasExpiredRef.current) {
            hasExpiredRef.current = true;
            onTimeExpiredRef.current();
          }
        }
      }, 33);
      return () => {
        hasExpiredRef.current = true;
        clearInterval(interval);
      };
    }, [totalMs, endTime, isActive]);
    // Compute width: direct pixel width when measured, or fallback to % string
    const fillWidth =
      trackWidth > 0 ? (trackWidth * progressPct) / 100 : `${progressPct}%`;
    return (
      <View
        style={styles.timerTrack}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && w !== trackWidth) {
            setTrackWidth(w);
          }
        }}
      >
        <View
          style={[
            styles.timerFill,
            {
              width: fillWidth as any,
              backgroundColor: isCritical ? criticalColor : themeColor,
            },
          ]}
        />
      </View>
    );
  }
);
// ---------------------------------------------------------------------------
// TAVRİKO MODERN YÜKSELEN ZİRVE YARIŞ PİSTİ
// (Modern Cosmic Ascending Energy Arc Race Track)
//
// - Tüm oyuncular %0 başlangıç noktasında (Adım 0) TAM OLARAK AYNI YERDEN başlar.
// - İlerleme yüzdesi: progressPercentage = (correctAnswers / totalQuestions) * 100
// - Her doğru cevap oyuncuyu yükselen enerji eğrisi üzerinde +1 adım (hem ileri
//   hem yukarı) bir sonraki ışıklı kontrol noktasına taşır.
// - Yanlış veya boş cevap 0 adım ilerletir.
// - Puanlama: Her doğru cevapta 100 taban puan + 0..50 hız bonusu (+ seri bonusu).
// ---------------------------------------------------------------------------
export interface RacerInfo {
  id: string;
  displayName: string;
  avatarUrl?: string;
  /** Avatarın altında ve alt bilgi barında gösterilen anlık puan */
  score: number;
  /** Eğri üzerindeki ilerleme adımını belirleyen doğru cevap sayısı */
  correctAnswers: number;
  isMe?: boolean;
  isHost?: boolean;
  hasAnswered?: boolean;
  lastAnswer?: {
    isCorrect: boolean;
    pointsEarned: number;
    speedBonus?: number;
    timeMs?: number;
  };
}

const WAVE_TRACK_HEIGHT = 96;
const WAVE_U_START = 0.08;
const WAVE_U_FINISH = 0.91;
const RACER_NODE_W = 46;
const RACER_AVATAR_SIZE = 32;

/** Doğru sayısını [0, totalQuestions] aralığına sıkıştırır; bitişe erken ulaşmayı imkânsız kılar */
export const clampCorrect = (correct: number, totalQuestions: number): number => {
  const total = Math.max(1, Math.floor(totalQuestions));
  const value = Math.floor(Number.isFinite(correct) ? correct : 0);
  return Math.min(total, Math.max(0, value));
};

/** progressPercentage = (correctAnswers / totalQuestions) * 100 */
export const getRaceProgressPercentage = (correct: number, totalQuestions: number): number => {
  const total = Math.max(1, Math.floor(totalQuestions));
  return (clampCorrect(correct, total) / total) * 100;
};

/** Eski 1000'lik ölçekten kalan puanları temiz 100-150 ölçeğine normalize eder */
const formatCleanScore = (rawScore: number, correctAnswers: number, totalQuestions: number): number => {
  const s = Math.max(0, Math.round(Number(rawScore) || 0));
  const refSteps = Math.max(1, correctAnswers || 1, Math.min(3, totalQuestions));
  if (s > refSteps * 260) {
    return Math.round(s / 10);
  }
  return s;
};

/**
 * Mantıklı, Sürekli Yükselen S-Eğrisi (Monotonic Ascending Arc):
 * Sol alttaki Başlangıç (u = 0.08, ny = 0.72) noktasından sağ üstteki
 * Zirve Bitiş Bayrağına (u = 0.91, ny = 0.28) doğru hiç çukura düşmeden
 * her adımda hem ileri hem yukarı yükselir.
 */
export const getHillCurveNormY = (uRaw: number): number => {
  const u = Math.max(0, Math.min(1, uRaw));
  const t = Math.max(0, Math.min(1, (u - WAVE_U_START) / (WAVE_U_FINISH - WAVE_U_START)));
  // Smoothstep + hafif modern dalga harmonikleri (her zaman yukarı eğimli)
  const smooth = t * t * (3 - 2 * t);
  const ripple = Math.sin(t * Math.PI * 2) * 0.028;
  return 0.72 - 0.44 * smooth - ripple;
};

/**
 * Her oyuncu kendi doğru cevap sayısının tam adım noktasında (baseU) durur!
 * Başlangıçta (0 doğru) herkes tam olarak aynı başlangıç noktasındadır.
 * Aynı adımdaki oyuncular yatayda kaydırılmaz; yalnızca dikeyde (offsetY) hafif ayrılır.
 */
const computeStepCoordinates = (
  sortedRacers: RacerInfo[],
  totalQuestions: number
): Record<string, { u: number; offsetY: number }> => {
  const total = Math.max(1, Math.floor(totalQuestions));
  const span = WAVE_U_FINISH - WAVE_U_START;

  const groups: Record<number, RacerInfo[]> = {};
  sortedRacers.forEach((r) => {
    const c = clampCorrect(r.correctAnswers, total);
    (groups[c] = groups[c] || []).push(r);
  });

  const coords: Record<string, { u: number; offsetY: number }> = {};
  Object.entries(groups).forEach(([correctKey, list]) => {
    const c = Number(correctKey);
    // Yatay konum (u) YALNIZCA doğru cevap sayısına bağlıdır — herkes aynı adımda aynı X'te!
    const exactU = WAVE_U_START + (c / total) * span;
    if (list.length === 1) {
      coords[list[0].id] = { u: exactU, offsetY: 0 };
      return;
    }
    const vSpacing = Math.min(10, 20 / Math.max(1, list.length - 1));
    list.forEach((racer, idx) => {
      const offsetY = (idx - (list.length - 1) / 2) * vSpacing;
      coords[racer.id] = { u: exactU, offsetY };
    });
  });

  return coords;
};

/** Eğri üzerinde (u) değiştiğinde 60 FPS yumuşak geçiş sağlayan hook */
const useAnimatedWaveU = (targetU: number, durationMs: number = 580): number => {
  const [currentU, setCurrentU] = useState<number>(targetU);
  const currentURef = useRef<number>(targetU);

  useEffect(() => {
    const startU = currentURef.current;
    const diff = targetU - startU;
    if (Math.abs(diff) < 0.0005) {
      currentURef.current = targetU;
      setCurrentU(targetU);
      return;
    }
    let rafId: number | null = null;
    const startTime = Date.now();

    const step = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const nextVal = startU + diff * eased;
      currentURef.current = nextVal;
      setCurrentU(nextVal);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [targetU, durationMs]);

  return currentU;
};

/** Eğri üzerindeki tek yarışçı düğümü: Üstte sıra, ortada ışıklı avatar, altta temiz puan */
const WaveRacerNode: React.FC<{
  racer: RacerInfo;
  rank: number;
  targetU: number;
  offsetY: number;
  trackWidth: number;
  trackHeight: number;
  totalQuestions: number;
}> = ({ racer, rank, targetU, offsetY, trackWidth, trackHeight, totalQuestions }) => {
  const animU = useAnimatedWaveU(targetU, 580);
  const [showPlusOne, setShowPlusOne] = useState(false);

  const prevCorrectRef = useRef<number>(clampCorrect(racer.correctAnswers, totalQuestions));
  const correctNow = clampCorrect(racer.correctAnswers, totalQuestions);

  useEffect(() => {
    if (correctNow > prevCorrectRef.current || racer.lastAnswer?.isCorrect) {
      setShowPlusOne(true);
      const timer = setTimeout(() => setShowPlusOne(false), 1500);
      prevCorrectRef.current = correctNow;
      return () => clearTimeout(timer);
    }
    prevCorrectRef.current = correctNow;
  }, [correctNow, racer.lastAnswer]);

  const x = animU * trackWidth;
  const y = getHillCurveNormY(animU) * trackHeight + offsetY;

  const cleanScore = formatCleanScore(racer.score || 0, correctNow, totalQuestions);
  const isLeader = rank === 1 && (correctNow > 0 || cleanScore > 0);
  const isCorrect = racer.lastAnswer?.isCorrect === true;
  const isWrong = racer.lastAnswer?.isCorrect === false;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.waveRacerNode,
        {
          left: x - RACER_NODE_W / 2,
          top: y - RACER_AVATAR_SIZE / 2 - 14,
          zIndex: racer.isMe ? 35 : 25 - rank,
        },
      ]}
    >
      {/* Doğru cevapta yukarı süzülen +1 adım rozeti */}
      {showPlusOne && (
        <View style={styles.wavePlusOneBadge}>
          <Text style={styles.wavePlusOneText}>+1 ADIM</Text>
        </View>
      )}

      {/* Üstte Sıralama Numarası */}
      <Text
        style={[
          styles.waveRankText,
          isLeader && styles.waveRankTextLeader,
          racer.isMe && styles.waveRankTextMe,
        ]}
        numberOfLines={1}
      >
        #{rank}
      </Text>

      {/* Ortada Yuvarlak Avatar (Sen = Tavriko Altın/Turuncu, Rakip = Neon Camgöbeği) */}
      <View
        style={[
          styles.waveAvatarOuterGlow,
          racer.isMe ? styles.waveAvatarGlowMe : styles.waveAvatarGlowOther,
          isCorrect && styles.waveAvatarGlowCorrect,
          isWrong && styles.waveAvatarGlowWrong,
        ]}
      >
        <View
          style={[
            styles.waveAvatarRing,
            racer.isMe ? styles.waveAvatarRingMe : styles.waveAvatarRingOther,
            isCorrect && styles.waveAvatarRingCorrect,
            isWrong && styles.waveAvatarRingWrong,
          ]}
        >
          <CharacterAvatar
            seed={racer.avatarUrl || racer.displayName}
            size={RACER_AVATAR_SIZE - 6}
          />
        </View>
        {racer.hasAnswered && (
          <View style={styles.waveAnsweredDot}>
            <Text style={styles.waveAnsweredDotText}>✓</Text>
          </View>
        )}
      </View>

      {/* Altta Anlık Temiz Puan (örn. 0p, 135p, 280p) */}
      <View style={[styles.waveScorePill, racer.isMe && styles.waveScorePillMe]}>
        <Text
          style={[
            styles.waveScoreText,
            racer.isMe && styles.waveScoreTextMe,
          ]}
          numberOfLines={1}
        >
          {cleanScore}p
        </Text>
      </View>
    </View>
  );
};

/** Tavriko Modern Yükselen Zirve Yarış Pisti */
const BilBakalimWaveTrack: React.FC<{
  racers: RacerInfo[];
  totalQuestions: number;
}> = ({ racers, totalQuestions }) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const total = Math.max(1, Math.floor(totalQuestions));
  const H = WAVE_TRACK_HEIGHT;

  // Sıralama: Önce doğru sayısı (pist adımı), eşitlikte puan
  const sorted = useMemo(
    () =>
      racers
        .slice()
        .sort(
          (a, b) =>
            clampCorrect(b.correctAnswers, total) - clampCorrect(a.correctAnswers, total) ||
            formatCleanScore(b.score || 0, b.correctAnswers, total) -
              formatCleanScore(a.score || 0, a.correctAnswers, total) ||
            (b.isMe ? 1 : 0) - (a.isMe ? 1 : 0)
        ),
    [racers, total]
  );

  const stepCoords = useMemo(
    () => computeStepCoordinates(sorted, total),
    [sorted, total]
  );

  const myRacer = useMemo(
    () => sorted.find((r) => r.isMe) || sorted[0],
    [sorted]
  );
  const myCorrect = myRacer ? clampCorrect(myRacer.correctAnswers, total) : 0;
  const myPct = Math.round(getRaceProgressPercentage(myCorrect, total));

  // SVG Yükselen Eğri ve Adım Noktaları (0 .. total)
  const { linePath, areaPath, progressPath, stepNodes, startPoint, finishPoint } = useMemo(() => {
    const W = Math.max(1, trackWidth);
    const samples = 64;
    const pts: Array<{ x: number; y: number; u: number }> = [];
    for (let i = 0; i <= samples; i += 1) {
      const u = WAVE_U_START + (i / samples) * (WAVE_U_FINISH - WAVE_U_START);
      pts.push({
        u,
        x: u * W,
        y: getHillCurveNormY(u) * H,
      });
    }

    const dLine = pts
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');

    const firstPt = pts[0];
    const lastPt = pts[pts.length - 1];
    const dArea = `${dLine} L ${lastPt.x.toFixed(1)} ${H.toFixed(1)} L ${firstPt.x.toFixed(1)} ${H.toFixed(1)} Z`;

    const maxCorrect = sorted.reduce(
      (acc, r) => Math.max(acc, clampCorrect(r.correctAnswers, total)),
      0
    );
    const leaderU = WAVE_U_START + (maxCorrect / total) * (WAVE_U_FINISH - WAVE_U_START);
    const progPts = pts.filter((p) => p.u <= leaderU + 0.004);
    const dProg =
      maxCorrect > 0 && progPts.length >= 2
        ? progPts
            .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
            .join(' ')
        : '';

    const nodes: Array<{ step: number; x: number; y: number; passed: boolean }> = [];
    const tickEvery = total > 15 ? 2 : 1;
    for (let s = 0; s <= total; s += 1) {
      if (s !== 0 && s !== total && s % tickEvery !== 0) continue;
      const u = WAVE_U_START + (s / total) * (WAVE_U_FINISH - WAVE_U_START);
      nodes.push({
        step: s,
        x: u * W,
        y: getHillCurveNormY(u) * H,
        passed: maxCorrect >= s && (s === 0 || maxCorrect > 0),
      });
    }

    return {
      linePath: dLine,
      areaPath: dArea,
      progressPath: dProg,
      stepNodes: nodes,
      startPoint: { x: firstPt.x, y: firstPt.y },
      finishPoint: { x: lastPt.x, y: lastPt.y },
    };
  }, [trackWidth, H, sorted, total]);

  return (
    <View style={styles.modernRaceCard}>
      {/* Üst Başlık: Sol = Canlı İlerleme Adımı, Sağ = Bitiş Hedefi */}
      <View style={styles.modernRaceTopRow}>
        <View style={styles.modernRaceTitleGroup}>
          <View style={styles.modernLiveDot} />
          <Text style={styles.modernRaceTitle}>ZİRVE YARIŞI</Text>
          <View style={styles.modernStepChip}>
            <Text style={styles.modernStepChipText}>
              {myCorrect}/{total} Doğru · %{myPct}
            </Text>
          </View>
        </View>
        <View style={styles.modernGoalChip}>
          <Text style={styles.modernGoalChipText}>Hedef: {total} Doğru 🏁</Text>
        </View>
      </View>

      {/* Orta Alan: Yükselen Enerji Eğrisi & Oyuncu Avatarları */}
      <View
        style={styles.bilBakalimWrapper}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - trackWidth) > 0.5) {
            setTrackWidth(w);
          }
        }}
      >
        {trackWidth > 0 && (
          <>
            <Svg
              width={trackWidth}
              height={H}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              <Defs>
                <LinearGradient id="skyGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#1B0C3A" />
                  <Stop offset="0.5" stopColor="#2A135A" />
                  <Stop offset="1" stopColor="#160830" />
                </LinearGradient>
                <LinearGradient id="hillFillGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#8B5CF6" stopOpacity="0.34" />
                  <Stop offset="1" stopColor="#3B0764" stopOpacity="0.06" />
                </LinearGradient>
                <LinearGradient id="activeWaveGrad" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#38BDF8" />
                  <Stop offset="0.5" stopColor="#FFC43D" />
                  <Stop offset="1" stopColor="#3FD08A" />
                </LinearGradient>
              </Defs>

              {/* 1. Modern Kozmik Arka Plan */}
              <Rect x={0} y={0} width={trackWidth} height={H} fill="url(#skyGrad)" />

              {/* 2. İnce Modern Perspektif Kılavuz Çizgileri */}
              <G opacity={0.14}>
                <Line x1={0} y1={H * 0.3} x2={trackWidth} y2={H * 0.3} stroke="#A78BFA" strokeWidth={1} />
                <Line x1={0} y1={H * 0.55} x2={trackWidth} y2={H * 0.55} stroke="#A78BFA" strokeWidth={1} />
                <Line x1={0} y1={H * 0.8} x2={trackWidth} y2={H * 0.8} stroke="#A78BFA" strokeWidth={1} />
              </G>

              {/* 3. Eğri Altı Neon Alan Dolgusu */}
              <Path d={areaPath} fill="url(#hillFillGrad)" />

              {/* 4. Ana Yükselen Pist Yolu (Pasif İz) */}
              <Path
                d={linePath}
                stroke="rgba(167, 139, 250, 0.25)"
                strokeWidth={7}
                fill="none"
                strokeLinecap="round"
              />
              <Path
                d={linePath}
                stroke="rgba(255, 255, 255, 0.45)"
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
              />

              {/* 5. Tamamlanan Doğru Adımların Parlak Enerji İzi */}
              {progressPath ? (
                <>
                  <Path
                    d={progressPath}
                    stroke="rgba(255, 196, 61, 0.35)"
                    strokeWidth={9}
                    fill="none"
                    strokeLinecap="round"
                  />
                  <Path
                    d={progressPath}
                    stroke="url(#activeWaveGrad)"
                    strokeWidth={4}
                    fill="none"
                    strokeLinecap="round"
                  />
                </>
              ) : null}

              {/* 6. Her Soru Adımı İçin Kontrol Noktaları (0 .. total) */}
              {stepNodes.map((n) => (
                <Circle
                  key={n.step}
                  cx={n.x}
                  cy={n.y}
                  r={n.step === 0 || n.step === total ? 4.5 : n.passed ? 3.5 : 2.5}
                  fill={n.passed ? '#FFC43D' : '#2E1660'}
                  stroke={n.passed ? '#FFFFFF' : 'rgba(255,255,255,0.45)'}
                  strokeWidth={1.5}
                />
              ))}

              {/* 7. Başlangıç (0) ve Zirve Bitiş Bayrağı (%100) */}
              <G>
                <Circle
                  cx={startPoint.x}
                  cy={startPoint.y}
                  r={5}
                  fill="#38BDF8"
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                />
                <Circle
                  cx={finishPoint.x}
                  cy={finishPoint.y}
                  r={6}
                  fill="#FFC43D"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
                <Line
                  x1={finishPoint.x}
                  y1={finishPoint.y - 2}
                  x2={finishPoint.x}
                  y2={finishPoint.y - 22}
                  stroke="#FFC43D"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
                <Path
                  d={`M ${finishPoint.x} ${finishPoint.y - 22} L ${finishPoint.x + 15} ${finishPoint.y - 17} L ${finishPoint.x} ${finishPoint.y - 12} Z`}
                  fill="#FFC43D"
                />
              </G>
            </Svg>

            {/* Eğri Üzerinde Hareket Eden Yarışçı Madalyonları */}
            {sorted.map((racer, idx) => {
              const coord = stepCoords[racer.id] || { u: WAVE_U_START, offsetY: 0 };
              return (
                <WaveRacerNode
                  key={racer.id}
                  racer={racer}
                  rank={idx + 1}
                  targetU={coord.u}
                  offsetY={coord.offsetY}
                  trackWidth={trackWidth}
                  trackHeight={H}
                  totalQuestions={total}
                />
              );
            })}
          </>
        )}
      </View>

      {/* Alt Canlı Oyuncu Rozetleri: İsim, Doğru Adımı (c/N) ve Anlık Puan */}
      <View style={styles.modernRacerStrip}>
        {sorted.map((racer, idx) => {
          const c = clampCorrect(racer.correctAnswers, total);
          const cleanScore = formatCleanScore(racer.score || 0, c, total);
          return (
            <View
              key={racer.id}
              style={[
                styles.modernRacerChip,
                racer.isMe && styles.modernRacerChipMe,
              ]}
            >
              <Text style={[styles.modernRacerRank, idx === 0 && styles.modernRacerRankFirst]}>
                #{idx + 1}
              </Text>
              <Text style={styles.modernRacerName} numberOfLines={1}>
                {racer.displayName}
              </Text>
              <Text style={styles.modernRacerStep}>
                {c}/{total}
              </Text>
              <Text style={styles.modernRacerScore}>{cleanScore}p</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export const QuizArenaScreen: React.FC<QuizArenaScreenProps> = ({
  question,
  selectedOptionId,
  streak,
  currentScore,
  feedback,
  onSelectOption,
  onTimeExpired,
  onExit,
  isDuelMode = false,
  myDisplayName = 'Sen',
  opponent = null,
  dailyChallengeInfo = null,
  racers: racersProp,
}) => {
  // Her oyun modunda (1v1, Arkadaşla Özel Oda, Keşfet, Günlük Görev) yarışçılar gösterilir
  const activeRacers: RacerInfo[] = useMemo(() => {
    if (racersProp && racersProp.length > 0) {
      return racersProp;
    }
    const fallbackList: RacerInfo[] = [
      {
        id: 'me',
        displayName: myDisplayName || 'Sen',
        score: currentScore || 0,
        correctAnswers: dailyChallengeInfo?.currentCorrect ?? 0,
        isMe: true,
        hasAnswered: selectedOptionId !== null,
      },
    ];
    if (opponent) {
      fallbackList.push({
        id: opponent.id,
        displayName: opponent.displayName,
        avatarUrl: opponent.avatarUrl,
        score: opponent.score || 0,
        correctAnswers: 0,
        isMe: false,
        hasAnswered: opponent.hasAnswered,
      });
    }
    return fallbackList;
  }, [racersProp, myDisplayName, currentScore, dailyChallengeInfo, selectedOptionId, opponent]);
  const [localSelectedOptionId, setLocalSelectedOptionId] = useState<string | null>(null);
  // Settings > "Soru Metin Boyutu" (normal / large) — real, app-wide effect
  const [isLargeText] = useState<boolean>(() => {
    try {
      return loadStoredPreferences().textSize === 'large';
    } catch {
      return false;
    }
  });
  const totalMs = (question.timeLimitSec || 15) * 1000;
  const [secondsLeft, setSecondsLeft] = useState<number>(
    question.timeLimitSec || 15
  );
  const [answerState, setAnswerState] =
    useState<QuestionAnswerState>('answerable');
  const [endTime, setEndTime] = useState<number>(() => Date.now() + totalMs);
  const endTimeRef = useRef<number>(Date.now() + totalMs);
  const hasExpiredRef = useRef<boolean>(false);
  const onTimeExpiredRef = useRef(onTimeExpired);
  onTimeExpiredRef.current = onTimeExpired;
  const categoryObj = ALL_CATEGORIES.find((c) => c.id === question.categoryId);
  const diffMap: Record<string, string> = {
    easy: 'Kolay',
    medium: 'Orta',
    hard: 'Zor',
    expert: 'Uzman',
  };
  // Sync answer state when feedback arrives
  useEffect(() => {
    if (feedback) {
      if (feedback.isTimeout) {
        setAnswerState('timed_out');
      } else if (feedback.isCorrect) {
        setAnswerState('correct');
      } else {
        setAnswerState('incorrect');
      }
    }
  }, [feedback]);
  // When question changes, reset time, answer state, and timer cleanly
  useEffect(() => {
    hasExpiredRef.current = false;
    setLocalSelectedOptionId(null);
    const newEndTime = Date.now() + totalMs;
    endTimeRef.current = newEndTime;
    setEndTime(newEndTime);
    setSecondsLeft(Math.ceil(totalMs / 1000));
    setAnswerState('answerable');
  }, [question.id, totalMs]);
  // AppState background/foreground synchronization
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (
          nextAppState === 'active' &&
          !hasExpiredRef.current &&
          answerState === 'answerable'
        ) {
          const now = Date.now();
          const remMs = Math.max(0, endTimeRef.current - now);
          if (remMs <= 0) {
            hasExpiredRef.current = true;
            setAnswerState('timed_out');
            setSecondsLeft(0);
            if (onTimeExpiredRef.current) onTimeExpiredRef.current();
          } else {
            setSecondsLeft(Math.ceil(remMs / 1000));
          }
        }
      }
    );
    return () => {
      subscription.remove();
    };
  }, [answerState]);
  const handleTimeExpiredInternal = useCallback(() => {
    if (!hasExpiredRef.current) {
      hasExpiredRef.current = true;
      setAnswerState('timed_out');
      setSecondsLeft(0);
      if (onTimeExpiredRef.current) {
        onTimeExpiredRef.current();
      }
    }
  }, []);
  const handleSecondChange = useCallback((sec: number) => {
    setSecondsLeft(sec);
    if (sec <= 3 && sec > 0) {
      // Settings > "Süre Uyarı Sesi" — kapalıysa geri sayım tiki çalınmaz
      const alertOn = loadStoredPreferences().timerAlertSound !== false;
      if (alertOn) {
        sound.playSound('timer_tick');
      }
    }
  }, []);
  const handleSelect = (optionId: string) => {
    if (
      answerState !== 'answerable' ||
      feedback ||
      hasExpiredRef.current ||
      secondsLeft <= 0
    ) {
      return;
    }
    const now = Date.now();
    const remainingMs = Math.max(0, endTimeRef.current - now);
    if (remainingMs <= 0) {
      hasExpiredRef.current = true;
      setAnswerState('timed_out');
      setSecondsLeft(0);
      if (onTimeExpiredRef.current) onTimeExpiredRef.current();
      return;
    }
    setLocalSelectedOptionId(optionId);
    setAnswerState('submitting');
    sound.playSound('tap');
    sound.triggerHaptic('medium');
    onSelectOption(optionId, remainingMs);
  };
  useEffect(() => {
    return () => {
      hasExpiredRef.current = true;
    };
  }, []);

  const handleExitPress = useCallback(() => {
    sound.playSound('tap');
    hasExpiredRef.current = true;
    if (onExit) {
      onExit();
    }
  }, [onExit]);

  const optionLabels = ['A', 'B', 'C', 'D'];
  const isOptionsDisabled =
    answerState !== 'answerable' ||
    !!feedback ||
    hasExpiredRef.current ||
    secondsLeft <= 0;
  return (
    <TavrikoScreen style={styles.screenContainer}>
      {/* 1. Top Row: Close button, SORU X/Y, Score Pill (Matches page11) */}
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleExitPress}
          activeOpacity={0.8}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.roundTitle}>
          SORU {question.roundNumber}/{question.totalRounds}
        </Text>
        <View style={styles.scorePill}>
          <XpStarIcon size={18} />
          <Text style={styles.scorePillText}>
            {formatCleanScore(
              currentScore,
              activeRacers.find((r) => r.isMe)?.correctAnswers || 0,
              question.totalRounds || 10
            )}
          </Text>
        </View>
      </View>
      {/* Daily Challenge Banner */}
      {dailyChallengeInfo && (
        <View style={styles.dailyStrip}>
          <StreakFlameIcon size={18} active={true} />
          <Text style={styles.dailyStripText}>
            MEYDAN OKUMA · Hedef: {dailyChallengeInfo.requiredCorrect}/{dailyChallengeInfo.totalQuestions} Doğru (Şu an: {dailyChallengeInfo.currentCorrect})
          </Text>
        </View>
      )}
      {/* TRT Bil Bakalım Tarzı Panoramik Dalga & Tepe Yarış Pisti */}
      {activeRacers.length > 0 && (
        <BilBakalimWaveTrack
          racers={activeRacers}
          totalQuestions={question.totalRounds || 10}
        />
      )}
      {/* 2. Second Row: Streak Pill + Smooth 30 FPS Timer Bar + Seconds (Matches page11) */}
      <View style={styles.timerRow}>
        <View style={styles.streakPill}>
          <StreakFlameIcon size={16} />
          <Text style={styles.streakPillText}>
            x{Math.max(1, streak)} SERİ
          </Text>
        </View>
        <SmoothTimerBar
          totalMs={totalMs}
          endTime={endTime}
          isActive={answerState === 'answerable'}
          themeColor="#FF9B2F"
          criticalColor="#FF5A6A"
          onTimeExpired={handleTimeExpiredInternal}
          onSecondChange={handleSecondChange}
        />
        <Text
          style={[
            styles.secondsText,
            secondsLeft <= 3 && { color: '#FF5A6A' },
          ]}
        >
          {secondsLeft} sn
        </Text>
      </View>
      {/* 3. Question Glass Card (Matches page11) */}
      <View style={styles.questionCard}>
        <View style={styles.categoryChip}>
          <Text style={styles.categoryChipText}>
            {categoryObj?.name || 'Bilim'} ·{' '}
            {diffMap[question.difficulty] || 'Orta'}
          </Text>
        </View>
        <Text style={[styles.questionText, isLargeText && styles.questionTextLarge]} numberOfLines={4}>
          {question.text}
        </Text>
      </View>
      {/* 4. Options List (.opt, .opt.sel, .opt.ok, .opt.no from page11 & page12) */}
      <View style={styles.optionsContainer}>
        {question.options.map((opt, index) => {
          const activeSelectedId = selectedOptionId || localSelectedOptionId;
          const isMyChoice = activeSelectedId === opt.id;
          const isCorrectChoice = !!feedback && feedback.correctOptionId === opt.id;
          const isWrongChoice = !!feedback && isMyChoice && !isCorrectChoice;

          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.optCard,
                !feedback && isMyChoice && styles.optCardSelected,
                feedback && isCorrectChoice && styles.optCardCorrect,
                feedback && isWrongChoice && styles.optCardWrong,
                isOptionsDisabled &&
                  !isMyChoice &&
                  !isCorrectChoice &&
                  styles.optCardDimmed,
              ]}
              disabled={isOptionsDisabled}
              activeOpacity={0.8}
              onPress={() => handleSelect(opt.id)}
            >
              <View
                style={[
                  styles.optBadge,
                  !feedback && isMyChoice && styles.optBadgeSelected,
                  feedback && isCorrectChoice && styles.optBadgeCorrect,
                  feedback && isWrongChoice && styles.optBadgeWrong,
                ]}
              >
                <Text
                  style={[
                    styles.optBadgeText,
                    !feedback && isMyChoice && { color: '#180B34' },
                  ]}
                >
                  {optionLabels[index]}
                </Text>
              </View>

              <Text style={[styles.optText, isLargeText && styles.optTextLarge]} numberOfLines={2}>
                {opt.text}
              </Text>

              {/* Status and Action Badges */}
              {feedback ? (
                isMyChoice && isCorrectChoice ? (
                  <View style={styles.choiceTagCorrect}>
                    <Text style={styles.choiceTagText}>Seçimin</Text>
                    <CheckMarkSvg size={16} color="#FFFFFF" />
                  </View>
                ) : isWrongChoice ? (
                  <View style={styles.choiceTagWrong}>
                    <Text style={styles.choiceTagText}>Seçimin</Text>
                    <CrossMarkSvg size={16} color="#FFFFFF" />
                  </View>
                ) : isCorrectChoice ? (
                  <View style={styles.choiceTagAnswer}>
                    <Text style={styles.choiceTagAnswerText}>Doğru Cevap</Text>
                    <CheckMarkSvg size={16} color="#3FD08A" />
                  </View>
                ) : null
              ) : isMyChoice ? (
                <View style={styles.choiceTagPending}>
                  <Text style={styles.choiceTagPendingText}>Seçildi 🔒</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
      {/* 5. Fixed Bottom Status Area (Zero Layout Shift) */}
      <View style={styles.fixedBottomStatus}>
        {feedback ? (
          <View style={styles.inlineFeedbackCard}>
            <Text
              style={[
                styles.inlineFeedbackTitle,
                {
                  color: feedback.isTimeout
                    ? '#FFC43D'
                    : feedback.isCorrect
                    ? '#7CFC8A'
                    : '#FF7A8A',
                },
              ]}
            >
              {feedback.isTimeout
                ? 'SÜRE DOLDU!'
                : feedback.isCorrect
                ? `DOĞRU! +${feedback.pointsAwarded} puan`
                : 'YANLIŞ CEVAP!'}
            </Text>
            {feedback.explanation ? (
              <Text style={styles.inlineFeedbackSub} numberOfLines={2}>
                {feedback.explanation}
              </Text>
            ) : null}
          </View>
        ) : answerState === 'submitting' ? (
          <Text style={styles.bottomHintText}>
            Cevabın kilitlendi, rakipler bekleniyor...
          </Text>
        ) : answerState === 'timed_out' ? (
          <Text style={[styles.bottomHintText, { color: '#FFC43D' }]}>
            Süre doldu! Sonuçlar hesaplanıyor...
          </Text>
        ) : (
          <Text style={styles.bottomHintText}>
            Doğru şıkkı seçerek serini koru ve hız bonusu kazan!
          </Text>
        )}
      </View>
    </TavrikoScreen>
  );
};
const styles = StyleSheet.create({
  // TAVRİKO MODERN YÜKSELEN ZİRVE YARIŞ PİSTİ
  modernRaceCard: {
    backgroundColor: 'rgba(18, 8, 42, 0.86)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
    gap: 6,
    shadowColor: '#090318',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  modernRaceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modernRaceTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modernLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#3FD08A',
    shadowColor: '#3FD08A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  modernRaceTitle: {
    color: '#F8FAFC',
    fontSize: 11,
    fontFamily: THEME.fonts.display,
    letterSpacing: 0.6,
  },
  modernStepChip: {
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  modernStepChipText: {
    color: '#7DD3FC',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  modernGoalChip: {
    backgroundColor: 'rgba(255, 196, 61, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.42)',
  },
  modernGoalChipText: {
    color: '#FFC43D',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  bilBakalimWrapper: {
    height: WAVE_TRACK_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1B0C3A',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    position: 'relative',
  },
  waveRacerNode: {
    position: 'absolute',
    width: RACER_NODE_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wavePlusOneBadge: {
    position: 'absolute',
    top: -15,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    zIndex: 50,
  },
  wavePlusOneText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontFamily: THEME.fonts.extraBold,
  },
  waveRankText: {
    color: '#E2E8F0',
    fontSize: 9.5,
    fontFamily: THEME.fonts.extraBold,
    marginBottom: 1,
    textShadowColor: 'rgba(10, 4, 36, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  waveRankTextLeader: {
    color: '#FFC43D',
  },
  waveRankTextMe: {
    color: '#FFC43D',
  },
  waveAvatarOuterGlow: {
    padding: 2,
    borderRadius: (RACER_AVATAR_SIZE + 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveAvatarGlowMe: {
    backgroundColor: 'rgba(255, 196, 61, 0.32)',
    shadowColor: '#FFC43D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  waveAvatarGlowOther: {
    backgroundColor: 'rgba(56, 189, 248, 0.28)',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 5,
  },
  waveAvatarGlowCorrect: {
    backgroundColor: 'rgba(63, 208, 138, 0.42)',
    shadowColor: '#3FD08A',
  },
  waveAvatarGlowWrong: {
    backgroundColor: 'rgba(255, 90, 106, 0.42)',
    shadowColor: '#FF5A6A',
  },
  waveAvatarRing: {
    width: RACER_AVATAR_SIZE,
    height: RACER_AVATAR_SIZE,
    borderRadius: RACER_AVATAR_SIZE / 2,
    borderWidth: 2,
    backgroundColor: '#1E1042',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  waveAvatarRingMe: {
    borderColor: '#FFC43D',
  },
  waveAvatarRingOther: {
    borderColor: '#38BDF8',
  },
  waveAvatarRingCorrect: {
    borderColor: '#3FD08A',
  },
  waveAvatarRingWrong: {
    borderColor: '#FF5A6A',
  },
  waveAnsweredDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3FD08A',
    borderWidth: 1.5,
    borderColor: '#180B34',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveAnsweredDotText: {
    color: '#052E16',
    fontSize: 7.5,
    fontFamily: THEME.fonts.extraBold,
  },
  waveScorePill: {
    marginTop: 1,
    paddingHorizontal: 5,
    paddingVertical: 0.5,
    borderRadius: 6,
    backgroundColor: 'rgba(15, 7, 36, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  waveScorePillMe: {
    borderColor: 'rgba(255, 196, 61, 0.55)',
    backgroundColor: 'rgba(40, 22, 10, 0.85)',
  },
  waveScoreText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontFamily: THEME.fonts.extraBold,
  },
  waveScoreTextMe: {
    color: '#FFC43D',
  },
  modernRacerStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modernRacerChip: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.2)',
  },
  modernRacerChipMe: {
    backgroundColor: 'rgba(255, 196, 61, 0.12)',
    borderColor: 'rgba(255, 196, 61, 0.45)',
  },
  modernRacerRank: {
    color: '#A78BFA',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  modernRacerRankFirst: {
    color: '#FFC43D',
  },
  modernRacerName: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 10.5,
    fontFamily: THEME.fonts.extraBold,
  },
  modernRacerStep: {
    color: '#7DD3FC',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  modernRacerScore: {
    color: '#FFC43D',
    fontSize: 10.5,
    fontFamily: THEME.fonts.extraBold,
  },

  screenContainer: {
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: THEME.fonts.extraBold,
  },
  roundTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 20,
    color: '#FFFFFF',
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  scorePillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  duelStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(10, 4, 24, 0.55)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 4,
  },
  duelSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '42%',
  },
  duelName: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  duelVsLabel: {
    fontFamily: THEME.fonts.display,
    fontSize: 12,
    color: '#FFC43D',
  },
  dailyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 122, 0, 0.2)',
    borderWidth: 1,
    borderColor: '#FF7A00',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginTop: 6,
    marginBottom: 4,
  },
  dailyStripText: {
    color: '#FFB300',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  opponentCheckBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3FD08A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  opponentCheckText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    marginBottom: 8,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  streakPillText: {
    color: '#FF9B4A',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  timerTrack: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    borderRadius: 7,
  },
  secondsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
    minWidth: 36,
    textAlign: 'right',
  },
  questionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChip: {
    backgroundColor: '#6B3CFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 10,
  },
  categoryChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  questionText: {
    fontFamily: THEME.fonts.display,
    fontSize: 23,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 29,
  },
  questionTextLarge: {
    fontSize: 27,
    lineHeight: 34,
  },
  optionsContainer: {
    marginTop: 12,
    gap: 10,
  },
  optCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 56,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  optCardSelected: {
    borderWidth: 2,
    borderColor: '#FFC43D',
  },
  optCardCorrect: {
    backgroundColor: 'rgba(37, 168, 104, 0.35)',
    borderWidth: 2,
    borderColor: '#3FD08A',
  },
  optCardWrong: {
    backgroundColor: 'rgba(208, 24, 54, 0.35)',
    borderWidth: 2,
    borderColor: '#FF5C77',
  },
  optCardDimmed: {
    opacity: 0.45,
  },
  optBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optBadgeSelected: {
    backgroundColor: '#FFC43D',
  },
  optBadgeCorrect: {
    backgroundColor: '#25A868',
  },
  optBadgeWrong: {
    backgroundColor: '#D01836',
  },
  choiceTagCorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#25A868',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  choiceTagWrong: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D01836',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  choiceTagAnswer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(63, 208, 138, 0.2)',
    borderWidth: 1,
    borderColor: '#3FD08A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  choiceTagPending: {
    backgroundColor: 'rgba(255, 196, 61, 0.2)',
    borderWidth: 1,
    borderColor: '#FFC43D',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  choiceTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  choiceTagAnswerText: {
    color: '#3FD08A',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  choiceTagPendingText: {
    color: '#FFC43D',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  optBadgeText: {
    fontFamily: THEME.fonts.display,
    fontSize: 16,
    color: '#FFFFFF',
  },
  optText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.extraBold,
  },
  optTextLarge: {
    fontSize: 18,
  },
  fixedBottomStatus: {
    height: 62,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomHintText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
  },
  inlineFeedbackCard: {
    width: '100%',
    backgroundColor: 'rgba(10, 4, 24, 0.78)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  inlineFeedbackTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 14,
  },
  inlineFeedbackSub: {
    color: '#E6DCFF',
    fontSize: 11,
    fontFamily: THEME.fonts.body,
    marginTop: 2,
  },
});