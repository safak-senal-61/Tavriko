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
  selectOption: (optId: string) => void;
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

export const useGameStore = create<GameState>((set) => ({
  user: null,
  token: null,
  setUser: (user, token = null) => set({ user, token }),

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
    set((state) => {
      if (state.isAnswerLocked) return state;
      return { selectedOptionId, isAnswerLocked: true };
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
