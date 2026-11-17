import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '@trivia/shared';
import { deliverGameInvite } from '../src/services/inviteDelivery';
import { sendPushToUser } from '../src/services/pushService';

vi.mock('../src/services/pushService', async importOriginal => ({
  ...await importOriginal<typeof import('../src/services/pushService')>(),
  sendPushToUser: vi.fn().mockResolvedValue({ sent: 1 }),
}));

const invite: NotificationItem = {
  id: 'test-room-invite',
  type: 'match_invite',
  title: 'Odaya davet',
  sub: 'Test odası',
  timeText: 'Az önce',
  roomCode: 'ROOM42',
  senderId: 'host',
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('game invite delivery', () => {
  it('relays the saved notification and sends the same ID and room in the native push', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'test-secret');
    vi.stubEnv('REALTIME_HTTP_URL', 'https://realtime.invalid/');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await deliverGameInvite('friend', invite);
    expect(fetchMock).toHaveBeenCalledWith('https://realtime.invalid/api/notify', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'x-internal-secret': 'test-secret' }),
      body: JSON.stringify({ targetUserId: 'friend', event: 'notification:new', data: invite }),
    }));
    expect(sendPushToUser).toHaveBeenCalledWith('friend', expect.objectContaining({
      categoryId: 'room_invite',
      data: expect.objectContaining({ notificationId: invite.id, roomCode: invite.roomCode }),
    }));
  });

  it('still completes the device push attempt when Cloudflare is unavailable', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'test-secret');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(deliverGameInvite('friend', invite)).resolves.toBeUndefined();
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
  });
});
