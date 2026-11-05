import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AppState,
  AppStateStatus,
  Animated,
  Platform,
  Easing,
} from 'react-native';
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
  CrownIcon,
  SpeedBoltIcon,
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
// ANADOLU KERVANYOLU YARIŞ PİSTİ (Anatolian Caravan Road Race Track)
//
// Yarış ilerlemesi YALNIZCA doğru cevap sayısına bağlıdır:
//   requiredProgress   = totalQuestions
//   progressPercentage = (correctAnswers / totalQuestions) * 100
// Her doğru cevap tam 1 adım, yanlış / boş cevap 0 adım ekler. Puan, hız
// bonusu veya sabit bir bitiş mesafesi ilerlemeyi ASLA etkilemez.
// ---------------------------------------------------------------------------
export interface RacerInfo {
  id: string;
  displayName: string;
  avatarUrl?: string;
  /** Sadece bilgi amaçlı gösterilir; pist konumunu etkilemez */
  score: number;
  /** Pist konumunu belirleyen tek değer: bu oyunda verilen doğru cevap sayısı */
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

/** Pist geometrisi sabitleri */
const TRACK_PADDING = 12;
const MEDALLION_SIZE = 36;

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
 * Aynı doğru sayısındaki yarışçıları dikey olarak yayar; madalyonlar üst üste binmez.
 * Dönüş: racerId -> dikey ofset (px)
 */
const computeVerticalOffsets = (
  racers: RacerInfo[],
  totalQuestions: number
): Record<string, number> => {
  const groups: Record<number, string[]> = {};
  racers.forEach((r) => {
    const key = clampCorrect(r.correctAnswers, totalQuestions);
    (groups[key] = groups[key] || []).push(r.id);
  });
  const offsets: Record<string, number> = {};
  Object.values(groups).forEach((ids) => {
    const spacing = Math.min(20, 44 / Math.max(1, ids.length - 1 || 1));
    ids.forEach((id, i) => {
      offsets[id] = ids.length === 1 ? 0 : (i - (ids.length - 1) / 2) * spacing;
    });
  });
  return offsets;
};

/** Tek yarışçı Bakır Madalyonu: doğru cevap oranına göre pistte ilerler */
const CaravanMedallion: React.FC<{
  racer: RacerInfo;
  totalQuestions: number;
  isLeader: boolean;
  verticalOffset: number;
  travelWidth: number;
}> = ({ racer, totalQuestions, isLeader, verticalOffset, travelWidth }) => {
  const correct = clampCorrect(racer.correctAnswers, totalQuestions);
  const ratio = correct / Math.max(1, totalQuestions);

  const posAnim = useRef(new Animated.Value(ratio)).current;
  const offsetAnim = useRef(new Animated.Value(verticalOffset)).current;
  const reactionAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // 600ms ease-in-out + bitişte küçük bir sekme
  useEffect(() => {
    Animated.timing(posAnim, {
      toValue: ratio,
      duration: 600,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [ratio, posAnim]);

  useEffect(() => {
    Animated.timing(offsetAnim, {
      toValue: verticalOffset,
      duration: 300,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [verticalOffset, offsetAnim]);

  // Doğru: yukarı süzülen "+1" rozeti. Yanlış: kırmızı sarsıntı (konum değişmez)
  useEffect(() => {
    if (!racer.lastAnswer) return;
    if (racer.lastAnswer.isCorrect) {
      reactionAnim.setValue(0);
      Animated.sequence([
        Animated.spring(reactionAnim, {
          toValue: 1,
          friction: 5,
          tension: 85,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.delay(1600),
        Animated.timing(reactionAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else {
      shakeAnim.setValue(0);
      Animated.sequence(
        [6, -6, 4, -4, 0].map((v) =>
          Animated.timing(shakeAnim, {
            toValue: v,
            duration: 60,
            useNativeDriver: Platform.OS !== 'web',
          })
        )
      ).start();
    }
  }, [racer.lastAnswer, reactionAnim, shakeAnim]);

  const translateX = posAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, travelWidth)],
    extrapolate: 'clamp',
  });

  const reactionTranslateY = reactionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -22],
  });

  const isCorrect = racer.lastAnswer?.isCorrect === true;
  const isWrong = racer.lastAnswer?.isCorrect === false;
  const isFinished = correct >= totalQuestions;

  return (
    <Animated.View
      style={[
        styles.caravanMedallionCluster,
        {
          zIndex: racer.isMe ? 12 : isLeader ? 10 : 5,
          transform: [
            { translateX },
            { translateY: offsetAnim },
            { translateX: shakeAnim },
          ],
        },
      ]}
      pointerEvents="none"
    >
      {isCorrect && (
        <Animated.View
          style={[
            styles.stepPopup,
            { opacity: reactionAnim, transform: [{ translateY: reactionTranslateY }] },
          ]}
        >
          <Text style={styles.stepPopupText}>+1</Text>
        </Animated.View>
      )}

      {(isFinished || (isLeader && correct > 0)) && (
        <View style={styles.racerCrownBadge}>
          <Text style={styles.racerCrownText}>{isFinished ? '🏆' : '👑'}</Text>
        </View>
      )}

      <View
        style={[
          styles.copperMedallionFrame,
          isLeader && styles.copperMedallionLeader,
          isCorrect && styles.copperMedallionCorrect,
          isWrong && styles.copperMedallionWrong,
          racer.isMe && styles.copperMedallionMe,
        ]}
      >
        <CharacterAvatar seed={racer.avatarUrl || racer.displayName} size={28} />
        {racer.hasAnswered ? (
          <View style={styles.racerStatusTick}>
            <Text style={styles.racerStatusTickText}>✓</Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
};

/** Pist + bitiş çizgisi + soru başına kilometre taşları + yarışçı listesi */
const CaravanRaceTrack: React.FC<{
  racers: RacerInfo[];
  totalQuestions: number;
}> = ({ racers, totalQuestions }) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const total = Math.max(1, Math.floor(totalQuestions));

  // Madalyon merkezinin 0% ile 100% arasında kat edebileceği yatay mesafe
  const travelWidth = Math.max(0, trackWidth - TRACK_PADDING * 2 - MEDALLION_SIZE);
  const startX = TRACK_PADDING + MEDALLION_SIZE / 2;
  const finishX = startX + travelWidth;

  const sorted = useMemo(
    () =>
      racers
        .slice()
        .sort(
          (a, b) =>
            clampCorrect(b.correctAnswers, total) - clampCorrect(a.correctAnswers, total) ||
            (b.score || 0) - (a.score || 0)
        ),
    [racers, total]
  );

  const offsets = useMemo(() => computeVerticalOffsets(sorted, total), [sorted, total]);
  const leaderId =
    sorted.length > 0 && clampCorrect(sorted[0].correctAnswers, total) > 0 ? sorted[0].id : null;

  // Soru başına bir kilometre taşı; 20'den fazla soruda kalabalığı önlemek için seyreltilir
  const tickEvery = total > 20 ? Math.ceil(total / 10) : 1;
  const ticks: number[] = [];
  for (let i = 1; i < total; i += 1) {
    if (i % tickEvery === 0) ticks.push(i);
  }

  const recentCorrect = racers.find((r) => r.lastAnswer?.isCorrect);
  const recentWrong = racers.find((r) => r.lastAnswer && !r.lastAnswer.isCorrect);

  return (
    <View style={styles.caravanCard}>
      <View style={styles.caravanHeaderRow}>
        <Text style={styles.caravanHeaderText}>ANADOLU KERVANYOLU</Text>
        <View style={styles.caravanGoalPill}>
          <Text style={styles.caravanGoalText}>Bitiş: {total} doğru</Text>
        </View>
      </View>

      <View style={styles.raceTickerBanner}>
        <Text style={styles.raceTickerText} numberOfLines={1}>
          {recentCorrect
            ? `${recentCorrect.displayName} doğru bildi, kervan 1 adım ilerledi`
            : recentWrong
            ? `${recentWrong.displayName} yanlış cevap verdi, yerinde kaldı`
            : `Her doğru cevap 1 adım · ${total} doğruda bitiş çizgisi`}
        </Text>
      </View>

      <View
        style={styles.caravanTrackField}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - trackWidth) > 0.5) setTrackWidth(w);
        }}
      >
        {trackWidth > 0 && (
          <>
            {/* Kum yolu: başlangıçtan bitişe */}
            <View
              style={[styles.caravanSandPath, { left: startX, width: travelWidth }]}
              pointerEvents="none"
            />

            {/* Her doğru cevap için bir kilometre taşı */}
            {ticks.map((i) => (
              <View
                key={i}
                style={[styles.caravanTick, { left: startX + (i / total) * travelWidth - 1 }]}
                pointerEvents="none"
              />
            ))}

            {/* Bitiş çizgisi = %100 */}
            <View style={[styles.caravanFinishLine, { left: finishX - 2 }]} pointerEvents="none" />
            <View style={[styles.caravanFinishFlag, { left: finishX - 10 }]} pointerEvents="none">
              <Text style={styles.caravanFinishFlagText}>🏁</Text>
            </View>

            {sorted.map((racer) => (
              <CaravanMedallion
                key={racer.id}
                racer={racer}
                totalQuestions={total}
                isLeader={racer.id === leaderId}
                verticalOffset={offsets[racer.id] || 0}
                travelWidth={travelWidth}
              />
            ))}
          </>
        )}
      </View>

      {/* Yarışçı listesi: doğru sayısı ve yüzde */}
      <View style={styles.caravanLegend}>
        {sorted.map((racer) => {
          const correct = clampCorrect(racer.correctAnswers, total);
          const pct = Math.round(getRaceProgressPercentage(correct, total));
          return (
            <View
              key={racer.id}
              style={[styles.caravanLegendRow, racer.isMe && styles.caravanLegendRowMe]}
            >
              <Text style={styles.caravanLegendName} numberOfLines={1}>
                {racer.displayName}
                {racer.isMe ? ' (Sen)' : ''}
              </Text>
              <Text style={styles.caravanLegendValue}>
                {correct}/{total} · %{pct}
              </Text>
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
  // Yarışçılar (doğru cevap sayılarıyla birlikte) RootNavigator'dan gelir.
  // Burada puandan doğru sayısı TAHMİN EDİLMEZ; veri yoksa pist gösterilmez.
  const activeRacers: RacerInfo[] = racersProp || [];
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
      {/* ANADOLU KERVANYOLU: ilerleme = doğru cevap sayısı / toplam soru */}
      {activeRacers.length > 0 && (
        <CaravanRaceTrack
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
  // ANADOLU KERVANYOLU PİSTİ (Warm Sand & Deep Teal & Copper Theme)
  caravanCard: {
    backgroundColor: '#0A252E',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#C87D55',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
    gap: 6,
    shadowColor: '#C87D55',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  caravanHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  caravanEmoji: {
    fontSize: 14,
  },
  caravanHeaderText: {
    color: '#E5C396',
    fontSize: 11.5,
    fontFamily: THEME.fonts.display,
    letterSpacing: 0.8,
  },
  caravanGoalPill: {
    backgroundColor: 'rgba(200, 125, 85, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C87D55',
  },
  caravanGoalText: {
    color: '#FFC43D',
    fontSize: 10.5,
    fontFamily: THEME.fonts.extraBold,
  },
  caravanTrackField: {
    height: 84,
    borderRadius: 14,
    backgroundColor: '#0D333F',
    borderWidth: 1,
    borderColor: 'rgba(200, 125, 85, 0.3)',
    position: 'relative',
    overflow: 'visible',
    marginVertical: 4,
  },
  caravanSandPath: {
    position: 'absolute',
    top: '50%',
    marginTop: -2,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C9A86A',
    opacity: 0.45,
  },
  caravanTick: {
    position: 'absolute',
    top: '50%',
    marginTop: -6,
    width: 2,
    height: 12,
    borderRadius: 1,
    backgroundColor: 'rgba(229, 195, 150, 0.35)',
  },
  caravanFinishLine: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    width: 4,
    borderRadius: 2,
    backgroundColor: '#FFC43D',
    opacity: 0.85,
  },
  caravanFinishFlag: {
    position: 'absolute',
    top: -4,
    width: 20,
    alignItems: 'center',
  },
  caravanFinishFlagText: {
    fontSize: 13,
  },
  caravanMedallionCluster: {
    position: 'absolute',
    left: 12, // TRACK_PADDING
    top: '50%',
    marginTop: -18, // MEDALLION_SIZE / 2
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copperMedallionFrame: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#C87D55',
    backgroundColor: '#0A252E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C87D55',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  copperMedallionLeader: {
    borderColor: '#FFC43D',
    shadowColor: '#FFC43D',
    shadowOpacity: 0.8,
  },
  copperMedallionCorrect: {
    borderColor: '#3FD08A',
  },
  copperMedallionWrong: {
    borderColor: '#FF5A6A',
  },
  copperMedallionMe: {
    borderWidth: 3,
  },
  stepPopup: {
    position: 'absolute',
    top: -16,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: '#1E4631',
    borderWidth: 1,
    borderColor: '#3FD08A',
    zIndex: 20,
  },
  stepPopupText: {
    color: '#3FD08A',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  caravanLegend: {
    gap: 4,
  },
  caravanLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  caravanLegendRowMe: {
    backgroundColor: 'rgba(255, 196, 61, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.35)',
  },
  caravanLegendName: {
    flex: 1,
    color: '#E5C396',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    marginRight: 8,
  },
  caravanLegendValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  raceCard: {
    backgroundColor: 'rgba(10, 4, 24, 0.55)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
    gap: 6,
  },
  raceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  raceHeaderText: {
    color: '#FFC43D',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.6,
  },
  raceTargetText: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  raceLane: {
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
  },
  raceLaneMe: {
    backgroundColor: 'rgba(255, 196, 61, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.35)',
  },
  raceTrackLine: {
    position: 'absolute',
    left: 6,
    right: 34,
    top: '50%',
    marginTop: -1.5,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  raceFinishWrap: {
    position: 'absolute',
    right: 2,
    top: 0,
    height: 34,
    width: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  raceFinishIcon: {
    fontSize: 15,
  },
  racerCluster: {
    position: 'absolute',
    left: 6,
    top: 0,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 3,
  },
  racerLeaderCluster: {
    zIndex: 5,
  },
  racerInfoPill: {
    maxWidth: 150,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(30, 14, 61, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(154, 107, 255, 0.35)',
  },
  racerInfoPillMe: {
    borderColor: '#FFC43D',
  },
  racerInfoText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  racerAnsweredBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#5ADBB5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  racerAnsweredText: {
    color: '#082520',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },

  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3FD08A',
    shadowColor: '#3FD08A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  raceTargetPill: {
    backgroundColor: 'rgba(255, 196, 61, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFC43D',
  },
  raceTickerBanner: {
    backgroundColor: 'rgba(107, 60, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(107, 60, 255, 0.4)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  raceTickerText: {
    color: '#FFC43D',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
  },
  raceLaneLeader: {
    borderColor: 'rgba(255, 196, 61, 0.5)',
  },
  raceMilestone: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  raceFinishText: {
    color: '#FFC43D',
    fontSize: 8.5,
    fontFamily: THEME.fonts.extraBold,
    marginTop: -2,
  },
  floatingReactionBadge: {
    position: 'absolute',
    top: -6,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    zIndex: 20,
    borderWidth: 1,
  },
  floatingReactionCorrect: {
    backgroundColor: '#1E4631',
    borderColor: '#3FD08A',
  },
  floatingReactionCorrectText: {
    color: '#3FD08A',
    fontSize: 9,
    fontFamily: THEME.fonts.extraBold,
  },
  floatingReactionWrong: {
    backgroundColor: '#47141C',
    borderColor: '#FF5A6A',
  },
  floatingReactionWrongText: {
    color: '#FF8598',
    fontSize: 9,
    fontFamily: THEME.fonts.extraBold,
  },
  racerCrownBadge: {
    position: 'absolute',
    top: -12,
    left: 10,
    zIndex: 15,
  },
  racerCrownText: {
    fontSize: 12,
  },
  racerAvatarFrame: {
    position: 'relative',
    borderRadius: 18,
    padding: 2,
    borderWidth: 2,
    borderColor: 'rgba(154, 107, 255, 0.4)',
    backgroundColor: '#1C0C3E',
  },
  racerAvatarLeader: {
    borderColor: '#FFC43D',
    shadowColor: '#FFC43D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  racerAvatarCorrect: {
    borderColor: '#3FD08A',
    shadowColor: '#3FD08A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  racerAvatarWrong: {
    borderColor: '#FF5A6A',
    shadowColor: '#FF5A6A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  racerAvatarMe: {
    borderColor: '#84D8FF',
  },
  racerStatusTick: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3FD08A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#1C0C3E',
  },
  racerStatusTickText: {
    color: '#082520',
    fontSize: 9,
    fontWeight: '900',
  },
  racerStatusThinking: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 196, 61, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#1C0C3E',
  },
  racerStatusThinkingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFC43D',
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