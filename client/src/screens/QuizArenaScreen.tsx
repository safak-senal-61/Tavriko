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
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { trackEvent } from '../services/analytics';
import { loadStoredPreferences } from '../store/appPrefs';
import { canUseJoker, ClientQuestion, ALL_CATEGORIES, JOKERS, JokerEffect, JokerId, LIGHTNING_WINDOW_MS, UserProfile } from '@trivia/shared';
import { JokerPurchasePanel } from '../components/WalletPanels';
import { WalletArtwork } from '../components/WalletArtwork';
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

const TIMER_STROKE = 9;

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
    const r = (size - TIMER_STROKE) / 2;
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
          <Circle cx={size / 2} cy={size / 2} r={r - TIMER_STROKE / 2 - 2} fill="url(#qaTimerInner)" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(154, 107, 255, 0.28)"
            strokeWidth={TIMER_STROKE}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={ringColor}
            strokeWidth={TIMER_STROKE}
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

/**
 * Kompakt maç oyuncu kartı: avatar, isim, puan ve yarış ilerlemesi tek satırda.
 * 2 kişilik düellodan 8 kişilik odalara kadar aynı iskelet kullanılır; kart
 * yüksekliği sabit kalır, böylece 320×568 ekranda kaydırma gerekmez.
 */
