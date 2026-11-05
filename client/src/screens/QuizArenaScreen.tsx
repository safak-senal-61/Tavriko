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
// TRT BİL BAKALIM TARZI PANORAMİK DALGA & TEPE YARIŞ PİSTİ
// (Scenic Bosphorus Bridge & Hill Wave Race Track)
//
// - İlerleme yüzdesi: progressPercentage = (correctAnswers / totalQuestions) * 100
// - Her doğru cevap yarışçıyı dalga eğrisi üzerinde +1 adım zirvedeki bayrağa taşır.
// - Yanlış veya boş cevap 0 adım ilerletir.
// - Her yarışçının yuvarlak avatarı doğrudan beyaz tepe-vadi-zirve dalga eğrisi
//   üzerinde (x, getHillCurveNormY(u) * H) konumlanır; üstünde sıralaması (1., 2., 3.),
//   altında anlık puanı (306, 295, 152...) yazar.
// ---------------------------------------------------------------------------
export interface RacerInfo {
  id: string;
  displayName: string;
  avatarUrl?: string;
  /** Avatarın hemen altında gösterilen anlık puan */
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

const WAVE_TRACK_HEIGHT = 116;
const WAVE_U_START = 0.11;
const WAVE_U_FINISH = 0.87;
const RACER_NODE_W = 48;
const RACER_AVATAR_SIZE = 34;

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

/**
 * TRT Bil Bakalım tepe-vadi-zirve dalga eğrisinin normalize Y koordinatı [0..1].
 * u = 0.00 -> sol giriş (0.67)
 * u = 0.18 -> ilk tepe sırtı (0.43)
 * u = 0.45 -> orta vadi çukuru (0.74)
 * u = 0.87 -> sağ zirve / bitiş bayrağı (0.25)
 * u = 1.00 -> sağ iniş yamacı (0.40)
 */
const HILL_CONTROL_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0.67],
  [0.18, 0.43],
  [0.45, 0.74],
  [WAVE_U_FINISH, 0.25],
  [1.0, 0.4],
];

export const getHillCurveNormY = (uRaw: number): number => {
  const u = Math.max(0, Math.min(1, uRaw));
  for (let i = 0; i < HILL_CONTROL_POINTS.length - 1; i += 1) {
    const [u0, y0] = HILL_CONTROL_POINTS[i];
    const [u1, y1] = HILL_CONTROL_POINTS[i + 1];
    if (u >= u0 && u <= u1) {
      const t = (u - u0) / Math.max(1e-6, u1 - u0);
      const s = 0.5 - 0.5 * Math.cos(Math.PI * t);
      return y0 + (y1 - y0) * s;
    }
  }
  return HILL_CONTROL_POINTS[HILL_CONTROL_POINTS.length - 1][1];
};

/**
 * Aynı doğru sayısındaki yarışçıların eğri üzerinde birbirini kapatmaması için
 * küçük yatay yayılım uygular (asla bir sonraki soru adımına veya bitişe taşmaz).
 */
const computeCurvePositionsU = (
  sortedRacers: RacerInfo[],
  totalQuestions: number
): Record<string, number> => {
  const total = Math.max(1, Math.floor(totalQuestions));
  const span = WAVE_U_FINISH - WAVE_U_START;
  const stepSpan = span / total;

  // Grupları doğru cevap sayısına göre ayır
  const groups: Record<number, RacerInfo[]> = {};
  sortedRacers.forEach((r) => {
    const c = clampCorrect(r.correctAnswers, total);
    (groups[c] = groups[c] || []).push(r);
  });

  const result: Record<string, number> = {};
  Object.entries(groups).forEach(([correctKey, list]) => {
    const c = Number(correctKey);
    const baseU = WAVE_U_START + (c / total) * span;
    if (list.length === 1) {
      result[list[0].id] = baseU;
      return;
    }
    // Aynı adımdaki yarışçıları puana göre yan yana diz (öndeki sağda, arkadaki solda)
    const maxSpread = Math.min(0.055, stepSpan * 0.42);
    const spacing = Math.min(0.036, (maxSpread * 2) / Math.max(1, list.length - 1));
    list.forEach((racer, idx) => {
      // idx=0 en yüksek puanlı -> biraz daha sağda; sonuncu biraz daha solda
      const offsetOrder = (list.length - 1) / 2 - idx;
      let u = baseU + offsetOrder * spacing;
      if (c < total) {
        u = Math.min(WAVE_U_FINISH - stepSpan * 0.25, Math.max(0.06, u));
      } else {
        u = Math.min(WAVE_U_FINISH, Math.max(0.06, u));
      }
      result[racer.id] = u;
    });
  });

  return result;
};

