import { describe, expect, it, vi, afterEach } from 'vitest';
import { ApiService } from '../src/services/apiService';
import { DEFAULT_QUESTIONS } from '../src/game/defaultQuestions';

const service = new ApiService('https://api.test', 'test-only-secret');
const input = () => ({
  userId: 'player', roomCode: 'TEST01', roundNumber: 1, startedAt: Date.now(),
  deadline: Date.now() + 10_000, jokerId: 'joker_eliminate' as const,
});

afterEach(() => vi.unstubAllGlobals());

describe('room joker gateway', () => {
  it('retries the same wallet operation once after a transient response', async () => {
    const effect = { eliminated: ['b'] };
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response('upstream failure', { status: 502 }))
      .mockResolvedValueOnce(Response.json(effect));
    vi.stubGlobal('fetch', fetch);
    await expect(service.useRoomJoker(input(), DEFAULT_QUESTIONS[0])).resolves.toEqual(effect);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);
  });

  it('does not retry a stock conflict', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ error: 'Stok yok.' }, { status: 409 }));
    vi.stubGlobal('fetch', fetch);
    await expect(service.useRoomJoker(input(), DEFAULT_QUESTIONS[0])).rejects.toThrow('Stok yok.');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
