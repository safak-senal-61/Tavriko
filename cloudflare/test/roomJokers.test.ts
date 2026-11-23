vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(protected ctx: DurableObjectState, protected env: unknown) {}
  },
}));

import { SOCKET_EVENTS } from '@trivia/shared';
import { GameRoomDO } from '../src/durable-objects/GameRoom';
import type { Env } from '../src/env';
import { DEFAULT_QUESTIONS } from '../src/game/defaultQuestions';
import { ApiService } from '../src/services/apiService';
import { encodeWsMessage } from '../src/websocket/protocol';

describe('room joker requests', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  async function setup(mode: 'duel' | 'friends_private' = 'duel', withBot = false) {
    vi.useFakeTimers();
    const startedAt = Date.now();
    const question = DEFAULT_QUESTIONS[0];
    const room = {
      code: 'QUIZ01', mode, status: 'question_active', currentRound: 1,
      currentQuestion: question, totalRounds: 2, roundStartedAt: startedAt,
      players: {
        one: { id: 'one', hasAnsweredCurrentRound: false },
        two: { id: withBot ? 'bot_atlas' : 'two', isBot: withBot, hasAnsweredCurrentRound: withBot },
      },
    };
    const values = new Map<string, unknown>([['room', room]]);
    let restore: Promise<unknown>;
    const ctx = {
      blockConcurrencyWhile: (run: () => Promise<unknown>) => { restore = run(); },
      storage: {
        get: async (key: string) => values.get(key),
        put: async (key: string, value: unknown) => { values.set(key, value); },
      },
      getWebSockets: () => [one, two],
    } as unknown as DurableObjectState;
    const makeSocket = (playerId: string, canSpendJokers = true) =>
      ({ send: vi.fn(), deserializeAttachment: () => ({ playerId, canSpendJokers }) });
    const one = makeSocket('one'), two = makeSocket('two'), unverified = makeSocket('one', false);
    const worker = new GameRoomDO(ctx, { INTERNAL_API_SECRET: 'room-joker-test' } as Env);
    await restore!;
    const effect = { eliminated: [question.options.find(o => o.id !== question.correctOptionId)!.id] };
    const api = vi.spyOn(ApiService.prototype, 'useRoomJoker').mockResolvedValue(effect);
    const use = (socket = one, patch: object = {}) => worker.webSocketMessage(socket as unknown as WebSocket, encodeWsMessage(
      SOCKET_EVENTS.USE_JOKER,
      { startedAt, roundNumber: 1, questionId: question.id, jokerId: 'joker_eliminate', playerId: 'two', ...patch }, 'use-1',
    ));
    return { worker, room, question, one, two, unverified, use, api, effect, startedAt, values };
  }

  it.each(['duel', 'friends_private'] as const)('applies and privately replays an owned effect in %s', async mode => {
    const { worker, one, two, question, use, api, effect, startedAt, values } = await setup(mode);
    await use();
    expect(api).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ userId: 'one', startedAt }), question);
    expect(JSON.parse(one.send.mock.calls[0][0])).toMatchObject({ event: SOCKET_EVENTS.JOKER_RESULT, requestId: 'use-1', payload: effect });
    expect(two.send).not.toHaveBeenCalled();
    expect(values.get('joker:one')).toEqual({ startedAt, roundNumber: 1, effect });
    // Directly exercise the reconnect question payload builder, without requiring a real WebSocketPair.
    const replay = (socket: typeof one) => (worker as any).getQuestionForSocket(socket.deserializeAttachment());
    expect(await replay(one)).toMatchObject({ jokerEffect: effect });
    expect(await replay(two)).not.toHaveProperty('jokerEffect');
  });

  it('offers the joker to the signed-in human even after the duel bot has answered', async () => {
    const { worker, question, one, two: botSocket, api, use, startedAt, effect } = await setup('duel', true);
    expect(await (worker as any).getQuestionForSocket(one.deserializeAttachment())).toMatchObject({
      id: question.id, jokerRoundStartedAt: startedAt,
    });
    await use(botSocket);
    expect(api).not.toHaveBeenCalled();
    await use();
    expect(api).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ userId: 'one' }), question);
    expect(JSON.parse(one.send.mock.calls[0][0])).toMatchObject({ event: SOCKET_EVENTS.JOKER_RESULT, payload: effect });
  });

  it('rejects unverified, stale, answered and expired requests before contacting the wallet', async () => {
    const { room, one, unverified, use, api, startedAt } = await setup();
    await use(unverified);
    await use(one, { startedAt: startedAt - 1000 });
    room.players.one.hasAnsweredCurrentRound = true;
    await use();
    room.players.one.hasAnsweredCurrentRound = false;
    vi.setSystemTime(startedAt + 120_000);
    await use();
    expect(api).not.toHaveBeenCalled();
    expect(one.send).toHaveBeenCalledTimes(3);
    expect(JSON.parse(unverified.send.mock.calls[0][0])).toMatchObject({ event: SOCKET_EVENTS.ERROR, requestId: 'use-1' });
  });
});
