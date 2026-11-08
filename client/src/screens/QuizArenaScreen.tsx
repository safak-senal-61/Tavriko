import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AppState,
  AppStateStatus,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { loadStoredPreferences } from '../store/appPrefs';
import { ClientQuestion, ALL_CATEGORIES } from '@trivia/shared';
import {
  TavrikoScreen,
  StreakFlameIcon,
  CheckMarkSvg,
  CrossMarkSvg,
  CharacterAvatar,
  CrownIcon,
  CoinIcon,
  CloseXIcon,
} from '../components/TavrikoIcons';
import { GradientFill } from '../components/TavrikoGradient';
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
}

const TIMER_STROKE = 9;

const CircularTimer: React.FC<CircularTimerProps> = React.memo(
  ({ totalMs, endTime, isActive, secondsLeft, onTimeExpired, onSecondChange, size = 96 }) => {
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
      const initRemMs = Math.max(0, endTime - Date.now());
      setProgressPct(Math.max(0, Math.min(100, (initRemMs / totalMs) * 100)));
      if (!isActive) return;
      const interval = setInterval(() => {
        const remainingMs = Math.max(0, endTime - Date.now());
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
    }, [totalMs, endTime, isActive]);

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

const RACE_LANE_COLORS = ['#38BDF8', '#B26BFF', '#FF6BC4', '#5ADBB5', '#FF9B2F', '#FFC43D'];
const RACE_MAX_LANES = 4;
const RACE_MARKER = 24;

/** Yatay şerit tabanlı Zirve Yarışı: her oyuncu kendi şeridinde bayrağa ilerler */
const SummitRaceTrack: React.FC<{
  racers: RacerInfo[];
  totalQuestions: number;
  compact?: boolean;
}> = ({ racers, totalQuestions, compact = false }) => {
  const marker = compact ? 20 : RACE_MARKER;
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
    const list = me ? [me, ...others] : others;
    return list.slice(0, RACE_MAX_LANES);
  }, [sorted]);
  const hiddenCount = Math.max(0, sorted.length - lanes.length);
  const me = sorted.find((r) => r.isMe);
  const myCorrect = me ? clampCorrect(me.correctAnswers, total) : 0;

  return (
    <View style={[styles.raceCard, compact && { paddingTop: 4, paddingBottom: 6 }]}>
      <View style={styles.raceTitleRow}>
        <Text style={styles.raceLaurel}>🏆</Text>
        <Text style={styles.raceTitle}>ZİRVE YARIŞI</Text>
        <Text style={styles.raceLaurel}>🏆</Text>
        <View style={styles.raceStepChip}>
          <Text style={styles.raceStepChipText}>
            {myCorrect}/{total} Doğru
          </Text>
        </View>
      </View>
      <View style={styles.raceBody}>
        <View
          style={styles.raceLanes}
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
              <View key={racer.id} style={[styles.raceLane, { height: marker }]}>
                <View style={styles.raceLaneTrack} />
                <View
                  style={[
                    styles.raceLaneFill,
                    { width: x + marker / 2, backgroundColor: color, shadowColor: color },
                  ]}
                />
                {laneWidth > 0 && (
                  <View
                    style={[
                      styles.raceMarker,
                      { left: x, width: marker, height: marker, borderRadius: marker / 2, borderColor: color, shadowColor: color },
                      racer.lastAnswer?.isCorrect === false && { borderColor: '#FF5A6A' },
                    ]}
                  >
                    <CharacterAvatar seed={racer.avatarUrl || racer.displayName} size={marker - 4} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
        <View style={styles.raceFlag}>
          <Text style={styles.raceFlagText}>🚩</Text>
          {hiddenCount > 0 && <Text style={styles.raceMoreText}>+{hiddenCount}</Text>}
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
  showCrown?: boolean;
  hasAnswered?: boolean;
  badge?: string | null;
  compact?: boolean;
}> = ({ name, avatarSeed, score, side, showCrown, hasAnswered, badge, compact = false }) => {
  const ring = compact ? 60 : 76;
  const isMe = side === 'me';
  const color = isMe ? '#38BDF8' : '#C06BFF';
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
      {showCrown && (
        <View style={styles.playerCrown} pointerEvents="none">
          <CrownIcon size={28} />
        </View>
      )}
      <View style={[styles.playerNamePill, { borderColor: `${color}AA` }]}>
        <Text style={styles.playerNameText} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <Text
        style={[styles.playerScore, compact && styles.playerScoreCompact, { color: isMe ? '#5FE1FF' : '#D9B8FF' }]}
        numberOfLines={1}
      >
        {score}
      </Text>
      {badge ? (
        <View style={styles.playerBadge}>
          <Text style={styles.playerBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
};

const CATEGORY_EMOJI: Record<string, string> = {
  gaming_videogames: '🎮',
  anime_manga: '🍥',
  cartoons_animation: '📺',
  cinema_tv: '🎬',
  comics_superheroes: '🦸',
  fantasy_fiction: '🐉',
  literature: '📚',
  music: '🎵',
  social_internet: '📱',
  animals_wildlife: '🦁',
  mythology_ancient: '🏛️',
  hobbies_leisure: '🎲',
  history: '📜',
  geography: '🌍',
  art_culture: '🎨',
  sports: '⚽',
  science_tech: '🔬',
  logic_puzzles: '🧩',
  mathematics: '➗',
  food_gastronomy: '🍲',
  daily_life: '🏠',
  turkey_special: '🇹🇷',
  space_astronomy: '🚀',
  biology: '🧬',
  physics_chemistry: '⚗️',
  language_vocab: '🔤',
  nature_ecology: '🌿',
  general_culture: '🧠',
  mixed: '✨',
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
  const totalRounds = question.totalRounds || 10;
  const { height: windowHeight } = useWindowDimensions();
  const compact = windowHeight < 800;
  const tiny = windowHeight < 690;
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
  const meLeads = !!rightPlayer && myScore > rightPlayer.score;
  const opponentLeads = !!rightPlayer && rightPlayer.score > myScore;
  const categoryName = categoryObj?.name || 'Genel Kültür';
  const categoryEmoji = CATEGORY_EMOJI[question.categoryId] || '🧠';

  return (
    <TavrikoScreen style={styles.screenContainer}>
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
        <View style={styles.roundPill}>
          <Text style={styles.roundPillText}>
            Soru {question.roundNumber} / {totalRounds}
          </Text>
        </View>
        <View style={styles.categoryPill}>
          <Text style={styles.categoryEmoji}>{categoryEmoji}</Text>
          <Text style={styles.categoryPillText} numberOfLines={1}>
            {categoryName}
          </Text>
        </View>
      </View>

      {/* Günlük Meydan Okuma bilgisi */}
      {dailyChallengeInfo && (
        <View style={styles.dailyStrip}>
          <StreakFlameIcon size={18} active={true} />
          <Text style={styles.dailyStripText}>
            MEYDAN OKUMA · Hedef: {dailyChallengeInfo.requiredCorrect}/{dailyChallengeInfo.totalQuestions} Doğru (Şu an: {dailyChallengeInfo.currentCorrect})
          </Text>
        </View>
      )}

      {/* 2. Skor Tablosu: Ben · Geri Sayım · Rakip */}
      <View style={styles.scoreboard}>
        <DuelPlayerBlock
          side="me"
          name={myDisplayName}
          avatarSeed={myAvatarUrl || myRacer?.avatarUrl || myDisplayName}
          score={myScore}
          showCrown={meLeads}
          hasAnswered={!!rightPlayer && myAnswered}
          badge={streak >= 2 ? `🔥 x${streak}` : null}
          compact={compact}
        />
        <CircularTimer
          totalMs={totalMs}
          endTime={endTime}
          isActive={answerState === 'answerable'}
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
            showCrown={opponentLeads}
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

      {/* 3. Zirve Yarışı (yalnızca çok oyunculu modlarda) */}
      {activeRacers.length > 0 && (
        <SummitRaceTrack racers={activeRacers} totalQuestions={totalRounds} compact={compact} />
      )}

      {/* 4. Soru Kartı */}
      <View style={[styles.questionCard, compact && styles.questionCardCompact, tiny && styles.questionCardTiny]}>
        <GradientFill
          colors={['rgba(107, 60, 255, 0.55)', 'rgba(52, 22, 128, 0.75)', 'rgba(30, 12, 74, 0.85)']}
          direction="diagonal"
        />
        <View style={styles.questionCardInner} pointerEvents="none" />
        {!tiny && <Text style={styles.difficultyText}>{(diffMap[question.difficulty] || 'Orta').toLocaleUpperCase('tr-TR')}</Text>}
        <Text
          style={[
            styles.questionText,
            compact && styles.questionTextCompact,
            isLargeText && styles.questionTextLarge,
          ]}
          numberOfLines={5}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {question.text}
        </Text>
      </View>

      {/* 5. Şıklar */}
      <View style={[styles.optionsContainer, compact && { gap: 7 }]}>
        {question.options.map((opt, index) => {
          const activeSelectedId = selectedOptionId || localSelectedOptionId;
          const isMyChoice = activeSelectedId === opt.id;
          const isCorrectChoice = !!feedback && feedback.correctOptionId === opt.id;
          const isWrongChoice = !!feedback && isMyChoice && !isCorrectChoice;
          const showPoints = !!feedback && feedback.isCorrect && isMyChoice && isCorrectChoice && feedback.pointsAwarded > 0;

          return (
            <View key={opt.id} style={styles.optWrap}>
              <TouchableOpacity
                style={[
                  styles.optCard,
                  compact && styles.optCardCompact,
                  tiny && styles.optCardTiny,
                  !feedback && isMyChoice && styles.optCardSelected,
                  feedback && isCorrectChoice && styles.optCardCorrect,
                  feedback && isWrongChoice && styles.optCardWrong,
                  isOptionsDisabled && !isMyChoice && !isCorrectChoice && styles.optCardDimmed,
                ]}
                disabled={isOptionsDisabled}
                activeOpacity={0.8}
                onPress={() => handleSelect(opt.id)}
                accessibilityRole="button"
                accessibilityLabel={`${optionLabels[index]} ${opt.text}`}
              >
                {feedback && isCorrectChoice ? (
                  <GradientFill colors={['#6FF0C6', '#3FD08A', '#22A873']} stops={[0, 0.5, 1]} />
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
                      feedback && isCorrectChoice && { color: '#14935F' },
                      feedback && isWrongChoice && { color: '#C8243A' },
                    ]}
                  >
                    {optionLabels[index]}
                  </Text>
                </View>

                <Text style={[styles.optText, compact && styles.optTextCompact, isLargeText && styles.optTextLarge]} numberOfLines={2}>
                  {opt.text}
                </Text>

                {feedback ? (
                  isCorrectChoice ? (
                    <View style={styles.choiceTagCorrect}>
                      <View style={styles.choiceTagCheck}>
                        <CheckMarkSvg size={14} color="#14935F" />
                      </View>
                      <Text style={styles.choiceTagText}>Doğru Cevap</Text>
                    </View>
                  ) : isWrongChoice ? (
                    <View style={styles.choiceTagWrong}>
                      <View style={styles.choiceTagCheck}>
                        <CrossMarkSvg size={14} color="#C8243A" />
                      </View>
                      <Text style={styles.choiceTagText}>Seçimin</Text>
                    </View>
                  ) : null
                ) : isMyChoice ? (
                  <View style={styles.choiceTagPending}>
                    <Text style={styles.choiceTagPendingText}>Seçildi 🔒</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
              {showPoints && (
                <View style={styles.pointsPopup} pointerEvents="none">
                  <CoinIcon size={18} />
                  <Text style={styles.pointsPopupText}>+{feedback!.pointsAwarded}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* 6. Sabit Alt Durum Alanı (yerleşim kaymasız) */}
      <View style={[styles.fixedBottomStatus, compact && { minHeight: 44 }]}>
        {feedback ? (
          <View
            style={[
              styles.inlineFeedbackCard,
              {
                borderColor: feedback.isTimeout
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
          <Text style={styles.bottomHintText}>Cevabın kilitlendi, rakipler bekleniyor...</Text>
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
  screenContainer: {
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
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
  categoryPill: {
    height: 40,
    maxWidth: 150,
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
  categoryEmoji: {
    fontSize: 16,
  },
  categoryPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.black,
    flexShrink: 1,
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
  playerCrown: {
    position: 'absolute',
    top: -14,
    left: 14,
    transform: [{ rotate: '-16deg' }],
  },
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
  raceLaurel: {
    fontSize: 11,
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
  raceMoreText: {
    color: '#D9CDF5',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  // ---- Soru Kartı ----
  questionCard: {
    minHeight: 132,
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
    height: 58,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: 29,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(154, 107, 255, 0.6)',
  },
  optCardCompact: {
    height: 50,
    borderRadius: 25,
  },
  optCardTiny: {
    height: 46,
    borderRadius: 23,
  },
  optCardSelected: {
    borderColor: '#FFC43D',
    borderWidth: 2,
  },
  optCardCorrect: {
    borderColor: '#B6FFE0',
    borderWidth: 2,
    shadowColor: '#3FD08A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 8,
  },
  optCardWrong: {
    borderColor: '#FFB3BC',
    borderWidth: 2,
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
  choiceTagCorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 10,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(10, 80, 50, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  choiceTagWrong: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 10,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(110, 10, 30, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  choiceTagCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceTagText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.black,
  },
  choiceTagPending: {
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 196, 61, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.7)',
  },
  choiceTagPendingText: {
    color: '#FFC43D',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  pointsPopup: {
    position: 'absolute',
    right: 6,
    bottom: -16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 4,
    paddingRight: 10,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FF9B2F',
    borderWidth: 2,
    borderColor: '#FFE27A',
    zIndex: 10,
    shadowColor: '#FFC43D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 10,
  },
  pointsPopupText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: THEME.fonts.display,
    textShadowColor: 'rgba(120, 50, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
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
