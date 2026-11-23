import { GameMode, JokerEffect, JokerId, Question, QuestionOption } from './types';
export declare const isJokerId: (id: unknown) => id is JokerId;
export declare const supportsLiveJokers: (mode: GameMode) => boolean;
export declare function canUseJoker(id: JokerId, options: QuestionOption[]): boolean;
export declare function resolveJokerEffect(id: JokerId, question: Pick<Question, 'options' | 'correctOptionId'>, previousEliminations?: string[]): JokerEffect | null;
