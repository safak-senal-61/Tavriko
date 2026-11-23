import { GameMode, JOKERS, JokerEffect, JokerId, Question, QuestionOption } from './types';

export const isJokerId = (id: unknown): id is JokerId => JOKERS.some(joker => joker.id === id);

export const supportsLiveJokers = (mode: GameMode): boolean =>
  mode === 'duel' || mode === 'quick_match' || mode === 'friends_private';

export type JokerTactics = 'friendly';
export const LIGHTNING_WINDOW_MS = 5000;
type JokerContext = { live?: boolean; tactics?: JokerTactics; lightningAvailable?: boolean; randomIndex?: number };
const modifiers = {
  joker_streak_guard: 'streak_guard',
  joker_lightning: 'lightning', joker_double: 'double',
} as const;

function numbers(options: QuestionOption[]): number[] | null {
  const values = options.map(option => /^[-+]?\d{1,12}(?:,\d{1,2})?$/.test(option.text.trim())
    ? Number(option.text.trim().replace(',', '.')) : NaN);
  return values.every(Number.isFinite) && new Set(values).size === values.length ? values : null;
}

function clue(id: JokerId, text: string): string {
  const value = text.trim();
  if (id === 'joker_initial') return value.match(/[\p{L}\p{N}]/u)?.[0]?.toLocaleUpperCase('tr-TR') ?? '';
  return value ? String(value.split(/\s+/u).length) : '';
}

// Availability uses public choices only, so disabling a joker does not leak the answer.
export function canUseJoker(id: JokerId, options: QuestionOption[], context: JokerContext = {}): boolean {
  const joker = JOKERS.find(item => item.id === id);
  if (!joker || options.length < 2 || new Set(options.map(option => option.id)).size !== options.length) return false;
  if (joker.eliminated) return options.length > joker.eliminated + 1;
  if (id === 'joker_nearest') return options.length >= 3 && !!numbers(options);
  if (id === 'joker_reveal' || id === 'joker_prophecy') return !context.live || !!context.tactics;
  if (id === 'joker_dice') return true;
  if (id === 'joker_lightning') return !!context.tactics && context.lightningAvailable !== false;
  if (id === 'joker_streak_guard' || id === 'joker_double') return !!context.tactics;
  const clues = options.map(option => clue(id, option.text));
  return clues.every(Boolean) && new Set(clues).size > 1;
}

export function resolveJokerEffect(
  id: JokerId,
  question: Pick<Question, 'options' | 'correctOptionId'>,
  previousEliminations?: string[],
  context: JokerContext = {},
): JokerEffect | null {
  const correct = question.options.find(option => option.id === question.correctOptionId);
  if (!correct || !canUseJoker(id, question.options, previousEliminations ? { ...context, lightningAvailable: true } : context)) return null;
  if (id === 'joker_prophecy') return { eliminated: [], highlightedOptionId: correct.id, hint: 'Kehanet bir şıkkı işaretledi.' };
  if (id === 'joker_reveal') return { eliminated: [], highlightedOptionId: correct.id, hint: `Doğru cevap: ${correct.text.trim()}` };
  if (id === 'joker_dice') {
    const options = [...question.options].sort((a, b) => a.id.localeCompare(b.id, 'en'));
    const chosen = options[(context.randomIndex ?? 0) % options.length];
    return { eliminated: [], highlightedOptionId: chosen.id, hint: 'Zarın önerisi işaretlendi.' };
  }
  if (id === 'joker_nearest') {
    const values = numbers(question.options)!;
    const current = values[question.options.indexOf(correct)];
    const [nearest] = question.options.map((option, index) => ({ option, gap: Math.abs(values[index] - current) }))
      .filter(item => item.gap > 0).sort((a, b) => a.gap - b.gap || a.option.id.localeCompare(b.option.id, 'en'));
    return { eliminated: [], highlightedOptionId: nearest.option.id, hint: 'En yakın yanlış şık işaretlendi.' };
  }
  if (id === 'joker_streak_guard' || id === 'joker_lightning' || id === 'joker_double') {
    return { eliminated: [], modifier: modifiers[id], hint: `${JOKERS.find(joker => joker.id === id)!.name} etkin` };
  }
  const count = JOKERS.find(joker => joker.id === id)?.eliminated;
  if (count === undefined) return null;
  if (!count) {
    const value = clue(id, correct.text);
    if (!value) return null;
    return { eliminated: [], hint: id === 'joker_initial' ? `İlk karakter: ${value}` : `${value} kelime` };
  }
  const wrong = question.options.filter(option => option.id !== question.correctOptionId).map(option => option.id);
  if (previousEliminations) return { eliminated: previousEliminations.filter(option => wrong.includes(option)) };
  const start = Math.floor(Math.random() * wrong.length);
  return { eliminated: [...wrong.slice(start), ...wrong.slice(0, start)].slice(0, count) };
}
