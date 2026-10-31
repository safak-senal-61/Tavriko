import request from 'supertest';
import { createApp } from '../src/server';
import { cacheService } from '../src/cache/redisClient';

describe('Timer Synchronization & Authoritative Answer Locking Engine', () => {
  let appInstance: any;

  beforeAll(() => {
    appInstance = createApp();
  });

  afterAll(() => {
    appInstance.close();
  });

  it('rejects duplicate answer submissions on the same question with 409 Conflict', async () => {
    const questionId = 'geo_1';
    const sessionId = 'test_session_idempotency_' + Date.now();
    const playerId = 'player_alpha';

    // 1st submission: should succeed
    const res1 = await request(appInstance.app)
      .post('/api/questions/submit')
      .send({
        questionId,
        selectedOptionId: 'opt_a',
        timeRemainingMs: 8000,
        totalTimeMs: 15000,
        currentStreak: 0,
        playerId,
        sessionId,
      });

    expect(res1.status).toBe(200);
    expect(res1.body.questionId).toBe(questionId);

    // 2nd submission for the exact same question/player/session: must be REJECTED!
    const res2 = await request(appInstance.app)
      .post('/api/questions/submit')
      .send({
        questionId,
        selectedOptionId: 'opt_a',
        timeRemainingMs: 7000,
        totalTimeMs: 15000,
        currentStreak: 1,
        playerId,
        sessionId,
      });

    expect(res2.status).toBe(409);
    expect(res2.body.code).toBe('ALREADY_ANSWERED');
  });

  it('authoritatively flags question as timed out when submitted after expiration', async () => {
    const questionId = 'math_1';
    const sessionId = 'test_session_expiry_' + Date.now();
    const playerId = 'player_late';

    // Set expiration in cache to 1000ms ago (well past the 500ms grace window)
    await cacheService.setQuestionExpiry(sessionId, questionId, Date.now() - 1000, 30);

    const res = await request(appInstance.app)
      .post('/api/questions/submit')
      .send({
        questionId,
        selectedOptionId: 'opt_b', // Even if correct option is sent
        timeRemainingMs: 1000,     // Client attempts to claim time remained
        totalTimeMs: 15000,
        currentStreak: 0,
        playerId,
        sessionId,
      });

    expect(res.status).toBe(200);
    expect(res.body.isTimeout).toBe(true);
    expect(res.body.isCorrect).toBe(false);
    expect(res.body.pointsAwarded).toBe(0);
  });

  it('sets expiry properly when practice questions are fetched', async () => {
    const sessionId = 'test_session_fetch_' + Date.now();
    const res = await request(appInstance.app)
      .get(`/api/questions/practice?category=geography&count=3&sessionId=${sessionId}`);

    expect(res.status).toBe(200);
    expect(res.body.questions.length).toBe(3);

    const firstQ = res.body.questions[0];
    const expiry = await cacheService.getQuestionExpiry(sessionId, firstQ.id);
    expect(expiry).toBeGreaterThan(Date.now());
  });
});
