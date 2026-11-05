import {
  GameRoom,
  PlayerResult,
  PlayerScoreSummary,
  RoundResult,
  FinalMatchSummary,
} from './types';

export interface ScoreInput {
  isCorrect: boolean;
  timeRemainingMs: number;
  totalTimeMs: number;
  currentStreak: number;
  penaltyForWrong: boolean;
}

export interface ScoreCalculationResult {
  pointsAwarded: number;
  speedBonus: number;
  streakBonus: number;
  streak: number;
}

export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 50;
export const WRONG_ANSWER_PENALTY = 0;

/**
 * Calculates score for a submitted answer based on correctness, speed and streak.
 * Clean, logical scale: 100 base + 0..50 speed bonus + up to +50 streak bonus per correct answer.
 */
export function calculateScore(input: ScoreInput): ScoreCalculationResult {
  const { isCorrect, timeRemainingMs, totalTimeMs, currentStreak } = input;

  if (!isCorrect) {
    return {
      pointsAwarded: 0,
      speedBonus: 0,
      streakBonus: 0,
      streak: 0,
    };
  }

  // Calculate speed ratio (clamped between 0 and 1)
  const ratio = Math.max(0, Math.min(1, timeRemainingMs / Math.max(1, totalTimeMs)));
  const speedBonus = Math.round(ratio * MAX_SPEED_BONUS);

  // Streak bonus: +10 for each streak level after 1, up to max +50
  const nextStreak = currentStreak + 1;
  let streakBonus = 0;
  if (nextStreak > 1) {
    streakBonus = Math.min(50, (nextStreak - 1) * 10);
  }

  const pointsAwarded = BASE_POINTS + speedBonus + streakBonus;

  return {
    pointsAwarded,
    speedBonus,
    streakBonus,
    streak: nextStreak,
  };
}

/**
 * Sorts and ranks players deterministically.
 * High score first.
 * If tied, fastest average response time wins.
 */
export function calculateRankings(players: PlayerResult[]): PlayerResult[] {
  return [...players].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Tie breaker: lower average response time wins
    return a.avgResponseTimeMs - b.avgResponseTimeMs;
  });
}

/**
 * Shared authoritative helper: applies a player's submitted answer to room state,
 * updating score, streak, response time, and correctAnswersCount (+1 for correct, +0 for wrong).
 */
export function applyPlayerRoundAnswer(
  room: GameRoom,
  playerId: string,
  selectedOptionId: string,
  elapsedMs: number
): ScoreCalculationResult & { isCorrect: boolean } {
  const player = room.players[playerId];
  const question = room.currentQuestion;
  if (!player || !question) {
    return { isCorrect: false, pointsAwarded: 0, speedBonus: 0, streakBonus: 0, streak: 0 };
  }

  const totalTimeMs = (question.timeLimitSec || room.questionTimeSec || 15) * 1000;
  const timeRemainingMs = Math.max(0, totalTimeMs - elapsedMs);
  const isCorrect = selectedOptionId === question.correctOptionId;

  const scoreResult = calculateScore({
    isCorrect,
    timeRemainingMs,
    totalTimeMs,
    currentStreak: player.currentStreak,
    penaltyForWrong: room.penaltyForWrong,
  });

  player.hasAnsweredCurrentRound = true;
  player.lastAnswerTimeMs = elapsedMs;
  player.lastSelectedOptionId = selectedOptionId;
  player.lastAnswerIsCorrect = isCorrect;
  player.lastPointsAwarded = scoreResult.pointsAwarded;
  player.lastSpeedBonus = scoreResult.speedBonus;
  player.totalResponseTimeMs += elapsedMs;
  player.score += scoreResult.pointsAwarded;
  player.currentStreak = scoreResult.streak;
  if (isCorrect) {
    player.correctAnswersCount += 1;
  }
  room.scores[playerId] = player.score;

  return {
    isCorrect,
    ...scoreResult,
  };
}

/**
 * Builds the sorted leaderboard for a GameRoom, preserving each player's correctAnswersCount.
 */
export function buildRoomLeaderboard(room: GameRoom): PlayerScoreSummary[] {
  const playersArray = Object.values(room.players);
  const sorted = calculateRankings(
    playersArray.map((p) => ({
      playerId: p.id,
      name: p.displayName,
      score: p.score,
      avgResponseTimeMs:
        p.correctAnswersCount > 0
          ? Math.round(p.totalResponseTimeMs / (p.correctAnswersCount || 1))
          : 999999,
      correctCount: p.correctAnswersCount,
    }))
  );

  return sorted.map((res, index) => {
    const p = room.players[res.playerId];
    return {
      playerId: p.id,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      score: p.score,
      rank: index + 1,
      streak: p.currentStreak,
      team: p.team,
      isHost: !!p.isHost,
      correctAnswersCount: p.correctAnswersCount,
    };
  });
}

/**
 * Evaluates the current round of a GameRoom and constructs the authoritative RoundResult payload.
 */
export function evaluateRoundResult(room: GameRoom): RoundResult {
  room.status = 'round_result';

  const playerAnswers: RoundResult['playerAnswers'] = {};
  Object.values(room.players).forEach((p) => {
    playerAnswers[p.id] = {
      selectedOptionId: p.lastSelectedOptionId || '',
      isCorrect: !!p.lastAnswerIsCorrect,
      pointsEarned: p.lastPointsAwarded || 0,
      speedBonus: p.lastSpeedBonus || 0,
      streak: p.currentStreak,
      timeMs: p.lastAnswerTimeMs || 0,
    };
  });

  const leaderboard = buildRoomLeaderboard(room);

  return {
    roundNumber: room.currentRound,
    correctOptionId: room.currentQuestion?.correctOptionId || '',
    explanation: room.currentQuestion?.explanation || '',
    playerAnswers,
    leaderboard,
  };
}

/**
 * Finalizes a GameRoom and returns the authoritative FinalMatchSummary.
 */
export function buildFinalMatchSummary(room: GameRoom): FinalMatchSummary {
  room.status = 'game_over';
  const rankings = buildRoomLeaderboard(room);

  let teamScores: FinalMatchSummary['teamScores'];
  if (room.mode === 'team_battle') {
    let redTotal = 0;
    let blueTotal = 0;
    Object.values(room.players).forEach((p) => {
      if (p.team === 'red') redTotal += p.score;
      if (p.team === 'blue') blueTotal += p.score;
    });
    teamScores = {
      red: redTotal,
      blue: blueTotal,
      winner: redTotal > blueTotal ? 'red' : blueTotal > redTotal ? 'blue' : 'tie',
    };
  }

  return {
    roomCode: room.code,
    mode: room.mode,
    totalRounds: room.totalRounds,
    podium: {
      first: rankings[0],
      second: rankings[1],
      third: rankings[2],
    },
    rankings,
    teamScores,
  };
}
