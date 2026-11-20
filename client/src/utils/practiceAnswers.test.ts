import { getOfflinePracticeAnswer, requestPracticeAnswer } from './practiceAnswers';

const answer = {
  questionId: 'q1', selectedOptionId: 'opt_c', timeRemainingMs: 1000,
  totalTimeMs: 15000, currentStreak: 0, sessionId: 'test', playerId: 'test-player',
};

describe('practice answer requests', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('unblocks the quiz even if the response body stalls', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => {}) });
    vi.stubGlobal('fetch', fetchMock);
    const pending = requestPracticeAnswer('/submit', answer, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toBeNull();
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('returns the server verdict when it belongs to the submitted question', async () => {
    const verdict = { questionId: 'q1', isCorrect: true, isTimeout: false, correctOptionId: 'opt_c' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => verdict }));
    await expect(requestPracticeAnswer('/submit', answer)).resolves.toEqual(verdict);
    await expect(requestPracticeAnswer('/submit', { ...answer, questionId: 'q2' })).resolves.toBeNull();
  });

  it('uses real answers only for bundled offline questions', () => {
    expect(getOfflinePracticeAnswer('fallback_q2')).toBe('opt_c');
    expect(getOfflinePracticeAnswer('fallback_q4')).toBe('opt_a');
    expect(getOfflinePracticeAnswer('q1')).toBeUndefined();
  });
});
