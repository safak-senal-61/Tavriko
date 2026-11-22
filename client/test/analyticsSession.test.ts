import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalyticsConsentValue } from '../src/services/analyticsConsent';

const mock = vi.hoisted(() => ({
  consent: null as AnalyticsConsentValue | null,
  initialize: vi.fn(),
  ready: vi.fn(),
  getDistinctId: vi.fn(),
  reset: vi.fn(),
  optIn: vi.fn(),
  optOut: vi.fn(),
  identify: vi.fn(),
  capture: vi.fn(),
}));
vi.mock('../src/services/analyticsConsent', () => ({ getAnalyticsConsent: () => mock.consent }));
vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.1.2' } } }));
vi.mock('posthog-react-native', () => ({
  default: class {
    constructor(...args: unknown[]) { mock.initialize(...args); }
    ready = mock.ready;
    getDistinctId = mock.getDistinctId;
    reset = mock.reset;
    optIn = mock.optIn;
    optOut = mock.optOut;
    identify = mock.identify;
    capture = mock.capture;
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mock.consent = null;
  mock.ready.mockResolvedValue(undefined);
  mock.getDistinctId.mockReturnValue('prior-player');
  mock.optIn.mockResolvedValue(undefined);
  mock.optOut.mockResolvedValue(undefined);
});

describe('analytics session', () => {
  it('does not start before login or consent, then identifies the player before recording one session', async () => {
    const analytics = await import('../src/services/analytics');
    await analytics.syncAnalyticsSession('player');
    mock.consent = 'granted';
    await analytics.syncAnalyticsSession(null);
    analytics.trackEvent('match_started');
    expect(mock.initialize).not.toHaveBeenCalled();
    expect(mock.capture).not.toHaveBeenCalled();
    await analytics.syncAnalyticsSession('player');
    await analytics.syncAnalyticsSession('player');
    expect(mock.reset).toHaveBeenCalledOnce();
    expect(mock.identify).toHaveBeenCalledExactlyOnceWith('player');
    expect(mock.capture).toHaveBeenCalledExactlyOnceWith('session_start', { platform: 'web', version: '1.1.2' });
    expect(mock.identify.mock.invocationCallOrder[0]).toBeLessThan(mock.capture.mock.invocationCallOrder[0]);
  });

  it('stops captures immediately on withdrawal and on logout', async () => {
    const analytics = await import('../src/services/analytics');
    mock.consent = 'granted';
    await analytics.syncAnalyticsSession('player');
    mock.capture.mockClear();
    mock.consent = 'denied';
    analytics.trackEvent('settings_changed');
    await analytics.syncAnalyticsSession('player');
    expect(mock.optOut).toHaveBeenCalledOnce();
    mock.consent = 'granted';
    await analytics.syncAnalyticsSession('player');
    await analytics.syncAnalyticsSession(null);
    analytics.trackEvent('match_started');
    expect(mock.capture).toHaveBeenCalledTimes(1);
    expect(mock.optOut).toHaveBeenCalledTimes(2);
  });

  it('does not activate a session that ends while the SDK is still starting', async () => {
    const analytics = await import('../src/services/analytics');
    let finish!: () => void;
    mock.ready.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    mock.consent = 'granted';
    const start = analytics.syncAnalyticsSession('player');
    await analytics.syncAnalyticsSession(null);
    finish();
    await start;
    expect(mock.identify).not.toHaveBeenCalled();
    expect(mock.capture).not.toHaveBeenCalled();
  });

  it('recovers from a transient startup error without recording a duplicate session', async () => {
    mock.ready.mockRejectedValueOnce(new Error('temporarily unavailable'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const analytics = await import('../src/services/analytics');
      mock.consent = 'granted';
      await analytics.syncAnalyticsSession('player');
      expect(mock.capture).not.toHaveBeenCalled();
      await analytics.syncAnalyticsSession('player');
      await analytics.syncAnalyticsSession('player');
      expect(mock.initialize).toHaveBeenCalledTimes(2);
      expect(mock.capture).toHaveBeenCalledTimes(1);
    } finally { warn.mockRestore(); }
  });

  it('finishes a pending opt-in before applying withdrawal and does not identify the player', async () => {
    const analytics = await import('../src/services/analytics');
    let resolveOptIn!: () => void;
    let entered!: () => void;
    const optInBegan = new Promise<void>(resolve => { entered = resolve; });
    mock.optIn.mockImplementationOnce(() => {
      entered();
      return new Promise<void>(resolve => { resolveOptIn = resolve; });
    });
    mock.consent = 'granted';
    const start = analytics.syncAnalyticsSession('player');
    await optInBegan;
    mock.consent = 'denied';
    const stop = analytics.syncAnalyticsSession(null);
    expect(mock.optOut).not.toHaveBeenCalled();
    resolveOptIn();
    await Promise.all([start, stop]);
    expect(mock.optOut).toHaveBeenCalledOnce();
    expect(mock.identify).not.toHaveBeenCalled();
    expect(mock.capture).not.toHaveBeenCalled();
  });
});
