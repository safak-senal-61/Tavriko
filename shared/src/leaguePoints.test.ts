import { calculateLeagueChange, applyLeagueChange, isRankedMatch } from './rewards';

describe('Lig Puanı (LP)', () => {
  it('dereceli olmayan maçlarda LP değişmez', () => {
    expect(calculateLeagueChange({ correct: 5, total: 5, won: true, ranked: false })).toBe(0);
    expect(calculateLeagueChange({ correct: 0, total: 5, won: false })).toBe(0);
  });

  it('mükemmel galibiyet +30 LP verir (5 soru)', () => {
    expect(calculateLeagueChange({ correct: 5, total: 5, won: true, ranked: true })).toBe(30);
  });

  it('yanlış cevap cezası açıkken her yanlış -10 LP', () => {
    // 3 doğru, 2 yanlış, galibiyet: 20 + 6 - 20 = 6
    expect(calculateLeagueChange({ correct: 3, total: 5, won: true, ranked: true })).toBe(6);
    // mağlubiyet, 2 doğru 3 yanlış: -5 - 30 = -35
    expect(calculateLeagueChange({ correct: 2, total: 5, won: false, ranked: true })).toBe(-35);
  });

  it('ceza kapalıyken yalnızca mağlubiyet -5 LP', () => {
    expect(calculateLeagueChange({ correct: 2, total: 5, won: false, ranked: true, penaltyForWrong: false })).toBe(-5);
  });

  it('galibiyetin net kazancı en az +5 LP', () => {
    expect(calculateLeagueChange({ correct: 1, total: 5, won: true, ranked: true })).toBe(5);
  });

  it('LP 0 altına inmez', () => {
    expect(applyLeagueChange(20, -35)).toEqual({ points: 0, applied: -20 });
    expect(applyLeagueChange(1000, 30)).toEqual({ points: 1030, applied: 30 });
  });

  it('dereceli maç tespiti: bot, arkadaş düellosu ve pratik hariç', () => {
    expect(isRankedMatch({ mode: 'duel', roomCode: 'TAV-ABCDE', playerIds: ['u1', 'u2'] })).toBe(true);
    expect(isRankedMatch({ mode: 'duel', roomCode: 'TAV-ABCDE', playerIds: ['u1', 'bot_1'] })).toBe(false);
    expect(isRankedMatch({ mode: 'duel', roomCode: 'DUEL-AB12', playerIds: ['u1', 'u2'] })).toBe(false);
    expect(isRankedMatch({ mode: 'friends_private', roomCode: 'ABC', playerIds: ['u1', 'u2'] })).toBe(false);
    expect(isRankedMatch({ mode: 'single_practice', playerIds: ['u1'] })).toBe(false);
  });
});