/** Eğri üzerinde (u) değiştiğinde 60 FPS yumuşak geçiş sağlayan hook */
const useAnimatedWaveU = (targetU: number, durationMs: number = 620): number => {
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
      // Cubic ease-out
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

/** Eğri üzerindeki tek yarışçı düğümü: Üstte sıra (1.), ortada ışıklı avatar, altta puan */
const WaveRacerNode: React.FC<{
  racer: RacerInfo;
  rank: number;
  targetU: number;
  trackWidth: number;
  trackHeight: number;
  totalQuestions: number;
}> = ({ racer, rank, targetU, trackWidth, trackHeight, totalQuestions }) => {
  const animU = useAnimatedWaveU(targetU, 620);
  const [showPlusOne, setShowPlusOne] = useState(false);

  const prevCorrectRef = useRef<number>(clampCorrect(racer.correctAnswers, totalQuestions));
  const correctNow = clampCorrect(racer.correctAnswers, totalQuestions);

  useEffect(() => {
    if (correctNow > prevCorrectRef.current || racer.lastAnswer?.isCorrect) {
      setShowPlusOne(true);
      const timer = setTimeout(() => setShowPlusOne(false), 1600);
      prevCorrectRef.current = correctNow;
      return () => clearTimeout(timer);
    }
    prevCorrectRef.current = correctNow;
  }, [correctNow, racer.lastAnswer]);

  const x = animU * trackWidth;
  const y = getHillCurveNormY(animU) * trackHeight;

  const isLeader = rank === 1 && (correctNow > 0 || (racer.score || 0) > 0);
  const isCorrect = racer.lastAnswer?.isCorrect === true;
  const isWrong = racer.lastAnswer?.isCorrect === false;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.waveRacerNode,
        {
          left: x - RACER_NODE_W / 2,
          top: y - RACER_AVATAR_SIZE / 2 - 15,
          zIndex: racer.isMe ? 30 : 20 - rank,
        },
      ]}
    >
      {/* Doğru cevapta yukarı süzülen +1 adım rozeti */}
      {showPlusOne && (
        <View style={styles.wavePlusOneBadge}>
          <Text style={styles.wavePlusOneText}>+1</Text>
        </View>
      )}

      {/* Üstte Sıralama Numarası (1., 2., 3. ...) */}
      <Text
        style={[
          styles.waveRankText,
          isLeader && styles.waveRankTextLeader,
          racer.isMe && styles.waveRankTextMe,
        ]}
        numberOfLines={1}
      >
        {rank}.
      </Text>

      {/* Ortada Yuvarlak Avatar (TRT Bil Bakalım: Sen = Turuncu/Altın halka, Rakipler = Mavi/Beyaz halka) */}
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

      {/* Altta Anlık Puan (306, 297, 152...) */}
      <Text
        style={[
          styles.waveScoreText,
          racer.isMe && styles.waveScoreTextMe,
        ]}
        numberOfLines={1}
      >
        {Math.max(0, Math.round(racer.score || 0))}
      </Text>
    </View>
  );
};

