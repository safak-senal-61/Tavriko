import request from 'supertest';
import { createApp } from '../src/server';
import { Server } from 'http';

describe('Authoritative Question Submit & Practice Flow API', () => {
  let app: any;
  let server: Server;
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

  it('validates a correct answer submission authoritatively with speed bonus and explanation', async () => {
    const res = await request(app)
      .post('/api/questions/submit')
      .send({
        questionId: 'geo_1', // Türkiye'nin başkenti neresidir? correctOptionId: 'opt_b' (Ankara)
        selectedOptionId: 'opt_b',
        timeRemainingMs: 12000,
        totalTimeMs: 15000,
        currentStreak: 0,
        playerId: 'player_flow_1_' + Date.now(),
        sessionId: 'sess_flow_1_' + Date.now(),
      });

    expect(res.status).toBe(200);
    expect(res.body.isCorrect).toBe(true);
    expect(res.body.isTimeout).toBe(false);
    expect(res.body.correctOptionId).toBe('opt_b');
    expect(res.body.pointsAwarded).toBeGreaterThan(100);
    expect(res.body.speedBonus).toBeGreaterThan(0);
    expect(res.body.streak).toBe(1);
    expect(res.body.explanation).toContain('Ankara');
  });

  it('validates an incorrect answer submission and reveals the correct answer with explanation', async () => {
    const res = await request(app)
      .post('/api/questions/submit')
      .send({
        questionId: 'geo_1',
        selectedOptionId: 'opt_a', // İstanbul (wrong)
        timeRemainingMs: 8000,
        totalTimeMs: 15000,
        currentStreak: 3,
        playerId: 'player_flow_2_' + Date.now(),
        sessionId: 'sess_flow_2_' + Date.now(),
      });

    expect(res.status).toBe(200);
    expect(res.body.isCorrect).toBe(false);
    expect(res.body.correctOptionId).toBe('opt_b');
    expect(res.body.pointsAwarded).toBe(0);
    expect(res.body.streak).toBe(0);
    expect(res.body.explanation).toBeDefined();
  });

  it('handles timeout when no answer is submitted (selectedOptionId is null)', async () => {
    const res = await request(app)
      .post('/api/questions/submit')
      .send({
        questionId: 'geo_1',
        selectedOptionId: null,
        timeRemainingMs: 0,
        totalTimeMs: 15000,
        currentStreak: 2,
        playerId: 'player_flow_3_' + Date.now(),
        sessionId: 'sess_flow_3_' + Date.now(),
      });

    expect(res.status).toBe(200);
    expect(res.body.isCorrect).toBe(false);
    expect(res.body.isTimeout).toBe(true);
    expect(res.body.correctOptionId).toBe('opt_b');
    expect(res.body.pointsAwarded).toBe(0);
    expect(res.body.streak).toBe(0);
    expect(res.body.explanation).toBeDefined();
  });
});
