import { DatabaseAdapter, computeQuestionHash } from '../src/db/prismaClient';
import { Question } from '@trivia/shared';

describe('DatabaseAdapter Review & Anti-Repeat Engine', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = new DatabaseAdapter();
  });

  it('marks seed questions as published and calculates their content hashes', () => {
    const questions = db.getAllQuestions();
    expect(questions.length).toBeGreaterThan(0);
    questions.forEach((q) => {
      expect(q.reviewStatus).toBe('published');
      expect(q.contentHash).toBeDefined();
    });
  });

  it('creates new question in pending_review status by default and detects duplicate hashes', () => {
    const rawQ: Omit<Question, 'id'> = {
      categoryId: 'history',
      difficulty: 'hard',
      text: 'Osmanlı Devleti hangi yıl kurulmuştur?',
      options: [
        { id: 'opt_a', text: '1299' },
        { id: 'opt_b', text: '1453' },
        { id: 'opt_c', text: '1071' },
        { id: 'opt_d', text: '1923' },
      ],
      correctOptionId: 'opt_a',
      explanation: 'Osman Gazi tarafından 1299 yılında Söğüt ve Domaniç civarında kurulmuştur.',
    };

    const created = db.createQuestion(rawQ);
    expect(created.id).toBeDefined();
    expect(created.reviewStatus).toBe('pending_review');
    expect(created.contentHash).toBeDefined();

    // Check duplicate detection
    const isDup = db.hasQuestionHash(created.contentHash!);
    expect(isDup).toBe(true);
  });

  it('approves and rejects questions with reviewer metadata', () => {
    const created = db.createQuestion({
      categoryId: 'geography',
      difficulty: 'easy',
      text: 'Fransa\'nın başkenti neresidir?',
      options: [
        { id: 'opt_a', text: 'Paris' },
        { id: 'opt_b', text: 'Lyon' },
        { id: 'opt_c', text: 'Marsilya' },
        { id: 'opt_d', text: 'Nice' },
      ],
      correctOptionId: 'opt_a',
      explanation: 'Paris Fransa\'nın başkentidir.',
    });

    // Approve
    const approved = db.approveQuestion(created.id, 'admin_123');
    expect(approved).not.toBeNull();
    expect(approved?.reviewStatus).toBe('published');
    expect(approved?.reviewedBy).toBe('admin_123');
    expect(approved?.reviewedAt).toBeDefined();

    // Create another and reject
    const created2 = db.createQuestion({
      categoryId: 'geography',
      difficulty: 'easy',
      text: 'Hatalı soru metni?',
      options: [
        { id: 'opt_a', text: 'A' },
        { id: 'opt_b', text: 'B' },
        { id: 'opt_c', text: 'C' },
        { id: 'opt_d', text: 'D' },
      ],
      correctOptionId: 'opt_a',
      explanation: 'Test',
    });

    const rejected = db.rejectQuestion(created2.id, 'admin_123', 'Yetersiz soru detayı');
    expect(rejected).not.toBeNull();
    expect(rejected?.reviewStatus).toBe('rejected');
    expect(rejected?.rejectionReason).toBe('Yetersiz soru detayı');
  });

  it('filters by status and only serves published questions in active games', () => {
    const createdPending = db.createQuestion({
      categoryId: 'geography',
      difficulty: 'medium',
      text: 'Pending test sorusu?',
      options: [
        { id: 'opt_a', text: '1' },
        { id: 'opt_b', text: '2' },
        { id: 'opt_c', text: '3' },
        { id: 'opt_d', text: '4' },
      ],
      correctOptionId: 'opt_a',
      explanation: 'Test',
    });

    const pendingList = db.getQuestionsByStatus('pending_review');
    expect(pendingList.some((q) => q.id === createdPending.id)).toBe(true);

    // Active game question fetcher must NEVER return pending_review or rejected
    const activeQuestions = db.getQuestions('geography', 'medium', 50);
    expect(activeQuestions.some((q) => q.id === createdPending.id)).toBe(false);
  });

  it('anti-repeat engine excludes seen question ids until pool is exhausted', () => {
    // There are 5 seed geography questions; pick 2 first, then next 2 must have 0 overlap
    const firstSet = db.getQuestions('geography', undefined, 2);
    const seenIds = firstSet.map((q) => q.id);

    const secondSet = db.getQuestions('geography', undefined, 2, seenIds);
    const overlap = secondSet.filter((q) => seenIds.includes(q.id));
    expect(overlap.length).toBe(0);
  });

  it('computes stats accurately', () => {
    const stats = db.getReviewStats();
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.published).toBeGreaterThan(0);
  });

  it('never leaks math or history questions into food_gastronomy category', () => {
    const foodQuestions = db.getQuestions('food_gastronomy', 'easy', 5);
    expect(foodQuestions.length).toBe(5);
    foodQuestions.forEach((q) => {
      expect(q.categoryId).toBe('food_gastronomy');
    });
  });

  it('returns real published question counts for each category via getCategories()', () => {
    const categories = db.getCategories();
    const foodCat = categories.find((c) => c.id === 'food_gastronomy');
    expect(foodCat).toBeDefined();
    const realFoodQuestions = db
      .getAllQuestions()
      .filter((q) => q.categoryId === 'food_gastronomy' && q.reviewStatus === 'published');
    expect(foodCat?.totalQuestions).toBe(realFoodQuestions.length);
  });
});
