import request from 'supertest';
import { createApp } from '../src/server';
import { Server } from 'http';

describe('Trivia REST API', () => {
  let app: any;
  let server: Server;
  let authToken: string;
  let authUserId: string;
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
    authUserId = res.body.user.id;
  });

  it('retrieves all trivia categories including food, nature and animals', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(16);
    const categoryIds = res.body.map((c: any) => c.id);
    expect(categoryIds).toContain('geography');
    expect(categoryIds).toContain('mathematics');
    expect(categoryIds).toContain('food_gastronomy');
    expect(categoryIds).toContain('history');
  });

  it('fetches single-player practice questions safely for clients', async () => {
    const res = await request(app)
      .get('/api/questions/practice?category=geography&difficulty=easy&count=3')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(3);
    const q = res.body.questions[0];
    expect(q.text).toBeDefined();
    expect(q.options).toHaveLength(4);
  });

  it('fetches the daily challenge question set', async () => {
    const res = await request(app)
      .get('/api/questions/daily')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.date).toBeDefined();
    expect(res.body.questions.length).toBeGreaterThanOrEqual(5);
  });


  it('requires authentication for user-specific event data', async () => {
    const res = await request(app).get('/api/social/events');
    expect(res.status).toBe(401);
  });

  it('prevents reading another user event data', async () => {
    const res = await request(app)
      .get('/api/social/events?userId=another-user-id')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(403);
  });

  it('requires authentication before starting an event', async () => {
    const res = await request(app)
      .post('/api/social/events/start')
      .send({ userId: 'someone-else', eventId: 'daily_1' });
    expect(res.status).toBe(401);
  });

  it('rejects legacy pack purchases without verified payment', async () => {
    const res = await request(app)
      .post('/api/social/shop/purchase')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ userId: 'someone-else', packId: 'starter_pack', cardHolder: 'Test' });
    expect(res.status).toBe(501);
  });

  it('rejects TRY catalog purchases without a payment provider', async () => {
    const res = await request(app)
      .post('/api/social/shop/purchase')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ userId: authUserId, productId: 'pack_starter', paymentMethod: 'credit_card' });
    expect(res.status).toBe(501);
  });

  it('fetches global leaderboards', async () => {
    const res = await request(app).get('/api/social/leaderboard');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.topPlayers)).toBe(true);
    for (const player of res.body.topPlayers) {
      expect(player).not.toHaveProperty('email');
      expect(player).not.toHaveProperty('phone');
      expect(player).not.toHaveProperty('birthDate');
      expect(player).not.toHaveProperty('gender');
      expect(player).not.toHaveProperty('inventory');
      expect(player).not.toHaveProperty('notifications');
      expect(player).not.toHaveProperty('settings');
    }
  });
});
