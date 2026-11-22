vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(protected ctx: DurableObjectState, protected env: unknown) {}
  },
}));

import { GameRoomDO } from '../src/durable-objects/GameRoom';
import { DEFAULT_QUESTIONS } from '../src/game/defaultQuestions';
import type { Env } from '../src/env';

describe('live duel phase and reconnect deadlines', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps the round and intermission moving after a disconnect and a Durable Object restart', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const question = DEFAULT_QUESTIONS[0];
    const storage = new Map<string, unknown>([
      ['room', {
        code: 'DUEL1', mode: 'duel', status: 'question_active',
        currentRound: 1, totalRounds: 2, currentQuestion: question, roundStartedAt: Date.now(),
        players: {
          one: { id: 'one', username: 'One', score: 0, isConnected: true },
          two: { id: 'two', username: 'Two', score: 0, isConnected: true },
        },
        scores: { one: 0, two: 0 },
      }],
      ['questions', DEFAULT_QUESTIONS.slice(0, 2)],
      ['alarmContext', { type: 'round_end', roundNumber: 1, dueAt: 1_015_000 }],
    ]);
    const setAlarm = vi.fn();
    let restore: Promise<unknown>;
    const context = {
      storage: {
        get: async (key: string) => structuredClone(storage.get(key)),
        put: async (key: string, value: unknown) => storage.set(key, structuredClone(value)),
        delete: async (keys: string | string[]) => (Array.isArray(keys) ? keys : [keys]).forEach((key) => storage.delete(key)),
        setAlarm,
      },
      blockConcurrencyWhile: (run: () => Promise<unknown>) => { restore = run(); },
      getWebSockets: () => [],
    } as unknown as DurableObjectState;
    const env = { RECONNECTION_GRACE_SEC: 60 } as Env;
    const socket = { deserializeAttachment: () => ({ playerId: 'two' }) } as unknown as WebSocket;
    const initialObject = new GameRoomDO(context, env);
    await restore!;
    await initialObject.webSocketClose(socket, 1006, '', false);
    expect(storage.get('reconnectDeadlines')).toEqual({ two: 1_060_000 });
    expect(setAlarm).toHaveBeenLastCalledWith(1_015_000);

    const restarted = new GameRoomDO(context, env);
    await restore!;
    vi.setSystemTime(1_015_000);
    await restarted.alarm();
    expect(storage.get('room')).toMatchObject({ status: 'round_result', currentRound: 1 });
    expect(setAlarm).toHaveBeenLastCalledWith(1_016_500);

    vi.setSystemTime(1_016_500);
    await restarted.alarm();
    expect(storage.get('room')).toMatchObject({ status: 'question_active', currentRound: 2 });
    expect(storage.get('reconnectDeadlines')).toEqual({ two: 1_060_000 });
  });
});
