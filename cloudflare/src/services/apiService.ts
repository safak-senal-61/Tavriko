import { Question, CategoryId, DifficultyLevel, FinalMatchSummary } from '@trivia/shared';
import { getFallbackQuestions } from '../game/defaultQuestions';

export class ApiService {
  constructor(
    private backendUrl: string,
    private internalSecret?: string
  ) {}

  public async fetchRoomQuestions(
    categoryId: CategoryId,
    difficulty: DifficultyLevel,
    count: number = 5
  ): Promise<Question[]> {
    const cleanUrl = (this.backendUrl || 'https://tavriko-app.vercel.app').replace(/\/+$/, '');
    const endpoint = `${cleanUrl}/api/internal/room-questions`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.internalSecret ? { 'x-internal-secret': this.internalSecret } : {}),
        },
        body: JSON.stringify({
          categoryId,
          difficulty,
          count,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (resp.ok) {
        const data: any = await resp.json();
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          return data.questions as Question[];
        }
      }
    } catch (err: any) {
      console.warn(`[ApiService] Question fetch failed from ${endpoint}, falling back to defaults:`, err?.message);
    }

    // Graceful fallback to rich offline questions
    return getFallbackQuestions(categoryId, difficulty, count);
  }

  public async submitMatchResults(summary: FinalMatchSummary): Promise<boolean> {
    const cleanUrl = (this.backendUrl || 'https://tavriko-app.vercel.app').replace(/\/+$/, '');
    const endpoint = `${cleanUrl}/api/internal/match-results`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.internalSecret ? { 'x-internal-secret': this.internalSecret } : {}),
        },
        body: JSON.stringify(summary),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return resp.ok;
    } catch (err: any) {
      console.warn(`[ApiService] Failed reporting match results to ${endpoint}:`, err?.message);
      return false;
    }
  }
}
