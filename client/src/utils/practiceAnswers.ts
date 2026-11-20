export interface PracticeAnswer {
  isCorrect: boolean;
  isTimeout: boolean;
  correctOptionId: string;
  explanation?: string;
  pointsAwarded: number;
  speedBonus: number;
  streak: number;
}

const offlineAnswers: Readonly<Record<string, string>> = {
  fallback_q1: 'opt_b',
  fallback_q2: 'opt_c',
  fallback_q3: 'opt_b',
  fallback_q4: 'opt_a',
  fallback_q5: 'opt_a',
};

export const getOfflinePracticeAnswer = (questionId: string) =>
  Object.hasOwn(offlineAnswers, questionId) ? offlineAnswers[questionId] : undefined;

export async function requestPracticeAnswer(
  url: string,
  answer: { questionId: string; selectedOptionId: string | null; timeRemainingMs: number;
    totalTimeMs: number; currentStreak: number; sessionId: string; playerId: string },
  timeoutMs = 3500
): Promise<PracticeAnswer | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve(null);
      }, timeoutMs);
    });
    const result = fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answer),
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) return null;
      const data = await response.json();
      return data?.questionId === answer.questionId && typeof data.isCorrect === 'boolean'
        ? data as PracticeAnswer
        : null;
    });
    return await Promise.race([result, timeout]);
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
