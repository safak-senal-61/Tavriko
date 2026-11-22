vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(protected ctx: DurableObjectState, protected env: unknown) {}
  },
}));

import { SOCKET_EVENTS, LOBBY_QUICK_MESSAGES } from '@trivia/shared';
import { GameRoomDO } from '../src/durable-objects/GameRoom';
import type { Env } from '../src/env';

it('filters actual Worker lobby messages and derives the sender from the room', async () => {
  let restore: Promise<unknown>;
  const room = { code: 'SAFE1', players: { p1: { id: 'p1', displayName: 'Oyuncu' } } };
  const receive = vi.fn();
  const context = {
    storage: { get: async (key: string) => key === 'room' ? room : undefined },
    blockConcurrencyWhile: (run: () => Promise<unknown>) => { restore = run(); },
    getWebSockets: () => [{ send: receive, deserializeAttachment: () => ({ playerId: 'viewer' }) }],
  } as unknown as DurableObjectState;
  const object = new GameRoomDO(context, {} as Env);
  await restore!;
  const connected = { send: vi.fn(), deserializeAttachment: () => ({ playerId: 'p1' }) } as unknown as WebSocket;
  const outside = { send: vi.fn(), deserializeAttachment: () => ({ playerId: 'outside' }) } as unknown as WebSocket;
  const input = (event: string, payload: unknown) => JSON.stringify({ event, payload });
  await object.webSocketMessage(connected, input(SOCKET_EVENTS.LOBBY_CHAT, { text: 'Serbest metin' }));
  await object.webSocketMessage(connected, input(SOCKET_EVENTS.SEND_EMOTE, { emote: 'Serbest' }));
  await object.webSocketMessage(outside, input(SOCKET_EVENTS.LOBBY_CHAT, { text: LOBBY_QUICK_MESSAGES[0] }));
  expect(receive).not.toHaveBeenCalled();

  await object.webSocketMessage(connected, input(SOCKET_EVENTS.LOBBY_CHAT, {
    text: LOBBY_QUICK_MESSAGES[0], playerId: 'wrong', displayName: 'ignored', roomCode: 'WRONG',
  }));
  expect(receive).toHaveBeenCalledOnce();
  expect(JSON.parse(receive.mock.calls[0][0])).toMatchObject({
    event: SOCKET_EVENTS.LOBBY_MESSAGE,
    payload: { roomCode: 'SAFE1', playerId: 'p1', displayName: 'Oyuncu', text: LOBBY_QUICK_MESSAGES[0] },
  });
});
