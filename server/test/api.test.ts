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
    expect(q).not.toHaveProperty('correctOptionId');
  });

  it('fetches the daily challenge question set', async () => {
    const res = await request(app)
      .get('/api/questions/daily')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.date).toBeDefined();
    expect(res.body.questions.length).toBeGreaterThanOrEqual(5);
    for (const question of res.body.questions) {
      expect(question).not.toHaveProperty('correctOptionId');
    }
  });


  it('binds profile updates to the authenticated user and ignores protected fields', async () => {
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        userId: 'another-user-id',
        fullName: 'Test User',
        email: 'attacker@example.invalid',
        rankTitle: 'Admin',
        coins: 999999999,
        gems: 999999999,
        equippedBadge: 'premium_badge',
      });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(authUserId);
    expect(res.body.user.email).not.toBe('attacker@example.invalid');
    expect(res.body.user.rankTitle).not.toBe('Admin');
    expect(res.body.user.coins).not.toBe(999999999);
    expect(res.body.user.gems).not.toBe(999999999);
  });

  it('rejects unsafe avatar URL schemes in profile updates', async () => {
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ avatarUrl: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
  });

  it('rejects attempts to smuggle economy fields through user settings', async () => {
    const res = await request(app)
      .post('/api/auth/settings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ settings: { coins: 999999, isAdmin: true } });
    expect(res.status).toBe(400);
  });

  it('honors the public-profile privacy setting', async () => {
    const hidden = await request(app)
      .post('/api/auth/settings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ settings: { profilePublic: false } });
    expect(hidden.status).toBe(200);

    const profile = await request(app).get(`/api/social/profile/${authUserId}`);
    expect(profile.status).toBe(404);

    const restored = await request(app)
      .post('/api/auth/settings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ settings: { profilePublic: true } });
    expect(restored.status).toBe(200);
  });

  it('rejects /me and password changes without a verified bearer token', async () => {
    const me = await request(app).get('/api/auth/me');
    expect(me.status).toBe(401);

    const changePassword = await request(app)
      .post('/api/auth/change-password')
      .send({ userId: 'someone-else', currentPassword: 'old', newPassword: 'new-password' });
    expect(changePassword.status).toBe(401);
  });

  it('rejects malformed and expired bearer tokens on protected endpoints', async () => {
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-jwt');
    expect(me.status).toBe(401);

    const friends = await request(app)
      .get('/api/social/friends/some-user')
      .set('Authorization', 'Bearer not-a-jwt');
    expect(friends.status).toBe(401);
  });

  it('prevents cross-user reads of friends and notifications', async () => {
    const friends = await request(app)
      .get('/api/social/friends/another-user-id')
      .set('Authorization', `Bearer ${authToken}`);
    expect(friends.status).toBe(403);

    const notifications = await request(app)
      .get('/api/social/notifications/another-user-id')
      .set('Authorization', `Bearer ${authToken}`);
    expect(notifications.status).toBe(403);
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