const MatchPlayerCard: React.FC<{
  name: string;
  avatarSeed: string;
  score: number;
  correct: number;
  total: number;
  isMe?: boolean;
  isLeading?: boolean;
  hasAnswered?: boolean;
  badge?: string | null;
  dense?: boolean;
}> = ({ name, avatarSeed, score, correct, total, isMe, isLeading, hasAnswered, badge, dense = false }) => {
  const color = isLeading ? '#F5CA79' : isMe ? '#38BDF8' : '#C06BFF';
  const ring = dense ? 26 : 30;
  const totalSafe = Math.max(1, Math.floor(total));
  const pct = Math.round(getRaceProgressPercentage(correct, totalSafe));
  return (
    <View
      style={[
        styles.matchCard,
        dense && styles.matchCardDense,
        isMe && styles.matchCardMe,
        isLeading && styles.matchCardLeading,
      ]}
      accessible
      accessibilityLabel={`${name}, ${score} puan, ${clampCorrect(correct, totalSafe)}/${totalSafe} doğru${isLeading ? ', önde' : ''}${hasAnswered ? ', cevapladı' : ''}`}
    >
      <View
        style={[
          styles.matchAvatarRing,
          { width: ring, height: ring, borderRadius: ring / 2, borderColor: color, shadowColor: color },
        ]}
      >
        <CharacterAvatar seed={avatarSeed} size={ring - 6} />
        {hasAnswered && (
          <View style={styles.matchAnsweredDot}>
            <CheckMarkSvg size={8} color="#FFFFFF" />
          </View>
        )}
      </View>
      <View style={styles.matchBody}>
        <View style={styles.matchTopRow}>
          <Text style={[styles.matchName, dense && styles.matchNameDense]} numberOfLines={1}>
            {name}
          </Text>
          <Text
            style={[
              styles.matchScore,
              dense && styles.matchScoreDense,
              { color: isLeading ? '#FFDE9A' : isMe ? '#5FE1FF' : '#D9B8FF' },
            ]}
            numberOfLines={1}
          >
            {score}
          </Text>
          {badge ? <Text style={styles.matchBadge} numberOfLines={1}>{badge}</Text> : null}
        </View>
        <View
          style={styles.matchProgressTrack}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View
            style={[
              styles.matchProgressFill,
              { width: `${pct}%`, backgroundColor: color, shadowColor: color },
            ]}
          />
        </View>
      </View>
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
  const isGroup = multiPlayers.length > 0;
  // 5+ kişi: oyuncu kartları, soru kartı, şıklar ve joker şeridi sıkışık modda render edilir.
  const denseLayout = playerCount >= 5;
  // Telefonda 2 sütun (8 oyuncu → 4+4), geniş ekranda tek sıra.
  const wideMatch = windowWidth >= 700;
  const narrowHeader = windowWidth < 400;
  const opponentRacer = activeRacers.find((r) => !r.isMe);
  const groupScore = (p: typeof multiPlayers[number]) => p.isMe ? myScore : formatCleanScore(p.score || 0, p.correctAnswers, totalRounds);
  const multiLeaderScore = Math.max(0, ...multiPlayers.map(groupScore));
  const hasGroupLeader = multiLeaderScore > 0 && multiPlayers.filter(p => groupScore(p) === multiLeaderScore).length === 1;
  const meLeads = !!rightPlayer && myScore > rightPlayer.score;
  const opponentLeads = !!rightPlayer && rightPlayer.score > myScore;
  const matchCards = useMemo(() => {
    if (isGroup) {
      return multiPlayers.map((p) => {
        const score = groupScore(p);
        return {
          id: p.id,
          name: p.isMe ? 'Sen' : p.displayName,
          avatarSeed: (p.isMe ? myAvatarUrl : undefined) || p.avatarUrl || p.displayName,
          score,
          correct: p.correctAnswers || 0,
          isMe: !!p.isMe,
          hasAnswered: p.isMe ? myAnswered : Boolean(p.hasAnswered),
          badge: p.isMe && streak >= 2 ? `×${streak}` : null,
        };
      });
    }
    const cards = [{
      id: 'me',
      name: myDisplayName,
      avatarSeed: myAvatarUrl || myRacer?.avatarUrl || myDisplayName,
      score: myScore,
      correct: myRacer?.correctAnswers || 0,
      isMe: true,
      hasAnswered: myAnswered,
      badge: streak >= 2 ? `×${streak}` : null,
    }];
    if (rightPlayer) {
      cards.push({
        id: 'opponent',
        name: rightPlayer.name,
        avatarSeed: rightPlayer.avatarSeed,
        score: rightPlayer.score,
        correct: opponentRacer?.correctAnswers || 0,
        isMe: false,
        hasAnswered: Boolean(rightPlayer.hasAnswered),
        badge: null,
      });
    }
    return cards;
  }, [isGroup, multiPlayers, myScore, myDisplayName, myAvatarUrl, myRacer, rightPlayer, opponentRacer, myAnswered, streak]);
  const matchLeaderScore = Math.max(0, ...matchCards.map((c) => c.score));
  const hasMatchLeader = matchLeaderScore > 0 && matchCards.filter((c) => c.score === matchLeaderScore).length === 1;
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
    <TavrikoScreen style={styles.screenContainer}>
      {/* Arka planı sakinleştiren ince karartma: kartlar öne çıksın */}
      <View pointerEvents="none" style={styles.backdropScrim} />
      {/* 1. Üst Bar: Çıkış, Soru Sayacı, Kategori */}
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleExitPress}
          activeOpacity={0.8}
          accessibilityLabel="Oyundan çık"
        >
          <CloseXIcon size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={[styles.roundPill, narrowHeader && styles.roundPillNarrow]}>
          <Text style={[styles.roundPillText, narrowHeader && styles.roundTextNarrow]} numberOfLines={1}>
            {narrowHeader ? `${question.roundNumber}/${totalRounds}` : `Soru ${question.roundNumber} / ${totalRounds}`}
          </Text>
        </View>
        <View style={[styles.categoryPill, isGroup && styles.groupCategoryPill, narrowHeader && styles.categoryPillNarrow]}>
          {!narrowHeader && <Image source={categoryArt} style={styles.categoryArt} resizeMode="contain" />}
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
        <View style={styles.topSpacer} />
        <CircularTimer
          totalMs={totalMs} pauseUntil={localPauseUntil}
          endTime={endTime}
          isActive={!jokerApplying && !feedback && (answerState === 'answerable' || (isMultiplayer && answerState === 'submitting'))}
          secondsLeft={secondsLeft}
          onTimeExpired={handleTimeExpiredInternal}
          onSecondChange={handleSecondChange}
          size={narrowHeader ? 34 : compact ? 40 : 44}
        />
      </View>
      <ScrollView
        ref={arenaScrollRef}
        testID="quiz-arena-scroll"
        style={styles.arenaScroll}
        contentContainerStyle={isGroup ? styles.groupArenaBody : Platform.OS === 'web' ? styles.webArenaBody : styles.arenaBody}
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

      {/* 2. Oyuncu kartları: telefon 2 sütun (8 kişi → 4+4), geniş ekran tek sıra */}
      <View style={[styles.matchGrid, wideMatch && styles.matchGridWide]}>
        {matchCards.map((card) => (
          <View
            key={card.id}
            style={
              wideMatch
                ? styles.matchCellWide
                : matchCards.length === 1
                ? styles.matchCellFull
                : styles.matchCell
            }
          >
            <MatchPlayerCard
              name={card.name}
              avatarSeed={card.avatarSeed}
              score={card.score}
              correct={card.correct}
              total={totalRounds}
              isMe={card.isMe}
              isLeading={hasMatchLeader && card.score === matchLeaderScore}
              hasAnswered={card.hasAnswered}
              badge={card.badge}
              dense={denseLayout}
            />
          </View>
        ))}
        {!isGroup && !rightPlayer && streak > 0 && (
          <View style={wideMatch ? styles.matchCellWide : styles.matchCell}>
            <View style={[styles.matchCard, styles.streakCard]}>
              <StreakFlameIcon size={18} active />
              <Text style={styles.streakCardText}>Seri ×{Math.max(1, streak)}</Text>
            </View>
          </View>
        )}
      </View>

      {/* 4. Soru Kartı */}
      <Animated.View
        key={`q-${question.id}-${question.roundNumber}`}
        entering={FadeIn.duration(320)}
        style={[
          styles.questionCard,
          compact && styles.questionCardCompact,
          (tiny || denseLayout) && styles.questionCardTiny,
        ]}
      >
        <GradientFill
          colors={['rgba(124, 92, 255, 0.22)', 'rgba(24, 20, 40, 0.94)', 'rgba(18, 16, 30, 0.98)']}
          direction="diagonal"
        />
        <View style={styles.questionCardInner} pointerEvents="none" />
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
            tiny && styles.questionTextTiny,
          ]}
          numberOfLines={5}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {question.text}
        </Text>
      </Animated.View>

      {jokers && (
        <View style={styles.jokerRow}>
          {jokerEffect || frozen || jokerBusy || (jokerRetry && !isOptionsDisabled) ? (
            <View style={[styles.jokerStatus, jokerEffect && !isOptionsDisabled && styles.jokerActions]}>
              <Text accessibilityLiveRegion="polite" style={[styles.jokerTriggerText, jokerEffect && !isOptionsDisabled && styles.jokerStrip]}>
                {frozen ? 'Sayacın donduruldu' : clockPaused ? 'Sayaç duraklatıldı' :
                  jokerRetry?.hint ?? jokerEffect?.hint ?? (jokerApplying ? 'Joker uygulanıyor…' : jokerBusy ? 'İşlem yapılıyor…' : 'Joker kullanıldı')}
              </Text>
              {jokerEffect && !isOptionsDisabled && (
                <TouchableOpacity style={[styles.jokerTrigger, styles.jokerShopTrigger, styles.jokerAfterUse]}
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
                    <TouchableOpacity key={joker.id} style={[styles.jokerTrigger, !joker.usable && styles.jokerUnavailable]}
                      disabled={!joker.usable} accessibilityRole="button"
                      accessibilityLabel={`${joker.name} ${joker.usable ? 'kullan' : 'bu soruda kullanılamaz'}, ${joker.qty} adet`}
                      accessibilityState={{ disabled: !joker.usable }}
                      onPress={() => { void useJokerAction(joker.id, false); }}>
                      <WalletArtwork kind={joker.id} size={19} />
                      <Text numberOfLines={1} style={styles.jokerTriggerText}>{joker.name} · {joker.qty}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : <Text style={[styles.jokerTriggerText, styles.jokerStrip]}>Henüz jokerin yok</Text>}
              <TouchableOpacity style={[styles.jokerTrigger, styles.jokerShopTrigger]}
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
      <View style={[styles.optionsContainer, compact && { gap: 5 }, denseLayout && { gap: 3 }, wideAnswers && styles.optionsWide]}>
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
                  ]}
                >
                  <Text
                    style={[
                      styles.optBadgeText,
                      !feedback && isMyChoice && { color: '#180B34' },
                      feedback && isCorrectChoice && { color: '#146748' },
                      feedback && isWrongChoice && { color: '#C8243A' },
                    ]}
                  >
                    {optionLabels[index]}
                  </Text>
                </View>

                <Text style={[styles.optText, compact && styles.optTextCompact, isLargeText && styles.optTextLarge]}>
                  {removed ? 'Elendi' : `${opt.text}${voteShare}`}
                </Text>

                <View pointerEvents="none" style={[styles.optionMark, (isCorrectChoice || isWrongChoice) && styles.optionMarkResult]}>
                  {isCorrectChoice ? <CheckMarkSvg size={13} color="#14935F" />
                    : isWrongChoice ? <CrossMarkSvg size={13} color="#C8243A" />
                    : highlighted || isMyChoice && !feedback ? <View style={styles.optionMarkDot} /> : null}
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {/* 6. Sabit Alt Durum Alanı (yerleşim kaymasız; 320×568'de boşken yer kaplamaz) */}
      {(!tiny || !!feedback || skipped || answerState !== 'answerable') && (
      <View style={[styles.fixedBottomStatus, compact && !tiny && { minHeight: 44 }]}>
        {feedback ? (
          <Animated.View
            entering={FadeInDown.duration(280)}
            style={[
              styles.inlineFeedbackCard,
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
                  paddingHorizontal: 20,
                  paddingVertical: 9,
                  borderRadius: 12,
                  backgroundColor: '#7C5CFF',
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
        ) : tiny ? null : (
          <Text style={styles.bottomHintText}>
            Doğru şıkkı seçerek serini koru ve hız bonusu kazan!
          </Text>
        )}
      </View>
      )}
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

const SURFACE = 'rgba(255, 255, 255, 0.05)';
const SURFACE_STRONG = 'rgba(255, 255, 255, 0.075)';
const HAIRLINE = 'rgba(255, 255, 255, 0.09)';
const TEXT_MUTED_SOFT = '#A5A0BF';

const styles = StyleSheet.create({
  jokerRow: { gap: 3 },
  jokerStatus: { minHeight: 30, justifyContent: 'center' },
  jokerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  jokerStrip: { flex: 1, minWidth: 0 },
  jokerStripContent: { gap: 6 },
  jokerTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 32, gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: HAIRLINE, backgroundColor: SURFACE },
  jokerUnavailable: { opacity: .5 },
  jokerShopTrigger: { borderColor: 'rgba(124, 92, 255, 0.55)', backgroundColor: 'rgba(124, 92, 255, 0.22)', flexShrink: 0 },
  jokerAfterUse: { marginLeft: 'auto' },
  jokerTriggerText: { color: '#EDEAF8', flexShrink: 1, fontSize: 11, fontFamily: THEME.fonts.bold },
  jokerInlineError: { color: '#FF9FB0', fontSize: 11, fontFamily: THEME.fonts.bold },
  screenContainer: {
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  backdropScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(9, 8, 16, 0.55)',
  },
  arenaBody: { flexGrow: 1, justifyContent: 'center', gap: 8, paddingVertical: 4 },
  arenaScroll: { flex: 1, minHeight: 0 },
  groupArenaBody: { flexGrow: 1, justifyContent: 'center', paddingVertical: 4, gap: 8 },
  webArenaBody: { flexGrow: 1, justifyContent: 'center', paddingTop: 4, paddingBottom: 8, gap: 10 },
  optionsWide: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  optWrapWide: { width: '49%' },
  // ---- Üst Bar ----
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },
  topSpacer: { flex: 1, minWidth: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HAIRLINE,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundPill: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: HAIRLINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundPillText: {
    color: '#C9C5DE',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.4,
  },
  roundPillNarrow: { paddingHorizontal: 7 },
  roundTextNarrow: { fontSize: 11 },
  categoryPill: {
    minHeight: 30,
    maxWidth: 210,
    paddingVertical: 3,
    flexShrink: 1,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: HAIRLINE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryArt: {
    width: 20,
    height: 20,
  },
  groupCategoryPill: { flexShrink: 1, minWidth: 0, maxWidth: 320 },
  categoryPillNarrow: { paddingHorizontal: 8 },
  categoryPillTexts: {
    flexShrink: 1,
    justifyContent: 'center',
  },
  categoryPillText: {
    color: '#EFEDF9',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    flexShrink: 1,
  },
  subCategoryPillText: {
    color: TEXT_MUTED_SOFT,
    fontSize: 9,
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
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  dailyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 196, 61, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.32)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  dailyStripText: {
    color: '#FFC43D',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
    flexShrink: 1,
  },
  // ---- Oyuncu kartları ----
  matchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 3,
  },
  matchGridWide: {
    flexWrap: 'nowrap',
    gap: 6,
  },
  matchCell: { width: '49%', minWidth: 0 },
  matchCellFull: { width: '100%', minWidth: 0 },
  matchCellWide: { flex: 1, minWidth: 0 },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HAIRLINE,
    backgroundColor: SURFACE,
  },
  matchCardDense: { minHeight: 38, paddingVertical: 3, gap: 6, paddingHorizontal: 7 },
  matchCardMe: { borderColor: 'rgba(56, 189, 248, 0.42)', backgroundColor: 'rgba(56, 189, 248, 0.10)' },
  matchCardLeading: { borderColor: 'rgba(245, 202, 121, 0.45)', backgroundColor: 'rgba(245, 202, 121, 0.10)' },
  matchAvatarRing: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  matchAnsweredDot: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#2BD576',
    borderWidth: 1.5,
    borderColor: '#14082E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchBody: { flex: 1, minWidth: 0, gap: 4 },
  matchTopRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  matchName: {
    flex: 1,
    minWidth: 0,
    color: '#E9E6F6',
    fontSize: 11.5,
    fontFamily: THEME.fonts.bold,
  },
  matchNameDense: { fontSize: 11 },
  matchScore: {
    fontSize: 15,
    lineHeight: 17,
    fontFamily: THEME.fonts.display,
    fontVariant: ['tabular-nums'],
  },
  matchScoreDense: { fontSize: 13, lineHeight: 15 },
  matchBadge: {
    color: '#F5CA79',
    fontSize: 10,
    fontFamily: THEME.fonts.bold,
  },
  matchProgressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    overflow: 'hidden',
  },
  matchProgressFill: {
    height: 3,
    borderRadius: 2,
  },
  streakCard: { justifyContent: 'center', gap: 6, borderColor: 'rgba(255, 155, 47, 0.38)', backgroundColor: 'rgba(255, 155, 47, 0.10)' },
  streakCardText: { color: '#FFC43D', fontSize: 12, fontFamily: THEME.fonts.bold },
  // ---- Geri Sayım ----
  timerWrap: {
    marginTop: 2,
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
  // ---- Soru Kartı ----
  questionCard: {
    minHeight: 104,
    flexGrow: 1,
    flexShrink: 1,
    maxHeight: 200,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionCardCompact: {
    minHeight: 78,
    paddingVertical: 10,
  },
  questionCardTiny: {
    minHeight: 46,
    paddingVertical: 2,
  },
  questionCardInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  difficultyText: {
    color: TEXT_MUTED_SOFT,
    fontSize: 9,
    fontFamily: THEME.fonts.bold,
    letterSpacing: 1.3,
    marginBottom: 4,
  },
  questionText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 18,
    color: '#F7F5FF',
    textAlign: 'center',
    lineHeight: 24,
  },
  questionTextCompact: {
    fontSize: 16.5,
    lineHeight: 21,
  },
  questionTextLarge: {
    fontSize: 22,
    lineHeight: 28,
  },
  questionTextTiny: {
    fontSize: 15,
    lineHeight: 19,
  },
  // ---- Şıklar ----
  optionsContainer: {
    gap: 6,
  },
  optWrap: {
    position: 'relative',
  },
  optCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 50,
    paddingVertical: 3,
    paddingLeft: 6,
    paddingRight: 8,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(154, 107, 255, 0.6)',
  },
  optCardCompact: {
    minHeight: 46,
    borderRadius: 23,
  },
  optCardTiny: {
    minHeight: 44,
    borderRadius: 22,
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optBadgeCompact: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
    fontSize: 15,
    fontFamily: THEME.fonts.black,
  },
  optText: {
    flex: 1,
    minWidth: 0,
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: THEME.fonts.black,
  },
  optTextCompact: {
    fontSize: 15,
  },
  optTextLarge: {
    fontSize: 18,
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
    minHeight: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomHintText: {
    color: TEXT_MUTED_SOFT,
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
  },
  inlineFeedbackCard: {
    width: '100%',
    backgroundColor: 'rgba(20, 18, 32, 0.94)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  inlineFeedbackTitle: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  inlineFeedbackSub: {
    color: '#B9B3D0',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
    marginTop: 3,
  },
});
