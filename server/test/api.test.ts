import request from 'supertest';
import { createApp } from '../src/server';
import { Server } from 'http';

describe('Trivia REST API', () => {
  let app: any;
  let server: Server;
  let authToken: string;
  let teardown: () => void;

  beforeAll((done) => {
    const created = createApp();
    app = created.app;
    teardown = created.close;
    server = created.httpServer.listen(0, () => {
      done();
    });
  });

  afterAll((done) => {
    teardown();
    server.close(done);
  });

  it('allows guest login and returns token and user profile', async () => {
    const res = await request(app)
      .post('/api/auth/guest')
      .send({ displayName: 'TestOyuncu' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.displayName).toBe('TestOyuncu');
    expect(res.body.user.level).toBe(1);
    authToken = res.body.token;
  });

  it('retrieves all 16 trivia categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(16);
    const categoryIds = res.body.map((c: any) => c.id);
    expect(categoryIds).toContain('geography');
    expect(categoryIds).toContain('mathematics');
    expect(categoryIds).toContain('space_astronomy');
    expect(categoryIds).toContain('history');
  });

  it('fetches single-player practice questions with correct answers and explanations', async () => {
    const res = await request(app)
      .get('/api/questions/practice?category=geography&difficulty=easy&count=3')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(3);
    const q = res.body.questions[0];
    expect(q.text).toBeDefined();
    expect(q.options).toHaveLength(4);
    expect(q.correctOptionId).toBeDefined();
    expect(q.explanation).toBeDefined();
  });

  it('fetches the daily challenge question set', async () => {
    const res = await request(app)
      .get('/api/questions/daily')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.date).toBeDefined();
    expect(res.body.questions.length).toBeGreaterThanOrEqual(5);
  });

  it('fetches global leaderboards', async () => {
    const res = await request(app).get('/api/social/leaderboard');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.topPlayers)).toBe(true);
  });
});
