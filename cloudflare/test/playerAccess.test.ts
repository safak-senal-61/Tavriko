import { afterEach, describe, expect, it, vi } from 'vitest';
import { accessResponse, PlayerAccessGate } from '../src/auth/playerAccess';
import type { Env } from '../src/env';

const env = { BACKEND_API_URL: 'https://backend.example.test', INTERNAL_API_SECRET: 'fixture-only', ACCOUNT_RESTRICTIONS_ENABLED: 'true' } as Env;
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('realtime account restrictions', () => {
  it('does not call the backend for guests or when the feature is off', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await new PlayerAccessGate(env).check('guest_local_123')).toBe('allowed');
    expect(await new PlayerAccessGate({ ...env, ACCOUNT_RESTRICTIONS_ENABLED: 'false' }).check('usr_123')).toBe('allowed');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses the authenticated backend, rechecks existing sockets and fails closed', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ enabled: true, access: 'allowed' }))
      .mockResolvedValueOnce(Response.json({ enabled: true, access: 'restricted' }))
      .mockResolvedValueOnce(Response.json({ enabled: false, access: 'allowed' }))
      .mockResolvedValueOnce(Response.redirect('https://redirect.example.test', 307))
      .mockRejectedValueOnce(new Error('network down'));
    vi.stubGlobal('fetch', fetch);
    const time = vi.spyOn(Date, 'now').mockReturnValue(100_000);
    const gate = new PlayerAccessGate(env);
    const socket = {} as WebSocket;
    expect(await gate.check('usr_123', socket)).toBe('allowed');
    expect(await gate.check('usr_123', socket)).toBe('allowed');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('https://backend.example.test/api/internal/player-access', expect.objectContaining({
      method: 'POST', redirect: 'manual', body: JSON.stringify({ id: 'usr_123' }),
      headers: expect.objectContaining({ 'x-internal-secret': 'fixture-only' }),
    }));
    time.mockReturnValue(110_001);
    expect(await gate.check('usr_123', socket)).toBe('restricted');
    expect(accessResponse('restricted').status).toBe(403);
    expect(await gate.check('usr_123')).toBe('unavailable');
    expect(await gate.check('usr_123')).toBe('unavailable');
    expect(await gate.check('usr_123')).toBe('unavailable');
  });
});
