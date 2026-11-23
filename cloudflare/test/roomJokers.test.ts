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

  async function setup(mode: 'duel' | 'friends_private' = 'duel', withBot = false, legacy = false) {
    vi.useFakeTimers();
    const startedAt = Date.now();
    const question = DEFAULT_QUESTIONS[0];
    const room = {
      code: 'QUIZ01', mode, status: 'question_active', currentRound: 1,
      currentQuestion: question, totalRounds: 2, roundStartedAt: startedAt,
      players: {
        one: { id: 'one', hasAnsweredCurrentRound: false, score: 0, currentStreak: 0, totalResponseTimeMs: 0, correctAnswersCount: 0 },
        two: { id: withBot ? 'bot_atlas' : 'two', isBot: withBot, isConnected: true, hasAnsweredCurrentRound: withBot },
      },
      scores: { one: 0, two: 0 },
    };
    const effect = { eliminated: [question.options.find(o => o.id !== question.correctOptionId)!.id] };
    const values = new Map<string, unknown>([['room', room], ['questions', DEFAULT_QUESTIONS.slice(0, 4)]]);
    if (legacy) values.set('joker:one', { startedAt, roundNumber: 1, effect });
    const get = vi.fn(async (key: string) => values.get(key));
    const setAlarm = vi.fn();
    const audienceFetch = vi.fn().mockResolvedValue(Response.json({}));
    let restore: Promise<unknown>;
    const ctx = {
      blockConcurrencyWhile: (run: () => Promise<unknown>) => { restore = run(); },
      storage: {
        get,
        put: async (key: string, value: unknown) => { values.set(key, value); },
        delete: async (key: string) => { values.delete(key); },
        setAlarm,
        deleteAlarm: vi.fn(),
      },
      getWebSockets: (tag?: string) => tag === 'player:one' ? [one] : tag === 'player:two' ? [two] : [one, two],
      waitUntil: vi.fn(),
    } as unknown as DurableObjectState;
    const makeSocket = (playerId: string, canSpendJokers = true) =>
      ({ send: vi.fn(), deserializeAttachment: () => ({ playerId, canSpendJokers }) });
    const one = makeSocket('one'), two = makeSocket('two'), unverified = makeSocket('one', false);
    const worker = new GameRoomDO(ctx, { INTERNAL_API_SECRET: 'room-joker-test',
      GAME_ROOMS: { idFromName: (name: string) => name, get: () => ({ fetch: audienceFetch }) },
    } as unknown as Env);
    await restore!;
    const api = vi.spyOn(ApiService.prototype, 'useRoomJoker').mockResolvedValue(effect);
    const use = (socket = one, patch: object = {}) => worker.webSocketMessage(socket as unknown as WebSocket, encodeWsMessage(
      SOCKET_EVENTS.USE_JOKER,
      { startedAt, roundNumber: 1, questionId: question.id, jokerId: 'joker_eliminate', playerId: 'two', ...patch }, 'use-1',
    ));
    const answer = (selectedOptionId: string, questionId = question.id) => worker.webSocketMessage(one as unknown as WebSocket, encodeWsMessage(
      SOCKET_EVENTS.SUBMIT_ANSWER, { roundNumber: 1, selectedOptionId, questionId }, 'answer-1',
    ));
    return { worker, room, question, one, two, unverified, use, answer, api, effect, startedAt, values, setAlarm, audienceFetch, get };
  }

  it.each(['duel', 'friends_private'] as const)('applies and privately replays an owned effect in %s', async mode => {
    const { worker, one, two, question, use, api, effect, startedAt, values, get } = await setup(mode);
    get.mockClear();
    await use();
    expect(get).not.toHaveBeenCalled();
    expect(api).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ userId: 'one', startedAt }), question);
    expect(JSON.parse(one.send.mock.calls[0][0])).toMatchObject({ event: SOCKET_EVENTS.JOKER_RESULT, requestId: 'use-1', payload: effect });
    expect(two.send).not.toHaveBeenCalled();
    expect(values.get('room')).toMatchObject({ players: { one: { jokerRound: { effect } } } });
    // Directly exercise the reconnect question payload builder, without requiring a real WebSocketPair.
    const replay = (socket: typeof one) => (worker as any).getQuestionForSocket(socket.deserializeAttachment());
    expect(await replay(one)).toMatchObject({ jokerEffect: effect });
    expect(await replay(two)).not.toHaveProperty('jokerEffect');
  });

  it('restores a legacy effect before a player reconnects, without reading storage on a tap', async () => {
    const { worker, one, two, get, api, effect, use, answer } = await setup('duel', false, true);
    expect(get).toHaveBeenCalledWith('joker:one');
    get.mockClear();
    expect(await (worker as any).getQuestionForSocket(one.deserializeAttachment())).toMatchObject({ jokerEffect: effect });
    expect(await (worker as any).getQuestionForSocket(two.deserializeAttachment())).not.toHaveProperty('jokerEffect');
    await use();
    await answer(effect.eliminated[0]);
    expect(get).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
    expect(JSON.parse(one.send.mock.calls.at(-1)![0])).toMatchObject({ payload: { code: 'OPTION_ELIMINATED' } });
  });

  it('returns bounded wallet latency only to the requesting player and only once', async () => {
    const { worker, question, room, one, two, use, api, effect, startedAt, setAlarm } = await setup('friends_private');
    const baseMs = (question.timeLimitSec || 15) * 1000;
    api.mockImplementationOnce(async () => {
      vi.setSystemTime(startedAt + 2400);
      return effect;
    });
    await use();
    await use();
    expect(api).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ requestedAt: startedAt }), question);
    expect(room.players.one).toMatchObject({ jokerRound: { extensionMs: 2000, pausedMs: 2000, effect } });
    expect(room.players.two).not.toHaveProperty('jokerRound');
    expect(setAlarm).toHaveBeenLastCalledWith(startedAt + baseMs + 2000);
    expect(await (worker as any).getQuestionForSocket(one.deserializeAttachment())).toMatchObject({
      timeRemainingMs: baseMs - 400, jokerEffect: effect,
    });
    expect(two.send).not.toHaveBeenCalled();
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

  it('replaces the question privately and rejects an answer sent for the original question', async () => {
    const { worker, one, two, question, use, answer, api, room } = await setup('friends_private');
    api.mockResolvedValue({ eliminated: [], action: 'replace' });
    await use(one, { jokerId: 'joker_replace' });
    const replacement = DEFAULT_QUESTIONS[2];
    const privateQuestion = JSON.parse(one.send.mock.calls[0][0]);
    expect(privateQuestion).toMatchObject({ event: SOCKET_EVENTS.QUESTION_START, payload: { id: replacement.id } });
    expect(privateQuestion.payload).not.toHaveProperty('correctOptionId');
    expect(two.send).not.toHaveBeenCalled();
    expect(await (worker as any).getQuestionForSocket(two.deserializeAttachment())).toMatchObject({ id: question.id });
    expect((worker as any).getSanitizedRoom().players.one).not.toHaveProperty('jokerRound');
    await answer(question.correctOptionId);
    expect(room.players.one.hasAnsweredCurrentRound).toBe(false);
    await answer(replacement.correctOptionId, replacement.id);
    expect(room.players.one).toMatchObject({ hasAnsweredCurrentRound: true, correctAnswersCount: 1, rewardAnswers: 1 });
  });

  it.each([
    ['joker_pause', 'pause', 5000, 5000],
    ['joker_extra_time', 'extra_time', 15000, undefined],
  ] as const)('syncs %s on reconnect without changing the opponent deadline', async (id, action, extension, pause) => {
    const { worker, question, use, one, two, api, startedAt, setAlarm } = await setup('friends_private');
    api.mockResolvedValue({ eliminated: [], action });
    await use(one, { jokerId: id });
    const baseMs = (question.timeLimitSec || 15) * 1000;
    const replay = (socket: typeof one) => (worker as any).getQuestionForSocket(socket.deserializeAttachment());
    expect(await replay(one)).toMatchObject({ timeRemainingMs: baseMs + extension, jokerPauseRemainingMs: pause });
    expect(await replay(two)).toMatchObject({ timeRemainingMs: baseMs });
    expect(setAlarm).toHaveBeenLastCalledWith(startedAt + baseMs + extension);
  });

  it.each([['joker_retry', 'retry'], ['joker_probe', 'probe']] as const)('keeps the first %s choice private and only scores the final answer', async (id, action) => {
    const { one, two, use, answer, api, effect, question, room } = await setup('friends_private');
    api.mockResolvedValue({ eliminated: [], action });
    await use(one, { jokerId: id });
    await answer(effect.eliminated[0]);
    expect(JSON.parse(one.send.mock.calls.at(-1)![0])).toMatchObject({ event: SOCKET_EVENTS.JOKER_RETRY });
    expect(two.send).not.toHaveBeenCalled();
    expect(room.players.one.hasAnsweredCurrentRound).toBe(false);
    await answer(question.correctOptionId);
    expect(room.players.one).toMatchObject({ hasAnsweredCurrentRound: true, correctAnswersCount: 1, rewardAnswers: 1 });
  });

  it('skips without registering an answer or debits no stock for a poll with insufficient votes', async () => {
    const { worker, one, use, answer, api, question, room, audienceFetch } = await setup('friends_private');
    await use(one, { jokerId: 'joker_audience' });
    expect(audienceFetch).toHaveBeenCalledOnce();
    expect(api).not.toHaveBeenCalled();
    api.mockResolvedValue({ eliminated: [], action: 'skip' });
    await use(one, { jokerId: 'joker_skip' });
    expect(await (worker as any).getQuestionForSocket(one.deserializeAttachment())).toMatchObject({ jokerSkipped: true });
    await answer(question.correctOptionId);
    expect(room.players.one).toMatchObject({ hasAnsweredCurrentRound: true, correctAnswersCount: 0 });
    expect(room.players.one).not.toHaveProperty('rewardAnswers');
  });

  it('freezes only the unanswered opponent and blocks their submission until the timer resumes', async () => {
    const { use, one, two, api, worker, room, question, startedAt } = await setup('friends_private');
    Object.assign(room.players.two, { score: 0, currentStreak: 0, totalResponseTimeMs: 0, correctAnswersCount: 0 });
    api.mockResolvedValue({ eliminated: [], action: 'freeze' });
    await use(one, { jokerId: 'joker_freeze' });
    expect(JSON.parse(two.send.mock.calls[0][0])).toMatchObject({
      event: SOCKET_EVENTS.QUESTION_START, payload: { jokerFrozen: true, jokerPauseRemainingMs: 15000 },
    });
    const opponentAnswer = () => worker.webSocketMessage(two as unknown as WebSocket, encodeWsMessage(
      SOCKET_EVENTS.SUBMIT_ANSWER, { roundNumber: 1, questionId: question.id, selectedOptionId: question.correctOptionId },
    ));
    await opponentAnswer();
    expect(room.players.two.hasAnsweredCurrentRound).toBe(false);
    vi.setSystemTime(startedAt + 15_001);
    await opponentAnswer();
    expect(room.players.two).toMatchObject({ hasAnsweredCurrentRound: true, correctAnswersCount: 1 });
  });

  it.each([true, false])('only includes completion proof when the final round ended normally (%s)', async completedNormally => {
    const { worker, room } = await setup('friends_private');
    Object.assign(room, { status: 'round_result', currentRound: 2 });
    Object.assign(room.players.one, { isConnected: true, rewardStarted: true, rewardAnswers: 1 });
    Object.assign(room.players.two, { isConnected: true, rewardStarted: true, rewardAnswers: 0, score: 0, correctAnswersCount: 0 });
    const submit = vi.spyOn(ApiService.prototype, 'submitMatchResults').mockResolvedValue(true);
    await (worker as any).finishGame(completedNormally);
    expect(submit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      rewardCompletedPlayerIds: completedNormally ? ['one'] : [],
    }));
  });
});
