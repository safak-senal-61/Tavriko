import { verifyJwt } from '../src/auth/authenticate';
import { getFallbackQuestions, DEFAULT_QUESTIONS } from '../src/game/defaultQuestions';

describe('Auth & Default Questions', () => {
  it('correctly validates and formats guest tokens', async () => {
    const res = await verifyJwt('guest_local_abc123', 'any_secret');
    expect(res.isValid).toBe(true);
    expect(res.user?.id).toBe('guest_local_abc123');
    expect(res.user?.isGuest).toBe(true);
  });

  it('rejects malformed or empty JWTs', async () => {
    const res1 = await verifyJwt('', 'secret');
    expect(res1.isValid).toBe(false);

    const res2 = await verifyJwt('invalid.token', 'secret');
    expect(res2.isValid).toBe(false);
  });

  it('provides rich fallback questions per category', () => {
    const geoQuestions = getFallbackQuestions('geography', 'easy', 3);
    expect(geoQuestions.length).toBe(3);
    expect(geoQuestions[0].options.length).toBe(4);
    expect(geoQuestions[0].correctOptionId).toBeDefined();

    const mixedQuestions = getFallbackQuestions('mixed', 'medium', 5);
    expect(mixedQuestions.length).toBe(5);
  });

  it('ensures all default questions have valid structure', () => {
    expect(DEFAULT_QUESTIONS.length).toBeGreaterThanOrEqual(8);
    for (const q of DEFAULT_QUESTIONS) {
      expect(q.text.length).toBeGreaterThan(5);
      expect(q.options.length).toBe(4);
      const optionIds = q.options.map((o) => o.id);
      expect(optionIds).toContain(q.correctOptionId);
      expect(q.explanation.length).toBeGreaterThan(5);
    }
  });
});
