import type { JokerEffect, JokerId } from '@trivia/shared';

export async function requestPracticeJoker(
  url: string, headers: Record<string, string>,
  request: { questionId: string; proof?: string; sessionId: string; jokerId: JokerId }, timeoutMs = 3000,
): Promise<JokerEffect> {
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeLimit = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('Joker yanıtı gecikti. Tekrar dene.'));
        abort.abort();
      }, timeoutMs);
    });
    const result = fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(request), signal: abort.signal,
    }).catch(() => { throw new Error('Bağlantı kurulamadı. Tekrar dene.'); }).then(async response => {
      const data = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(data?.eliminated)) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Joker yanıtı alınamadı. Tekrar dene.');
      }
      return {
        eliminated: data.eliminated,
        ...(typeof data.hint === 'string' ? { hint: data.hint } : {}),
        ...(typeof data.highlightedOptionId === 'string' ? { highlightedOptionId: data.highlightedOptionId } : {}),
      };
    });
    return await Promise.race([result, timeLimit]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
