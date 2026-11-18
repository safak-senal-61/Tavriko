import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleNotificationResponse, subscribeNotificationNavigation } from '../src/services/notificationRouter';

const mocks = vi.hoisted(() => ({
  getStoredAuth: vi.fn(),
  hydrateAuthStorage: vi.fn(async () => {}),
  getInbox: vi.fn(),
  patch: vi.fn(),
  markRead: vi.fn(),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('../src/config', () => ({ DEFAULT_API_BASE: 'https://qa.invalid/api' }));
vi.mock('../src/store/gameStore', () => ({ useGameStore: { getState: () => ({ user: null }) } }));
vi.mock('../src/store/notificationStore', () => ({ useNotificationStore: { getState: mocks.getInbox } }));
vi.mock('../src/utils/authStorage', () => ({
  getStoredAuth: mocks.getStoredAuth,
  hydrateAuthStorage: mocks.hydrateAuthStorage,
}));

const response = (actionIdentifier: string) => ({
  actionIdentifier,
  notification: { request: { content: { data: {
    type: 'match_invite', roomCode: 'ABC123', notificationId: 'invite-1',
  } } } },
});

describe('native push invitation actions', () => {
  const navigate = vi.fn();
  const request = vi.fn();
  let unsubscribe: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStoredAuth.mockReturnValue({ user: { id: 'player-1' }, token: 'test-token' });
    mocks.getInbox.mockReturnValue({ userId: 'player-1', patch: mocks.patch, markRead: mocks.markRead });
    request.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', request);
    unsubscribe = subscribeNotificationNavigation(navigate);
  });

  afterEach(() => {
    unsubscribe();
    vi.unstubAllGlobals();
  });

  it.each(['decline_room', 'decline_duel', 'decline_friend'])('%s submits a decline and never joins the room', async action => {
    handleNotificationResponse(response(action));
    await vi.waitFor(() => expect(mocks.markRead).toHaveBeenCalledWith(['invite-1']));
    expect(request).toHaveBeenCalledWith('https://qa.invalid/api/social/notifications/respond', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      body: JSON.stringify({ userId: 'player-1', notificationId: 'invite-1', action: 'decline' }),
    }));
    expect(mocks.patch).toHaveBeenCalledWith('invite-1', expect.objectContaining({ handled: 'declined' }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('leaves a failed decline available to retry and does not navigate', async () => {
    const json = vi.fn(async () => ({ success: false }));
    request.mockResolvedValue({ ok: false, json });
    handleNotificationResponse(response('decline_room'));
    await vi.waitFor(() => expect(json).toHaveBeenCalled());
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps normal join routing separate from declining', () => {
    handleNotificationResponse(response('join_room'));
    expect(navigate).toHaveBeenCalledWith({ screen: 'home', roomCode: 'ABC123', clearInboxBadge: true });
  });
});
