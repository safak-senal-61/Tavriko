import { GameMode, JokerEffect, JokerId, Question, QuestionOption } from './types';
export declare const isJokerId: (id: unknown) => id is JokerId;
export declare const supportsLiveJokers: (mode: GameMode) => boolean;
export type JokerTactics = 'friendly';
export declare const LIGHTNING_WINDOW_MS = 5000;
type JokerContext = {
    live?: boolean;
    tactics?: JokerTactics;
    lightningAvailable?: boolean;
    randomIndex?: number;
};
export declare function canUseJoker(id: JokerId, options: QuestionOption[], context?: JokerContext): boolean;
export declare function resolveJokerEffect(id: JokerId, question: Pick<Question, 'options' | 'correctOptionId'>, previousEliminations?: string[], context?: JokerContext): JokerEffect | null;
export {};
