import { LEGAL_VERSION, REQUIRED_LEGAL_DOCUMENTS } from '@trivia/shared';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import authRoutes from '../src/routes/authRoutes';

const mocks = vi.hoisted(() => ({ register: vi.fn(), updateUserSettings: vi.fn(), verifyToken: vi.fn() }));
vi.mock('../src/db/prismaClient', () => ({ db: { ...mocks, rawClient: {} } }));

const app = express().use(express.json()).use('/auth', authRoutes);
const receipt = (method: string) => expect.objectContaining({
  version: LEGAL_VERSION, method, acceptedAt: expect.any(String), documents: REQUIRED_LEGAL_DOCUMENTS,
});
const userId = 'legal-fixture';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.verifyToken.mockReturnValue({ userId });
});

describe('legal consent routes', () => {
  it('passes validated consent into account creation, not a second write', async () => {
    mocks.register.mockImplementation(async ({ legalConsent }) => ({
      token: 'fixture', user: { id: userId, settings: { legalConsent } },
    }));
    const body = { username: 'fixture', email: 'fixture@example.test', password: 'fixture-password' };
    expect((await request(app).post('/auth/register').send(body)).status).toBe(400);
    expect(mocks.register).not.toHaveBeenCalled();
    const res = await request(app).post('/auth/register').send({ ...body, acceptedLegalVersion: LEGAL_VERSION });
    expect(res.status).toBe(200);
    expect(res.body.user.settings.legalConsent).toEqual(receipt('register'));
    expect(mocks.updateUserSettings).not.toHaveBeenCalled();
  });

  it('reports a failed write as retryable and only returns success on confirmation', async () => {
    mocks.updateUserSettings.mockRejectedValueOnce(new Error('db unavailable'))
      .mockImplementationOnce(async (id, settings) => ({ id, settings }));
    const post = () => request(app).post('/auth/legal-consent').set('Authorization', 'Bearer fixture')
      .send({ version: LEGAL_VERSION, method: 'in_app', userId: 'different-user' });
    const failed = await post();
    expect(failed.status).toBe(503);
    expect(failed.body.success).toBeUndefined();
    const saved = await post();
    expect(saved.body.user).toEqual({ id: userId, settings: { legalConsent: receipt('in_app') } });
  });
});
