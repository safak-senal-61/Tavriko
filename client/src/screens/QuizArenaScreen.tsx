import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AppState,
  AppStateStatus,
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
}) => {
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
      {/* Optional Compact 1v1 Live Duel Banner */}
      {isDuelMode && opponent && (
        <View style={styles.duelStrip}>
          <View style={styles.duelSide}>
            <CharacterAvatar seed={myDisplayName} size={24} />
            <Text style={styles.duelName} numberOfLines={1}>
              {myDisplayName} ({currentScore})
            </Text>
          </View>
          <Text style={styles.duelVsLabel}>VS</Text>
          <View style={styles.duelSide}>
            <Text style={styles.duelName} numberOfLines={1}>
              {opponent.displayName} ({opponent.score})
            </Text>
            <CharacterAvatar
              seed={opponent.avatarUrl || opponent.displayName}
              size={24}
            />
            {opponent.hasAnswered && (
              <View style={styles.opponentCheckBadge}>
                <Text style={styles.opponentCheckText}>✓</Text>
              </View>
            )}
          </View>
        </View>
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