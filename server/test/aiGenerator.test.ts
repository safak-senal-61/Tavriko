import { validateQuestion } from '../src/ai/questionValidator';
import { generateQuestionsWithAI } from '../src/ai/geminiGenerator';
import { DatabaseAdapter } from '../src/db/prismaClient';

describe('AI Question Validator & Generation Engine', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = new DatabaseAdapter();
  });

  describe('10-Point Question Validator', () => {
    it('passes for a valid complete Turkish question', () => {
      const validQ = {
        categoryId: 'mathematics' as const,
        difficulty: 'medium' as const,
        text: 'Bir üçgenin iç açıları toplamı kaç derecedir?',
        options: [
          { id: 'opt_a', text: '90' },
          { id: 'opt_b', text: '180' },
          { id: 'opt_c', text: '270' },
          { id: 'opt_d', text: '360' },
        ],
        correctOptionId: 'opt_b',
        explanation: 'Öklid geometrisinde tüm düzlem üçgenlerin iç açıları toplamı 180 derecedir.',
        language: 'tr',
      };

      const result = validateQuestion(validQ, db);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('fails when options count is not 4', () => {
      const invalidQ = {
        categoryId: 'history' as const,
        difficulty: 'easy' as const,
        text: 'Cumhuriyet kaç yılında ilan edildi?',
        options: [
          { id: 'opt_a', text: '1923' },
          { id: 'opt_b', text: '1920' },
        ],
        correctOptionId: 'opt_a',
        explanation: '29 Ekim 1923 yılında ilan edildi.',
      };

      const result = validateQuestion(invalidQ, db);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Check 2'))).toBe(true);
    });

    it('fails when options have duplicate texts', () => {
      const duplicateOptQ = {
        categoryId: 'geography' as const,
        difficulty: 'easy' as const,
        text: 'Ege Denizi hangi ülkeye kıyıdır?',
        options: [
          { id: 'opt_a', text: 'Türkiye' },
          { id: 'opt_b', text: 'Yunanistan' },
          { id: 'opt_c', text: 'türkiye' }, // duplicate text
          { id: 'opt_d', text: 'İtalya' },
        ],
        correctOptionId: 'opt_a',
        explanation: 'Ege Denizi hem Türkiye hem Yunanistan kıyısındadır.',
      };

      const result = validateQuestion(duplicateOptQ, db);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Check 4'))).toBe(true);
    });

    it('fails when correctOptionId does not match any option', () => {
      const wrongIdQ = {
        categoryId: 'sports' as const,
        difficulty: 'easy' as const,
        text: 'Futbolda bir takım sahaya kaç oyuncu ile çıkar?',
        options: [
          { id: 'opt_a', text: '9' },
          { id: 'opt_b', text: '10' },
          { id: 'opt_c', text: '11' },
          { id: 'opt_d', text: '12' },
        ],
        correctOptionId: 'opt_z',
        explanation: 'Her takım sahaya 11 oyuncuyla çıkar.',
      };

      const result = validateQuestion(wrongIdQ, db);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Check 5'))).toBe(true);
    });

    it('fails when question is a duplicate of existing question in db', () => {
      const existing = db.getAllQuestions()[0];
      const dupQ = {
        categoryId: existing.categoryId,
        difficulty: existing.difficulty,
        text: existing.text,
        options: existing.options,
        correctOptionId: existing.correctOptionId,
        explanation: existing.explanation,
      };

      const result = validateQuestion(dupQ, db);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Check 10'))).toBe(true);
    });
  });

  describe('AI Generator Service', () => {
    it('generates, validates, and stores questions as pending_review', async () => {
      const beforePending = db.getQuestionsByStatus('pending_review').length;

      const result = await generateQuestionsWithAI({
        categoryId: 'mathematics',
        difficulty: 'hard',
        count: 2,
        db,
      });

      expect(result.generatedCount).toBeGreaterThanOrEqual(1);
      expect(result.validCount).toBeGreaterThanOrEqual(1);
      expect(result.questions.length).toBeGreaterThanOrEqual(1);

      // Verify all generated questions have pending_review status
      result.questions.forEach((q) => {
        expect(q.reviewStatus).toBe('pending_review');
        expect(q.categoryId).toBe('mathematics');
        expect(q.difficulty).toBe('hard');
      });

      const afterPending = db.getQuestionsByStatus('pending_review').length;
      expect(afterPending).toBe(beforePending + result.validCount);
    });
  });
});
