import { GameMode, JOKERS, JokerEffect, JokerId, Question, QuestionOption } from './types';

export const isJokerId = (id: unknown): id is JokerId => JOKERS.some(joker => joker.id === id);

export const supportsLiveJokers = (mode: GameMode): boolean =>
  mode === 'duel' || mode === 'quick_match' || mode === 'friends_private';

function clue(id: JokerId, text: string): string {
  const value = text.trim();
  if (id === 'joker_initial') return value.match(/[\p{L}\p{N}]/u)?.[0]?.toLocaleUpperCase('tr-TR') ?? '';
  return value ? String(value.split(/\s+/u).length) : '';
}

// Availability uses public choices only, so disabling a joker does not leak the answer.
export function canUseJoker(id: JokerId, options: QuestionOption[]): boolean {
  const joker = JOKERS.find(item => item.id === id);
  if (!joker || options.length < 2 || new Set(options.map(option => option.id)).size !== options.length) return false;
  if (joker.eliminated) return options.length > joker.eliminated + 1;
  const clues = options.map(option => clue(id, option.text));
  return clues.every(Boolean) && new Set(clues).size > 1;
}

export function resolveJokerEffect(
  id: JokerId,
  question: Pick<Question, 'options' | 'correctOptionId'>,
  previousEliminations?: string[],
): JokerEffect | null {
  const correct = question.options.find(option => option.id === question.correctOptionId);
  if (!correct || (previousEliminations === undefined && !canUseJoker(id, question.options))) return null;
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
