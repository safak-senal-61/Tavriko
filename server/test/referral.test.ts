import { ReferralService, ReferralError, validReferralToken } from '../src/services/referralService';
const token = 'a'.repeat(48);
describe('Referral ledger and friendship transaction', () => {
  let prisma: any, tx: any, service: ReferralService;
  let invitee: any, inviter: any;
  beforeEach(() => {
    inviter = { id: 'owner', displayName: 'Davet Sahibi', friendIds: ['existing-a'], coins: 500 };
    invitee = { id: 'new', displayName: 'Yeni Oyuncu', friendIds: ['existing-b'], createdAt: new Date(2000) };
    tx = {
      referralLink: { findUnique: vi.fn().mockResolvedValue({ token, inviterId: 'owner', createdAt: new Date(1000) }) },
      referralRedemption: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'new' }, { id: 'owner' }]),
      user: {
        findUnique: vi.fn().mockImplementation(({ where }: any) => Promise.resolve(where.id === 'owner' ? inviter : invitee)),
        update: vi.fn().mockResolvedValue({}),
      },
      userNotification: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn().mockResolvedValue({ id: 'n' }) },
    };
    prisma = { ...tx, $transaction: vi.fn().mockImplementation((fn: any) => fn(tx)) };
    service = new ReferralService(prisma);
  });
  it('awards new accounts once and adds both IDs without losing other friends', async () => {
    const result = await service.confirm('new', token);
    expect(result.rewardCoins).toBe(100);
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'new' }, data: { friendIds: ['existing-b', 'owner'] } });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'owner' }, data: { friendIds: ['existing-a', 'new'], coins: { increment: 100 } } });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });
  it('does not re-award a redeemed invitee, even with a different inviter', async () => {
    tx.referralRedemption.findUnique.mockResolvedValue({ inviterId: 'another', rewardCoins: 100 });
    expect((await service.confirm('new', token)).rewardCoins).toBe(0);
    expect(tx.referralRedemption.create).not.toHaveBeenCalled();
  });
  it('connects existing accounts without a new-user reward', async () => {
    invitee.createdAt = new Date(500);
    expect((await service.confirm('new', token)).rewardCoins).toBe(0);
  });
  it('does not reward existing or one-sided friendships or create duplicate notices', async () => {
    inviter.friendIds.push('new');
    expect((await service.confirm('new', token)).alreadyFriends).toBe(true);
    expect(tx.userNotification.create).not.toHaveBeenCalled();
    expect(tx.referralRedemption.create).toHaveBeenCalledWith({ data: { inviteeId: 'new', inviterId: 'owner', token, rewardCoins: 0 } });
  });
  it('rejects self-links, missing links, missing accounts and malformed tokens', async () => {
    await expect(service.confirm('owner', token)).rejects.toThrow('Kendi davetini');
    tx.referralLink.findUnique.mockResolvedValue(null);
    await expect(service.confirm('new', token)).rejects.toBeInstanceOf(ReferralError);
    tx.referralLink.findUnique.mockResolvedValue({ inviterId: 'owner', createdAt: new Date(0) });
    tx.user.findUnique.mockResolvedValue(null);
    await expect(service.confirm('new', token)).rejects.toThrow('Oyuncu hesabı');
    await expect(service.confirm('new', 'bad')).rejects.toThrow('geçersiz');
  });
  it('retries serialization conflicts but never reports database failure as success', async () => {
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2034' }).mockImplementation((fn: any) => fn(tx));
    expect((await service.confirm('new', token)).success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2010', meta: { code: '40001' } });
    expect((await service.confirm('new', token)).success).toBe(true);
    prisma.$transaction.mockRejectedValue(new Error('offline'));
    await expect(service.confirm('new', token)).rejects.toThrow('offline');
  });
  it('uses a strict opaque token format and exposes only a safe preview selection', async () => {
    expect(validReferralToken(token)).toBe(true);
    expect(validReferralToken(['bad'])).toBe(false);
    await service.preview(token);
    const select = tx.user.findUnique.mock.calls[0][0].select;
    expect(select).not.toHaveProperty('email');
    expect(select).not.toHaveProperty('friendIds');
    expect(select).not.toHaveProperty('passwordHash');
    await expect(service.preview('invalid')).rejects.toThrow('geçersiz');
  });
});
