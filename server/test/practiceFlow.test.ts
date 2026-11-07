import request from 'supertest';
import { createApp } from '../src/server';
import { db } from '../src/db/prismaClient';
import { Server } from 'http';

describe('Authoritative Question Submit & Practice Flow API', () => {
  let app: any;
  let server: Server;
  let teardown: () => void;

  beforeAll((done) => {
    const created = createApp();
    app = created.app;
    teardown = created.close;
    server = created.httpServer.listen(0, () => done());
  });

  afterAll((done) => {
    teardown();
    server.close(done);
  });

  async function createPracticeSession() {
    const issued = await request(app).get('/api/questions/practice?category=geography&count=5');
    expect(issued.status).toBe(200);
    expect(issued.body.sessionId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const questionId = issued.body.questions[0].id as string;
    const question = db.getQuestionById(questionId);
    if (!question) throw new Error('Test question missing from DB');
    return { sessionId: issued.body.sessionId as string, question };
  }

  it('validates a correct answer authoritatively with speed bonus and explanation', async () => {
    const { sessionId, question } = await createPracticeSession();
    const res = await request(app)
      .post('/api/questions/submit')
      .send({
        questionId: question.id,
        selectedOptionId: question.correctOptionId,
        timeRemainingMs: 12000,
        totalTimeMs: 15000,
        currentStreak: 0,
        sessionId,
      });

    expect(res.status).toBe(200);
    expect(res.body.isCorrect).toBe(true);
    expect(res.body.isTimeout).toBe(false);
    expect(res.body.correctOptionId).toBe(question.correctOptionId);
    expect(res.body.pointsAwarded).toBeGreaterThan(100);
    expect(res.body.speedBonus).toBeGreaterThan(0);
    expect(res.body.streak).toBe(1);
    expect(res.body.explanation).toBeDefined();
  });

  it('validates an incorrect answer and reveals the answer only after the issued attempt', async () => {
    const { sessionId, question } = await createPracticeSession();
    const incorrectOption = question.options.find((option) => option.id !== question.correctOptionId);
    const res = await request(app)
      .post('/api/questions/submit')
      .send({
        questionId: question.id,
        selectedOptionId: incorrectOption?.id,
        timeRemainingMs: 8000,
        totalTimeMs: 15000,
        currentStreak: 3,
        sessionId,
      });

    expect(res.status).toBe(200);
    expect(res.body.isCorrect).toBe(false);
    expect(res.body.correctOptionId).toBe(question.correctOptionId);
    expect(res.body.pointsAwarded).toBe(0);
    expect(res.body.streak).toBe(0);
    expect(res.body.explanation).toBeDefined();
  });

  it('handles timeout when no answer is submitted', async () => {
    const { sessionId, question } = await createPracticeSession();
    const res = await request(app)
      .post('/api/questions/submit')
      .send({
        questionId: question.id,
        selectedOptionId: null,
        timeRemainingMs: 0,
        totalTimeMs: 15000,
        currentStreak: 2,
        sessionId,
      });

    expect(res.status).toBe(200);
    expect(res.body.isCorrect).toBe(false);
    expect(res.body.isTimeout).toBe(true);
    expect(res.body.correctOptionId).toBe(question.correctOptionId);
    expect(res.body.pointsAwarded).toBe(0);
    expect(res.body.streak).toBe(0);
    expect(res.body.explanation).toBeDefined();
  });

  it('rejects arbitrary client-created session tickets', async () => {
    const { question } = await createPracticeSession();
    const res = await request(app)
      .post('/api/questions/submit')
      .send({
        questionId: question.id,
        selectedOptionId: question.correctOptionId,
        sessionId: 'sess_guessable_client_value',
      });
    expect(res.status).toBe(400);
  });
});
