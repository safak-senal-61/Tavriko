import { PrismaClient } from '@prisma/client';
import { ReferralService } from '../src/services/referralService';
const url = process.env.REFERRAL_TEST_DATABASE_URL;
// Opt-in only, and NEVER allow this suite to target a remote/production database.
const suite = url ? describe : describe.skip;
suite('Referral integration with isolated PostgreSQL', () => {
  let db: PrismaClient, service: ReferralService;
  beforeAll(() => {
    const parsed = new URL(url!);
    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || parsed.pathname !== '/tavriko_referral_qa') {
      throw new Error('Referral integration tests require an isolated local tavriko_referral_qa database.');
    }
    db = new PrismaClient({ datasources: { db: { url } } });
    service = new ReferralService(db);
  });
  afterAll(async () => { await db?.$disconnect(); });
  const user = async (id: string, createdAt = new Date(0)) => db.user.create({
    data: { id, username: id, displayName: 'Ahmet', email: `${id}@example.test`, friendCode: id, coins: 500, createdAt },
  });
  it('preserves all existing users when the additive migration is applied', async () => {
    expect(await db.user.count()).toBe(1);
    expect(await db.user.findUnique({ where: { id: 'migration-baseline' } })).not.toBeNull();
    expect(await db.referralLink.count()).toBe(0);
    expect(await db.referralRedemption.count()).toBe(0);
  });
  it('does not add friendship on link generation/preview; confirmation survives a new client', async () => {
    await user('owner1'); const link = await service.personalLink('owner1');
    await user('invitee1', new Date(Date.now() + 100));
    await service.preview(link.token);
    expect((await db.user.findUniqueOrThrow({ where: { id: 'owner1' } })).friendIds).toEqual([]);
    expect(await db.referralRedemption.count()).toBe(0);
    expect((await service.confirm('invitee1', link.token)).rewardCoins).toBe(100);
    const other = new PrismaClient({ datasources: { db: { url } } });
    try {
      expect((await other.user.findUniqueOrThrow({ where: { id: 'owner1' } })).coins).toBe(600);
      expect((await other.user.findUniqueOrThrow({ where: { id: 'invitee1' } })).friendIds).toEqual(['owner1']);
      expect((await other.user.findUniqueOrThrow({ where: { id: 'owner1' } })).friendIds).toEqual(['invitee1']);
    } finally { await other.$disconnect(); }
    await service.confirm('invitee1', link.token);
    expect((await db.user.findUniqueOrThrow({ where: { id: 'owner1' } })).coins).toBe(600);
    expect(await db.userNotification.count({ where: { userId: 'owner1' } })).toBe(1);
  });
  it('serializes concurrent repeats to one reward, ledger entry and notification', async () => {
    await user('owner2'); const link = await service.personalLink('owner2');
    await user('invitee2', new Date(Date.now() + 100));
    const results = await Promise.all([service.confirm('invitee2', link.token), service.confirm('invitee2', link.token)]);
    expect(results.reduce((sum, r) => sum + r.rewardCoins, 0)).toBe(100);
    expect(await db.referralRedemption.count({ where: { inviteeId: 'invitee2' } })).toBe(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: 'owner2' } })).coins).toBe(600);
    expect(await db.userNotification.count({ where: { userId: 'owner2' } })).toBe(1);
  });
  it('two different links cannot reward the same invitee twice', async () => {
    await user('owner3'); await user('owner4');
    const [a, b] = await Promise.all([service.personalLink('owner3'), service.personalLink('owner4')]);
    await user('invitee3', new Date(Date.now() + 100));
    const results = await Promise.all([service.confirm('invitee3', a.token), service.confirm('invitee3', b.token)]);
    expect(results.reduce((sum, r) => sum + r.rewardCoins, 0)).toBe(100);
    expect((await db.user.findUniqueOrThrow({ where: { id: 'invitee3' } })).friendIds).toEqual(expect.arrayContaining(['owner3', 'owner4']));
    expect(await db.referralRedemption.count({ where: { inviteeId: 'invitee3' } })).toBe(1);
  });
  it('connects older accounts with no reward and rejects self/deleted links', async () => {
    await user('owner5'); await user('old-invitee');
    const link = await service.personalLink('owner5');
    expect((await service.confirm('old-invitee', link.token)).rewardCoins).toBe(0);
    await expect(service.confirm('owner5', link.token)).rejects.toThrow('Kendi davetini');
    await expect(service.confirm('old-invitee', '0'.repeat(48))).rejects.toThrow('artık kullanılamıyor');
    expect((await db.user.findUniqueOrThrow({ where: { id: 'owner5' } })).coins).toBe(500);
  });
  it('rolls back both friendship and reward if the transaction fails at notification creation', async () => {
    await user('owner6'); const link = await service.personalLink('owner6');
    await user('invitee6', new Date(Date.now() + 100));
    // Test-only constraint in this isolated database forces a failure late in the transaction.
    await db.$executeRawUnsafe(`ALTER TABLE public.user_notifications ADD CONSTRAINT qa_force_rollback CHECK ("userId" <> 'owner6')`);
    try {
      await expect(service.confirm('invitee6', link.token)).rejects.toThrow();
      expect((await db.user.findUniqueOrThrow({ where: { id: 'owner6' } })).coins).toBe(500);
      expect((await db.user.findUniqueOrThrow({ where: { id: 'invitee6' } })).friendIds).toEqual([]);
      expect(await db.referralRedemption.count({ where: { inviteeId: 'invitee6' } })).toBe(0);
    } finally { await db.$executeRawUnsafe('ALTER TABLE public.user_notifications DROP CONSTRAINT qa_force_rollback'); }
  });
  it('denies anonymous access to the referral tables', async () => {
    await expect(db.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE anon');
      return tx.$queryRawUnsafe('SELECT token FROM public.referral_links');
    })).rejects.toThrow('permission denied');
  });
});
