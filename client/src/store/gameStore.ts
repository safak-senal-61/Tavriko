import { create } from 'zustand';
import {
  UserProfile,
  GameRoom,
  ClientQuestion,
  RoundResult,
  FinalMatchSummary,
  CategoryId,
  DifficultyLevel,
} from '@trivia/shared';

const STORAGE_KEY_USER = 'tavriko_auth_user';
const STORAGE_KEY_TOKEN = 'tavriko_auth_token';

// Safe universal storage helper for Web, SSR, and Mobile
export const getStoredAuth = (): { user: UserProfile | null; token: string | null } => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const rawUser = window.localStorage.getItem(STORAGE_KEY_USER);
      const rawToken = window.localStorage.getItem(STORAGE_KEY_TOKEN);
      const user = rawUser ? (JSON.parse(rawUser) as UserProfile) : null;
      return { user, token: rawToken || null };
    } catch {
      return { user: null, token: null };
    }
  }
  return { user: null, token: null };
};

export const saveStoredAuth = (user: UserProfile | null, token?: string | null) => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      if (user) {
        window.localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      } else {
        window.localStorage.removeItem(STORAGE_KEY_USER);
      }
      if (token !== undefined) {
        if (token) {
          window.localStorage.setItem(STORAGE_KEY_TOKEN, token);
        } else {
          window.localStorage.removeItem(STORAGE_KEY_TOKEN);
        }
      }
    } catch {}
  }
};

export const clearAllAccountStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(STORAGE_KEY_USER);
      window.localStorage.removeItem(STORAGE_KEY_TOKEN);
      window.localStorage.removeItem('tavriko_permanent_wallet');
      const keys = Object.keys(window.localStorage);
      for (const k of keys) {
        if (k.startsWith('tavriko_wallet_')) {
          window.localStorage.removeItem(k);
        }
      }
    } catch {}
  }
};

interface GameState {
  // Auth & User
  user: UserProfile | null;
  token: string | null;
  setUser: (user: UserProfile | null, token?: string | null) => void;
  // Active Room State
  activeRoom: GameRoom | null;
  setActiveRoom: (room: GameRoom | null) => void;
  // Active Gameplay
  currentQuestion: ClientQuestion | null;
  selectedOptionId: string | null;
  isAnswerLocked: boolean;
  timeRemainingSec: number;
  lastRoundResult: RoundResult | null;
  roundResultsByRound: Record<number, RoundResult>;
  finalSummary: FinalMatchSummary | null;
  // Actions for gameplay
  setCurrentQuestion: (q: ClientQuestion | null) => void;
  selectOption: (optId: string | null) => void;
  setTimeRemaining: (sec: number) => void;
  setRoundResult: (result: RoundResult | null) => void;
  setFinalSummary: (summary: FinalMatchSummary | null) => void;
  resetGame: () => void;
  // Matchmaking
  isSearchingMatch: boolean;
  searchCategory: CategoryId;
  searchDifficulty: DifficultyLevel;
  setSearchingMatch: (searching: boolean, cat?: CategoryId, diff?: DifficultyLevel) => void;
  // User Settings
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  setSoundEnabled: (val: boolean) => void;
  setHapticsEnabled: (val: boolean) => void;
}

const initialAuth = getStoredAuth();

/** Eski 1000'lik ölçekten gelen puanları (örn. 1350) modern 100-150 ölçeğine (135) dönüştürür */
const normalizeScoreScale = (score: number, roundsPlayed: number = 1): number => {
  const s = Math.max(0, Math.round(Number(score) || 0));
  const threshold = Math.max(1, roundsPlayed) * 260;
  return s > threshold ? Math.round(s / 10) : s;
};

/**
 * Yalnızca tamamlanmış turların (ROUND_RESULT) sonuçlarından oyuncunun kesin
 * doğru cevap sayısını hesaplar. Böylece:
 * 1) Herkes cevabını verip tur bitmeden (ROUND_RESULT gelmeden) kimse ilerlemez.
 * 2) ROOM_STATE_SYNC ve ROUND_RESULT üst üste gelse bile aynı tur asla 2 kez sayılmaz!
 */