/** TRT Bil Bakalım Tarzı Panoramik Boğaz Köprüsü & Dalga Tepesi Yarış Pisti */
const BilBakalimWaveTrack: React.FC<{
  racers: RacerInfo[];
  totalQuestions: number;
}> = ({ racers, totalQuestions }) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const total = Math.max(1, Math.floor(totalQuestions));
  const H = WAVE_TRACK_HEIGHT;

  // Sıralama: Önce doğru sayısı (pist konumu), eşitlikte puan
  const sorted = useMemo(
    () =>
      racers
        .slice()
        .sort(
          (a, b) =>
            clampCorrect(b.correctAnswers, total) - clampCorrect(a.correctAnswers, total) ||
            (b.score || 0) - (a.score || 0) ||
            (b.isMe ? 1 : 0) - (a.isMe ? 1 : 0)
        ),
    [racers, total]
  );

  const positionsU = useMemo(
    () => computeCurvePositionsU(sorted, total),
    [sorted, total]
  );

  const myRacer = useMemo(
    () => sorted.find((r) => r.isMe) || sorted[0],
    [sorted]
  );
  const myCorrect = myRacer ? clampCorrect(myRacer.correctAnswers, total) : 0;
  const myPct = Math.round(getRaceProgressPercentage(myCorrect, total));

  // SVG Eğri yolunu oluştur (80 örnek nokta ile pürüzsüz dalga)
  const { linePath, areaPath, progressPath, stepDots, finishPoint } = useMemo(() => {
    const W = Math.max(1, trackWidth);
    const samples = 72;
    const pts: Array<{ x: number; y: number; u: number }> = [];
    for (let i = 0; i <= samples; i += 1) {
      const u = i / samples;
      pts.push({
        u,
        x: u * W,
        y: getHillCurveNormY(u) * H,
      });
    }

    const dLine = pts
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');

    const dArea = `${dLine} L ${W.toFixed(1)} ${H.toFixed(1)} L 0 ${H.toFixed(1)} Z`;

    // Liderin veya oyuncunun ulaştığı noktaya kadar parlak vurgu izi
    const maxCorrect = sorted.reduce(
      (acc, r) => Math.max(acc, clampCorrect(r.correctAnswers, total)),
      0
    );
    const leaderU = WAVE_U_START + (maxCorrect / total) * (WAVE_U_FINISH - WAVE_U_START);
    const progPts = pts.filter((p) => p.u >= WAVE_U_START && p.u <= leaderU + 0.005);
    const dProg =
      progPts.length >= 2
        ? progPts
            .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
            .join(' ')
        : '';

    // Soru adımı noktaları (1 .. total-1)
    const tickStep = total > 15 ? 2 : 1;
    const dots: Array<{ step: number; x: number; y: number; passed: boolean }> = [];
    for (let s = 1; s < total; s += tickStep) {
      const u = WAVE_U_START + (s / total) * (WAVE_U_FINISH - WAVE_U_START);
      dots.push({
        step: s,
        x: u * W,
        y: getHillCurveNormY(u) * H,
        passed: maxCorrect >= s,
      });
    }

    const finX = WAVE_U_FINISH * W;
    const finY = getHillCurveNormY(WAVE_U_FINISH) * H;

    return {
      linePath: dLine,
      areaPath: dArea,
      progressPath: dProg,
      stepDots: dots,
      finishPoint: { x: finX, y: finY },
    };
  }, [trackWidth, H, sorted, total]);

  // Boğaz Köprüsü & Silüet koordinatları
  const W = Math.max(300, trackWidth);
  const tower1X = W * 0.28;
  const tower2X = W * 0.56;
  const deckY = H * 0.48;

  return (
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
              <LinearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#4F3FD6" />
                <Stop offset="0.55" stopColor="#3F2EB8" />
                <Stop offset="1" stopColor="#2A1B86" />
              </LinearGradient>
              <LinearGradient id="hillFillGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#7260EE" stopOpacity="0.65" />
                <Stop offset="0.5" stopColor="#523EC8" stopOpacity="0.82" />
                <Stop offset="1" stopColor="#332096" stopOpacity="0.96" />
              </LinearGradient>
              <LinearGradient id="activeWaveGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#60A5FA" />
                <Stop offset="0.5" stopColor="#FBBF24" />
                <Stop offset="1" stopColor="#34D399" />
              </LinearGradient>
            </Defs>

            {/* 1. Gökyüzü Arka Planı */}
            <Rect x={0} y={0} width={trackWidth} height={H} fill="url(#skyGrad)" />

            {/* 2. Arka Plan Boğaz Köprüsü & Şehir Silüeti (TRT Bil Bakalım estetiği) */}
            <G opacity={0.32}>
              {/* Uzak Şehir & Cami/Kule Silüetleri */}
              <Rect x={W * 0.04} y={H * 0.36} width={W * 0.04} height={H * 0.4} fill="#1E115A" rx={2} />
              <Rect x={W * 0.09} y={H * 0.28} width={W * 0.035} height={H * 0.45} fill="#1E115A" rx={2} />
              <Rect x={W * 0.63} y={H * 0.32} width={W * 0.045} height={H * 0.42} fill="#1E115A" rx={2} />
              <Rect x={W * 0.69} y={H * 0.38} width={W * 0.035} height={H * 0.36} fill="#1E115A" rx={2} />

              {/* Boğaz Köprüsü Kuleleri */}
              <Rect x={tower1X - 3} y={H * 0.08} width={6} height={H * 0.62} fill="#1B0E54" rx={1.5} />
              <Rect x={tower2X - 3} y={H * 0.14} width={6} height={H * 0.56} fill="#1B0E54" rx={1.5} />

              {/* Köprü Tabliyesi */}
              <Line
                x1={W * 0.12}
                y1={deckY}
                x2={W * 0.68}
                y2={deckY}
                stroke="#1B0E54"
                strokeWidth={3}
              />

              {/* Köprü Ana Askı Halatları (Parabolik) */}
              <Path
                d={`M ${W * 0.12} ${deckY} Q ${W * 0.21} ${deckY - 4} ${tower1X} ${H * 0.1} Q ${(tower1X + tower2X) / 2} ${deckY + 2} ${tower2X} ${H * 0.16} Q ${W * 0.62} ${deckY - 4} ${W * 0.68} ${deckY}`}
                stroke="#1B0E54"
                strokeWidth={2}
                fill="none"
              />

              {/* Dikey Askı Halatları */}
              {[0.32, 0.36, 0.4, 0.44, 0.48, 0.52].map((uCab) => (
                <Line
                  key={uCab}
                  x1={W * uCab}
                  y1={H * 0.24}
                  x2={W * uCab}
                  y2={deckY}
                  stroke="#1B0E54"
                  strokeWidth={1}
                />
              ))}
            </G>

            {/* 3. Dalga Eğrisi Altındaki 3B Tepe Dolgusu */}
            <Path d={areaPath} fill="url(#hillFillGrad)" />

            {/* 4. Beyaz Dalga Yolu Dış Işıması */}
            <Path
              d={linePath}
              stroke="rgba(255, 255, 255, 0.26)"
              strokeWidth={8}
              fill="none"
              strokeLinecap="round"
            />

            {/* 5. Ana Beyaz Dalga Yolu */}
            <Path
              d={linePath}
              stroke="#FFFFFF"
              strokeWidth={3.5}
              fill="none"
              strokeLinecap="round"
            />

            {/* 6. Aktif İlerleme İzi */}
            {progressPath ? (
              <Path
                d={progressPath}
                stroke="url(#activeWaveGrad)"
                strokeWidth={4}
                fill="none"
                strokeLinecap="round"
              />
            ) : null}

            {/* 7. Soru Adımı Noktaları */}
            {stepDots.map((d) => (
              <Circle
                key={d.step}
                cx={d.x}
                cy={d.y}
                r={d.passed ? 3 : 2.2}
                fill={d.passed ? '#FBBF24' : 'rgba(255,255,255,0.65)'}
              />
            ))}

            {/* 8. Zirvedeki Bitiş Bayrağı (%100 = totalQuestions doğru) */}
            <G>
              <Circle
                cx={finishPoint.x}
                cy={finishPoint.y}
                r={5}
                fill="#FFFFFF"
                stroke="#F59E0B"
                strokeWidth={2}
              />
              {/* Bayrak Direği */}
              <Line
                x1={finishPoint.x}
                y1={finishPoint.y - 2}
                x2={finishPoint.x}
                y2={finishPoint.y - 23}
                stroke="#FFFFFF"
                strokeWidth={2.4}
                strokeLinecap="round"
              />
              {/* Dalgalanan Beyaz/Altın Bitiş Bayrağı */}
              <Path
                d={`M ${finishPoint.x} ${finishPoint.y - 23} C ${finishPoint.x + 6} ${finishPoint.y - 25}, ${finishPoint.x + 11} ${finishPoint.y - 19}, ${finishPoint.x + 16} ${finishPoint.y - 21} L ${finishPoint.x + 14} ${finishPoint.y - 12} C ${finishPoint.x + 9} ${finishPoint.y - 10}, ${finishPoint.x + 5} ${finishPoint.y - 15}, ${finishPoint.x} ${finishPoint.y - 13} Z`}
                fill="#FFFFFF"
              />
            </G>
          </Svg>

          {/* Sol Üst Bilgi Rozeti: Doğru Sayısı / Toplam Soru & Yüzde */}
          <View style={styles.waveOverlayHeader} pointerEvents="none">
            <View style={styles.waveStepBadge}>
              <Text style={styles.waveStepBadgeText}>
                🏁 {myCorrect}/{total} Doğru · %{myPct}
              </Text>
            </View>
          </View>

          {/* Eğri Üzerinde Hareket Eden Yarışçı Madalyonları */}
          {sorted.map((racer, idx) => (
            <WaveRacerNode
              key={racer.id}
              racer={racer}
              rank={idx + 1}
              targetU={positionsU[racer.id] ?? WAVE_U_START}
              trackWidth={trackWidth}
              trackHeight={H}
              totalQuestions={total}
            />
          ))}
        </>
      )}
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
          <Text style={styles.scorePillText}>{currentScore}</Text>
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
  // TRT BİL BAKALIM TARZI PANORAMİK DALGA & TEPE PİSTİ
  bilBakalimWrapper: {
    height: WAVE_TRACK_HEIGHT,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#3B28A8',
    borderWidth: 1.5,
    borderColor: 'rgba(167, 139, 250, 0.42)',
    position: 'relative',
    marginTop: 4,
    shadowColor: '#1E115A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  waveOverlayHeader: {
    position: 'absolute',
    top: 6,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 40,
  },
  waveStepBadge: {
    backgroundColor: 'rgba(19, 10, 56, 0.58)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  waveStepBadgeText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.3,
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
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    zIndex: 50,
  },
  wavePlusOneText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontFamily: THEME.fonts.extraBold,
  },
  waveRankText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontFamily: THEME.fonts.extraBold,
    marginBottom: 1,
    textShadowColor: 'rgba(10, 4, 36, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  waveRankTextLeader: {
    color: '#FDE047',
  },
  waveRankTextMe: {
    color: '#FDBA74',
  },
  waveAvatarOuterGlow: {
    padding: 2,
    borderRadius: (RACER_AVATAR_SIZE + 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveAvatarGlowMe: {
    backgroundColor: 'rgba(255, 159, 28, 0.32)',
    shadowColor: '#FF9F1C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  waveAvatarGlowOther: {
    backgroundColor: 'rgba(125, 211, 252, 0.28)',
    shadowColor: '#7DD3FC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 5,
  },
  waveAvatarGlowCorrect: {
    backgroundColor: 'rgba(52, 211, 153, 0.42)',
    shadowColor: '#34D399',
  },
  waveAvatarGlowWrong: {
    backgroundColor: 'rgba(251, 113, 133, 0.42)',
    shadowColor: '#FB7185',
  },
  waveAvatarRing: {
    width: RACER_AVATAR_SIZE,
    height: RACER_AVATAR_SIZE,
    borderRadius: RACER_AVATAR_SIZE / 2,
    borderWidth: 2.5,
    backgroundColor: '#1E1354',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  waveAvatarRingMe: {
    borderColor: '#FF9F1C',
  },
  waveAvatarRingOther: {
    borderColor: '#7DD3FC',
  },
  waveAvatarRingCorrect: {
    borderColor: '#34D399',
  },
  waveAvatarRingWrong: {
    borderColor: '#FB7185',
  },
  waveAnsweredDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveAnsweredDotText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontFamily: THEME.fonts.extraBold,
  },
  waveScoreText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 1,
    textShadowColor: 'rgba(10, 4, 36, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  waveScoreTextMe: {
    color: '#FDE68A',
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