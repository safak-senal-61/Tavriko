import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  platform: { OS: 'android', Version: 35 },
  getPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  openSettings: vi.fn(),
  sendIntent: vi.fn(),
  getDeviceToken: vi.fn(),
  session: { user: { id: 'player', isGuest: false }, token: 'session' },
}));

vi.mock('react-native', () => ({
  Platform: mocks.platform,
  Linking: { openSettings: mocks.openSettings, sendIntent: mocks.sendIntent },
}));
vi.mock('expo-notifications', () => ({
  getPermissionsAsync: mocks.getPermissions, requestPermissionsAsync: mocks.requestPermissions,
  getDevicePushTokenAsync: mocks.getDeviceToken, AndroidImportance: { MAX: 5, HIGH: 4 },
  setNotificationHandler: vi.fn(), addNotificationResponseReceivedListener: vi.fn(),
  setNotificationCategoryAsync: vi.fn(async () => {}), setNotificationChannelAsync: vi.fn(async () => {}),
  getLastNotificationResponseAsync: vi.fn(async () => null),
}));
vi.mock('expo-constants', () => ({ default: { expoConfig: { android: { package: 'com.tavriko.app' } } } }));
vi.mock('../src/config', () => ({ DEFAULT_API_BASE: 'https://example.invalid/api' }));
vi.mock('../src/store/gameStore', () => ({ useGameStore: { getState: () => mocks.session } }));
vi.mock('../src/utils/apiAuth', () => ({ authHeaders: () => ({ Authorization: 'Bearer session' }) }));
vi.mock('../src/services/notificationRouter', () => ({ handleNotificationResponse: vi.fn() }));

import { enablePushFromUserAction, registerForPushNotifications } from '../src/services/pushNotifications';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.platform.Version = 35;
});

describe('push permission and registration', () => {
  it('never requests system permission during passive registration if push is off', async () => {
    mocks.getPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    await registerForPushNotifications('player');
    expect(mocks.requestPermissions).not.toHaveBeenCalled();
    expect(mocks.getDeviceToken).not.toHaveBeenCalled();
  });

  it('requests permission after a tap and registers a newly approved Android device once', async () => {
    mocks.getPermissions.mockResolvedValueOnce({ granted: false, canAskAgain: true })
      .mockResolvedValue({ granted: true, status: 'granted', canAskAgain: true });
    mocks.requestPermissions.mockResolvedValue({ granted: true, status: 'granted', canAskAgain: true });
    mocks.getDeviceToken.mockResolvedValue({ data: 'fcm-device' });
    const fetch = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('fetch', fetch);
    try {
      expect(await enablePushFromUserAction()).toBe('granted');
      await Promise.all([registerForPushNotifications('player'), registerForPushNotifications('player')]);
      expect(mocks.requestPermissions).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith('https://example.invalid/api/push/register', expect.objectContaining({
        body: JSON.stringify({ token: 'fcm-device', platform: 'android' }),
      }));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('opens Android notification settings if the OS will not ask again', async () => {
    mocks.getPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
    expect(await enablePushFromUserAction()).toBe('blocked');
    expect(mocks.requestPermissions).not.toHaveBeenCalled();
    expect(mocks.sendIntent).toHaveBeenCalledWith('android.settings.APP_NOTIFICATION_SETTINGS', [
      { key: 'android.provider.extra.APP_PACKAGE', value: 'com.tavriko.app' },
    ]);
  });

  it('does not show notifications as on when Android has blocked app notifications', async () => {
    mocks.getPermissions.mockResolvedValue({ granted: true, status: 'denied', canAskAgain: false });
    await registerForPushNotifications('player');
    expect(mocks.getDeviceToken).not.toHaveBeenCalled();
  });

  it('falls back to app settings if the notifications settings intent is unsupported', async () => {
    mocks.getPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    mocks.platform.Version = 32;
    mocks.sendIntent.mockRejectedValueOnce(new Error('intent unavailable'));
    expect(await enablePushFromUserAction()).toBe('blocked');
    expect(mocks.requestPermissions).not.toHaveBeenCalled();
    expect(mocks.openSettings).toHaveBeenCalledOnce();
  });
});