const getCompletedCorrectCount = (
  roundResultsByRound: Record<number, RoundResult>,
  playerId: string
): number => {
  let count = 0;
  for (const res of Object.values(roundResultsByRound)) {
    if (res?.playerAnswers?.[playerId]?.isCorrect) {
      count += 1;
    }
  }
  return count;
};

/**
 * Yalnızca tamamlanmış turların (ROUND_RESULT) sonuçlarından oyuncunun kesin
 * puanını hesaplar. Tur devam ederken (diğer oyuncular beklenirken) puan değişmez.
 */
const getCompletedScore = (
  roundResultsByRound: Record<number, RoundResult>,
  playerId: string
): number => {
  const roundNums = Object.keys(roundResultsByRound)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (roundNums.length === 0) return 0;

  const latestRoundNum = roundNums[roundNums.length - 1];
  const latestRes = roundResultsByRound[latestRoundNum];
  const lbEntry = latestRes?.leaderboard?.find((e) => e.playerId === playerId);
  if (lbEntry && typeof lbEntry.score === 'number') {
    return normalizeScoreScale(lbEntry.score, latestRoundNum);
  }

  let total = 0;
  for (const rNum of roundNums) {
    const ans = roundResultsByRound[rNum]?.playerAnswers?.[playerId];
    if (ans && typeof ans.pointsEarned === 'number') {
      total += normalizeScoreScale(ans.pointsEarned, 1);
    }
  }
  return total;
};

