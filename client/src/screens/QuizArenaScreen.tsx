import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AppState,
  AppStateStatus,
  useWindowDimensions,
  Image,
  Platform,
  ScrollView,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { trackEvent } from '../services/analytics';
import { loadStoredPreferences } from '../store/appPrefs';
import { canUseJoker, ClientQuestion, ALL_CATEGORIES, JOKERS, JokerEffect, JokerId, LIGHTNING_WINDOW_MS, UserProfile } from '@trivia/shared';
import { JokerPurchasePanel } from '../components/WalletPanels';
import { WalletArtwork } from '../components/WalletArtwork';
import { ArrowUpRight, Flag } from 'lucide-react-native';
import {
  TavrikoScreen,
  StreakFlameIcon,
  CheckMarkSvg,
  CrossMarkSvg,
  CharacterAvatar,
  CloseXIcon,
} from '../components/TavrikoIcons';
import { GradientFill } from '../components/TavrikoGradient';
import { DISCOVER_CATEGORY_IMG, DISCOVER_SUBCATEGORY_IMG } from '../components/DiscoverArtwork';
export type QuestionAnswerState =
  | 'answerable'
  | 'submitting'
  | 'correct'
  | 'incorrect'
  | 'timed_out';
export interface RoundFeedback {
  skipped?: boolean;
  isCorrect: boolean;
  isTimeout: boolean;
  unavailable?: boolean;
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
  isMultiplayer?: boolean;
  streak: number;
  currentScore: number;
  feedback?: RoundFeedback | null;
  jokerRetry?: { at: number; hint: string };
  onSelectOption: (optionId: string, timeRemainingMs: number) => void;
  onTimeExpired?: () => void;
  onExit?: () => void;
  /** Otomatik sonraki soru kapalıyken gösterilen "Sonraki Soru" düğmesinin eylemi */
  onNext?: () => void;
  jokers?: { user: UserProfile; apply: (id: JokerId) => Promise<JokerEffect>; buy: (id: JokerId) => Promise<void> };
  isDuelMode?: boolean;
  myDisplayName?: string;
  /** Profil fotoğrafı yoksa karakter avatarı seçmek için tohum (avatarUrl veya isim) */
  myAvatarUrl?: string;
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
// Dairesel Geri Sayım Halkası (30 FPS, Android/iOS/Web güvenilir)
// Eski SmoothTimerBar ile aynı zamanlama mantığı; görünüm halka biçiminde.
// ---------------------------------------------------------------------------
interface CircularTimerProps {
  totalMs: number;
  endTime: number;
  isActive: boolean;
  secondsLeft: number;
  onTimeExpired: () => void;
  onSecondChange: (sec: number) => void;
  size?: number;
  pauseUntil?: number;
}

const CircularTimer: React.FC<CircularTimerProps> = React.memo(
  ({ totalMs, endTime, isActive, secondsLeft, onTimeExpired, onSecondChange, size = 96, pauseUntil = 0 }) => {
    const [progressPct, setProgressPct] = useState<number>(100);
    const hasExpiredRef = useRef<boolean>(false);
    const onTimeExpiredRef = useRef(onTimeExpired);
    onTimeExpiredRef.current = onTimeExpired;
    const onSecondChangeRef = useRef(onSecondChange);
    onSecondChangeRef.current = onSecondChange;
    const lastSecRef = useRef<number>(Math.ceil(totalMs / 1000));
    useEffect(() => {
      hasExpiredRef.current = false;
      lastSecRef.current = Math.ceil(totalMs / 1000);
      const initRemMs = Math.max(0, endTime - Math.max(Date.now(), pauseUntil));
      setProgressPct(Math.max(0, Math.min(100, (initRemMs / totalMs) * 100)));
      if (!isActive) return;
      const interval = setInterval(() => {
        const remainingMs = Math.max(0, endTime - Math.max(Date.now(), pauseUntil));
        setProgressPct(Math.max(0, Math.min(100, (remainingMs / totalMs) * 100)));
        const sec = Math.ceil(remainingMs / 1000);
        if (sec !== lastSecRef.current) {
          lastSecRef.current = sec;
          onSecondChangeRef.current(sec);
        }
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
    }, [totalMs, endTime, isActive, pauseUntil]);

    const isCritical = secondsLeft <= 3;
    const isWarning = !isCritical && secondsLeft <= 6;
    const ringColor = isCritical ? '#FF5A6A' : isWarning ? '#FF9B2F' : '#FFC43D';
    // Keep the ring thin relative to its diameter, including the group header.
    const strokeWidth = Math.max(2.5, Math.min(5, size * 0.07));
    const r = (size - strokeWidth) / 2;
    const c = 2 * Math.PI * r;
    const dashOffset = c * (1 - progressPct / 100);
    return (
      <View style={[styles.timerWrap, { width: size, height: size, shadowColor: ringColor }]}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="qaTimerInner" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#3A1C86" />
              <Stop offset="1" stopColor="#170A38" />
            </LinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={r - strokeWidth / 2 - 1} fill="url(#qaTimerInner)" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(154, 107, 255, 0.28)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.timerCenter}>
            <Text style={[styles.timerNumber, { fontSize: Math.round(size * 0.4) }, isCritical && { color: '#FF7A8A' }]}>
              {Math.max(0, secondsLeft)}
            </Text>
          </View>
        </View>
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// TAVRİKO ZİRVE YARIŞI
// - Tüm oyuncular 0. adımdan başlar; ilerleme = doğru sayısı / toplam soru.
// - Yanlış veya boş cevap ilerletmez.
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

const WAVE_U_START = 0.08;
const WAVE_U_FINISH = 0.91;

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

const RACE_LANE_COLORS = ['#38BDF8', '#B26BFF', '#FF6BC4', '#5ADBB5', '#FF9B2F', '#FFC43D'];
const RACE_MARKER = 24;

/**
 * Zirve Yarışı şerit göstergesi: oyuncu sayısı arttıkça şeritler küçülür ki
 * 8 kişilik odada bile TÜM oyuncuların barı ekrana sığsın (4 şeritle kesilmez).
 */
const raceMarkerSize = (playerCount: number, compact: boolean): number => {
  if (playerCount >= 7) return 14;
  if (playerCount >= 5) return 16;
  return compact ? 20 : RACE_MARKER;
};

/** Tek şerit: doğru sayısı arttığında avatar yay animasyonuyla ileri kayar ve "+1" belirir */
const RaceLane: React.FC<{
  racer: RacerInfo;
  color: string;
  marker: number;
  trackHeight: number;
  laneWidth: number;
  x: number;
  correct: number;
}> = ({ racer, color, marker, trackHeight, laneWidth, x, correct }) => {
  const pos = useSharedValue(x);
  const pop = useSharedValue(1);
  const bubble = useSharedValue(0);
  const prevCorrect = useRef(correct);
  const firstLayout = useRef(true);

  useEffect(() => {
    if (laneWidth <= 0) return;
    if (firstLayout.current) {
      // İlk ölçümde zıplama olmadan doğrudan konumla
      firstLayout.current = false;
      pos.value = x;
    } else {
      pos.value = withSpring(x, { damping: 16, stiffness: 120, mass: 0.9 });
    }
    if (correct > prevCorrect.current) {
      pop.value = withSequence(withTiming(1.28, { duration: 160 }), withSpring(1, { damping: 7 }));
      bubble.value = 0;
      bubble.value = withSequence(
        withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }),
        withDelay(520, withTiming(0, { duration: 260 }))
      );
    }
    prevCorrect.current = correct;
  }, [x, correct, laneWidth]);

  const fillStyle = useAnimatedStyle(() => ({ width: pos.value + marker / 2 }));
  const markerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value }, { scale: pop.value }],
  }));
  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: bubble.value,
    transform: [{ translateX: pos.value + marker + 4 + bubble.value * 6 }, { scale: 0.7 + bubble.value * 0.3 }],
  }));

  return (
    <View style={[styles.raceLane, { height: marker }]}>
      <View style={[styles.raceLaneTrack, { height: trackHeight, borderRadius: trackHeight / 2 }]} />
      <Animated.View
        style={[
          styles.raceLaneFill,
          { backgroundColor: color, shadowColor: color, height: trackHeight, borderRadius: trackHeight / 2 },
          fillStyle,
        ]}
      />
      {laneWidth > 0 && (
        <>
          <Animated.View
            style={[
              styles.raceMarker,
              { left: 0, width: marker, height: marker, borderRadius: marker / 2, borderColor: color, shadowColor: color },
              racer.lastAnswer?.isCorrect === false && { borderColor: '#FF5A6A' },
              markerStyle,
            ]}
          >
            <CharacterAvatar seed={racer.avatarUrl || racer.displayName} size={marker - 4} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.raceBubble, bubbleStyle]}>
            <Text style={styles.raceBubbleText}>+1</Text>
          </Animated.View>
        </>
      )}
    </View>
  );
};

