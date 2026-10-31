export type CategoryId = 'geography' | 'mathematics' | 'general_culture' | 'history' | 'science_tech' | 'space_astronomy' | 'sports' | 'cinema_tv' | 'music' | 'literature' | 'biology' | 'physics_chemistry' | 'logic_puzzles' | 'language_vocab' | 'art_culture' | 'food_gastronomy' | 'animals_wildlife' | 'nature_ecology' | 'mixed';
export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert';
export type ReviewStatus = 'pending_review' | 'approved' | 'published' | 'rejected';
export type GameMode = 'duel' | 'quick_match' | 'friends_private' | 'ranked_random' | 'free_for_all' | 'team_battle' | 'tournament' | 'daily_challenge' | 'single_practice';
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
    subCategory?: string;
    difficulty: DifficultyLevel;
    text: string;
    options: QuestionOption[];
    correctOptionId: string;
    explanation: string;
    sourceOrVerification?: string;
    language?: string;
    contentHash?: string;
    reviewStatus?: ReviewStatus;
    createdAt?: string;
    reviewedAt?: string;
    reviewedBy?: string;
    rejectionReason?: string;
    modelMetadata?: {
        model: string;
        promptVersion: string;
    };
    timeLimitSec?: number;
}
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
    lastSelectedOptionId?: string;
    lastAnswerIsCorrect?: boolean;
    lastPointsAwarded?: number;
    lastSpeedBonus?: number;
    totalResponseTimeMs: number;
    correctAnswersCount: number;
}
export type RoomStatus = 'lobby' | 'countdown' | 'question_active' | 'round_result' | 'intermission' | 'game_over';
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
export interface InventoryItem {
    id: string;
    name: string;
    desc: string;
    qty: number;
}
export interface NotificationItem {
    id: string;
    type: 'duel' | 'reward' | 'league' | 'friend' | 'system';
    title: string;
    sub: string;
    timeText: string;
    handled?: 'accepted' | 'declined' | null;
}
export interface UserProfile {
    id: string;
    username: string;
    displayName: string;
    email?: string;
    fullName?: string;
    countryCode?: string;
    countryName?: string;
    phone?: string;
    birthDate?: string;
    gender?: string;
    bio?: string;
    avatarUrl?: string;
    friendCode?: string;
    level: number;
    xp: number;
    coins: number;
    gems?: number;
    dailyStreak?: number;
    dailyChallenge?: {
        lastCompletedDate?: string;
        completedToday?: boolean;
        streakDay?: number;
    };
    rankTitle: string;
    rankPoints: number;
    profileCompletionPct?: number;
    inventory?: InventoryItem[];
    claimedSeasonTiers?: number[];
    friendIds?: string[];
    notifications?: NotificationItem[];
    stats: {
        totalMatches: number;
        wins: number;
        correctAnswers: number;
        totalAnswers: number;
        bestStreak: number;
        avgResponseTimeMs: number;
    };
    categoryMastery: Partial<Record<CategoryId, {
        level: number;
        correctCount: number;
    }>>;
}
export interface QuestionStats {
    total: number;
    pending: number;
    approved: number;
    published: number;
    rejected: number;
    byCategory?: Partial<Record<CategoryId, number>>;
    byDifficulty?: Partial<Record<DifficultyLevel, number>>;
}
export interface LevelProgress {
    level: number;
    rankTitle: string;
    currentLevelXp: number;
    nextLevelXpRequired: number;
    progressPct: number;
    totalXp: number;
}
/**
 * Fair, balanced RPG leveling formula:
 * Level 1: 0 - 300 XP (300 XP needed)
 * Level 2: 300 - 750 XP (450 XP needed)
 * Level 3: 750 - 1350 XP (600 XP needed)
 * Level 4: 1350 - 2100 XP (750 XP needed)
 * Level 5: 2100 - 3000 XP (900 XP needed)
 * Level 6: 3000 - 4050 XP (1050 XP needed)
 * Level 7: 4050 - 5250 XP (1200 XP needed)
 * Level 8: 5250 - 6600 XP (1350 XP needed)
 * Level L requires 300 + (L - 1) * 150 XP.
 */
export declare function calculateLevelFromXp(totalXp?: number): LevelProgress;
export interface DailyChallengeConfig {
    dayNumber: number;
    totalQuestions: number;
    requiredCorrect: number;
    rewardXp: number;
    rewardCoins: number;
    rewardGems: number;
    rewardChest?: string;
    description: string;
}
export declare function getDailyChallengeConfig(streakDay?: number): DailyChallengeConfig;
