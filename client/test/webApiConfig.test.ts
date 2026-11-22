import { afterEach, describe, expect, it, vi } from 'vitest';
import { Platform } from 'react-native';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('separately hosted web API', () => {
  it('uses the configured origin for both player and same-origin API callers', async () => {
    vi.stubEnv('EXPO_PUBLIC_WEB_API_ORIGIN', 'https://tavriko-preview.vercel.app/');
    vi.stubGlobal('window', { location: { origin: 'https://tavriko-preview.pages.dev' } });
    const { getApiBaseUrl, DEFAULT_API_BASE, getRealtimeWsUrl } = await import('../src/config');
    expect(getApiBaseUrl()).toBe('https://tavriko-preview.vercel.app/api');
    expect(DEFAULT_API_BASE).toBe(getApiBaseUrl());
    expect(getRealtimeWsUrl()).toMatch(/^wss:\/\/tavriko-realtime\./);
  });

  it('keeps the current fallback when the separate web origin is not configured', async () => {
    vi.stubEnv('EXPO_PUBLIC_WEB_API_ORIGIN', '');
    vi.stubGlobal('window', { location: { origin: 'http://localhost:3000' } });
    const { getApiBaseUrl, DEFAULT_API_BASE, CLOUD_API_URL } = await import('../src/config');
    expect(getApiBaseUrl()).toBe('http://localhost:3000/api');
    expect(DEFAULT_API_BASE).toBe(CLOUD_API_URL);
  });

  it('ignores a web export override on native', async () => {
    vi.stubEnv('EXPO_PUBLIC_WEB_API_ORIGIN', 'https://tavriko-preview.vercel.app');
    const original = Platform.OS;
    try {
      Platform.OS = 'android';
      const { getApiBaseUrl, DEFAULT_API_BASE, CLOUD_API_URL } = await import('../src/config');
      expect(getApiBaseUrl()).toBe(CLOUD_API_URL);
      expect(DEFAULT_API_BASE).toBe(CLOUD_API_URL);
    } finally {
      Platform.OS = original;
    }
  });
});
