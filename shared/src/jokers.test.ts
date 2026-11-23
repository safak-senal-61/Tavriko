import { describe, expect, it, vi } from 'vitest';
import { canUseJoker, resolveJokerEffect, supportsLiveJokers } from './jokers';

const question = {
  correctOptionId: 'b',
  options: [
    { id: 'a', text: 'Satürn' },
    { id: 'b', text: ' İstanbul Boğazı ' },
    { id: 'c', text: 'Ay' },
    { id: 'd', text: 'Kız Kulesi' },
  ],
};

describe('quiz joker effects', () => {
  it('eliminates only wrong options and replays the original IDs', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(.9);
    try {
      expect(resolveJokerEffect('joker_eliminate', question)).toEqual({ eliminated: ['d'] });
      expect(resolveJokerEffect('joker_half', question)).toEqual({ eliminated: ['d', 'a'] });
      expect(resolveJokerEffect('joker_half', question, ['a', 'c'])).toEqual({ eliminated: ['a', 'c'] });
    } finally { random.mockRestore(); }
  });

  it('returns Turkish first-character and word-count clues without adding eliminations', () => {
    expect(resolveJokerEffect('joker_initial', question)).toEqual({ eliminated: [], hint: 'İlk karakter: İ' });
    expect(resolveJokerEffect('joker_word_count', question)).toEqual({ eliminated: [], hint: '2 kelime' });
    const numeric = { ...question, options: question.options.map(o => o.id === 'b' ? { ...o, text: '1984' } : o) };
    expect(resolveJokerEffect('joker_initial', numeric)?.hint).toBe('İlk karakter: 1');
  });

  it('does not spend on useless clues, broken option IDs, or an elimination without alternatives', () => {
    const options = question.options.map(option => ({ ...option, text: 'Aynı' }));
    expect(canUseJoker('joker_initial', options)).toBe(false);
    expect(canUseJoker('joker_word_count', options)).toBe(false);
    expect(canUseJoker('joker_half', options.slice(0, 3))).toBe(false);
    expect(canUseJoker('joker_eliminate', [options[1], options[1], options[2]])).toBe(false);
    expect(resolveJokerEffect('joker_eliminate', { ...question, correctOptionId: 'missing' })).toBeNull();
  });

  it('limits live wallet use to the three supported room modes', () => {
    expect((['duel', 'quick_match', 'friends_private'] as const).every(supportsLiveJokers)).toBe(true);
    expect(supportsLiveJokers('daily_challenge')).toBe(false);
    expect(supportsLiveJokers('ranked_random')).toBe(false);
  });

  it('marks the nearest numeric distractor, reveals the right option and keeps dice replay stable', () => {
    const numeric = { ...question, options: ['1996', '1999', '2000', '2005'].map((text, i) => ({ id: 'abcd'[i], text })) };
    expect(resolveJokerEffect('joker_nearest', question)).toBeNull();
    expect(resolveJokerEffect('joker_nearest', numeric)).toMatchObject({ highlightedOptionId: 'c' });
    expect(resolveJokerEffect('joker_prophecy', question)).toMatchObject({ highlightedOptionId: 'b' });
    expect(resolveJokerEffect('joker_reveal', question)?.hint).toBe('Doğru cevap: İstanbul Boğazı');
    const first = resolveJokerEffect('joker_dice', question, undefined, { randomIndex: 42 });
    expect(first?.highlightedOptionId).toBe('c');
    expect(resolveJokerEffect('joker_dice', { ...question, options: [...question.options].reverse() }, [], { randomIndex: 42 })).toEqual(first);
  });

  it('blocks scoring tactics in practice and public human duels, and rejects late lightning', () => {
    expect(canUseJoker('joker_double', question.options)).toBe(false);
    expect(canUseJoker('joker_reveal', question.options, { live: true })).toBe(false);
    expect(canUseJoker('joker_reveal', question.options, { live: true, tactics: 'friendly' })).toBe(true);
    expect(resolveJokerEffect('joker_double', question, undefined, { tactics: 'friendly' })).toMatchObject({ modifier: 'double' });
    expect(resolveJokerEffect('joker_lightning', question, undefined, { tactics: 'friendly', lightningAvailable: false })).toBeNull();
  });
});
