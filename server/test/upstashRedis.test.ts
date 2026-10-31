import { cacheService } from '../src/cache/redisClient';

describe('Upstash Redis & Game State Cache Engine', () => {
  it('stores and retrieves question expiry timestamps accurately', async () => {
    const sessionId = 'test_redis_sess_' + Date.now();
    const questionId = 'q_expiry_123';
    const expiresAt = Date.now() + 15000;

    await cacheService.setQuestionExpiry(sessionId, questionId, expiresAt, 10);
    const retrieved = await cacheService.getQuestionExpiry(sessionId, questionId);

    expect(retrieved).toBe(expiresAt);
  });

  it('atomically acquires answer lock and prevents duplicate execution', async () => {
    const sessionId = 'test_redis_lock_' + Date.now();
    const questionId = 'q_lock_456';
    const playerId = 'player_one';

    // First attempt must succeed
    const firstAttempt = await cacheService.acquireAnswerLock(sessionId, questionId, playerId);
    expect(firstAttempt).toBe(true);

    // Second attempt must fail (already locked)
    const secondAttempt = await cacheService.acquireAnswerLock(sessionId, questionId, playerId);
    expect(secondAttempt).toBe(false);
  });

  it('records and returns seen questions for anti-repeat tracking', async () => {
    const playerId = 'player_antirepeat_' + Date.now();
    const categoryId = 'geography';

    await cacheService.recordSeenQuestion(playerId, categoryId, 'geo_1');
    await cacheService.recordSeenQuestion(playerId, categoryId, 'geo_2');

    const seen = await cacheService.getSeenQuestions(playerId, categoryId);
    expect(seen).toContain('geo_1');
    expect(seen).toContain('geo_2');
    expect(seen.length).toBe(2);
  });
});