export const useGameStore = create<GameState>((set) => ({
  user: initialAuth.user,
  token: initialAuth.token,
  setUser: (user, token) => {
    saveStoredAuth(user, token);
    set((state) => ({
      user,
      token: token !== undefined ? token : state.token,
    }));
  },
  activeRoom: null,
  setActiveRoom: (activeRoom) =>
    set((state) => {
      if (!activeRoom) {
        return { activeRoom: null, roundResultsByRound: {}, lastRoundResult: null };
      }
      const isNewRoomOrReset =
        !state.activeRoom ||
        state.activeRoom.code !== activeRoom.code ||
        activeRoom.status === 'lobby' ||
        activeRoom.status === 'countdown';

      if (isNewRoomOrReset) {
        const cleanPlayers = { ...activeRoom.players };
        const cleanScores = { ...activeRoom.scores };
        if (activeRoom.status === 'lobby' || activeRoom.status === 'countdown') {
          for (const [pid, pObj] of Object.entries(cleanPlayers)) {
            cleanPlayers[pid] = {
              ...pObj,
              score: 0,
              correctAnswersCount: 0,
            };
            cleanScores[pid] = 0;
          }
        }
        return {
          activeRoom: {
            ...activeRoom,
            players: cleanPlayers,
            scores: cleanScores,
          },
          roundResultsByRound: {},
          lastRoundResult: null,
        };
      }

      // Oyun aktifken (question_active veya round_result):
      // İlerleme ve puan YALNIZCA tamamlanmış turların (roundResultsByRound) kaydından okunur!
      // Böylece ilk cevap veren oyuncu, diğer oyuncular işaretleyip ROUND_RESULT gelene kadar
      // pistte erken ilerlemez ve state_sync + round_result çakışmasında çift ilerleme olmaz.
      const completedMap = state.roundResultsByRound || {};
      const mergedPlayers = { ...activeRoom.players };
      const mergedScores = { ...activeRoom.scores };

      for (const [pid, pObj] of Object.entries(mergedPlayers)) {
        const authCorrect = getCompletedCorrectCount(completedMap, pid);
        const authScore = getCompletedScore(completedMap, pid);
        mergedPlayers[pid] = {
          ...pObj,
          correctAnswersCount: authCorrect,
          score: authScore,
        };
        mergedScores[pid] = authScore;
      }

      // Odada daha önce bilinen oyuncuları koru
      for (const [pid, prevPlayer] of Object.entries(state.activeRoom.players || {})) {
        if (!mergedPlayers[pid]) {
          const authCorrect = getCompletedCorrectCount(completedMap, pid);
          const authScore = getCompletedScore(completedMap, pid);
          mergedPlayers[pid] = {
            ...prevPlayer,
            correctAnswersCount: authCorrect,
            score: authScore,
          };
          mergedScores[pid] = authScore;
        }
      }

      return {
        activeRoom: {
          ...activeRoom,
          players: mergedPlayers,
          scores: mergedScores,
        },
      };
    }),
  currentQuestion: null,
  selectedOptionId: null,
  isAnswerLocked: false,
  timeRemainingSec: 15,
  lastRoundResult: null,
  roundResultsByRound: {},
  finalSummary: null,
  setCurrentQuestion: (currentQuestion) =>
    set({
      currentQuestion,
      selectedOptionId: null,
      isAnswerLocked: false,
      timeRemainingSec: currentQuestion ? currentQuestion.timeLimitSec : 15,
      lastRoundResult: null,
    }),
  selectOption: (selectedOptionId) =>
    set({
      selectedOptionId,
      isAnswerLocked: selectedOptionId !== null,
    }),
  setTimeRemaining: (timeRemainingSec) => set({ timeRemainingSec }),
  setRoundResult: (lastRoundResult) =>
    set((state) => {
      if (!lastRoundResult || !state.activeRoom) {
        return { lastRoundResult };
      }
      const rNum = Math.max(1, lastRoundResult.roundNumber || state.activeRoom.currentRound || 1);
      const nextRoundResults: Record<number, RoundResult> = {
        ...(state.roundResultsByRound || {}),
        [rNum]: lastRoundResult,
      };

      const nextPlayers = { ...state.activeRoom.players };
      const nextScores = { ...state.activeRoom.scores };

      // Leaderboard içindeki tüm oyuncuları da oyuncu listesine dahil et
      for (const entry of lastRoundResult.leaderboard || []) {
        if (!nextPlayers[entry.playerId]) {
          nextPlayers[entry.playerId] = {
            id: entry.playerId,
            username: entry.username || entry.displayName,
            displayName: entry.displayName,
            avatarUrl: entry.avatarUrl || 'av1',
            score: 0,
            currentStreak: entry.streak || 0,
            isReady: true,
            isHost: false,
            isConnected: true,
            hasAnsweredCurrentRound: true,
            totalResponseTimeMs: 0,
            correctAnswersCount: 0,
          };
        } else {
          nextPlayers[entry.playerId] = {
            ...nextPlayers[entry.playerId],
            currentStreak: entry.streak ?? nextPlayers[entry.playerId].currentStreak,
          };
        }
      }

      // Tüm oyuncuların doğru cevap sayısını ve puanını tamamlanmış turlar tablosundan (1..rNum) kesin olarak hesapla
      const allPlayerIds = new Set<string>([
        ...Object.keys(nextPlayers),
        ...Object.keys(lastRoundResult.playerAnswers || {}),
      ]);

      for (const pid of allPlayerIds) {
        const authCorrect = getCompletedCorrectCount(nextRoundResults, pid);
        const authScore = getCompletedScore(nextRoundResults, pid);
        nextScores[pid] = authScore;
        if (nextPlayers[pid]) {
          nextPlayers[pid] = {
            ...nextPlayers[pid],
            correctAnswersCount: authCorrect,
            score: authScore,
            hasAnsweredCurrentRound: true,
          };
        }
      }

      return {
        lastRoundResult,
        roundResultsByRound: nextRoundResults,
        activeRoom: {
          ...state.activeRoom,
          players: nextPlayers,
          scores: nextScores,
        },
      };
    }),
  setFinalSummary: (finalSummary) => set({ finalSummary }),
  resetGame: () =>
    set({
      currentQuestion: null,
      selectedOptionId: null,
      isAnswerLocked: false,
      lastRoundResult: null,
      roundResultsByRound: {},
      finalSummary: null,
      activeRoom: null,
    }),
  isSearchingMatch: false,
  searchCategory: 'mixed',
  searchDifficulty: 'medium',
  setSearchingMatch: (isSearchingMatch, searchCategory = 'mixed', searchDifficulty = 'medium') =>
    set({ isSearchingMatch, searchCategory, searchDifficulty }),
  soundEnabled: true,
  hapticsEnabled: true,
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
}));
