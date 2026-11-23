vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(protected ctx: DurableObjectState, protected env: unknown) {}
  },
}));

import { calculateScore, SOCKET_EVENTS, type JokerEffect } from '@trivia/shared';
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
        one: { id: 'one', hasAnsweredCurrentRound: false, score: 0, currentStreak: 0, totalResponseTimeMs: 0, correctAnswersCount: 0 },
        two: { id: withBot ? 'bot_atlas' : 'two', isBot: withBot, hasAnsweredCurrentRound: withBot },
      },
      scores: { one: 0, two: 0 },
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
    const answer = (selectedOptionId: string) => worker.webSocketMessage(one as unknown as WebSocket, encodeWsMessage(
      SOCKET_EVENTS.SUBMIT_ANSWER, { roundNumber: 1, selectedOptionId }, 'answer-1',
    ));
    return { worker, room, question, one, two, unverified, use, answer, api, effect, startedAt, values };
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

  it('derives tactic eligibility from the actual room and privately replays it only once', async () => {
    const human = await setup();
    await human.use(human.one, { jokerId: 'joker_double', tactics: 'friendly' });
    expect(human.api).not.toHaveBeenCalled();
    const friends = await setup('friends_private');
    const result = { eliminated: [], modifier: 'double' as const };
    friends.api.mockResolvedValue(result);
    await friends.use(friends.one, { jokerId: 'joker_double' });
    await friends.use(friends.one, { jokerId: 'joker_prophecy' });
    expect(friends.api).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ tactics: 'friendly', jokerId: 'joker_double' }), friends.question);
    expect(friends.one.send.mock.calls.map(([message]) => JSON.parse(message).payload)).toEqual([result, result]);
    expect(friends.two.send).not.toHaveBeenCalled();
  });

  it('blocks answers while the joker is pending and applies the saved multiplier when scoring', async () => {
    const { use, one, api, answer, room, question, startedAt } = await setup('friends_private');
    let finish!: (effect: JokerEffect) => void;
    let sent!: () => void;
    const requested = new Promise<void>(resolve => { sent = resolve; });
    api.mockImplementation(() => new Promise(resolve => { finish = resolve; sent(); }));
    const consuming = use(one, { jokerId: 'joker_double' });
    await requested;
    await answer(question.correctOptionId);
    expect(JSON.parse(one.send.mock.calls[0][0])).toMatchObject({ event: SOCKET_EVENTS.ERROR, payload: { code: 'JOKER_PENDING' } });
    finish({ eliminated: [], modifier: 'double' });
    await consuming;
    vi.setSystemTime(startedAt + 1000);
    await answer(question.correctOptionId);
    const totalTimeMs = (question.timeLimitSec || 15) * 1000;
    const normal = calculateScore({ isCorrect: true, timeRemainingMs: totalTimeMs - 1000, totalTimeMs, currentStreak: 0, penaltyForWrong: false });
    expect(room.players.one).toMatchObject({ score: normal.pointsAwarded * 2, correctAnswersCount: 1, hasAnsweredCurrentRound: true });
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
