import type { UserProfile } from '@trivia/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStoredAuth, saveStoredAuth } from '../src/utils/authStorage';

const profile = (id: string, isGuest?: boolean) => ({ id, isGuest }) as UserProfile;

describe('web auth storage', () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['guest_api123', 'server-token'],
    ['guest_local_123', 'mock_token'],
  ])('restores the guest flag and token for %s', (id, token) => {
    const user = profile(id, true);
    saveStoredAuth(user, token);
    expect(getStoredAuth()).toEqual({ user, token });
  });

  it.each(['guest_local_old12', 'guest_old123'])('restores older profile %s as a guest', (id) => {
    values.set('tavriko_auth_user', JSON.stringify(profile(id)));
    values.set('tavriko_auth_token', 'legacy-token');
    expect(getStoredAuth()).toEqual({ user: profile(id, true), token: 'legacy-token' });
  });

  it('does not treat a regular account as a guest', () => {
    const user = profile('player_123');
    saveStoredAuth(user, 'account-token');
    expect(getStoredAuth()).toEqual({ user: { id: user.id }, token: 'account-token' });
  });

  it('removes both the profile and token on explicit sign-out', () => {
    saveStoredAuth(profile('guest_api123', true), 'guest-token');
    saveStoredAuth(null, null);
    expect(getStoredAuth()).toEqual({ user: null, token: null });
  });

  it('replaces the guest profile and token when an account signs in', () => {
    saveStoredAuth(profile('guest_api123', true), 'guest-token');
    const user = profile('player_123', false);
    saveStoredAuth(user, 'account-token');
    expect(getStoredAuth()).toEqual({ user, token: 'account-token' });
  });

  it('keeps the app usable when browser storage is blocked', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('Storage blocked');
      },
    });
    expect(getStoredAuth()).toEqual({ user: null, token: null });
    expect(() => saveStoredAuth(profile('guest_local_123', true), 'mock_token')).not.toThrow();
  });
});
