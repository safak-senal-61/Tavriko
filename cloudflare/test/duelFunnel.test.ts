import { afterEach, expect, it, vi } from 'vitest';
import { ApiService } from '../src/services/apiService';

afterEach(() => vi.unstubAllGlobals());

it('dispatches the authoritative duel id and time and retries a transient backend error', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 })).mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetch);
  const id = '0bc08de1-dce6-4200-9f1d-972a98837bbc';
  const at = Date.now();
  await new ApiService('https://example.test', 'fixture').reportDuelMatch(id, ['usr_a'], at);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenCalledWith('https://example.test/api/internal/duel-funnel/matched', expect.objectContaining({
    method: 'POST', headers: expect.objectContaining({ 'x-internal-secret': 'fixture' }),
    body: JSON.stringify({ room: id, ids: ['usr_a'], matchedAt: at }),
  }));
});

it('does not send an empty or unauthenticated milestone', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  await new ApiService('https://example.test').reportDuelMatch('fixture', ['usr_a'], Date.now());
  await new ApiService('https://example.test', 'fixture').reportDuelMatch('fixture', [], Date.now());
  expect(fetch).not.toHaveBeenCalled();
});
