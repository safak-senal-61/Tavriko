"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uniqueQuestions = uniqueQuestions;
/** A quiz must not repeat either a question record or the prompt shown to the player. */
function uniqueQuestions(candidates, limit = Infinity) {
    const ids = new Set();
    const prompts = new Set();
    const result = [];
    for (const question of candidates) {
        if (result.length >= limit)
            break;
        const normalized = question.text
            .normalize('NFC')
            .toLocaleLowerCase('tr')
            .replace(/[’‘]/g, "'")
            .replace(/[“”]/g, '"')
            .replace(/\s+/gu, ' ')
            .trim();
        let end = normalized.length;
        while (end > 0 && '.!?…'.includes(normalized.charAt(end - 1)))
            end--;
        const prompt = normalized.slice(0, end).trimEnd();
        if (!prompt || ids.has(question.id) || prompts.has(prompt))
            continue;
        ids.add(question.id);
        prompts.add(prompt);
        result.push(question);
    }
    return result;
}
