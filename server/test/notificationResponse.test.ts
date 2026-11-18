import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/db/prismaClient';

const owner = { id: 'current-player', notifications: [] };
const invitation = { id: 'invite-1', type: 'match_invite', handled: null, roomCode: 'ABC123' };

function fixture(row: (Omit<typeof invitation, 'handled'> & { userId: string; handled: string | null }) | null) {
  const findUnique = vi.fn(async ({ where }: { where: { id: string; userId: string } }) =>
    row && where.id === row.id && where.userId === row.userId ? { ...row } : null);
  const update = vi.fn();
  const fake = {
    users: new Map([[owner.id, owner]]),
    rawClient: { user: { findFirst: vi.fn().mockResolvedValue(null) }, userNotification: { findUnique, update } },
    savePersistedUsers: vi.fn(),
  };
  return {
    findUnique,
    update,
    decline: () => PrismaService.prototype.respondToNotification.call(fake as unknown as PrismaService, owner.id, invitation.id, 'decline'),
  };
}

describe('declining a notification', () => {
  it('persists the response only for the recipient', async () => {
    const f = fixture({ ...invitation, userId: owner.id });
    await expect(f.decline()).resolves.toMatchObject({ success: true, handled: 'declined' });
    expect(f.update).toHaveBeenCalledWith({
      where: { id: invitation.id, userId: owner.id },
      data: { handled: 'declined', sub: 'İstek reddedildi.' },
    });
  });

  it('cannot change another account’s notification', async () => {
    const f = fixture({ ...invitation, userId: 'other-player' });
    await expect(f.decline()).resolves.toMatchObject({ success: false });
    expect(f.findUnique).toHaveBeenCalledWith({ where: { id: invitation.id, userId: owner.id } });
    expect(f.update).not.toHaveBeenCalled();
  });

  it('does not overwrite an already accepted invitation from a stale push', async () => {
    const f = fixture({ ...invitation, userId: owner.id, handled: 'accepted' });
    await expect(f.decline()).resolves.toMatchObject({ success: false, handled: 'accepted' });
    expect(f.update).not.toHaveBeenCalled();
  });
});
