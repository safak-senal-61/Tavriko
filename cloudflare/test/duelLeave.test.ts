vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(protected ctx: DurableObjectState, protected env: unknown) {}
  },
}));

import { SOCKET_EVENTS } from '@trivia/shared';
import { GameRoomDO } from '../src/durable-objects/GameRoom';
import { DEFAULT_QUESTIONS } from '../src/game/defaultQuestions';
import type { Env } from '../src/env';

type Sent = { event: string; payload: any };

function fakeSocket(playerId: string) {
  const sent: Sent[] = [];
  const socket = {
    sent,
    closed: false,
    deserializeAttachment: () => ({ playerId, username: playerId, displayName: playerId, isHost: false }),
    send: (raw: string) => { sent.push(JSON.parse(raw)); },
    close: () => { socket.closed = true; },
  };
  return socket;
}

function makeRoom(status: string, extra: Record<string, unknown> = {}) {
  const storage = new Map<string, unknown>([
    ['room', {
      code: 'DUEL1', mode: 'duel', status, hostId: 'ahmet', currentRound: status === 'question_active' ? 1 : 0,
      totalRounds: 2, questionTimeSec: 15,
      ...(status === 'question_active' ? { currentQuestion: DEFAULT_QUESTIONS[0], roundStartedAt: Date.now() } : {}),
      players: {
        ahmet: { id: 'ahmet', username: 'ahmet', displayName: 'Ahmet', score: 0, isConnected: true },
        ali: { id: 'ali', username: 'ali', displayName: 'Ali', score: 0, isConnected: true },
      },
      scores: { ahmet: 0, ali: 0 },
      ...extra,
    }],
    ['questions', DEFAULT_QUESTIONS.slice(0, 2)],
    ['matchId', '11111111-2222-3333-4444-555555555555'],
  ]);
  const ahmet = fakeSocket('ahmet');
  const ali = fakeSocket('ali');
  let restore: Promise<unknown>;
  const context = {
    storage: {
      get: async (key: string) => structuredClone(storage.get(key)),
      put: async (key: string, value: unknown) => storage.set(key, structuredClone(value)),
      delete: async (keys: string | string[]) => (Array.isArray(keys) ? keys : [keys]).forEach((key) => storage.delete(key)),
      setAlarm: vi.fn(),
      deleteAlarm: vi.fn(),
    },
    blockConcurrencyWhile: (run: () => Promise<unknown>) => { restore = run(); },
    getWebSockets: (tag?: string) => [ahmet, ali].filter((s) => !tag || tag === `player:${s.deserializeAttachment().playerId}`),
    waitUntil: () => {},
  } as unknown as DurableObjectState;
  const env = { RECONNECTION_GRACE_SEC: 60, INTERNAL_API_SECRET: 'internal', BACKEND_API_URL: 'https://api.test' } as Env;
  return { storage, ahmet, ali, context, env, ready: () => restore! };
}

function leave(room: GameRoomDO, socket: ReturnType<typeof fakeSocket>, playerId: string) {
  return room.webSocketMessage(socket as unknown as WebSocket, JSON.stringify({
    event: SOCKET_EVENTS.LEAVE_ROOM, payload: { roomCode: 'DUEL1', playerId }, timestamp: Date.now(),
  }));
}

describe('1v1 leave before and during the match', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/api/internal/player-access')) {
        return new Response(JSON.stringify({ enabled: false, access: 'allowed' }), { status: 200 });
      }
      if (String(url).includes('/api/internal/duel-quit-penalty')) {
        return new Response(JSON.stringify({ applied: true, amount: 10, balance: 490 }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('cancels the match for the opponent and penalizes the leaver when nobody has answered yet', async () => {
    const t = makeRoom('countdown');
    const room = new GameRoomDO(t.context, t.env);
    await t.ready();
    await leave(room, t.ahmet, 'ahmet');

    const notice = t.ali.sent.find((m) => m.event === SOCKET_EVENTS.OPPONENT_LEFT);
    expect(notice?.payload).toMatchObject({ playerId: 'ahmet', phase: 'before_start', reason: 'left' });
    expect(t.ahmet.sent.some((m) => m.event === SOCKET_EVENTS.OPPONENT_LEFT)).toBe(false);
    expect(t.storage.get('room')).toMatchObject({ status: 'game_over' });
    expect((t.storage.get('room') as any).players.ahmet).toBeUndefined();

    const penaltyCall = fetchMock.mock.calls.find(([url]) => String(url).includes('duel-quit-penalty'));
    expect(JSON.parse(penaltyCall![1].body)).toEqual({
      roomCode: 'DUEL1', matchId: '11111111-2222-3333-4444-555555555555', playerId: 'ahmet',
    });
    expect(t.ahmet.sent.find((m) => m.event === SOCKET_EVENTS.QUIT_PENALTY)?.payload).toMatchObject({ amount: 10 });
    expect(t.ahmet.closed).toBe(true);
  });

  it('tells the opponent mid-game and ends the match in their favour', async () => {
    const t = makeRoom('question_active');
    const room = new GameRoomDO(t.context, t.env);
    await t.ready();
    await leave(room, t.ahmet, 'ahmet');

    expect(t.ali.sent.find((m) => m.event === SOCKET_EVENTS.OPPONENT_LEFT)?.payload).toMatchObject({ phase: 'in_game' });
    expect(t.ali.sent.some((m) => m.event === SOCKET_EVENTS.GAME_OVER)).toBe(true);
    expect(t.ahmet.sent.some((m) => m.event === SOCKET_EVENTS.QUIT_PENALTY)).toBe(true);
  });

  it('does not penalize leaving a finished match', async () => {
    const t = makeRoom('game_over');
    const room = new GameRoomDO(t.context, t.env);
    await t.ready();
    await leave(room, t.ahmet, 'ahmet');

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('duel-quit-penalty'))).toBe(false);
    expect(t.ali.sent.some((m) => m.event === SOCKET_EVENTS.OPPONENT_LEFT)).toBe(false);
  });

  it('cancels the match when the matched opponent never connects', async () => {
    const t = makeRoom('lobby');
    (t.storage.get('room') as any).players.ahmet.isConnected = false;
    t.storage.set('alarmContext', { type: 'join_timeout', dueAt: Date.now() - 1 });
    const room = new GameRoomDO(t.context, t.env);
    await t.ready();
    await room.alarm();

    expect(t.ali.sent.find((m) => m.event === SOCKET_EVENTS.OPPONENT_LEFT)?.payload).toMatchObject({
      playerId: 'ahmet', phase: 'before_start', reason: 'no_show',
    });
    expect(t.storage.get('room')).toMatchObject({ status: 'game_over' });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('duel-quit-penalty'))).toBe(false);
  });
});
