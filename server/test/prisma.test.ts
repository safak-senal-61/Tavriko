import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/server';
import { prisma, db } from '../src/db/prismaClient';

describe('Prisma ORM & Supabase Integration Tests', () => {
  const { app, close } = createApp();
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const testUserId = 'ci_user_' + suffix;

  beforeAll(async () => {
    await db.syncAllToPrisma();
    await prisma.rawClient.user.create({
      data: {
        id: testUserId,
        username: 'ci_' + suffix,
        email: 'ci_' + suffix + '@example.invalid',
        displayName: 'CI Test User',
        friendCode: 'CI-' + suffix,
      },
    });
    await prisma.rawClient.userInventoryItem.create({
      data: {
        userId: testUserId,
        itemId: 'ci_test_item',
        name: 'CI test item',
        desc: 'Temporary integration test fixture',
        qty: 1,
      },
    });
    await prisma.rawClient.userNotification.create({
      data: {
        id: 'ci_notification_' + suffix,
        userId: testUserId,
        type: 'test',
        title: 'CI test',
        sub: 'Temporary integration test fixture',
        timeText: 'now',
      },
    });
  });

  afterAll(async () => {
    await prisma.rawClient.matchHistory.deleteMany({ where: { userId: testUserId } }).catch(() => {});
    await prisma.rawClient.user.delete({ where: { id: testUserId } }).catch(() => {});
    await prisma.rawClient.$disconnect().catch(() => {});
    close();
  });

  it('syncs categories and questions and stores isolated user-owned rows in Prisma', async () => {
    const categoryCount = await prisma.rawClient.category.count();
    const questionCount = await prisma.rawClient.question.count();
    const userCount = await prisma.rawClient.user.count({ where: { id: testUserId } });
    const inventoryCount = await prisma.rawClient.userInventoryItem.count({ where: { userId: testUserId } });
    const notifCount = await prisma.rawClient.userNotification.count({ where: { userId: testUserId } });

    expect(categoryCount).toBeGreaterThanOrEqual(19);
    expect(questionCount).toBeGreaterThan(150);
    expect(userCount).toBe(1);
    expect(inventoryCount).toBe(1);
    expect(notifCount).toBe(1);
  }, 35000);

  it('supports CRUD operations on Prisma models', async () => {
    const foodCat = await prisma.rawClient.category.findUnique({ where: { id: 'food_gastronomy' } });
    expect(foodCat).toBeDefined();
    expect(foodCat?.name).toContain('Yemek');

    const foodQuestions = await prisma.rawClient.question.findMany({
      where: { categoryId: 'food_gastronomy', reviewStatus: 'published' },
      take: 5,
    });
    expect(foodQuestions.length).toBeGreaterThan(0);
    foodQuestions.forEach((question) => expect(question.categoryId).toBe('food_gastronomy'));

    const match = await prisma.rawClient.matchHistory.create({
      data: {
        roomCode: 'TEST99',
        mode: 'duel_1v1',
        categoryId: 'food_gastronomy',
        winnerId: testUserId,
        userId: testUserId,
        score: 500,
        correctAnswers: 5,
        totalQuestions: 5,
        rankingsJson: [{ userId: testUserId, score: 500 }],
      },
    });
    expect(match.roomCode).toBe('TEST99');
  });

  it('keeps health output minimal and rejects unauthorized Prisma sync', async () => {
    const healthRes = await request(app).get('/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('ok');
    expect(healthRes.body.services).toBeUndefined();

    const invalidAdminToken = jwt.sign(
      { role: 'ordinary_user', email: process.env.PORTAL_ADMIN_EMAIL },
      process.env.JWT_SECRET || 'ci-only-test-secret-do-not-use-in-production-0123456789',
      { algorithm: 'HS256', expiresIn: '5m' }
    );
    const syncRes = await request(app)
      .post('/api/admin/prisma-sync')
      .set('Authorization', 'Bearer ' + invalidAdminToken);
    expect(syncRes.status).toBe(403);
  });
});
