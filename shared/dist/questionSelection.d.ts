/** A quiz must not repeat either a question record or the prompt shown to the player. */
export declare function uniqueQuestions<T extends {
    id: string;
    text: string;
}>(candidates: Iterable<T>, limit?: number): T[];
