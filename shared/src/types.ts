export type CategoryId =
  | 'geography'
  | 'mathematics'
  | 'general_culture'
  | 'history'
  | 'science_tech'
  | 'space_astronomy'
  | 'sports'
  | 'cinema_tv'
  | 'music'
  | 'literature'
  | 'biology'
  | 'physics_chemistry'
  | 'logic_puzzles'
  | 'language_vocab'
  | 'art_culture'
  | 'mixed';

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert';

export type GameMode =
  | 'quick_match'
  | 'friends_private'
  | 'ranked_random'
  | 'free_for_all'
  | 'team_battle'
  | 'tournament'
  | 'daily_challenge'
  | 'single_practice';

export interface CategoryInfo {
  id: CategoryId;
  name: string;
  description: string;
  icon: string;
  primaryColor: string;
  accentColor: string;
  totalQuestions: number;
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  categoryId: CategoryId;
  difficulty: DifficultyLevel;
  text: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation: string;
  timeLimitSec?: number;
}

// Client-safe question omitting correctOptionId
export interface ClientQuestion {
  id: string;
  categoryId: CategoryId;
  difficulty: DifficultyLevel;
  text: string;
  options: QuestionOption[];
  roundNumber: number;
  totalRounds: number;
  timeLimitSec: number;
}

export interface Player {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  score: number;
  currentStreak: number;
  isReady: boolean;
  isHost: boolean;
  team?: 'red' | 'blue';
  isConnected: boolean;
  hasAnsweredCurrentRound: boolean;
  lastAnswerTimeMs?: number;
  totalResponseTimeMs: number;
  correctAnswersCount: number;
}

export type RoomStatus =
  | 'lobby'
  | 'countdown'
  | 'question_active'
  | 'round_result'
  | 'intermission'
  | 'game_over';

export interface GameRoom {
  code: string;
  mode: GameMode;
  hostId: string;
  status: RoomStatus;
  category: CategoryId;
  difficulty: DifficultyLevel;
  maxPlayers: number;
  currentRound: number;
  totalRounds: number;
  questionTimeSec: number;
  penaltyForWrong: boolean;
  players: Record<string, Player>;
  currentQuestion?: Question;
  roundStartedAt?: number;
  scores: Record<string, number>;
}

export interface AnswerSubmission {
  roomCode: string;
  questionId: string;
  selectedOptionId: string;
  clientTimestamp: number;
}

export interface RoundResult {
  roundNumber: number;
  correctOptionId: string;
  explanation: string;
  playerAnswers: Record<string, {
    selectedOptionId: string;
    isCorrect: boolean;
    pointsEarned: number;
    speedBonus: number;
    streak: number;
    timeMs: number;
  }>;
  leaderboard: PlayerScoreSummary[];
}

export interface PlayerScoreSummary {
  playerId: string;
  displayName: string;
  avatarUrl?: string;
  score: number;
  rank: number;
  streak: number;
  team?: 'red' | 'blue';
  isHost: boolean;
}

export interface PlayerResult {
  playerId: string;
  name: string;
  score: number;
  avgResponseTimeMs: number;
  correctCount: number;
}

export interface FinalMatchSummary {
  roomCode: string;
  mode: GameMode;
  totalRounds: number;
  podium: {
    first?: PlayerScoreSummary;
    second?: PlayerScoreSummary;
    third?: PlayerScoreSummary;
  };
  rankings: PlayerScoreSummary[];
  teamScores?: {
    red: number;
    blue: number;
    winner: 'red' | 'blue' | 'tie';
  };
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  level: number;
  xp: number;
  coins: number;
  rankTitle: string;
  rankPoints: number;
  stats: {
    totalMatches: number;
    wins: number;
    correctAnswers: number;
    totalAnswers: number;
    bestStreak: number;
    avgResponseTimeMs: number;
  };
  categoryMastery: Partial<Record<CategoryId, { level: number; correctCount: number }>>;
}
