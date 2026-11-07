import request from 'supertest';
import { createApp } from '../src/server';
import { db } from '../src/db/prismaClient';
import { cacheService } from '../src/cache/redisClient';

describe('Timer Synchronization & Authoritative Answer Locking Engine', () => {
  let appInstance: any;

  beforeAll(() => {
    appInstance = createApp();
  });

  afterAll(() => {
    appInstance.close();
  });

  async function issuePracticeQuestion() {
    const issued = await request(appInstance.app).get('/api/questions/practice?category=geography&count=3');
    expect(issued.status).toBe(200);
    const questionId = issued.body.questions[0].id as string;
    const question = db.getQuestionById(questionId);
    if (!question) throw new Error('Test question missing from DB');
    return { sessionId: issued.body.sessionId as string, question };
  }

  it('rejects duplicate answer submissions for the same issued session', async () => {
    const { sessionId, question } = await issuePracticeQuestion();
    const body = {
      questionId: question.id,
      selectedOptionId: question.correctOptionId,
      timeRemainingMs: 8000,
      totalTimeMs: 15000,
      currentStreak: 0,
      sessionId,
    };

    const res1 = await request(appInstance.app).post('/api/questions/submit').send(body);
    expect(res1.status).toBe(200);

    const res2 = await request(appInstance.app).post('/api/questions/submit').send(body);
    expect(res2.status).toBe(409);
    expect(res2.body.code).toBe('ALREADY_ANSWERED');
  });

  it('rejects answers after the server-side question expiry', async () => {
    const { sessionId, question } = await issuePracticeQuestion();
    await cacheService.setQuestionExpiry(sessionId, question.id, Date.now() - 1000, 30);

    const res = await request(appInstance.app)
      .post('/api/questions/submit')
      .send({
        questionId: question.id,
        selectedOptionId: question.correctOptionId,
        timeRemainingMs: 1000,
        totalTimeMs: 15000,
        currentStreak: 0,
        sessionId,
      });

    expect(res.status).toBe(410);
  });

  it('sets expiry for each question under the server-issued session ticket', async () => {
    const res = await request(appInstance.app)
      .get('/api/questions/practice?category=geography&count=3');

    expect(res.status).toBe(200);
    expect(res.body.questions.length).toBe(3);
    expect(res.body.sessionId).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const firstQ = res.body.questions[0];
    const expiry = await cacheService.getQuestionExpiry(res.body.sessionId, firstQ.id);
    expect(expiry).toBeGreaterThan(Date.now());
  });

  it('does not reveal answers for questions outside the issued session', async () => {
    const { sessionId, question } = await issuePracticeQuestion();
    const otherQuestion = db.getQuestionById('math_1');
    if (!otherQuestion) throw new Error('Expected test question missing');
    const res = await request(appInstance.app)
      .post('/api/questions/submit')
      .send({
        questionId: otherQuestion.id,
        selectedOptionId: otherQuestion.correctOptionId,
        sessionId,
      });
    expect(res.status).toBe(403);
  });
});
