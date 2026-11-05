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
      if (
        !activeRoom ||
        !state.activeRoom ||
        state.activeRoom.code !== activeRoom.code ||
        activeRoom.status === 'lobby'
      ) {
        return { activeRoom };
      }
      const mergedPlayers = { ...activeRoom.players };
      const mergedScores = { ...activeRoom.scores };
      for (const [pid, prevPlayer] of Object.entries(state.activeRoom.players || {})) {
        if (mergedPlayers[pid]) {
          mergedPlayers[pid] = {
            ...mergedPlayers[pid],
            correctAnswersCount: Math.max(
              mergedPlayers[pid].correctAnswersCount || 0,
              prevPlayer.correctAnswersCount || 0
            ),
            score: Math.max(mergedPlayers[pid].score || 0, prevPlayer.score || 0),
          };
          mergedScores[pid] = Math.max(mergedScores[pid] || 0, mergedPlayers[pid].score || 0);
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
      const alreadyApplied =
        (state.lastRoundResult as RoundResult | null)?.roundNumber ===
        lastRoundResult.roundNumber;
      const nextPlayers = { ...state.activeRoom.players };
      const nextScores = { ...state.activeRoom.scores };
      const byLeaderboard: Record<string, number | undefined> = {};
      for (const entry of lastRoundResult.leaderboard || []) {
        nextScores[entry.playerId] = entry.score;
        byLeaderboard[entry.playerId] = entry.correctAnswersCount;
        if (nextPlayers[entry.playerId]) {
          nextPlayers[entry.playerId] = {
            ...nextPlayers[entry.playerId],
            score: entry.score,
            currentStreak: entry.streak,
            ...(typeof entry.correctAnswersCount === 'number'
              ? { correctAnswersCount: entry.correctAnswersCount }
              : {}),
          };
        } else {
          nextPlayers[entry.playerId] = {
            id: entry.playerId,
            username: entry.username || entry.displayName,
            displayName: entry.displayName,
            avatarUrl: entry.avatarUrl || 'av1',
            score: entry.score,
            currentStreak: entry.streak || 0,
            isReady: true,
            isHost: false,
            isConnected: true,
            hasAnsweredCurrentRound: true,
            totalResponseTimeMs: 0,
            correctAnswersCount:
              typeof entry.correctAnswersCount === 'number' ? entry.correctAnswersCount : 0,
          };
        }
      }
      if (!alreadyApplied) {
        for (const [pid, ans] of Object.entries(lastRoundResult.playerAnswers || {})) {
          if (
            nextPlayers[pid] &&
            typeof byLeaderboard[pid] !== 'number' &&
            ans?.isCorrect
          ) {
            nextPlayers[pid] = {
              ...nextPlayers[pid],
              correctAnswersCount: (nextPlayers[pid].correctAnswersCount || 0) + 1,
            };
          }
        }
      }
      return {
        lastRoundResult,
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
