import {
  GameRoom,
  Player,
  Question,
  ClientQuestion,
  GameMode,
  CategoryId,
  DifficultyLevel,
  calculateScore,
  calculateRankings,
  RoundResult,
  FinalMatchSummary,
  PlayerScoreSummary,
} from '@trivia/shared';
import { GameStateMachine } from './GameStateMachine';

export interface CreateRoomOptions {
  code?: string;
  hostId: string;
  hostName: string;
  avatarUrl?: string;
  mode?: GameMode;
  category?: CategoryId;
  difficulty?: DifficultyLevel;
  maxPlayers?: number;
  totalRounds?: number;
  questionTimeSec?: number;
  penaltyForWrong?: boolean;
}

export interface JoinRoomOptions {
  playerId: string;
  displayName: string;
  avatarUrl?: string;
  team?: 'red' | 'blue';
}

export type QuestionProvider = (
  category: CategoryId,
  difficulty: DifficultyLevel,
  count: number
) => Question[];

export interface AnswerSubmissionResult {
  accepted: boolean;
  reason?: string;
  isCorrect?: boolean;
  pointsAwarded?: number;
  speedBonus?: number;
  streak?: number;
}

export class GameRoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private stateMachines: Map<string, GameStateMachine> = new Map();
  private questionsByRoom: Map<string, Question[]> = new Map();
  private roundTimers: Map<string, NodeJS.Timeout> = new Map();
  private questionProvider: QuestionProvider;

  // Event callbacks for real-time socket propagation
  public onRoundStart?: (roomCode: string, question: ClientQuestion) => void;
  public onRoundEnd?: (roomCode: string, result: RoundResult) => void;
  public onGameOver?: (roomCode: string, summary: FinalMatchSummary) => void;
  public onStateSync?: (roomCode: string, room: GameRoom) => void;

  constructor(questionProvider: QuestionProvider) {
    this.questionProvider = questionProvider;
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  public getActiveRoomsCount(): number {
    return this.rooms.size;
  }

  public createRoom(options: CreateRoomOptions): GameRoom {
    let code = options.code ? options.code.toUpperCase() : this.generateCode();
    while (!options.code && this.rooms.has(code)) {
      code = this.generateCode();
    }

    const host: Player = {
      id: options.hostId,
      username: options.hostName.toLowerCase().replace(/\s+/g, '_'),
      displayName: options.hostName,
      avatarUrl: options.avatarUrl,
      score: 0,
      currentStreak: 0,
      isReady: true,
      isHost: true,
      team: options.mode === 'team_battle' ? 'red' : undefined,
      isConnected: true,
      hasAnsweredCurrentRound: false,
      totalResponseTimeMs: 0,
      correctAnswersCount: 0,
    };

    const room: GameRoom = {
      code,
      mode: options.mode || 'friends_private',
      hostId: options.hostId,
      status: 'lobby',
      category: options.category || 'general_culture',
      difficulty: options.difficulty || 'medium',
      maxPlayers: options.maxPlayers || 8,
      currentRound: 0,
      totalRounds: options.totalRounds || 10,
      questionTimeSec: options.questionTimeSec || 15,
      penaltyForWrong: options.penaltyForWrong ?? false,
      players: { [options.hostId]: host },
      scores: { [options.hostId]: 0 },
    };

    this.rooms.set(code, room);
    this.stateMachines.set(code, new GameStateMachine('lobby'));

    return room;
  }

  public joinRoom(code: string, options: JoinRoomOptions): { success: boolean; error?: string; room?: GameRoom } {
    const room = this.getRoom(code);
    if (!room) {
      return { success: false, error: 'Oda bulunamadı' };
    }

    if (room.status !== 'lobby') {
      return { success: false, error: 'Oyun devam ediyor veya oda kilitli' };
    }

    const currentCount = Object.keys(room.players).length;
    if (currentCount >= room.maxPlayers) {
      return { success: false, error: 'Oda dolu' };
    }

    // Assign team if team battle
    let team = options.team;
    if (room.mode === 'team_battle' && !team) {
      const redCount = Object.values(room.players).filter((p) => p.team === 'red').length;
      const blueCount = Object.values(room.players).filter((p) => p.team === 'blue').length;
      team = redCount <= blueCount ? 'red' : 'blue';
    }

    const player: Player = {
      id: options.playerId,
      username: options.displayName.toLowerCase().replace(/\s+/g, '_'),
      displayName: options.displayName,
      avatarUrl: options.avatarUrl,
      score: 0,
      currentStreak: 0,
      isReady: false,
      isHost: false,
      team,
      isConnected: true,
      hasAnsweredCurrentRound: false,
      totalResponseTimeMs: 0,
      correctAnswersCount: 0,
    };

    room.players[options.playerId] = player;
    room.scores[options.playerId] = 0;

    return { success: true, room };
  }

  public toggleReady(code: string, playerId: string): boolean {
    const room = this.getRoom(code);
    if (!room || !room.players[playerId]) return false;
    room.players[playerId].isReady = !room.players[playerId].isReady;
    return true;
  }

  public startGame(code: string, requesterId: string): boolean {
    const room = this.getRoom(code);
    if (!room || room.hostId !== requesterId) return false;

    // Fetch questions for this match
    const questions = this.questionProvider(room.category, room.difficulty, room.totalRounds);
    if (questions.length === 0) return false;

    this.questionsByRoom.set(code, questions);
    room.totalRounds = questions.length;
    room.currentRound = 0;

    this.advanceToNextRound(code);
    return true;
  }

  private advanceToNextRound(code: string): void {
    const room = this.getRoom(code);
    if (!room) return;

    room.currentRound += 1;
    const questions = this.questionsByRoom.get(code);

    if (!questions || room.currentRound > questions.length) {
      this.finishGame(code);
      return;
    }

    // Reset player round states
    Object.values(room.players).forEach((p) => {
      p.hasAnsweredCurrentRound = false;
      p.lastAnswerTimeMs = 0;
      p.lastSelectedOptionId = undefined;
      p.lastAnswerIsCorrect = undefined;
      p.lastPointsAwarded = 0;
      p.lastSpeedBonus = 0;
    });

    const question = questions[room.currentRound - 1];
    room.currentQuestion = question;
    room.status = 'question_active';
    room.roundStartedAt = Date.now();

    const clientQuestion = this.getClientQuestion(code);
    if (clientQuestion && this.onRoundStart) {
      this.onRoundStart(code, clientQuestion);
    }

    // Clear existing timer if any
    const existingTimer = this.roundTimers.get(code);
    if (existingTimer) clearTimeout(existingTimer);

    // Authoritative server timer for round end
    const timerDurationMs = (question.timeLimitSec || room.questionTimeSec) * 1000;
    const timer = setTimeout(() => {
      this.endCurrentRound(code);
    }, timerDurationMs);

    this.roundTimers.set(code, timer);
  }

  public submitAnswer(
    code: string,
    playerId: string,
    selectedOptionId: string,
    clientTimestamp: number
  ): AnswerSubmissionResult {
    const room = this.getRoom(code);
    if (!room || room.status !== 'question_active' || !room.currentQuestion) {
      return { accepted: false, reason: 'Soru aktif değil' };
    }

    const player = room.players[playerId];
    if (!player) {
      return { accepted: false, reason: 'Oyuncu bulunamadı' };
    }

    if (player.hasAnsweredCurrentRound) {
      return { accepted: false, reason: 'Bu soruya zaten cevap verdiniz' };
    }

    const now = Date.now();
    const roundStartedAt = room.roundStartedAt || now;
    const totalTimeMs = (room.currentQuestion.timeLimitSec || room.questionTimeSec) * 1000;
    const elapsedMs = Math.max(0, now - roundStartedAt);
    const timeRemainingMs = Math.max(0, totalTimeMs - elapsedMs);

    // Strict server-side expiration: if elapsed exceeds total limit with 500ms grace, reject
    if (elapsedMs > totalTimeMs + 500) {
      player.hasAnsweredCurrentRound = true;
      return { accepted: false, reason: 'Soru süresi doldu' };
    }

    const isCorrect = selectedOptionId === room.currentQuestion.correctOptionId;

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

    // Check if all connected players have answered
    const connectedPlayers = Object.values(room.players).filter((p) => p.isConnected);
    const allAnswered = connectedPlayers.every((p) => p.hasAnsweredCurrentRound);

    if (allAnswered) {
      const timer = this.roundTimers.get(code);
      if (timer) clearTimeout(timer);
      // Small 600ms grace for visual feel before revealing
      setTimeout(() => {
        this.endCurrentRound(code);
      }, 600);
    }

    return {
      accepted: true,
      isCorrect,
      pointsAwarded: scoreResult.pointsAwarded,
      speedBonus: scoreResult.speedBonus,
      streak: scoreResult.streak,
    };
  }

  public endCurrentRound(code: string): void {
    const room = this.getRoom(code);
    if (!room || !room.currentQuestion) return;

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

    const leaderboard: PlayerScoreSummary[] = this.getLeaderboard(code);

    const roundResult: RoundResult = {
      roundNumber: room.currentRound,
      correctOptionId: room.currentQuestion.correctOptionId,
      explanation: room.currentQuestion.explanation,
      playerAnswers,
      leaderboard,
    };

    if (this.onRoundEnd) {
      this.onRoundEnd(code, roundResult);
    }

    // Schedule intermission or next round
    setTimeout(() => {
      if (room.currentRound >= room.totalRounds) {
        this.finishGame(code);
      } else {
        this.advanceToNextRound(code);
      }
    }, 3500);
  }

  public finishGame(code: string): void {
    const room = this.getRoom(code);
    if (!room) return;

    room.status = 'game_over';
    const rankings = this.getLeaderboard(code);

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

    const summary: FinalMatchSummary = {
      roomCode: code,
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

    if (this.onGameOver) {
      this.onGameOver(code, summary);
    }
  }

  public getLeaderboard(code: string): PlayerScoreSummary[] {
    const room = this.getRoom(code);
    if (!room) return [];

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
        isHost: p.isHost,
      };
    });
  }

  public getClientQuestion(code: string): ClientQuestion | undefined {
    const room = this.getRoom(code);
    if (!room || !room.currentQuestion) return undefined;

    return {
      id: room.currentQuestion.id,
      categoryId: room.currentQuestion.categoryId,
      difficulty: room.currentQuestion.difficulty,
      text: room.currentQuestion.text,
      options: room.currentQuestion.options,
      roundNumber: room.currentRound,
      totalRounds: room.totalRounds,
      timeLimitSec: room.currentQuestion.timeLimitSec || room.questionTimeSec,
    };
  }

  public handlePlayerDisconnect(code: string, playerId: string): void {
    const room = this.getRoom(code);
    if (!room || !room.players[playerId]) return;

    room.players[playerId].isConnected = false;

    // If host leaves, assign next connected player as host
    if (room.hostId === playerId) {
      const nextHost = Object.values(room.players).find((p) => p.isConnected && p.id !== playerId);
      if (nextHost) {
        room.hostId = nextHost.id;
        nextHost.isHost = true;
      }
    }
  }

  public reconnectPlayer(code: string, playerId: string): {
    success: boolean;
    room?: GameRoom;
    currentQuestion?: ClientQuestion;
  } {
    const room = this.getRoom(code);
    if (!room || !room.players[playerId]) {
      return { success: false };
    }

    room.players[playerId].isConnected = true;
    const currentQuestion = this.getClientQuestion(code);

    return {
      success: true,
      room,
      currentQuestion,
    };
  }

  public cleanupAll(): void {
    for (const timer of this.roundTimers.values()) {
      clearTimeout(timer);
    }
    this.roundTimers.clear();
    this.rooms.clear();
    this.questionsByRoom.clear();
    this.stateMachines.clear();
  }
}
