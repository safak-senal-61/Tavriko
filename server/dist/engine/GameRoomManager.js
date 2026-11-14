"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameRoomManager = void 0;
const shared_1 = require("@trivia/shared");
const GameStateMachine_1 = require("./GameStateMachine");
class GameRoomManager {
    rooms = new Map();
    stateMachines = new Map();
    questionsByRoom = new Map();
    roundTimers = new Map();
    questionProvider;
    // Event callbacks for real-time socket propagation
    onRoundStart;
    onRoundEnd;
    onGameOver;
    onStateSync;
    constructor(questionProvider) {
        this.questionProvider = questionProvider;
    }
    generateCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    getRoom(code) {
        return this.rooms.get(code.toUpperCase());
    }
    getActiveRoomsCount() {
        return this.rooms.size;
    }
    getPublicRooms() {
        const list = [];
        for (const room of this.rooms.values()) {
            const isPublic = room.privacy === 'public' || !room.privacy;
            const isAvailable = room.status === 'lobby';
            const players = Object.values(room.players || {}).filter((p) => p.isConnected);
            if (isPublic && isAvailable && players.length < room.maxPlayers) {
                list.push({
                    code: room.code,
                    name: `${room.players[room.hostId]?.displayName || 'Oyuncu'} Odası`,
                    hostName: room.players[room.hostId]?.displayName || 'Kurucu',
                    category: room.category || 'genel_kultur',
                    playerCount: players.length,
                    maxPlayers: room.maxPlayers,
                    questionTimeSec: room.questionTimeSec,
                    totalRounds: room.totalRounds,
                    penaltyForWrong: !!room.penaltyForWrong,
                    status: room.status,
                    createdAt: Date.now(),
                });
            }
        }
        return list;
    }
    createRoom(options) {
        let code = options.code ? options.code.toUpperCase() : this.generateCode();
        while (!options.code && this.rooms.has(code)) {
            code = this.generateCode();
        }
        const host = {
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
        const room = {
            code,
            mode: options.mode || 'friends_private',
            hostId: options.hostId,
            status: 'lobby',
            category: options.category || (options.categories?.[0] || 'general_culture'),
            subCategory: options.subCategory || undefined,
            difficulty: options.difficulty || 'medium',
            maxPlayers: options.maxPlayers || 8,
            currentRound: 0,
            totalRounds: options.totalRounds || 10,
            questionTimeSec: options.questionTimeSec || 15,
            penaltyForWrong: options.penaltyForWrong ?? false,
            categories: options.categories,
            mixedCategories: options.mixedCategories,
            privacy: options.privacy,
            password: options.password,
            hasPassword: Boolean(options.password),
            players: { [options.hostId]: host },
            scores: { [options.hostId]: 0 },
        };
        this.rooms.set(code, room);
        this.stateMachines.set(code, new GameStateMachine_1.GameStateMachine('lobby'));
        return room;
    }
    joinRoom(code, options) {
        const room = this.getRoom(code);
        if (!room) {
            return { success: false, error: 'Oda bulunamadı' };
        }
        if (room.status !== 'lobby') {
            return { success: false, error: 'Oyun devam ediyor veya oda kilitli' };
        }
        if (room.password && room.password !== options.password) {
            return { success: false, error: 'Oda şifresi yanlış veya eksik' };
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
        const isBot = options.isBot ?? (options.playerId.startsWith('rival_bot_') || options.playerId.startsWith('bot_'));
        const player = {
            id: options.playerId,
            username: options.displayName.toLowerCase().replace(/\s+/g, '_'),
            displayName: options.displayName,
            avatarUrl: options.avatarUrl,
            score: 0,
            currentStreak: 0,
            isReady: isBot ? true : false,
            isHost: false,
            isBot,
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
    toggleReady(code, playerId) {
        const room = this.getRoom(code);
        if (!room || !room.players[playerId])
            return false;
        room.players[playerId].isReady = !room.players[playerId].isReady;
        return true;
    }
    kickPlayer(code, hostId, targetPlayerId) {
        const room = this.getRoom(code);
        if (!room)
            return { success: false, error: 'Oda bulunamadı' };
        if (room.hostId !== hostId) {
            return { success: false, error: 'Yalnızca oda sahibi oyuncu atabilir' };
        }
        if (room.status !== 'lobby') {
            return { success: false, error: 'Oyun devam ederken oyuncu atılamaz' };
        }
        if (targetPlayerId === hostId) {
            return { success: false, error: 'Oda sahibi kendini odadan atamaz' };
        }
        if (!room.players[targetPlayerId]) {
            return { success: false, error: 'Oyuncu odada bulunamadı' };
        }
        delete room.players[targetPlayerId];
        delete room.scores[targetPlayerId];
        return { success: true };
    }
    updateRoomSettings(code, hostId, settings) {
        const room = this.getRoom(code);
        if (!room)
            return { success: false, error: 'Oda bulunamadı' };
        if (room.hostId !== hostId) {
            return { success: false, error: 'Yalnızca oda sahibi ayarları değiştirebilir' };
        }
        if (room.status !== 'lobby') {
            return { success: false, error: 'Oyun devam ederken ayarlar değiştirilemez' };
        }
        if (settings.maxPlayers && typeof settings.maxPlayers === 'number')
            room.maxPlayers = settings.maxPlayers;
        if (settings.totalRounds && typeof settings.totalRounds === 'number')
            room.totalRounds = settings.totalRounds;
        if (settings.questionTimeSec && typeof settings.questionTimeSec === 'number')
            room.questionTimeSec = settings.questionTimeSec;
        if (settings.difficulty)
            room.difficulty = settings.difficulty;
        if (settings.category)
            room.category = settings.category;
        if (settings.subCategory !== undefined)
            room.subCategory = settings.subCategory || undefined;
        if (settings.categories)
            room.categories = settings.categories;
        if (settings.mixedCategories !== undefined)
            room.mixedCategories = !!settings.mixedCategories;
        if (settings.penaltyForWrong !== undefined)
            room.penaltyForWrong = !!settings.penaltyForWrong;
        if (settings.privacy)
            room.privacy = settings.privacy;
        return { success: true };
    }
    startGame(code, requesterId) {
        const room = this.getRoom(code);
        if (!room || room.hostId !== requesterId)
            return false;
        // Fetch questions for this match
        const questions = this.questionProvider(room.category, room.difficulty, room.totalRounds, room.subCategory);
        if (questions.length === 0)
            return false;
        this.questionsByRoom.set(code, questions);
        room.totalRounds = questions.length;
        room.currentRound = 0;
        this.advanceToNextRound(code);
        return true;
    }
    advanceToNextRound(code) {
        const room = this.getRoom(code);
        if (!room)
            return;
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
        if (existingTimer)
            clearTimeout(existingTimer);
        // Authoritative server timer for round end
        const timerDurationMs = (question.timeLimitSec || room.questionTimeSec) * 1000;
        const timer = setTimeout(() => {
            this.endCurrentRound(code);
        }, timerDurationMs);
        this.roundTimers.set(code, timer);
    }
    submitAnswer(code, playerId, selectedOptionId, clientTimestamp) {
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
        const scoreResult = (0, shared_1.applyPlayerRoundAnswer)(room, playerId, selectedOptionId, elapsedMs);
        const isCorrect = scoreResult.isCorrect;
        // Check if all connected players have answered
        const connectedPlayers = Object.values(room.players).filter((p) => p.isConnected);
        const allAnswered = connectedPlayers.every((p) => p.hasAnsweredCurrentRound);
        if (allAnswered) {
            const timer = this.roundTimers.get(code);
            if (timer)
                clearTimeout(timer);
            // Fast 80ms transition when all players have answered
            setTimeout(() => {
                this.endCurrentRound(code);
            }, 80);
        }
        return {
            accepted: true,
            isCorrect,
            pointsAwarded: scoreResult.pointsAwarded,
            speedBonus: scoreResult.speedBonus,
            streak: scoreResult.streak,
        };
    }
    endCurrentRound(code) {
        const room = this.getRoom(code);
        if (!room || room.status !== 'question_active' || !room.currentQuestion)
            return;
        const roundResult = (0, shared_1.evaluateRoundResult)(room);
        if (this.onStateSync) {
            this.onStateSync(code, room);
        }
        if (this.onRoundEnd) {
            this.onRoundEnd(code, roundResult);
        }
        // Schedule intermission or next round (1200ms gives crisp, responsive pacing while allowing review of correct answer)
        setTimeout(() => {
            if (room.currentRound >= room.totalRounds) {
                this.finishGame(code);
            }
            else {
                this.advanceToNextRound(code);
            }
        }, 1200);
    }
    finishGame(code) {
        const room = this.getRoom(code);
        if (!room)
            return;
        const summary = (0, shared_1.buildFinalMatchSummary)(room);
        if (this.onGameOver) {
            this.onGameOver(code, summary);
        }
    }
    getLeaderboard(code) {
        const room = this.getRoom(code);
        if (!room)
            return [];
        return (0, shared_1.buildRoomLeaderboard)(room);
    }
    getClientQuestion(code) {
        const room = this.getRoom(code);
        if (!room || !room.currentQuestion)
            return undefined;
        return {
            id: room.currentQuestion.id,
            categoryId: room.currentQuestion.categoryId,
            difficulty: room.currentQuestion.difficulty,
            text: room.currentQuestion.text,
            options: room.currentQuestion.options,
            roundNumber: room.currentRound,
            totalRounds: room.totalRounds,
            timeLimitSec: room.currentQuestion.timeLimitSec || room.questionTimeSec,
            ...(room.currentQuestion.subCategory ? { subCategory: room.currentQuestion.subCategory } : {}),
        };
    }
    handlePlayerDisconnect(code, playerId) {
        const room = this.getRoom(code);
        if (!room || !room.players[playerId])
            return;
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
    reconnectPlayer(code, playerId) {
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
    cleanupAll() {
        for (const timer of this.roundTimers.values()) {
            clearTimeout(timer);
        }
        this.roundTimers.clear();
        this.rooms.clear();
        this.questionsByRoom.clear();
        this.stateMachines.clear();
    }
}
exports.GameRoomManager = GameRoomManager;
