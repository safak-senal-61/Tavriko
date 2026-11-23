import { Question, CategoryId, DifficultyLevel, FinalMatchSummary, JokerEffect, JokerId, uniqueQuestions } from '@trivia/shared';
import { getFallbackQuestions } from '../game/defaultQuestions';

export class ApiService {
  constructor(
    private backendUrl: string,
    private internalSecret?: string
  ) {}

  public async useRoomJoker(input: {
    userId: string; roomCode: string; roundNumber: number; startedAt: number; deadline: number; jokerId: JokerId;
  }, question: Question): Promise<JokerEffect> {
    if (!this.internalSecret) throw new Error('Jokerler henüz kullanıma açık değil.');
    const cleanUrl = (this.backendUrl || 'https://tavriko-app.vercel.app').replace(/\/+$/, '');
    const response = await fetch(`${cleanUrl}/api/internal/room-joker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': this.internalSecret },
      body: JSON.stringify({ ...input, questionId: question.id, options: question.options, correctOptionId: question.correctOptionId }),
      signal: AbortSignal.timeout(4500),
    });
    const data = await response.json() as JokerEffect & { error?: string };
    if (!response.ok || !Array.isArray(data.eliminated)) throw new Error(data.error || 'Joker kullanılamadı. Tekrar dene.');
    return { eliminated: data.eliminated, ...(typeof data.hint === 'string' ? { hint: data.hint } : {}) };
  }

  public async fetchRoomQuestions(
    categoryId: CategoryId,
    difficulty: DifficultyLevel,
    count: number = 5,
    subCategory?: string
  ): Promise<Question[]> {
    const cleanUrl = (this.backendUrl || 'https://tavriko-app.vercel.app').replace(/\/+$/, '');
    const endpoint = `${cleanUrl}/api/internal/room-questions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    try {
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
          ...(subCategory ? { subCategory } : {}),
        }),
        signal: controller.signal,
      });

      if (resp.ok) {
        const data: any = await resp.json();
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          return uniqueQuestions(data.questions as Question[], count);
        }
        // Alt kategori seçiliyse ve havuzda soru yoksa başka kategorinin sorularını
        // uydurma; boş dön, oda sahibine "sorular yüklenemedi" hatası gösterilsin.
        if (subCategory) return [];
      }
    } catch (err: any) {
      console.warn(`[ApiService] Question fetch failed from ${endpoint}, falling back to defaults:`, err?.message);
    } finally {
      clearTimeout(timeoutId);
    }

    // Graceful fallback to rich offline questions
    return subCategory ? [] : getFallbackQuestions(categoryId, difficulty, count);
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

  public async reportDuelMatch(room: string, ids: string[], matchedAt: number): Promise<void> {
    if (!this.internalSecret || !ids.length) return;
    const cleanUrl = (this.backendUrl || 'https://tavriko-app.vercel.app').replace(/\/+$/, '');
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(`${cleanUrl}/api/internal/duel-funnel/matched`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-internal-secret': this.internalSecret },
          body: JSON.stringify({ room, ids, matchedAt }), signal: AbortSignal.timeout(3500),
        });
        if (response.status < 500) return;
      } catch { /* Retry once; backend writes are idempotent. */ }
    }
    console.warn('[ApiService] Duel milestone delivery failed.');
  }
}
