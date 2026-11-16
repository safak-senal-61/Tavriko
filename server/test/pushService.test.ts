/**
 * pushService birim testleri — Expo push API çağrısı, parçalama (chunking)
 * ve geçersiz token temizliği fetch mock'lanarak doğrulanır.
 */
import { sendPushToExpo, notificationToPushPayload } from '../src/services/pushService';
import type { NotificationItem } from '@trivia/shared';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch as typeof fetch;
});

function makeItem(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'notif_test_1',
    type: 'friend_request',
    title: 'Ayşe sana arkadaşlık isteği gönderdi!',
    sub: 'Kabul etmek için bildirim merkezine bak.',
    timeText: 'Az önce',
    createdAt: Date.now(),
    senderId: 'u2',
    senderName: 'Ayşe',
    senderAvatar: 'av1',
    handled: null,
    ...overrides,
  } as NotificationItem;
}

describe('sendPushToExpo', () => {
  it('geçerli tokenları 100lük parçalarla Expo APIye yollar', async () => {
    const calls: Array<{ body: any }> = [];
    global.fetch = (async (_url: any, init: any) => {
      calls.push({ body: JSON.parse(init.body) });
      return new Response(JSON.stringify({
        data: init.body.match(/ExponentPushToken/g)
          ? Array.from({ length: JSON.parse(init.body).length }, () => ({ status: 'ok' }))
          : [],
      }), { status: 200 });
    }) as typeof fetch;

    const tokens = Array.from({ length: 150 }, (_, i) => `ExponentPushToken[test${i}]`);
    const result = await sendPushToExpo(tokens, { title: 'Merhaba', body: 'Test' });

    expect(calls.length).toBe(2); // 100 + 50
    expect(calls[0].body.length).toBe(100);
    expect(calls[1].body.length).toBe(50);
    expect(result.sent).toBe(150);
    expect(result.invalidTokens).toEqual([]);
  });

  it('DeviceNotRegistered dönen tokenları geçersiz işaretler', async () => {
    global.fetch = (async (_url: any, init: any) => {
      const body = JSON.parse(init.body);
      return new Response(JSON.stringify({
        data: body.map((m: { to: string }) =>
          m.to.includes('dead') ? { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } } : { status: 'ok' }
        ),
      }), { status: 200 });
    }) as typeof fetch;

    const result = await sendPushToExpo(
      ['ExponentPushToken[alive]', 'ExponentPushToken[dead]'],
      { title: 'T', body: 'B' }
    );

    expect(result.sent).toBe(1);
    expect(result.invalidTokens).toEqual(['ExponentPushToken[dead]']);
  });

  it('geçersiz biçimli tokenları hiç göndermez', async () => {
    let called = false;
    global.fetch = (async () => {
      called = true;
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    const result = await sendPushToExpo(['not-a-token'], { title: 'T', body: 'B' });
    expect(called).toBe(false);
    expect(result.sent).toBe(0);
  });

  it('ağ hatasında çökmez', async () => {
    global.fetch = (async () => { throw new Error('network down'); }) as typeof fetch;
    const result = await sendPushToExpo(['ExponentPushToken[x]'], { title: 'T', body: 'B' });
    expect(result.sent).toBe(0);
  });
});

describe('notificationToPushPayload', () => {
  it('eylem bildirimlerinde tip ve id bilgisini taşır', () => {
    const payload = notificationToPushPayload(makeItem());
    expect(payload.title).toContain('arkadaşlık isteği');
    expect(payload.data?.type).toBe('friend_request');
    expect(payload.data?.notificationId).toBe('notif_test_1');
  });

  it('roomCode varsa derin bağlantı verisine ekler', () => {
    const payload = notificationToPushPayload(makeItem({ type: 'duel', roomCode: 'TV42' }));
    expect(payload.data?.roomCode).toBe('TV42');
  });

  it('boş alt başılda varsayılan gövde kullanır', () => {
    const payload = notificationToPushPayload(makeItem({ sub: '' }));
    expect(payload.body.length).toBeGreaterThan(0);
  });
});
