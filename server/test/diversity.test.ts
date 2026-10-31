import { generateQuestionsWithEvrenGLM, generateDeterministicEvrenCandidates } from '../src/ai/evrenLlmGenerator';
import { DatabaseAdapter } from '../src/db/prismaClient';

describe('Question Diversity & Anti-Repetition Verification', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = new DatabaseAdapter();
  });

  it('generates 3 consecutive questions with distinct texts (no repeating)', async () => {
    const q1 = await generateQuestionsWithEvrenGLM({
      categoryId: 'geography',
      difficulty: 'easy',
      count: 1,
      db,
    });

    const q2 = await generateQuestionsWithEvrenGLM({
      categoryId: 'geography',
      difficulty: 'easy',
      count: 1,
      db,
    });

    const q3 = await generateQuestionsWithEvrenGLM({
      categoryId: 'geography',
      difficulty: 'easy',
      count: 1,
      db,
    });

    expect(q1.questions.length).toBe(1);
    expect(q2.questions.length).toBe(1);
    expect(q3.questions.length).toBe(1);

    const text1 = q1.questions[0].text;
    const text2 = q2.questions[0].text;
    const text3 = q3.questions[0].text;

    console.log('Generated Q1:', text1);
    console.log('Generated Q2:', text2);
    console.log('Generated Q3:', text3);

    expect(text1).not.toBe(text2);
    expect(text2).not.toBe(text3);
    expect(text1).not.toBe(text3);
  });

  it('shuffles option positions so correctOptionId is not always opt_a', () => {
    const questions = generateDeterministicEvrenCandidates('geography', 'easy', 10, db);
    const correctIds = new Set(questions.map((q) => q.correctOptionId));
    console.log('Distinct correctOptionIds in 10 questions:', Array.from(correctIds));
    // Over 10 questions with 4 options, there should be multiple distinct correct option IDs (not just opt_a)
    expect(correctIds.size).toBeGreaterThan(1);
  });
});
