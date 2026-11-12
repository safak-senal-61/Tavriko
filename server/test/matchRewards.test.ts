import { describe, it, expect } from 'vitest';
import { calculateMatchRewards } from '@trivia/shared';

describe('calculateMatchRewards', () => {
  it('hiç doğru yoksa ödül vermez', () => {
    expect(calculateMatchRewards({ correct: 0, total: 10, won: false, mode: 'solo' })).toEqual({ xp: 0, coins: 0, seasonXp: 0 });
  });

  it('çok oyunculu XP üst sınırı 35', () => {
    const r = calculateMatchRewards({ correct: 10, total: 10, won: true, mode: 'multiplayer' });
    expect(r.xp).toBe(35);
  });

  it('çok oyunculu kayıpta XP en fazla 15', () => {
    const r = calculateMatchRewards({ correct: 10, total: 10, won: false, mode: 'multiplayer' });
    expect(r.xp).toBe(15);
  });

  it('tek kişilikte zorluk çarpanı uygulanır ve 50 XP geçilmez', () => {
    const easy = calculateMatchRewards({ correct: 10, total: 10, won: true, mode: 'solo', difficulty: 'easy' });
    const expert = calculateMatchRewards({ correct: 10, total: 10, won: true, mode: 'solo', difficulty: 'expert' });
    expect(easy.xp).toBe(25);
    expect(expert.xp).toBe(50);
  });
});
