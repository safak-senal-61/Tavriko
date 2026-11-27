import { advancedJokerAction, ClientQuestion, Question, CategoryId, DifficultyLevel, FinalMatchSummary, JokerEffect, JokerId, JokerTactics, uniqueQuestions } from '@trivia/shared';
import { getFallbackQuestions } from '../game/defaultQuestions';

export class ApiService {
  constructor(
    private backendUrl: string,
    private internalSecret?: string
  ) {}

  public async useRoomJoker(input: {
    userId: string; roomCode: string; roundNumber: number; startedAt: number; requestedAt?: number; deadline: number; jokerId: JokerId; tactics?: JokerTactics;
    capabilities?: ClientQuestion['jokerCapabilities']; votes?: Record<string, number>;
  }, question: Question): Promise<JokerEffect> {
    if (!this.internalSecret) throw new Error('Jokerler henüz kullanıma açık değil.');
    const cleanUrl = (this.backendUrl || 'https://tavriko-app.vercel.app').replace(/\/+$/, '');
    const stopAt = Math.min(input.deadline, Date.now() + 2700);
    const body = JSON.stringify({ ...input, questionId: question.id, options: question.options, correctOptionId: question.correctOptionId });
    const request = () => fetch(`${cleanUrl}/api/internal/room-joker`, {
      method: 'POST', body,
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': this.internalSecret! },
      signal: AbortSignal.timeout(Math.max(1, stopAt - Date.now())),
    }).catch(() => null);
    let response = await request();
    // Re-send exactly the same operation once on a transient gateway failure.
    // The wallet's unique round key handles a response lost after commit.
    if ((!response || response.status === 502 || response.status === 504) && stopAt - Date.now() > 400) {
      if (response?.body) void response.body.cancel().catch(() => {});
      response = await request();
    }
    if (!response) throw new Error('Joker yanıtı gecikti. Tekrar dene.');
    const data = await response.json().catch(() => null) as (JokerEffect & { error?: string }) | null;
    if (response.status === 403 || response.status === 404) throw new Error('Canlı maç jokerleri şu anda kullanılamıyor.');
    if (!response.ok || !Array.isArray(data?.eliminated)) {
      throw new Error(typeof data?.error === 'string' ? data.error : 'Joker kullanılamadı. Tekrar dene.');
    }
    return {
      eliminated: data.eliminated,
      ...(typeof data.hint === 'string' ? { hint: data.hint } : {}),
      ...(typeof data.highlightedOptionId === 'string' ? { highlightedOptionId: data.highlightedOptionId } : {}),
      ...(data.modifier === 'double' || data.modifier === 'lightning' || data.modifier === 'streak_guard' ? { modifier: data.modifier } : {}),
      ...(data.action && advancedJokerAction(input.jokerId) === data.action ? { action: data.action } : {}),
      ...(data.votes && input.jokerId === 'joker_audience' ? { votes: data.votes } : {}),
    };
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

  /** Bitmemiş 1v1 maçı terk eden oyuncudan altın düşer; sunucu maç başına bir kez uygular. */
  public async applyQuitPenalty(roomCode: string, matchId: string, playerId: string): Promise<{ applied: boolean; amount: number; balance?: number } | null> {
    if (!this.internalSecret) return null;
    const cleanUrl = (this.backendUrl || 'https://tavriko-app.vercel.app').replace(/\/+$/, '');
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(`${cleanUrl}/api/internal/duel-quit-penalty`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-secret': this.internalSecret },
          body: JSON.stringify({ roomCode, matchId, playerId }),
          signal: AbortSignal.timeout(3500),
        });
        if (response.ok) {
          const data = await response.json<any>();
          return { applied: data?.applied === true, amount: Number(data?.amount) || 0,
            ...(typeof data?.balance === 'number' ? { balance: data.balance } : {}) };
        }
        if (response.status < 500) return null;
      } catch { /* Retry once; the backend applies the penalty at most once per match. */ }
    }
    console.warn('[ApiService] Quit penalty delivery failed.');
    return null;
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
