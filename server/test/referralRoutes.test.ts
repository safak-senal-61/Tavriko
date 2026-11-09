import express from 'express';
import request from 'supertest';
jest.mock('../src/db/prismaClient', () => ({ db: {
  rawClient: {}, getUserProfileAsync: jest.fn().mockResolvedValue({}),
  verifyToken: jest.fn((token: string) => token === 'valid' ? { userId: 'signed-owner' }
    : token === 'guest' ? { userId: 'guest_123' } : null),
} }));
jest.mock('../src/services/presenceManager', () => ({ presenceManager: { notifyUser: jest.fn() } }));
import router from '../src/routes/referralRoutes';
import { ReferralService } from '../src/services/referralService';
const app = express().use(express.json()).use('/referrals', router);
describe('Authenticated referral routes', () => {
  afterEach(() => jest.restoreAllMocks());
  it('rejects missing, invalid and guest credentials before touching the ledger', async () => {
    const confirm = jest.spyOn(ReferralService.prototype, 'confirm');
    for (const token of ['', 'invalid', 'guest']) {
      const result = await request(app).post('/referrals/confirm')
        .set('Authorization', `Bearer ${token}`).send({ userId: 'spoofed', token: 'a'.repeat(48) });
      expect(result.status).toBe(401);
    }
    expect(confirm).not.toHaveBeenCalled();
  });
  it('derives the user only from the verified token, ignoring forged body ownership', async () => {
    const confirm = jest.spyOn(ReferralService.prototype, 'confirm').mockResolvedValue({
      success: true, inviterId: 'inviter', notification: null,
    } as any);
    const result = await request(app).post('/referrals/confirm').set('Authorization', 'Bearer valid')
      .send({ userId: 'spoofed', inviterId: 'spoofed-inviter', rewardCoins: 99999, token: 'a'.repeat(48) });
    expect(result.status).toBe(200);
    expect(confirm).toHaveBeenCalledWith('signed-owner', 'a'.repeat(48));
  });
  it('keeps link statistics authenticated and the safe profile preview public', async () => {
    expect((await request(app).get('/referrals/me')).status).toBe(401);
    const personal = jest.spyOn(ReferralService.prototype, 'personalLink').mockResolvedValue({ token: 'opaque' } as any);
    expect((await request(app).get('/referrals/me').set('Authorization', 'Bearer valid')).status).toBe(200);
    expect(personal).toHaveBeenCalledWith('signed-owner');
    jest.spyOn(ReferralService.prototype, 'preview').mockResolvedValue({ inviter: { displayName: 'Ahmet' } } as any);
    const result = await request(app).get('/referrals/preview/' + 'a'.repeat(48));
    expect(result.body.inviter.displayName).toBe('Ahmet');
    expect(result.headers['cache-control']).toBe('no-store');
  });
  it('fails closed without revealing database errors or reporting success', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(ReferralService.prototype, 'confirm').mockRejectedValue(new Error('private database details'));
    const result = await request(app).post('/referrals/confirm').set('Authorization', 'Bearer valid').send({});
    expect(result.status).toBe(503);
    expect(result.body.error).not.toContain('private database');
    expect(result.body.success).toBeUndefined();
  });
});
