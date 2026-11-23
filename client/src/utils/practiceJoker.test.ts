import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPracticeJoker } from './practiceJoker';

const input = { questionId: 'practice-1', sessionId: 'practice-session', jokerId: 'joker_eliminate' } as const;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('practice joker request', () => {
  it('returns the authoritative effect directly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ eliminated: ['d'], hint: 'Elendi' })));
    await expect(requestPracticeJoker('/joker', {}, input)).resolves.toEqual({ eliminated: ['d'], hint: 'Elendi' });
  });

  it('shows server errors without exposing malformed gateway HTML', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: 'Envanterinde bu jokerden kalmadı.' }, { status: 409 }))
      .mockResolvedValueOnce(new Response('<h1>Gateway</h1>', { status: 502 }));
    vi.stubGlobal('fetch', fetch);
    await expect(requestPracticeJoker('/joker', {}, input)).rejects.toThrow('Envanterinde');
    await expect(requestPracticeJoker('/joker', {}, input)).rejects.toThrow('Joker yanıtı alınamadı');
  });

  it('releases a stalled request and aborts the transport', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', fetch);
    const result = expect(requestPracticeJoker('/joker', {}, input, 100)).rejects.toThrow('gecikti');
    await vi.advanceTimersByTimeAsync(100);
    await result;
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });
});
