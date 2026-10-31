import { generateQuestionsWithEvrenGLM } from '../src/ai/evrenLlmGenerator';
import { DatabaseAdapter } from '../src/db/prismaClient';

describe('Evren Türkiye LLM (GLM 5.3) Question Generator', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = new DatabaseAdapter();
  });

  it('generates questions with evren/glm-5.3-fp8 model metadata and pending_review status', async () => {
    const result = await generateQuestionsWithEvrenGLM({
      categoryId: 'science_tech',
      difficulty: 'hard',
      count: 2,
      db,
    });

    expect(result.generatedCount).toBe(2);
    expect(result.validCount).toBe(2);
    expect(result.provider).toBe('evren-turkiye');
    expect(result.questions.length).toBe(2);

    result.questions.forEach((q) => {
      expect(q.categoryId).toBe('science_tech');
      expect(q.difficulty).toBe('hard');
      expect(q.reviewStatus).toBe('pending_review');
      expect(q.options.length).toBe(4);
      expect(q.modelMetadata?.model).toContain('glm-5.3');
    });
  });

  it('generates mathematics questions with verified formulas and explanations', async () => {
    const result = await generateQuestionsWithEvrenGLM({
      categoryId: 'mathematics',
      difficulty: 'medium',
      count: 1,
      db,
    });

    expect(result.validCount).toBe(1);
    const q = result.questions[0];
    expect(q.explanation.length).toBeGreaterThanOrEqual(15);
    expect(q.sourceOrVerification).toBeDefined();
  });
});
