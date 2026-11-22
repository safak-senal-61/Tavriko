import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { db } from '../src/db/prismaClient';
import socialRoutes from '../src/routes/socialRoutes';
import type { User } from '@prisma/client';

const app = express();
app.use(express.json(), socialRoutes);
const user = { id: 'owner', username: 'owner', friendCode: 'TV-OWNER', displayName: 'Owner', friendIds: [] } as unknown as User;
const friend = { id: 'target', username: 'elif', friendCode: 'TV-ELIF', displayName: 'Elif', friendIds: [] } as unknown as User;
const token = () => jwt.sign({ userId: user.id }, process.env.JWT_SECRET!);

describe('friend requests', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses the authenticated sender and prioritizes an exact username over a display name', async () => {
    const lookup = vi.spyOn(db.rawClient.user, 'findUnique').mockResolvedValue(user);
    vi.spyOn(db.rawClient.user, 'findMany').mockResolvedValue([
      { ...friend, id: 'someone-else', username: 'another-elif', displayName: 'elif' }, friend,
    ]);
    vi.spyOn(db.rawClient.userNotification, 'findFirst').mockResolvedValue(null);
    const save = vi.spyOn(db.rawClient.userNotification, 'create').mockResolvedValue({} as never);

    const res = await request(app).post('/friends/add').set('Authorization', `Bearer ${token()}`)
      .send({ userId: 'not-the-sender', codeOrUsername: ' @ELIF ' });

    expect(res.status).toBe(200);
    expect(lookup).toHaveBeenCalledWith({ where: { id: user.id } });
    expect(save).toHaveBeenCalledWith({ data: expect.objectContaining({ senderId: user.id, userId: friend.id }) });
  });

  it('does not claim success for a request PostgreSQL did not persist', async () => {
    vi.spyOn(db.rawClient.user, 'findUnique').mockResolvedValue(user);
    vi.spyOn(db.rawClient.user, 'findMany').mockResolvedValue([friend]);
    vi.spyOn(db.rawClient.userNotification, 'findFirst').mockResolvedValue(null);
    vi.spyOn(db.rawClient.userNotification, 'create').mockRejectedValue(new Error('write unavailable'));

    const res = await request(app).post('/friends/add').set('Authorization', `Bearer ${token()}`).send({ codeOrUsername: 'elif' });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('UNAVAILABLE');
  });

  it('distinguishes an expired session from a temporary service failure', async () => {
    const expired = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: -1 });
    const res = await request(app).post('/friends/add').set('Authorization', `Bearer ${expired}`).send({ codeOrUsername: 'elif' });
    expect(res.status).toBe(401);

    vi.spyOn(db.rawClient.user, 'findUnique').mockResolvedValue(null);
    const stale = await request(app).post('/friends/add').set('Authorization', `Bearer ${token()}`).send({ codeOrUsername: 'elif' });
    expect(stale.status).toBe(401);
    expect(stale.body.code).toBe('SESSION_REQUIRED');
  });

  it('keeps acceptance and both friend-list updates in a single transaction', async () => {
    vi.spyOn(db.rawClient.user, 'findFirst').mockResolvedValue(user);
    vi.spyOn(db.rawClient.userNotification, 'findUnique').mockResolvedValue({
      id: 'pending', userId: user.id, senderId: friend.id, type: 'friend_request', handled: null,
    } as never);
    const tx = {
      userNotification: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), create: vi.fn().mockResolvedValue({}) },
      user: {
        findUniqueOrThrow: vi.fn(({ where }) => where.id === user.id ? user : friend),
        update: vi.fn(({ where }) => where.id === user.id ? user : friend),
      },
    };
    const transaction = vi.spyOn(db.rawClient, '$transaction');
    transaction.mockImplementation((async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)) as never);
    const response = () => request(app).post('/notifications/respond').set('Authorization', `Bearer ${token()}`)
      .send({ notificationId: 'pending', action: 'accept' });

    expect((await response()).status).toBe(200);
    expect(tx.userNotification.updateMany).toHaveBeenCalledWith({
      where: { id: 'pending', userId: user.id, handled: null },
      data: expect.objectContaining({ handled: 'accepted' }),
    });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: user.id }, data: { friendIds: [friend.id] } });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: friend.id }, data: { friendIds: [user.id] } });

    tx.user.update.mockImplementation(() => { throw new Error('write unavailable'); });
    expect((await response()).status).toBe(503);
  });
});