/** Yatay şerit tabanlı Zirve Yarışı: her oyuncu kendi şeridinde bayrağa ilerler */
const SummitRaceTrack: React.FC<{
  racers: RacerInfo[];
  totalQuestions: number;
  compact?: boolean;
  /** 5+ oyuncu: kart içi boşluklar ve şerit aralıkları sıkılaştırılır */
  dense?: boolean;
  /** Dense moddaki orantılı küçültme katsayısı (1 = küçültme yok) */
  scale?: number;
}> = ({ racers, totalQuestions, compact = false, dense = false, scale = 1 }) => {
  const marker = Math.max(8, Math.round(raceMarkerSize(racers.length, compact) * scale));
  // Şerit kalınlığı göstergelerle birlikte küçülür; 8 kişilik odada bile sığar.
  const trackHeight = Math.max(5, Math.min(8, Math.round(marker * 0.42)));
  const [laneWidth, setLaneWidth] = useState(0);
  const maxRacerCorrect = racers.reduce(
    (acc, r) => Math.max(acc, Math.floor(Number.isFinite(r.correctAnswers) ? r.correctAnswers : 0)),
    0
  );
  const total = Math.max(1, Math.floor(totalQuestions), maxRacerCorrect);
  // Sıralama: önce doğru sayısı, eşitlikte puan; "ben" her zaman ilk şeritte
  const sorted = useMemo(
    () =>
      racers
        .slice()
        .sort(
          (a, b) =>
            clampCorrect(b.correctAnswers, total) - clampCorrect(a.correctAnswers, total) ||
            formatCleanScore(b.score || 0, b.correctAnswers, total) -
              formatCleanScore(a.score || 0, a.correctAnswers, total)
        ),
    [racers, total]
  );
  const lanes = useMemo(() => {
    const me = sorted.find((r) => r.isMe);
    const others = sorted.filter((r) => !r.isMe);
    // Tüm oyuncular kendi şeridinde gösterilir (sınır yok)
    return me ? [me, ...others] : others;
  }, [sorted]);
  const me = sorted.find((r) => r.isMe);
  const myCorrect = me ? clampCorrect(me.correctAnswers, total) : 0;

  return (
    <View
      style={[
        styles.raceCard,
        compact && { paddingTop: 4, paddingBottom: 6 },
        dense && {
          borderWidth: 1,
          borderRadius: 14,
          paddingHorizontal: 8,
          paddingTop: Math.max(2, Math.round(3 * scale)),
          paddingBottom: Math.max(3, Math.round(4 * scale)),
          gap: Math.max(1, Math.round(2 * scale)),
        },
      ]}
    >
      <View style={styles.raceTitleRow}>
        <Text style={styles.raceTitle}>ZİRVE YARIŞI</Text>
        <View style={[styles.raceStepChip, dense && { paddingHorizontal: 5, paddingVertical: 0 }]}>
          <Text style={styles.raceStepChipText}>
            {myCorrect}/{total} Doğru
          </Text>
        </View>
      </View>
      <View style={styles.raceBody}>
        <View
          style={[styles.raceLanes, dense && { gap: 1 }]}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && Math.abs(w - laneWidth) > 0.5) setLaneWidth(w);
          }}
        >
          {lanes.map((racer, idx) => {
            const color = racer.isMe ? RACE_LANE_COLORS[0] : RACE_LANE_COLORS[(idx % (RACE_LANE_COLORS.length - 1)) + 1];
            const pct = getRaceProgressPercentage(racer.correctAnswers, total) / 100;
            const usable = Math.max(0, laneWidth - marker);
            const x = usable * pct;
            return (
              <RaceLane
                key={racer.id}
                racer={racer}
                color={color}
                marker={marker}
                trackHeight={trackHeight}
                laneWidth={laneWidth}
                x={x}
                correct={clampCorrect(racer.correctAnswers, total)}
              />
            );
          })}
        </View>
        <View style={[styles.raceFlag, dense && { width: 18 }]}>
          <Flag size={dense ? 13 : 16} color="#FFD178" />
        </View>
      </View>
    </View>
  );
};

