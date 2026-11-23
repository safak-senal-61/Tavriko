import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SOCKET_EVENTS, type ClientQuestion } from '@trivia/shared';
import { SocketService } from './socketService';

vi.mock('@sentry/react-native', () => ({ addBreadcrumb: vi.fn() }));
vi.mock('../config', () => ({ getRealtimeWsUrl: (path: string) => `wss://test.invalid${path}` }));
vi.mock('../utils/avatarImage', () => ({ sanitizeAvatarForUrl: () => 'av1' }));
vi.mock('./analytics', () => ({ getBotFallbackMs: () => 7000 }));

class FakeSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;
  static all: FakeSocket[] = [];
  readyState = 0;
  onopen?: () => void;
  onclose?: (event: { code: number }) => void;
  onmessage?: (event: { data: string }) => void;
  frames: { event: string; requestId: string; payload: any }[] = [];
  constructor() { FakeSocket.all.push(this); }
  send(frame: string) { this.frames.push(JSON.parse(frame)); }
  open() { this.readyState = 1; this.onopen?.(); }
  close() { this.readyState = 3; this.onclose?.({ code: 1006 }); }
  message(event: string, payload: unknown, requestId?: string) {
    this.onmessage?.({ data: JSON.stringify({ event, payload, requestId }) });
  }
  jokers() { return this.frames.filter(frame => frame.event === SOCKET_EVENTS.USE_JOKER); }
}

const room = 'TAV-TEST';
const question = { id: 'q1', roundNumber: 1, jokerRoundStartedAt: 1000, timeRemainingMs: 12_000 } as ClientQuestion;
const effect = { eliminated: ['b'] };
const lastSocket = () => FakeSocket.all.at(-1)!;
const start = (ws: FakeSocket, q = question) => ws.message(SOCKET_EVENTS.QUESTION_START, q);

let service: SocketService;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', FakeSocket);
  FakeSocket.all = [];
  service = new SocketService();
  service.joinRoom(room, 'player', 'Player');
});
afterEach(() => {
  service.disconnect();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('live joker reconnect', () => {
  it('sends immediately on an active socket', async () => {
    const ws = lastSocket();
    ws.open(); start(ws);
    const result = service.useRoomJoker(room, 'player', question, 'joker_eliminate');
    expect(ws.jokers()).toHaveLength(1);
    ws.message(SOCKET_EVENTS.JOKER_RESULT, effect, ws.jokers()[0].requestId);
    await expect(result).resolves.toEqual(effect);
  });

  it('automatically reconnects and waits for the same authoritative question', async () => {
    const old = lastSocket();
    old.open(); start(old); old.close();
    const result = service.useRoomJoker(room, 'player', question, 'joker_eliminate');
    const fresh = lastSocket();
    expect(fresh).not.toBe(old);
    fresh.open();
    old.message(SOCKET_EVENTS.QUESTION_START, question);
    expect(fresh.jokers()).toHaveLength(0);
    start(fresh);
    expect(fresh.jokers()).toHaveLength(1);
    fresh.message(SOCKET_EVENTS.JOKER_RESULT, effect, fresh.jokers()[0].requestId);
    await expect(result).resolves.toEqual(effect);
    await vi.advanceTimersByTimeAsync(1200);
    expect(FakeSocket.all).toHaveLength(2);
  });

  it('recovers a committed effect after dropping its response without another use', async () => {
    const old = lastSocket();
    old.open(); start(old);
    const result = service.useRoomJoker(room, 'player', question, 'joker_eliminate');
    old.close();
    await vi.advanceTimersByTimeAsync(1);
    const fresh = lastSocket();
    fresh.open();
    start(fresh, { ...question, jokerEffect: effect });
    expect(fresh.jokers()).toHaveLength(0);
    await expect(result).resolves.toEqual(effect);
  });

  it('replays the same request ID after reconnect and handles in-flight server work', async () => {
    const old = lastSocket();
    old.open(); start(old);
    const result = service.useRoomJoker(room, 'player', question, 'joker_eliminate');
    const request = old.jokers()[0];
    old.close();
    await vi.advanceTimersByTimeAsync(1);
    const fresh = lastSocket();
    fresh.open(); start(fresh);
    expect(fresh.jokers()[0]).toMatchObject({ requestId: request.requestId, payload: request.payload });
    fresh.message(SOCKET_EVENTS.ERROR, { message: 'Joker isteği işleniyor.' }, request.requestId);
    await vi.advanceTimersByTimeAsync(200);
    expect(fresh.jokers()).toHaveLength(2);
    expect(fresh.jokers()[1].requestId).toBe(request.requestId);
    fresh.message(SOCKET_EVENTS.JOKER_RESULT, effect, request.requestId);
    await expect(result).resolves.toEqual(effect);
  });

  it('does not send a queued use into a new round or room', async () => {
    const old = lastSocket();
    old.open(); start(old); old.close();
    const result = expect(service.useRoomJoker(room, 'player', question, 'joker_eliminate')).rejects.toThrow('artık aktif değil');
    const fresh = lastSocket();
    fresh.open(); start(fresh, { ...question, roundNumber: 2, id: 'q2' });
    await result;
    expect(fresh.jokers()).toHaveLength(0);
    fresh.close();
    const switched = expect(service.useRoomJoker(room, 'player', question, 'joker_eliminate')).rejects.toThrow('artık aktif değil');
    service.joinRoom('OTHER', 'player', 'Player');
    await switched;
    lastSocket().open(); start(lastSocket(), question);
    expect(lastSocket().jokers()).toHaveLength(0);
  });

  it('does not send a queued leave from the old connecting socket to the new room', async () => {
    service.leaveRoom(room, 'player');
    service.joinRoom('OTHER', 'player', 'Player');
    lastSocket().open();
    await vi.advanceTimersByTimeAsync(150);
    expect(lastSocket().frames.some(frame => frame.event === SOCKET_EVENTS.LEAVE_ROOM)).toBe(false);
  });
});
