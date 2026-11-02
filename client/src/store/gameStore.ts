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
const STORAGE_KEY_PERMANENT_WALLET = 'tavriko_permanent_wallet';

// Safe universal storage helper for Web, SSR, and Mobile with permanent balance protection
export const getStoredAuth = (): { user: UserProfile | null; token: string | null } => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const rawUser = window.localStorage.getItem(STORAGE_KEY_USER);
      const rawToken = window.localStorage.getItem(STORAGE_KEY_TOKEN);
      let user = rawUser ? (JSON.parse(rawUser) as UserProfile) : null;

      // Check permanent wallet backup (survives logouts and page refreshes)
      const rawPerm = window.localStorage.getItem(STORAGE_KEY_PERMANENT_WALLET);
      let permWallet: { coins?: number; gems?: number; xp?: number; level?: number; email?: string; id?: string } | null = null;
      if (rawPerm) {
        try {
          permWallet = JSON.parse(rawPerm);
        } catch {}
      }

      if (user) {
        if (user.email) {
          const emailWalletRaw = window.localStorage.getItem(`tavriko_wallet_${user.email.toLowerCase()}`);
          if (emailWalletRaw) {
            try {
              const emailWallet = JSON.parse(emailWalletRaw);
              user.coins = Math.max(user.coins ?? 0, emailWallet.coins ?? 0);
              user.gems = Math.max(user.gems ?? 0, emailWallet.gems ?? 0);
              user.xp = Math.max(user.xp ?? 0, emailWallet.xp ?? 0);
              user.level = Math.max(user.level ?? 1, emailWallet.level ?? 1);
            } catch {}
          }
        }
        if (permWallet && (!permWallet.email || !user.email || permWallet.email.toLowerCase() === user.email.toLowerCase())) {
          user.coins = Math.max(user.coins ?? 0, permWallet.coins ?? 0);
          user.gems = Math.max(user.gems ?? 0, permWallet.gems ?? 0);
          user.xp = Math.max(user.xp ?? 0, permWallet.xp ?? 0);
          user.level = Math.max(user.level ?? 1, permWallet.level ?? 1);
        }
      }

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

        const permPayload = {
          id: user.id,
          email: user.email,
          coins: user.coins,
          gems: user.gems,
          xp: user.xp,
          level: user.level,
          savedAt: Date.now(),
        };
        window.localStorage.setItem(STORAGE_KEY_PERMANENT_WALLET, JSON.stringify(permPayload));

        if (user.email) {
          window.localStorage.setItem(`tavriko_wallet_${user.email.toLowerCase()}`, JSON.stringify(permPayload));
        }
        if (user.id) {
          window.localStorage.setItem(`tavriko_wallet_${user.id}`, JSON.stringify(permPayload));
        }
      } else {
        // Safe logout: remove active session but KEEP permanent wallet backups intact!
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
      window.localStorage.removeItem(STORAGE_KEY_PERMANENT_WALLET);
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
