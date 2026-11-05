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
    targetPool?: 'standard' | 'daily_challenge' | 'custom_room';
    isDailyChallenge?: boolean;
    isCustomRoomOnly?: boolean;
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
    isBot?: boolean;
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
    categories?: CategoryId[];
    mixedCategories?: boolean;
    privacy?: 'public' | 'private' | 'password';
    password?: string;
    players: Record<string, Player>;
    currentQuestion?: Question;
    roundStartedAt?: number;
    scores: Record<string, number>;
}
export interface PublicRoomSummary {
    code: string;
    name?: string;
    hostName: string;
    category: string;
    categoryName?: string;
    playerCount: number;
    maxPlayers: number;
    questionTimeSec: number;
    totalRounds: number;
    penaltyForWrong: boolean;
    status: RoomStatus;
    createdAt: number;
}
export interface LobbyMessagePayload {
    id: string;
    roomCode: string;
    playerId: string;
    displayName: string;
    avatarUrl?: string;
    text: string;
    timestamp: number;
}
export interface CustomRoomSettings {
    maxPlayers: number;
    totalRounds: number;
    difficulty: DifficultyLevel | 'mixed';
    questionTimeSec: number;
    categories?: CategoryId[];
    mixedCategories?: boolean;
    penaltyForWrong?: boolean;
    privacy?: 'public' | 'private';
    password?: string;
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
    isBot?: boolean;
    correctAnswersCount?: number;
}
export interface PlayerResult {
    playerId: string;
    name: string;
    score: number;
    avgResponseTimeMs: number;
    correctCount: number;
}
export interface MatchQuestionReviewItem {
    roundNumber: number;
    questionText: string;
    userAnswerText?: string;
    correctAnswerText: string;
    isCorrect: boolean;
    isTimeout: boolean;
    pointsEarned: number;
    explanation?: string;
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
    questionReviews?: MatchQuestionReviewItem[];
}
export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type ItemCategory = 'chest' | 'key' | 'booster' | 'cosmetic' | 'badge' | 'avatar' | 'frame' | 'name_effect' | 'background';
export interface InventoryItem {
    id: string;
    name: string;
    desc: string;
    qty: number;
    category?: ItemCategory;
    rarity?: ItemRarity;
    icon?: string;
    equipped?: boolean;
}
export interface NotificationItem {
    id: string;
    type: 'duel' | 'reward' | 'league' | 'friend' | 'system' | 'friend_request' | 'match_invite';
    title: string;
    sub: string;
    timeText: string;
    handled?: 'accepted' | 'declined' | null;
    senderId?: string;
    senderName?: string;
    senderAvatar?: string;
    roomCode?: string;
}
export interface UserSettings {
    sfxEnabled?: boolean;
    sfxVolume?: '25' | '50' | '75' | '100';
    musicEnabled?: boolean;
    musicVolume?: '25' | '50' | '75' | '100';
    hapticsEnabled?: boolean;
    hapticIntensity?: 'light' | 'medium' | 'strong';
    timerAlertSound?: boolean;
    victoryMelody?: boolean;
    smoothAnimations?: boolean;
    batterySaver?: boolean;
    ambientGlow?: boolean;
    textSize?: 'normal' | 'large';
    buttonSpring?: boolean;
    defaultDifficulty?: 'easy' | 'medium' | 'hard';
    questionCount?: number;
    questionTimeSec?: number;
    penaltyForWrong?: boolean;
    autoNextQuestion?: boolean;
    doubleTapProtection?: boolean;
    notifsEnabled?: boolean;
    duelInvitesAllowed?: boolean;
    roomInvitesAllowed?: boolean;
    onlineStatusVisible?: boolean;
    profilePublic?: boolean;
    friendRequestsAllowed?: boolean;
    dailyReminder?: boolean;
    seasonAlerts?: boolean;
    friendActivity?: boolean;
    themeMode?: 'dark' | 'vibrant' | 'midnight';
    equippedTitle?: string;
}
export interface UserProfile {
    isGuest?: boolean;
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
    seasonXp?: number;
    hasPremiumPass?: boolean;
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
    claimedSeasonFreeTiers?: number[];
    claimedSeasonPremiumTiers?: number[];
    equippedFrame?: string;
    equippedBadge?: string;
    equippedNameEffect?: string;
    equippedBackground?: string;
    activeBoosterExpiresAt?: number;
    friendIds?: string[];
    notifications?: NotificationItem[];
    eventProgress?: Record<string, {
        progress: number;
        completed: boolean;
        claimed: boolean;
    }>;
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
    settings?: UserSettings;
}
export interface QuestionStats {
    total: number;
    pending: number;
    approved: number;
    published: number;
    rejected: number;
    byCategory?: Partial<Record<CategoryId, number>>;
    byDifficulty?: Partial<Record<DifficultyLevel, number>>;
    matrix?: Record<string, Record<string, number>>;
    pools?: Record<string, number>;
    categoriesDetail?: Array<{
        id: CategoryId;
        name: string;
        icon: string;
        total: number;
        easy: number;
        medium: number;
        hard: number;
        expert: number;
    }>;
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
 * Steep, balanced RPG leveling curve designed for longevity:
 * - Level 1: 500 XP
 * - Level 2: 800 XP
 * - Level 3: 1,200 XP
 * - Level 4: 1,700 XP
 * - Level 5: 2,300 XP
 * - Level 6..10: Progressive +1,200 XP per level (reach ~8,300 XP at Level 10)
 * - Level 11..20: Noticeably harder, +2,200 XP per level (~30,000 XP per level at Level 20)
 * - Level 21..30: Serious dedication, +5,000 XP per level (~80,000 XP at Level 30)
 * - Level 31+: Veteran players only, +12,000 XP per level
 */
export declare function getXpRequiredForLevel(level: number): number;
export declare function calculateLevelFromXp(totalXp?: number): LevelProgress;
export interface SeasonReward {
    type: 'coin' | 'gem' | 'key' | 'chest' | 'booster' | 'frame' | 'badge' | 'name_effect' | 'background';
    amount: number;
    title: string;
    itemId?: string;
    rarity?: ItemRarity;
}
export interface SeasonTierItem {
    tier: number;
    requiredSeasonXp: number;
    freeReward: SeasonReward;
    premiumReward: SeasonReward;
}
export declare function generateSeason1Tiers(): SeasonTierItem[];
export declare const SEASON_1_TIERS: SeasonTierItem[];
export type ShopProductCategory = 'featured' | 'diamonds' | 'gold' | 'chests' | 'keys' | 'avatars' | 'frames' | 'badges' | 'name_effects' | 'boosters' | 'backgrounds';
export interface ShopProduct {
    id: string;
    name: string;
    desc: string;
    category: ShopProductCategory;
    price: number;
    currency: 'coins' | 'gems' | 'try';
    rarity: ItemRarity;
    badge?: string;
    bonusText?: string;
    discountPct?: number;
    grantItems?: {
        id: string;
        name: string;
        desc: string;
        qty: number;
        category: ItemCategory;
        rarity: ItemRarity;
    }[];
    grantCoins?: number;
    grantGems?: number;
    grantPremiumPass?: boolean;
}
export declare const SHOP_CATALOG: ShopProduct[];
export interface GameEvent {
    id: string;
    type: 'daily' | 'weekly' | 'special';
    title: string;
    desc: string;
    targetCount: number;
    currentCount?: number;
    started?: boolean;
    completed?: boolean;
    claimed?: boolean;
    metric: 'matches_played' | 'correct_answers' | 'wins' | 'streak' | 'category_solved';
    categoryFilter?: CategoryId;
    rewardCoins: number;
    rewardGems: number;
    rewardXp: number;
    rewardSeasonXp: number;
    rewardItem?: {
        id: string;
        name: string;
        desc: string;
        qty: number;
        category: ItemCategory;
        rarity: ItemRarity;
    };
    endsInHours: number;
}
export declare const EVENT_DEFINITIONS: GameEvent[];
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
