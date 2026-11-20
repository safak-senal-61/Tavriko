/** A quiz must not repeat either a question record or the prompt shown to the player. */
export function uniqueQuestions<T extends { id: string; text: string }>(
  candidates: Iterable<T>,
  limit = Infinity
): T[] {
  const ids = new Set<string>();
  const prompts = new Set<string>();
  const result: T[] = [];
  for (const question of candidates) {
    if (result.length >= limit) break;
    const prompt = question.text
      .normalize('NFC')
      .toLocaleLowerCase('tr')
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/\s+/gu, ' ')
      .trim()
      .replace(/[.!?…]+$/u, '')
      .trim();
    if (!prompt || ids.has(question.id) || prompts.has(prompt)) continue;
    ids.add(question.id);
    prompts.add(prompt);
    result.push(question);
  }
  return result;
}
