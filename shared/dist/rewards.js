"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REWARDED_AD_COOLDOWN_SEC = exports.REWARDED_AD_DAILY_LIMIT = exports.REWARDED_AD_COINS = exports.LP_MIN_WIN_GAIN = exports.LP_WRONG_ANSWER_PENALTY = exports.LP_LOSS = exports.LP_PER_CORRECT_ON_WIN = exports.LP_WIN_BASE = exports.LEAGUE_START_POINTS = exports.MAX_MATCH_XP_SOLO = exports.MAX_MATCH_XP_MULTIPLAYER = exports.DIFFICULTY_XP_LABEL = exports.DIFFICULTY_XP_MULTIPLIER = void 0;
exports.calculateMatchRewards = calculateMatchRewards;
exports.calculateLeagueChange = calculateLeagueChange;
exports.applyLeagueChange = applyLeagueChange;
exports.isRankedMatch = isRankedMatch;
exports.getRewardedAdStatus = getRewardedAdStatus;
/** Zorluk çarpanları (Zorluk seçim ekranındaki etiketlerle birebir aynı) */
exports.DIFFICULTY_XP_MULTIPLIER = {
    easy: 1,
    medium: 1.25,
    hard: 1.5,
    expert: 2,
};
exports.DIFFICULTY_XP_LABEL = {
    easy: 'x1 XP',
    medium: 'x1,25 XP',
    hard: 'x1,5 XP',
    expert: 'x2 XP',
};
exports.MAX_MATCH_XP_MULTIPLAYER = 35;
exports.MAX_MATCH_XP_SOLO = 50;
function calculateMatchRewards(input) {
    const total = Math.max(1, Math.round(Number(input.total) || 1));
    const correct = Math.max(0, Math.min(total, Math.round(Number(input.correct) || 0)));
    const won = !!input.won;
    // Hiç doğru cevap yoksa (veya erken çıkışta) hiçbir ödül verilmez
    if (correct === 0)
        return { xp: 0, coins: 0, seasonXp: 0 };
    if (input.mode === 'solo') {
        const mult = exports.DIFFICULTY_XP_MULTIPLIER[input.difficulty || 'easy'] ?? 1;
        const baseXp = Math.min(25, correct * 4 + (won ? 8 : 0));
        return {
            xp: Math.min(exports.MAX_MATCH_XP_SOLO, Math.round(baseXp * mult)),
            coins: Math.min(8, correct + (won ? 3 : 0)),
            seasonXp: won ? 15 : 5,
        };
    }
    return {
        xp: won ? Math.min(35, correct * 5 + 10) : Math.min(15, correct * 3),
        coins: won ? Math.min(15, correct * 2 + 5) : Math.min(6, correct),
        seasonXp: won ? 25 : 10,
    };
}
// ---------------------------------------------------------------------------
// Lig Puanı (LP) — TEK DOĞRULUK KAYNAĞI
// ---------------------------------------------------------------------------
// LP yalnızca "dereceli" maçlarda değişir: gerçek bir rakiple oynanan hızlı
// eşleşme / 1v1 düello. Tek kişilik pratik, Keşfet, günlük görev, özel oda ve
// arkadaş düellosu LP'yi DEĞİŞTİRMEZ. Herkes 1000 LP ile başlar, LP 0'ın altına inmez.
exports.LEAGUE_START_POINTS = 1000;
exports.LP_WIN_BASE = 20;
exports.LP_PER_CORRECT_ON_WIN = 2;
exports.LP_LOSS = 5;
exports.LP_WRONG_ANSWER_PENALTY = 10;
exports.LP_MIN_WIN_GAIN = 5;
/**
 * Bir maç sonunda LP değişimini (negatif olabilir) döndürür.
 * - Galibiyet: +20 LP, her doğru cevap için +2 LP
 * - Mağlubiyet: -5 LP
 * - Ceza açıksa her yanlış / boş cevap için -10 LP
 * - Galibiyetin net kazancı hiçbir zaman +5 LP'nin altına düşmez
 */
function calculateLeagueChange(input) {
    if (!input.ranked)
        return 0;
    const total = Math.max(1, Math.round(Number(input.total) || 1));
    const correct = Math.max(0, Math.min(total, Math.round(Number(input.correct) || 0)));
    const wrong = total - correct;
    const won = !!input.won;
    let delta = won ? exports.LP_WIN_BASE + correct * exports.LP_PER_CORRECT_ON_WIN : -exports.LP_LOSS;
    if (input.penaltyForWrong !== false)
        delta -= wrong * exports.LP_WRONG_ANSWER_PENALTY;
    if (won)
        delta = Math.max(exports.LP_MIN_WIN_GAIN, delta);
    return delta;
}
/** LP'yi uygular; 0'ın altına inmez. Gerçekte uygulanan değişimi de döndürür. */
function applyLeagueChange(current, delta) {
    const start = Number.isFinite(current) ? Math.max(0, Math.round(current)) : exports.LEAGUE_START_POINTS;
    const points = Math.max(0, start + delta);
    return { points, applied: points - start };
}
/** Bir maçın dereceli sayılıp sayılmayacağı (sunucu ve istemci aynı kuralı kullanır). */
function isRankedMatch(input) {
    const modeOk = input.mode === 'duel' || input.mode === 'quick_match' || input.mode === 'ranked_random';
    const ids = input.playerIds || [];
    const hasBot = ids.some((id) => String(id).startsWith('bot_'));
    const friendDuel = String(input.roomCode || '').toUpperCase().startsWith('DUEL-');
    return modeOk && ids.length >= 2 && !hasBot && !friendDuel;
}
// ---------------------------------------------------------------------------
// Ödüllü reklam ("Reklam izle, jeton kazan") — TEK DOĞRULUK KAYNAĞI
// ---------------------------------------------------------------------------
// Ödülü yalnızca doğrulanmış AdMob sunucu bildirimi üzerine sunucu verir.
// Kötüye kullanımı sınırlamak için günlük üst sınır ve iki izleme arası bekleme
// süresi sunucuda uygulanır. Gün sınırı UTC tarihine göre sıfırlanır.
exports.REWARDED_AD_COINS = 25;
exports.REWARDED_AD_DAILY_LIMIT = 5;
exports.REWARDED_AD_COOLDOWN_SEC = 30;
function getRewardedAdStatus(state, now = Date.now()) {
    const today = new Date(now).toISOString().slice(0, 10);
    const count = state && state.date === today ? Math.max(0, Number(state.count) || 0) : 0;
    const lastAt = Number(state?.lastAt) || 0;
    const cooldownSec = Math.max(0, Math.ceil((lastAt + exports.REWARDED_AD_COOLDOWN_SEC * 1000 - now) / 1000));
    return {
        coinsPerAd: exports.REWARDED_AD_COINS,
        dailyLimit: exports.REWARDED_AD_DAILY_LIMIT,
        remainingToday: Math.max(0, exports.REWARDED_AD_DAILY_LIMIT - count),
        cooldownSec,
    };
}
