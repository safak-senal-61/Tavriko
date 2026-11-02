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
const getStoredAuth = (): { user: UserProfile | null; token: string | null } => {
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

const saveStoredAuth = (user: UserProfile | null, token?: string | null) => {
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
  setActiveRoom: (activeRoom) => set({ activeRoom }),
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
  setRoundResult: (lastRoundResult) => set({ lastRoundResult }),
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
