import express from 'express';
import request from 'supertest';
import { afterEach, expect, it, vi } from 'vitest';
import { gameplayRewardRoutes } from '../src/routes/gameplayRewardRoutes';

vi.mock('../src/db/prismaClient', () => ({ db: {} }));

afterEach(() => vi.unstubAllEnvs());

it('limits claim requests before authentication and keeps progress in a separate bucket', async () => {
  vi.stubEnv('VERCEL', '0');
  const app = express().use('/rewards', gameplayRewardRoutes);
  for (let i = 0; i < 20; i++) {
    const res = await request(app).post('/rewards/claim').set('X-Forwarded-For', `192.0.2.${i + 1}`);
    expect(res.status).toBe(401);
  }
  const claim = await request(app).post('/rewards/claim').set('X-Forwarded-For', '192.0.2.99');
  expect(claim.status).toBe(429);
  expect(claim.headers['cache-control']).toBe('no-store');
  expect(Number(claim.headers['retry-after'])).toBeGreaterThan(0);
  const progress = await request(app).get('/rewards');
  expect(progress.status).toBe(401);
  expect(progress.headers['ratelimit']).toMatch(/r=119/);
});