/** Skor tablosundaki oyuncu bloğu (avatar + isim + puan) */
const DuelPlayerBlock: React.FC<{
  name: string;
  avatarSeed: string;
  score: number;
  side: 'me' | 'opponent';
  isLeading?: boolean;
  showLeaderSlot?: boolean;
  hasAnswered?: boolean;
  badge?: string | null;
  compact?: boolean;
}> = ({ name, avatarSeed, score, side, isLeading, showLeaderSlot, hasAnswered, badge, compact = false }) => {
  const ring = compact ? 60 : 76;
  const isMe = side === 'me';
  const color = isLeading ? '#F5CA79' : isMe ? '#38BDF8' : '#C06BFF';
  return (
    <View style={styles.playerBlock}>
      <View
        style={[
          styles.playerAvatarRing,
          { width: ring, height: ring, borderRadius: ring / 2, borderColor: color, shadowColor: color },
        ]}
      >
        <CharacterAvatar seed={avatarSeed} size={ring - 10} />
        {hasAnswered && (
          <View style={styles.playerAnsweredDot}>
            <CheckMarkSvg size={12} color="#FFFFFF" />
          </View>
        )}
      </View>
      <View style={[styles.playerNamePill, { borderColor: `${color}AA` }]}>
        <Text style={styles.playerNameText} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <Text
        style={[styles.playerScore, compact && styles.playerScoreCompact, { color: isLeading ? '#FFDE9A' : isMe ? '#5FE1FF' : '#D9B8FF' }]}
        numberOfLines={1}
      >
        {score}
      </Text>
      {showLeaderSlot && <View style={styles.leaderSlot}>{isLeading && <LeaderTag />}</View>}
      {badge ? (
        <View style={styles.playerBadge}>
          <Text style={styles.playerBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
};

function LeaderTag() {
  return <View style={styles.leaderTag}>
    <ArrowUpRight color="#FFDE9A" size={12} />
    <Text style={styles.leaderText}>Önde</Text>
  </View>;
}

/**
 * Çok kişili odada avatar, isim ve puan dikey ve birbirinden bağımsız hizalanır.
 */
const MiniPlayerBlock: React.FC<{
  name: string;
  avatarSeed: string;
  score: number;
  isMe: boolean;
  ringSize: number;
  dense?: boolean;
  isLeading?: boolean;
  hasAnswered?: boolean;
  badge?: string | null;
}> = ({ name, avatarSeed, score, isMe, ringSize, dense, isLeading, hasAnswered, badge }) => {
  const color = isLeading ? '#F5CA79' : isMe ? '#38BDF8' : '#C06BFF';
  const dot = Math.max(dense ? 11 : 13, Math.round(ringSize * 0.3));
  const ringBorder = Math.max(2, Math.round(ringSize * 0.07));
  const nameSize = Math.max(9, Math.round(ringSize * 0.22));
  const scoreSize = Math.max(11, Math.round(ringSize * 0.28));
  return (
    <View style={[styles.miniPlayerBlock, dense && styles.miniPlayerDense, isLeading && styles.miniPlayerLeading]} accessible accessibilityLabel={`${name}, ${score} puan${isLeading ? ', önde' : ''}${hasAnswered ? ', cevapladı' : ''}`}>
      <View
        style={[
          styles.playerAvatarRing,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderWidth: ringBorder,
            borderColor: color,
            shadowColor: color,
            shadowRadius: 8,
            elevation: 5,
          },
        ]}
      >
        <CharacterAvatar seed={avatarSeed} size={ringSize - ringBorder * 2 - 2} />
        {hasAnswered && (
          <View
            style={[
              styles.playerAnsweredDot,
              { width: dot, height: dot, borderRadius: dot / 2, borderWidth: 1.5 },
            ]}
          >
            <CheckMarkSvg size={Math.round(dot * 0.67)} color="#FFFFFF" />
          </View>
        )}
      </View>
        <Text
          style={[styles.playerNameText, styles.miniPlayerName, { fontSize: nameSize }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {name}
        </Text>
        <Text
          style={[styles.miniPlayerScore, {
            color: isLeading ? '#FFDE9A' : isMe ? '#5FE1FF' : '#D9B8FF',
            fontSize: scoreSize,
          }]}
          numberOfLines={1}
        >
          {score}
        </Text>
      {badge ? (
        <Text style={styles.miniStreak} numberOfLines={1}>{badge}</Text>
      ) : null}
    </View>
  );
};

export const QuizArenaScreen: React.FC<QuizArenaScreenProps> = ({
  question,
  selectedOptionId,
  isLocked,
  isMultiplayer = false,
  streak,
  currentScore,
  feedback,
  jokerRetry,
  onSelectOption,
  onTimeExpired,
  onExit,
  onNext,
  jokers,
  isDuelMode = false,
  myDisplayName = 'Sen',
  myAvatarUrl,
  opponent = null,
  dailyChallengeInfo = null,
  racers: racersProp,
}) => {
  // Yarış pisti (Zirve Yarışı) YALNIZCA çok oyunculu modlarda (1v1 Düello / Özel Oda) gösterilir;
  // tek kişilik oyunda (Keşfet / Günlük Görev) hiç gösterilmez.
  const activeRacers: RacerInfo[] = useMemo(() => {
    if (racersProp && racersProp.length > 0) {
      return racersProp;
    }
    return [];
  }, [racersProp]);
  const [localSelectedOptionId, setLocalSelectedOptionId] = useState<string | null>(null);
  const [jokersOpen, setJokersOpen] = useState(false);
  const [jokerBusy, setJokerBusy] = useState(false);
  const [buyingJoker, setBuyingJoker] = useState<JokerId>();
  const [applyingJokerRound, setApplyingJokerRound] = useState<string>();
  const [jokerError, setJokerError] = useState<string>();
  const [jokerResult, setJokerResult] = useState<{ key: string; effect: JokerEffect }>();
  const jokerLock = useRef(false);
  const purchaseLock = useRef(false);
  const arenaScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const jokerRound = `${question.id}:${question.roundNumber}:${question.jokerProof ?? question.jokerRoundStartedAt ?? ''}`;
  const jokerApplying = applyingJokerRound === jokerRound;
  const jokerEffect = (jokerResult?.key === jokerRound ? jokerResult.effect : undefined) ?? question.jokerEffect;
  const eliminated = jokerEffect?.eliminated ?? [];
  const jokerRoundRef = useRef(jokerRound);
  jokerRoundRef.current = jokerRound;
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
  const [endTime, setEndTime] = useState<number>(() => Date.now() + (question.timeRemainingMs ?? totalMs));
  const endTimeRef = useRef<number>(endTime);
  const serverDeadlineRef = useRef(0);
  const [localPauseUntil, setLocalPauseUntil] = useState(0);
  const [clockPaused, setClockPaused] = useState(false);
  const frozen = question.jokerFrozen === true && clockPaused;
  const skipped = question.jokerSkipped === true || jokerEffect?.action === 'skip';
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
      // PostHog: soru bazlı başarı — zorluk dengesinin ana veri kaynağı
      if (!feedback.unavailable) trackEvent('question_answered', {
        question_id: question.id,
        category: question.categoryId,
        correct: feedback.isCorrect,
        timeout: feedback.isTimeout,
        streak: feedback.streak,
        points_awarded: feedback.pointsAwarded,
      });
    }
  }, [feedback]);
  // When question changes, reset time, answer state, and timer cleanly
  useEffect(() => {
    hasExpiredRef.current = false;
    serverDeadlineRef.current = 0;
    arenaScrollRef.current?.scrollTo({ y: 0, animated: false });
    setJokersOpen(false);
    setJokerError(undefined);
    setLocalSelectedOptionId(null);
    const remainingMs = question.timeRemainingMs ?? totalMs;
    const newEndTime = Date.now() + remainingMs;
    endTimeRef.current = newEndTime;
    setEndTime(newEndTime);
    setSecondsLeft(Math.ceil(remainingMs / 1000));
    setAnswerState('answerable');
  }, [jokerRound, totalMs]);
  useEffect(() => {
    if (answerState !== 'answerable' || isLocked || feedback || frozen || skipped) setJokersOpen(false);
  }, [answerState, isLocked, feedback, frozen, skipped]);
  useEffect(() => {
    if (!jokerRetry || feedback || endTimeRef.current <= Date.now()) return;
    setLocalSelectedOptionId(null);
    setAnswerState('answerable');
  }, [jokerRetry, feedback]);
  useEffect(() => {
    const remaining = Math.max(0, question.jokerPauseRemainingMs ?? 0);
    setLocalPauseUntil(remaining ? Date.now() + remaining : 0);
    setClockPaused(remaining > 0);
    if (remaining > 0) {
      const timer = setTimeout(() => setClockPaused(false), remaining);
      return () => clearTimeout(timer);
    }
  }, [jokerRound, question.jokerPauseUntil, question.jokerPauseRemainingMs]);
  const useJokerAction = async (id: JokerId, buy: boolean) => {
    if (!jokers || jokerLock.current || purchaseLock.current || isOptionsDisabled || (!buy && jokerEffect)) return;
    const tapTime = Date.now();
    if (tapTime >= endTimeRef.current) {
      setJokerError('Bu sorunun süresi doldu.');
      return;
    }
    if (buy) {
      purchaseLock.current = true;
      setBuyingJoker(id);
    } else {
      jokerLock.current = true;
      setApplyingJokerRound(jokerRound);
      setJokerBusy(true);
    }
    sound.triggerHaptic('light');
    setJokerError(undefined);
    try {
      if (buy) {
        await jokers.buy(id);
        if (jokerRoundRef.current === jokerRound) setJokersOpen(false);
      } else {
        const effect = await jokers.apply(id);
        if (jokerRoundRef.current === jokerRound) {
          if (!isMultiplayer) {
            const now = Date.now();
            const deadline = endTimeRef.current + Math.min(2000, Math.max(0, now - tapTime));
            endTimeRef.current = deadline;
            setEndTime(deadline);
            setSecondsLeft(Math.ceil(Math.max(0, deadline - now) / 1000));
          }
          setJokerResult({ key: jokerRound, effect });
          setJokersOpen(false);
        }
      }
    } catch (error) {
      if (jokerRoundRef.current === jokerRound) {
        setJokerError(error instanceof Error ? error.message : 'İşlem tamamlanamadı.');
      }
    } finally {
      if (buy) {
        purchaseLock.current = false;
        setBuyingJoker(undefined);
      } else {
        jokerLock.current = false;
        setJokerBusy(false);
        setApplyingJokerRound(undefined);
      }
    }
  };
  useEffect(() => {
    if (question.timeRemainingMs === undefined) return;
    // Only a newer authoritative deadline can extend a running round.
    const allowExtension = !!question.jokerDeadline && question.jokerDeadline > serverDeadlineRef.current;
    if (question.jokerDeadline) serverDeadlineRef.current = Math.max(serverDeadlineRef.current, question.jokerDeadline);
    const proposal = Date.now() + question.timeRemainingMs;
    const syncedEnd = allowExtension ? proposal : Math.min(endTimeRef.current, proposal);
    endTimeRef.current = syncedEnd;
    setEndTime(syncedEnd);
    setSecondsLeft(Math.ceil(Math.max(0, syncedEnd - Date.now() - (question.jokerPauseRemainingMs ?? 0)) / 1000));
    if (allowExtension && hasExpiredRef.current && syncedEnd > Date.now()) {
      hasExpiredRef.current = false;
      setAnswerState('answerable');
    }
  }, [jokerRound, question.timeRemainingMs, question.jokerDeadline, question.jokerPauseRemainingMs]);
  // AppState background/foreground synchronization
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (
          nextAppState === 'active' &&
          !hasExpiredRef.current &&
          !jokerApplying &&
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
  }, [answerState, jokerApplying]);
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
    if (sec <= 5 && sec > 0) {
      // Settings > "Süre Uyarı Sesi" (son 5 saniye) — kapalıysa geri sayım tiki çalınmaz
      const alertOn = loadStoredPreferences().timerAlertSound !== false;
      if (alertOn) {
        sound.playSound('timer_tick');
      }
    }
  }, []);
  const handleSelect = (optionId: string) => {
    if (
      answerState !== 'answerable' ||
      isLocked ||
      jokerLock.current ||
      frozen ||
      skipped ||
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
    isLocked ||
    frozen ||
    skipped ||
    !!feedback ||
    hasExpiredRef.current ||
    secondsLeft <= 0;
  const lightningAvailable = totalMs - Math.max(0, endTimeRef.current - Date.now()) < LIGHTNING_WINDOW_MS;
  const ownedJokers = jokers && !jokerEffect && !isOptionsDisabled
    ? JOKERS.flatMap(joker => {
      const qty = jokers.user.inventory?.find(item => item.id === joker.id)?.qty ?? 0;
      if (qty <= 0) return [];
      const usable = canUseJoker(joker.id, question.options, {
        live: isMultiplayer, tactics: question.jokerTactics, capabilities: question.jokerCapabilities, lightningAvailable,
      });
      return [{ ...joker, qty, usable }];
    }).sort((a, b) => Number(b.usable) - Number(a.usable)) : [];
  const totalRounds = question.totalRounds || 10;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const compact = windowHeight < 800;
  const tiny = windowHeight < 690;
  const wideAnswers = Platform.OS === 'web' && windowWidth >= 700;
  const myRacer = activeRacers.find((r) => r.isMe);
  const myScore = formatCleanScore(currentScore, myRacer?.correctAnswers || 0, totalRounds);
  const rightPlayer = useMemo(() => {
    if (opponent) {
      const racer = activeRacers.find((r) => r.id === opponent.id);
      return {
        name: opponent.displayName,
        avatarSeed: opponent.avatarUrl || opponent.displayName,
        score: formatCleanScore(
          racer?.score ?? opponent.score ?? 0,
          racer?.correctAnswers || 0,
          totalRounds
        ),
        hasAnswered: Boolean(opponent.hasAnswered ?? racer?.hasAnswered),
      };
    }
    const others = activeRacers.filter((r) => !r.isMe);
    if (others.length === 0) return null;
    const best = others
      .slice()
      .sort((a, b) => (b.score || 0) - (a.score || 0) || b.correctAnswers - a.correctAnswers)[0];
    return {
      name: others.length > 1 ? `${best.displayName} +${others.length - 1}` : best.displayName,
      avatarSeed: best.avatarUrl || best.displayName,
      score: formatCleanScore(best.score || 0, best.correctAnswers, totalRounds),
      hasAnswered: Boolean(best.hasAnswered),
    };
  }, [opponent, activeRacers, totalRounds]);
  const myAnswered = !!(selectedOptionId || localSelectedOptionId);
  // 3+ kişilik özel odalarda TÜM oyuncuların profili tek alanda gösterilir;
  // oyuncu sayısı arttıkça bloklar küçültülerek ekrana sığdırılır.
  const multiPlayers = useMemo(() => {
    if (activeRacers.length <= 2) return [];
    const me = activeRacers.find((r) => r.isMe);
    // Keep player positions stable as scores change.
    const others = activeRacers.filter((r) => !r.isMe);
    return me ? [me, ...others] : others;
  }, [activeRacers]);
  const playerCount = activeRacers.length;
  // Kalabalık odalarda yüksek ekranlarda da küçült; kısa ekranlarda daha sıkı ol.
  const denseLayout = playerCount >= 5;
  const denseScale = denseLayout
    ? Math.max(0.65, Math.min(0.92 - 0.04 * (playerCount - 5), (windowHeight - 100) / 760))
    : 1;
  const ds = (value: number) => Math.round(value * denseScale);
  const denseWide = denseLayout && wideAnswers;
  const denseTopInset = Math.round(Math.max(0, Math.min(140, (windowHeight - 560) / 2)));
  const denseOptionBadge = Math.max(20, ds(30));
  const denseTimerSize = Math.max(34, ds(46));
  const denseJokerButton = { minHeight: Math.max(26, ds(34)), paddingVertical: 2 };
  const denseQuestionSize = Math.max(15, ds(compact ? 19 : 22)) + (isLargeText ? 3 : 0);
  const denseOptionSize = Math.max(13, ds(compact ? 16 : 18)) + (isLargeText ? 2 : 0);
  const isGroup = multiPlayers.length > 0;
  const rowSize = Math.ceil(playerCount / 2);
  const playerRows = playerCount <= 4 ? [multiPlayers] : [multiPlayers.slice(0, rowSize), multiPlayers.slice(rowSize)];
  const multiRing = playerCount <= 4 ? (tiny ? 35 : 41) : Math.max(16, ds(tiny ? 28 : 34));
  const narrowHeader = isGroup && windowWidth < 380;
  const groupScore = (p: typeof multiPlayers[number]) => p.isMe ? myScore : formatCleanScore(p.score || 0, p.correctAnswers, totalRounds);
  const multiLeaderScore = Math.max(0, ...multiPlayers.map(groupScore));
  const hasGroupLeader = multiLeaderScore > 0 && multiPlayers.filter(p => groupScore(p) === multiLeaderScore).length === 1;
  const meLeads = !!rightPlayer && myScore > rightPlayer.score;
  const opponentLeads = !!rightPlayer && rightPlayer.score > myScore;
  const categoryName = categoryObj?.name || 'Genel Kültür';
  const subCategoryName = (question.subCategory || '').trim();
  const normalizeKey = (v: string) => v.trim().toLocaleLowerCase('tr-TR');
  const subCategoryObj = subCategoryName
    ? categoryObj?.subCategories?.find(
        (sc: { id: string; name: string }) =>
          normalizeKey(sc.id) === normalizeKey(subCategoryName) ||
          normalizeKey(sc.name) === normalizeKey(subCategoryName)
      )
    : undefined;
  const categoryArt =
    (subCategoryObj && DISCOVER_SUBCATEGORY_IMG[subCategoryObj.id]) ||
    DISCOVER_CATEGORY_IMG[question.categoryId] ||
    DISCOVER_CATEGORY_IMG.general_culture;
  const subCategoryLabel = subCategoryObj?.name || subCategoryName;
  const difficultyLabel = (diffMap[question.difficulty] || 'Orta').toLocaleUpperCase('tr-TR');
  const difficultyColor = DIFFICULTY_COLORS[question.difficulty] || DIFFICULTY_COLORS.medium;
  return (
    <TavrikoScreen style={denseLayout ? styles.denseScreenContainer : styles.screenContainer}>
      {/* 1. Üst Bar: Çıkış, Soru Sayacı, Kategori */}
      <View style={[styles.topRow, denseLayout && styles.denseTopRow, denseWide && styles.denseWideFrame, denseWide && { marginTop: denseTopInset }]}>
        <TouchableOpacity
          style={[styles.closeBtn, denseLayout && styles.denseCloseBtn]}
          hitSlop={denseLayout ? 4 : undefined}
          onPress={handleExitPress}
          activeOpacity={0.8}
          accessibilityLabel="Oyundan çık"
        >
          <CloseXIcon size={denseLayout ? 16 : 20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={[styles.roundPill, narrowHeader && styles.roundPillNarrow, denseLayout && styles.denseRoundPill]}>
          <Text style={[styles.roundPillText, (narrowHeader || denseLayout) && styles.roundTextNarrow]} numberOfLines={1}>
            Soru {question.roundNumber} / {totalRounds}
          </Text>
        </View>
        <View style={[styles.categoryPill, isGroup && styles.groupCategoryPill, narrowHeader && styles.categoryPillNarrow, denseLayout && styles.denseCategoryPill]}>
          {!narrowHeader && <Image source={categoryArt} style={[styles.categoryArt, denseLayout && styles.denseCategoryArt]} resizeMode="contain" />}
          <View style={styles.categoryPillTexts}>
            <Text style={styles.categoryPillText} numberOfLines={1}>
              {categoryName}
            </Text>
            {subCategoryLabel ? (
              <Text style={styles.subCategoryPillText} numberOfLines={1} accessibilityLabel={`Alt kategori: ${subCategoryLabel}`}>
                {subCategoryLabel}
              </Text>
            ) : null}
          </View>
        </View>
        {isGroup && (
          <CircularTimer
            totalMs={totalMs} pauseUntil={localPauseUntil}
            endTime={endTime}
            isActive={!jokerApplying && !feedback && (answerState === 'answerable' || (isMultiplayer && answerState === 'submitting'))}
            secondsLeft={secondsLeft}
            onTimeExpired={handleTimeExpiredInternal}
            onSecondChange={handleSecondChange}
            size={denseLayout ? denseTimerSize : narrowHeader ? 42 : 48}
          />
        )}
      </View>
      <ScrollView
        ref={arenaScrollRef}
        testID="quiz-arena-scroll"
        style={[styles.arenaScroll, denseWide && styles.denseWideFrame]}
        contentContainerStyle={[
          isGroup ? styles.groupArenaBody : Platform.OS === 'web' ? styles.webArenaBody : styles.arenaBody,
          denseLayout && { gap: Math.max(4, ds(8)), paddingVertical: 4 },
          denseWide && styles.denseWideBody,
        ]}
        showsVerticalScrollIndicator={false}
      >
      {/* Günlük Meydan Okuma bilgisi */}
      {dailyChallengeInfo && (
        <View style={styles.dailyStrip}>
          <StreakFlameIcon size={18} active={true} />
          <Text style={styles.dailyStripText}>
            MEYDAN OKUMA · Hedef: {dailyChallengeInfo.requiredCorrect}/{dailyChallengeInfo.totalQuestions} Doğru (Şu an: {dailyChallengeInfo.currentCorrect})
          </Text>
        </View>
      )}

      {/* 2. Skor Tablosu: 3+ kişi → TÜM oyuncular; 1-2 kişi → Ben · Geri Sayım · Rakip */}
      {isGroup ? (
        <View style={styles.multiScoreboard}>
          {playerRows.map((row, i) => (
            <View key={i} style={styles.multiPlayerRow}>
              {row.map(p => {
                const score = p.isMe ? myScore : formatCleanScore(p.score || 0, p.correctAnswers, totalRounds);
                return (
                  <MiniPlayerBlock
                    key={p.id}
                    name={p.isMe ? 'Sen' : p.displayName}
                    avatarSeed={(p.isMe ? myAvatarUrl : undefined) || p.avatarUrl || p.displayName}
                    score={score}
                    isMe={!!p.isMe}
                    ringSize={multiRing}
                    dense={denseLayout}
                    isLeading={hasGroupLeader && score === multiLeaderScore}
                    hasAnswered={p.isMe ? myAnswered : Boolean(p.hasAnswered)}
                    badge={p.isMe && streak >= 2 ? `×${streak}` : null}
                  />
                );
              })}
            </View>
          ))}
        </View>
      ) : (
      <View style={styles.scoreboard}>
        <DuelPlayerBlock
          side="me"
          name={myDisplayName}
          avatarSeed={myAvatarUrl || myRacer?.avatarUrl || myDisplayName}
          score={myScore}
          isLeading={meLeads}
          showLeaderSlot={!!rightPlayer}
          hasAnswered={!!rightPlayer && myAnswered}
          badge={streak >= 2 ? `×${streak}` : null}
          compact={compact}
        />
        <CircularTimer
          totalMs={totalMs} pauseUntil={localPauseUntil}
          endTime={endTime}
          isActive={!jokerApplying && !feedback && (answerState === 'answerable' || (isMultiplayer && answerState === 'submitting'))}
          secondsLeft={secondsLeft}
          onTimeExpired={handleTimeExpiredInternal}
          onSecondChange={handleSecondChange}
          size={compact ? 80 : 96}
        />
        {rightPlayer ? (
          <DuelPlayerBlock
            side="opponent"
            name={rightPlayer.name}
            avatarSeed={rightPlayer.avatarSeed}
            score={rightPlayer.score}
            isLeading={opponentLeads}
            showLeaderSlot
            hasAnswered={rightPlayer.hasAnswered}
            compact={compact}
          />
        ) : (
          <View style={styles.playerBlock}>
            <View
              style={[
                styles.playerAvatarRing,
                styles.streakRing,
                compact && { width: 60, height: 60, borderRadius: 30 },
              ]}
            >
              <StreakFlameIcon size={compact ? 36 : 46} active={streak > 0} />
            </View>
            <View style={[styles.playerNamePill, { borderColor: 'rgba(255, 155, 47, 0.7)' }]}>
              <Text style={styles.playerNameText}>Seri</Text>
            </View>
            <Text style={[styles.playerScore, compact && styles.playerScoreCompact, { color: '#FFC43D' }]}>
              x{Math.max(1, streak)}
            </Text>
          </View>
        )}
      </View>
      )}

      {/* 3. Zirve Yarışı (yalnızca çok oyunculu modlarda) */}
      {activeRacers.length > 0 && (
        <SummitRaceTrack
          racers={activeRacers}
          totalQuestions={totalRounds}
          compact={compact}
          dense={denseLayout}
          scale={denseScale}
        />
      )}

      {/* 4. Soru Kartı */}
      <Animated.View
        key={`q-${question.id}-${question.roundNumber}`}
        entering={FadeIn.duration(320)}
        style={[
          styles.questionCard,
          compact && styles.questionCardCompact,
          (tiny || denseLayout) && styles.questionCardTiny,
          denseLayout && styles.denseQuestionCard,
          denseLayout && { minHeight: Math.max(46, ds(68)) },
        ]}
      >
        <GradientFill
          colors={['rgba(107, 60, 255, 0.55)', 'rgba(52, 22, 128, 0.75)', 'rgba(30, 12, 74, 0.85)']}
          direction="diagonal"
        />
        <View style={[styles.questionCardInner, denseLayout && styles.denseQuestionInner]} pointerEvents="none" />
        {!tiny && !denseLayout && (
          <View style={styles.difficultyRow}>
            <View
              style={[styles.difficultyBadge, { borderColor: difficultyColor, backgroundColor: `${difficultyColor}26` }]}
              accessibilityLabel={`Zorluk: ${difficultyLabel}`}
            >
              <Text style={[styles.difficultyText, { color: difficultyColor, marginBottom: 0 }]}>{difficultyLabel}</Text>
            </View>
          </View>
        )}
        <Text
          style={[
            styles.questionText,
            compact && styles.questionTextCompact,
            isLargeText && styles.questionTextLarge,
            denseLayout && {
              fontSize: denseQuestionSize,
              lineHeight: Math.ceil(denseQuestionSize * 1.3),
            },
          ]}
          numberOfLines={denseLayout ? undefined : 5}
          adjustsFontSizeToFit={!denseLayout}
          minimumFontScale={0.8}
        >
          {question.text}
        </Text>
      </Animated.View>

      {jokers && (
        <View style={[styles.jokerRow, denseLayout && styles.denseJokerRow]}>
          {jokerEffect || frozen || jokerBusy || (jokerRetry && !isOptionsDisabled) ? (
            <View style={[styles.jokerStatus, denseLayout && denseJokerButton, jokerEffect && !isOptionsDisabled && styles.jokerActions]}>
              <Text accessibilityLiveRegion="polite" style={[styles.jokerTriggerText, jokerEffect && !isOptionsDisabled && styles.jokerStrip]}>
                {frozen ? 'Sayacın donduruldu' : clockPaused ? 'Sayaç duraklatıldı' :
                  jokerRetry?.hint ?? jokerEffect?.hint ?? (jokerApplying ? 'Joker uygulanıyor…' : jokerBusy ? 'İşlem yapılıyor…' : 'Joker kullanıldı')}
              </Text>
              {jokerEffect && !isOptionsDisabled && (
                <TouchableOpacity style={[styles.jokerTrigger, styles.jokerShopTrigger, styles.jokerAfterUse, denseLayout && denseJokerButton]}
                  accessibilityRole="button" accessibilityLabel="Joker satın al"
                  onPress={() => { setJokerError(undefined); setJokersOpen(true); }}>
                  <Text numberOfLines={1} style={styles.jokerTriggerText}>Joker Al</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : !isOptionsDisabled && (
            <View style={styles.jokerActions}>
              {ownedJokers.length ? (
                <ScrollView horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false}
                  testID="owned-joker-strip" style={styles.jokerStrip} contentContainerStyle={styles.jokerStripContent}>
                  {ownedJokers.map(joker => (
                    <TouchableOpacity key={joker.id} style={[styles.jokerTrigger, !joker.usable && styles.jokerUnavailable, denseLayout && denseJokerButton]}
                      disabled={!joker.usable} accessibilityRole="button"
                      accessibilityLabel={`${joker.name} ${joker.usable ? 'kullan' : 'bu soruda kullanılamaz'}, ${joker.qty} adet`}
                      accessibilityState={{ disabled: !joker.usable }}
                      onPress={() => { void useJokerAction(joker.id, false); }}>
                      <WalletArtwork kind={joker.id} size={denseLayout ? 16 : 19} />
                      <Text numberOfLines={1} style={styles.jokerTriggerText}>{joker.name} · {joker.qty}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : <Text style={[styles.jokerTriggerText, styles.jokerStrip]}>Henüz jokerin yok</Text>}
              <TouchableOpacity style={[styles.jokerTrigger, styles.jokerShopTrigger, denseLayout && denseJokerButton]}
                accessibilityRole="button" accessibilityLabel="Joker satın al"
                onPress={() => { setJokerError(undefined); setJokersOpen(true); }}>
                <Text numberOfLines={1} style={styles.jokerTriggerText}>Joker Al</Text>
              </TouchableOpacity>
            </View>
          )}
          {!jokersOpen && jokerError && !jokerEffect && !isOptionsDisabled && (
            <Text accessibilityRole="alert" style={styles.jokerInlineError}>{jokerError}</Text>
          )}
        </View>
      )}
      {jokers && jokersOpen && !isOptionsDisabled && (
        <JokerPurchasePanel user={jokers.user} options={question.options} live={isMultiplayer} tactics={question.jokerTactics} capabilities={question.jokerCapabilities}
          lightningAvailable={lightningAvailable}
          buying={buyingJoker} error={jokerError} onClose={() => setJokersOpen(false)}
          onBuy={id => { void useJokerAction(id, true); }} />
      )}

      {/* 5. Şıklar */}
      <View style={[styles.optionsContainer, wideAnswers && styles.optionsWide, compact && !wideAnswers && { gap: 7 }, denseLayout && { gap: Math.max(4, ds(7)) }]}>
        {question.options.map((opt, index) => {
          const activeSelectedId = selectedOptionId || localSelectedOptionId;
          const isMyChoice = activeSelectedId === opt.id;
          const isCorrectChoice = !!feedback && feedback.correctOptionId === opt.id;
          const isWrongChoice = !!feedback && !feedback.unavailable && isMyChoice && !isCorrectChoice;
          const removed = !feedback && eliminated.includes(opt.id);
          const highlighted = !feedback && jokerEffect?.highlightedOptionId === opt.id;
          const votes = !feedback ? jokerEffect?.votes : undefined;
          const voteTotal = votes ? Object.values(votes).reduce((sum, value) => sum + value, 0) : 0;
          const voteShare = votes && voteTotal ? ` · %${Math.round((votes[opt.id] ?? 0) * 100 / voteTotal)}` : '';
          const stateLabel = removed ? 'elendi' : isCorrectChoice ? 'doğru cevap'
            : isWrongChoice ? 'yanlış cevap' : highlighted ? 'jokerin işaretlediği şık' : isMyChoice ? 'seçildi' : '';

          return (
            <Animated.View
              key={`${question.id}-${question.roundNumber}-${opt.id}`}
              entering={FadeInDown.delay(90 + index * 70).duration(360).springify().damping(16)}
              style={[styles.optWrap, wideAnswers && styles.optWrapWide]}
            >
              <TouchableOpacity
                style={[
                  styles.optCard,
                  compact && styles.optCardCompact,
                  (tiny || denseLayout) && styles.optCardTiny,
                  !feedback && isMyChoice && styles.optCardSelected,
                  feedback && isCorrectChoice && styles.optCardCorrect,
                  feedback && isWrongChoice && styles.optCardWrong,
                  highlighted && styles.optCardHighlighted,
                  isOptionsDisabled && !isMyChoice && !isCorrectChoice && styles.optCardDimmed,
                  removed && { opacity: .42 },
                  denseLayout && styles.denseOptCard,
                  denseLayout && { minHeight: Math.max(38, ds(49)) },
                ]}
                disabled={isOptionsDisabled || jokerBusy || removed}
                activeOpacity={0.8}
                onPress={() => handleSelect(opt.id)}
                testID={`quiz-option-${index}`}
                accessibilityRole="button"
                accessibilityLabel={removed ? `${optionLabels[index]} elendi` : `${optionLabels[index]} ${opt.text}${voteShare}${stateLabel ? `, ${stateLabel}` : ''}`}
              >
                {feedback && isCorrectChoice ? (
                  <>
                    <GradientFill colors={['#217654', '#146748', '#0C543A']} stops={[0, 0.5, 1]} />
                    <View pointerEvents="none" style={styles.optCorrectGlow} />
                  </>
                ) : feedback && isWrongChoice ? (
                  <GradientFill colors={['#FF8A98', '#FF5A6A', '#C8243A']} stops={[0, 0.5, 1]} />
                ) : (
                  <GradientFill
                    colors={
                      !feedback && isMyChoice
                        ? ['rgba(255, 196, 61, 0.38)', 'rgba(120, 70, 220, 0.6)']
                        : ['rgba(80, 44, 180, 0.62)', 'rgba(40, 18, 96, 0.8)']
                    }
                    direction="horizontal"
                  />
                )}
                <View
                  style={[
                    styles.optBadge,
                    compact && styles.optBadgeCompact,
                    !feedback && isMyChoice && styles.optBadgeSelected,
                    feedback && isCorrectChoice && styles.optBadgeCorrect,
                    feedback && isWrongChoice && styles.optBadgeWrong,
                    denseLayout && { width: denseOptionBadge, height: denseOptionBadge, borderRadius: denseOptionBadge / 2, borderWidth: 1 },
                  ]}
                >
                  <Text
                    style={[
                      styles.optBadgeText,
                      denseLayout && { fontSize: Math.max(13, ds(17)) },
                      !feedback && isMyChoice && { color: '#180B34' },
                      feedback && isCorrectChoice && { color: '#146748' },
                      feedback && isWrongChoice && { color: '#C8243A' },
                    ]}
                  >
                    {optionLabels[index]}
                  </Text>
                </View>

                <Text style={[styles.optText, compact && styles.optTextCompact, isLargeText && styles.optTextLarge, denseLayout && { fontSize: denseOptionSize }]}>
                  {removed ? 'Elendi' : `${opt.text}${voteShare}`}
                </Text>

                <View pointerEvents="none" style={[styles.optionMark, denseLayout && styles.denseOptionMark, (isCorrectChoice || isWrongChoice) && styles.optionMarkResult]}>
                  {isCorrectChoice ? <CheckMarkSvg size={13} color="#14935F" />
                    : isWrongChoice ? <CrossMarkSvg size={13} color="#C8243A" />
                    : highlighted || isMyChoice && !feedback ? <View style={styles.optionMarkDot} /> : null}
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {/* 6. Sabit Alt Durum Alanı (yerleşim kaymasız) */}
      <View style={[styles.fixedBottomStatus, compact && { minHeight: 44 }, denseLayout && styles.denseBottomStatus]}>
        {feedback ? (
          <Animated.View
            entering={FadeInDown.duration(280)}
            style={[
              styles.inlineFeedbackCard,
              denseLayout && styles.denseFeedbackCard,
              {
                borderColor: feedback.isTimeout || feedback.unavailable
                  ? 'rgba(255, 196, 61, 0.6)'
                  : feedback.isCorrect
                  ? 'rgba(63, 208, 138, 0.6)'
                  : 'rgba(255, 90, 106, 0.6)',
              },
            ]}
          >
            <Text
              style={[
                styles.inlineFeedbackTitle,
                {
                  color: feedback.isTimeout || feedback.unavailable
                    ? '#FFC43D'
                    : feedback.isCorrect
                    ? '#7CFC8A'
                    : '#FF7A8A',
                },
              ]}
            >
              {feedback.skipped
                ? 'SORU PAS GEÇİLDİ'
                : feedback.unavailable
                ? 'CEVAP DOĞRULANAMADI'
                : feedback.isTimeout
                ? 'SÜRE DOLDU!'
                : feedback.isCorrect
                ? `DOĞRU! +${feedback.pointsAwarded} puan`
                : feedback.pointsAwarded < 0 ? `YANLIŞ CEVAP! ${feedback.pointsAwarded} puan` : 'YANLIŞ CEVAP!'}
            </Text>
            {feedback.explanation ? (
              <Text style={styles.inlineFeedbackSub} numberOfLines={2}>
                {feedback.explanation}
              </Text>
            ) : null}
            {onNext ? (
              <TouchableOpacity
                onPress={onNext}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Sonraki soru"
                style={{
                  marginTop: 8,
                  alignSelf: 'center',
                  paddingHorizontal: 22,
                  paddingVertical: 8,
                  borderRadius: 14,
                  backgroundColor: '#6B3CFF',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontFamily: THEME.fonts.extraBold }}>SONRAKİ SORU</Text>
              </TouchableOpacity>
            ) : null}
          </Animated.View>
        ) : skipped ? (
          <Text style={styles.bottomHintText}>Soru pas geçildi. Turun bitmesi bekleniyor…</Text>
        ) : answerState === 'submitting' || (isMultiplayer && isLocked) ? (
          <Text style={styles.bottomHintText}>
            {isMultiplayer ? 'Cevabın seçildi. Turun bitmesi bekleniyor...' : 'Cevabın kontrol ediliyor...'}
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
      </ScrollView>
    </TavrikoScreen>
  );
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#4ADE80',
  medium: '#FFC43D',
  hard: '#FF6B6B',
  expert: '#E879F9',
};

const styles = StyleSheet.create({
  jokerRow: { marginVertical: 2, gap: 4 },
  jokerStatus: { minHeight: 34, justifyContent: 'center' },
  jokerActions: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  jokerStrip: { flex: 1, minWidth: 0 },
  jokerStripContent: { gap: 5 },
  jokerTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 34, gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 9, borderWidth: 1, borderColor: '#72597F', backgroundColor: '#271B40' },
  jokerUnavailable: { opacity: .55 },
  jokerShopTrigger: { borderColor: '#AA794B', backgroundColor: '#402948', flexShrink: 0 },
  jokerAfterUse: { marginLeft: 'auto' },
  jokerTriggerText: { color: '#FFE0B1', flexShrink: 1, fontSize: 11, fontFamily: THEME.fonts.extraBold },
  jokerInlineError: { color: '#FFB7C9', fontSize: 12 },
  screenContainer: {
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  denseScreenContainer: { minHeight: 0, paddingBottom: 8 },
  denseWideFrame: { width: '100%', maxWidth: 740, alignSelf: 'center' },
  denseWideBody: { justifyContent: 'flex-start' },
  denseTopRow: { gap: 6, marginBottom: 4 },
  denseCloseBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1 },
  denseRoundPill: { height: 32, borderRadius: 16, paddingHorizontal: 9, borderWidth: 1 },
  denseCategoryPill: { minHeight: 32, borderRadius: 16, paddingHorizontal: 8, borderWidth: 1 },
  denseCategoryArt: { width: 22, height: 22 },
  miniPlayerDense: { maxWidth: 84, paddingVertical: 2, borderRadius: 8 },
  denseQuestionCard: { borderRadius: 16, borderWidth: 1.5, paddingVertical: 6, paddingHorizontal: 10 },
  denseQuestionInner: { top: 3, bottom: 3, left: 3, right: 3, borderRadius: 12 },
  denseJokerRow: { marginVertical: 0 },
  denseOptCard: { gap: 7, paddingVertical: 3, paddingLeft: 6, paddingRight: 7, borderWidth: 1 },
  denseOptionMark: { width: 18, height: 18, borderRadius: 9 },
  denseBottomStatus: { minHeight: 24 },
  denseFeedbackCard: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1 },
  arenaBody: { flexGrow: 1, justifyContent: 'space-between', gap: 6 },
  arenaScroll: { flex: 1, minHeight: 0 },
  groupArenaBody: { flexGrow: 1, justifyContent: 'space-between', paddingVertical: 6, gap: 6 },
  webArenaBody: { flexGrow: 1, justifyContent: 'space-between', paddingBottom: 5, gap: 8 },
  optionsWide: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  optWrapWide: { width: '49%' },
  // ---- Üst Bar ----
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(186, 150, 255, 0.6)',
    backgroundColor: 'rgba(36, 16, 80, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundPill: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(36, 16, 80, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(154, 107, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundPillText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: THEME.fonts.black,
    letterSpacing: 0.3,
  },
  roundPillNarrow: { paddingHorizontal: 8 },
  roundTextNarrow: { fontSize: 13 },
  categoryPill: {
    minHeight: 40,
    maxWidth: 210,
    paddingVertical: 3,
    flexShrink: 1,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(36, 16, 80, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(154, 107, 255, 0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryArt: {
    width: 32,
    height: 32,
  },
  groupCategoryPill: { flex: 1, minWidth: 0, maxWidth: '100%' },
  categoryPillNarrow: { paddingHorizontal: 8 },
  categoryPillTexts: {
    flexShrink: 1,
    justifyContent: 'center',
  },
  categoryPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.black,
    flexShrink: 1,
  },
  subCategoryPillText: {
    color: '#D9CDF5',
    fontSize: 10,
    fontFamily: THEME.fonts.bold,
    flexShrink: 1,
    marginTop: 1,
  },
  difficultyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 6,
  },
  difficultyBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
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
  },
  dailyStripText: {
    color: '#FFB300',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    flexShrink: 1,
  },
  // ---- Skor Tablosu ----
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  // 3+ kişilik odalarda tüm oyuncu profilleri sığan satırlar
  multiScoreboard: {
    gap: 4,
  },
  multiPlayerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  miniPlayerBlock: {
    flex: 1,
    minWidth: 0,
    maxWidth: 104,
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(24, 10, 56, 0.8)',
  },
  miniPlayerName: { width: '100%', marginTop: 2 },
  miniPlayerScore: { fontFamily: THEME.fonts.display, fontVariant: ['tabular-nums'] },
  miniPlayerLeading: { backgroundColor: '#3C2B47' },
  miniStreak: {
    position: 'absolute',
    left: 3,
    top: 3,
    color: '#FFD27A',
    fontSize: 9,
    fontFamily: THEME.fonts.black,
  },
  playerBlock: {
    width: 108,
    alignItems: 'center',
  },
  playerAvatarRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B0C38',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 12,
    elevation: 8,
  },
  streakRing: {
    borderColor: '#FF9B2F',
    shadowColor: '#FF9B2F',
  },
  playerAnsweredDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3FD08A',
    borderWidth: 2,
    borderColor: '#14082E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderSlot: { height: 22, alignItems: 'center', justifyContent: 'center' },
  leaderTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, height: 20, borderRadius: 8, backgroundColor: '#3C2B47', borderWidth: 1, borderColor: '#8F6E4E' },
  leaderText: { fontSize: 12, color: '#FFDE9A', fontFamily: THEME.fonts.extraBold },
  playerNamePill: {
    marginTop: -8,
    maxWidth: 108,
    paddingHorizontal: 14,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(24, 10, 56, 0.96)',
    borderWidth: 1.5,
  },
  playerNameText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.black,
    textAlign: 'center',
  },
  playerScore: {
    fontSize: 26,
    fontFamily: THEME.fonts.display,
    lineHeight: 30,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  playerScoreCompact: {
    fontSize: 22,
    lineHeight: 26,
  },
  playerBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 122, 0, 0.9)',
    borderWidth: 1,
    borderColor: '#FFD27A',
  },
  playerBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: THEME.fonts.black,
  },
  // ---- Geri Sayım ----
  timerWrap: {
    marginTop: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 14,
  },
  timerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerNumber: {
    color: '#FFFFFF',
    fontSize: 38,
    fontFamily: THEME.fonts.display,
  },
  // ---- Zirve Yarışı ----
  raceCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(154, 107, 255, 0.55)',
    backgroundColor: 'rgba(22, 9, 52, 0.9)',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 4,
  },
  raceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  raceTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.black,
    letterSpacing: 1,
  },
  raceStepChip: {
    position: 'absolute',
    right: 0,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.45)',
  },
  raceStepChipText: {
    color: '#7DD3FC',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  raceBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  raceLanes: {
    flex: 1,
    gap: 2,
  },
  raceLane: {
    height: RACE_MARKER,
    justifyContent: 'center',
  },
  raceLaneTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(154, 107, 255, 0.18)',
  },
  raceBubble: {
    position: 'absolute',
    left: 0,
    width: 24,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#5ADBB5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  raceBubbleText: {
    color: '#0B2A20',
    fontSize: 10,
    fontFamily: THEME.fonts.black,
  },
  raceLaneFill: {
    position: 'absolute',
    left: 0,
    height: 8,
    borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  raceMarker: {
    position: 'absolute',
    width: RACE_MARKER,
    height: RACE_MARKER,
    borderRadius: RACE_MARKER / 2,
    borderWidth: 2,
    backgroundColor: '#1B0C38',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  raceFlag: {
    width: 28,
    alignItems: 'center',
  },
  raceFlagText: {
    fontSize: 22,
  },
  // ---- Soru Kartı ----
  questionCard: {
    minHeight: 132,
    flexShrink: 1,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(170, 140, 255, 0.85)',
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6B3CFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 16,
    elevation: 8,
  },
  questionCardCompact: {
    minHeight: 100,
    paddingVertical: 10,
  },
  questionCardTiny: {
    minHeight: 80,
    paddingVertical: 8,
  },
  questionCardInner: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  difficultyText: {
    color: 'rgba(217, 205, 245, 0.75)',
    fontSize: 10,
    fontFamily: THEME.fonts.black,
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  questionText: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 29,
  },
  questionTextCompact: {
    fontSize: 19,
    lineHeight: 25,
  },
  questionTextLarge: {
    fontSize: 25,
    lineHeight: 32,
  },
  // ---- Şıklar ----
  optionsContainer: {
    gap: 10,
  },
  optWrap: {
    position: 'relative',
  },
  optCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 58,
    paddingVertical: 4,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: 29,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(154, 107, 255, 0.6)',
  },
  optCardCompact: {
    minHeight: 50,
    borderRadius: 25,
  },
  optCardTiny: {
    minHeight: 46,
    borderRadius: 23,
  },
  optCardSelected: {
    borderColor: '#FFC43D',
  },
  optCardCorrect: {
    borderColor: '#B6FFE0',
  },
  optCorrectGlow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(63, 208, 138, 0.06)',
  },
  optCardHighlighted: {
    borderColor: '#FFCE67',
  },
  optCardWrong: {
    borderColor: '#FFB3BC',
  },
  optCardDimmed: {
    opacity: 0.6,
  },
  optBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optBadgeCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  optBadgeSelected: {
    backgroundColor: '#FFC43D',
    borderColor: '#FFE27A',
  },
  optBadgeCorrect: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  optBadgeWrong: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  optBadgeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: THEME.fonts.black,
  },
  optText: {
    flex: 1,
    minWidth: 0,
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: THEME.fonts.black,
  },
  optTextCompact: {
    fontSize: 16,
  },
  optTextLarge: {
    fontSize: 20,
  },
  optionMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionMarkResult: { backgroundColor: '#FFFFFF' },
  optionMarkDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFCE67' },
  // ---- Alt Durum ----
  fixedBottomStatus: {
    minHeight: 52,
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
    backgroundColor: 'rgba(10, 4, 24, 0.82)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
  },
  inlineFeedbackTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 15,
  },
  inlineFeedbackSub: {
    color: '#E6DCFF',
    fontSize: 11,
    fontFamily: THEME.fonts.body,
    marginTop: 2,
  },
});
