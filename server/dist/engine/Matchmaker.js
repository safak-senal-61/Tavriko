"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Matchmaker = exports.RIVAL_BOTS = void 0;
exports.RIVAL_BOTS = [
    { id: 'rival_bot_1', name: 'Zeka Avcısı', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=ZekaAvcisi' },
    { id: 'rival_bot_2', name: 'Selin Trivia', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=SelinTrivia' },
    { id: 'rival_bot_3', name: 'Quiz Fırtınası', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=QuizFirtinasi' },
    { id: 'rival_bot_4', name: 'Bilgi Bükücü', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=BilgiBukucu' },
    { id: 'rival_bot_5', name: 'Hızlı Cevap', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=HizliCevap' },
];
class Matchmaker {
    queue = [];
    manager;
    intervalId;
    onMatchFound;
    constructor(manager) {
        this.manager = manager;
        this.startLoop();
    }
    enqueue(req) {
        // Remove if already in queue
        this.dequeue(req.playerId);
        this.queue.push(req);
        this.checkMatches();
    }
    dequeue(playerId) {
        this.queue = this.queue.filter((r) => r.playerId !== playerId);
    }
    startLoop() {
        this.intervalId = setInterval(() => {
            this.checkMatches();
        }, 1500);
    }
    checkMatches() {
        // 1. Priority 1: Match 2 real human players waiting in queue
        while (this.queue.length >= 2) {
            const p1 = this.queue.shift();
            const p2 = this.queue.shift();
            if (p1 && p2) {
                const mode = p1.mode === 'duel' || p2.mode === 'duel' ? 'duel' : (p1.mode || 'duel');
                const category = p1.category || p2.category || 'mixed';
                const difficulty = p1.difficulty || p2.difficulty || 'medium';
                const room = this.manager.createRoom({
                    hostId: p1.playerId,
                    hostName: p1.displayName,
                    avatarUrl: p1.avatarUrl,
                    mode,
                    category,
                    difficulty,
                    totalRounds: 5,
                    maxPlayers: 2,
                });
                this.manager.joinRoom(room.code, {
                    playerId: p2.playerId,
                    displayName: p2.displayName,
                    avatarUrl: p2.avatarUrl,
                });
                if (this.onMatchFound) {
                    this.onMatchFound(room.code, [p1, p2]);
                }
                // Auto-launch the duel round after 2500ms versus reveal
                setTimeout(() => {
                    this.manager.startGame(room.code, p1.playerId);
                }, 2500);
            }
        }
        // 2. Priority 2: Smart Bot Matchmaking if player has waited >= 7 seconds (1v1 fallback)
        const now = Date.now();
        for (let i = 0; i < this.queue.length; i++) {
            const req = this.queue[i];
            if (now - req.queuedAt >= 7000) {
                this.queue.splice(i, 1);
                i--;
                const rival = exports.RIVAL_BOTS[Math.floor(Math.random() * exports.RIVAL_BOTS.length)];
                const rivalReq = {
                    socketId: 'bot_' + rival.id,
                    playerId: rival.id,
                    displayName: rival.name,
                    avatarUrl: rival.avatar,
                    mode: 'duel',
                    category: req.category || 'mixed',
                    difficulty: req.difficulty || 'medium',
                    queuedAt: now,
                };
                const room = this.manager.createRoom({
                    hostId: req.playerId,
                    hostName: req.displayName,
                    avatarUrl: req.avatarUrl,
                    mode: 'duel',
                    category: req.category || 'mixed',
                    difficulty: req.difficulty || 'medium',
                    totalRounds: 5,
                    maxPlayers: 2,
                });
                this.manager.joinRoom(room.code, {
                    playerId: rival.id,
                    displayName: rival.name,
                    avatarUrl: rival.avatar,
                    isBot: true,
                });
                if (this.onMatchFound) {
                    this.onMatchFound(room.code, [req, rivalReq]);
                }
                // Auto-launch duel round after versus intro
                setTimeout(() => {
                    this.manager.startGame(room.code, req.playerId);
                }, 2500);
            }
        }
    }
    destroy() {
        if (this.intervalId)
            clearInterval(this.intervalId);
        this.queue = [];
    }
}
exports.Matchmaker = Matchmaker;
