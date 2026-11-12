import request from 'supertest';
import { createApp } from '../src/server';
import { prisma } from '../src/db/prismaClient';
import { db } from '../src/db/prismaClient';

// Bu dosya gerçek bir Postgres (DATABASE_URL) gerektirir; yoksa tamamı atlanır.
const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb('Prisma ORM & Supabase Integration Tests', () => {
  const { app, close } = createApp();

  afterAll(() => {
    close();
  });

  it('populates all categories, questions, users, inventory items and notifications into Prisma ORM', async () => {
    await db.syncAllToPrisma();

    const categoryCount = await prisma.category.count();
    const questionCount = await prisma.question.count();
    const userCount = await prisma.user.count();
    const inventoryCount = await prisma.userInventoryItem.count();
    const notifCount = await prisma.userNotification.count();

    expect(categoryCount).toBeGreaterThanOrEqual(19);
    expect(questionCount).toBeGreaterThan(150);
    expect(userCount).toBeGreaterThanOrEqual(1);
    expect(inventoryCount).toBeGreaterThanOrEqual(1);
    expect(notifCount).toBeGreaterThanOrEqual(1);
  }, 35000);

  it('supports CRUD operations on Prisma models (category, question, user, matchHistory)', async () => {
    const foodCat = await prisma.category.findUnique({ where: { id: 'food_gastronomy' } });
    expect(foodCat).toBeDefined();
    expect(foodCat?.name).toContain('Yemek');

    const foodQuestions = await prisma.question.findMany({
      where: { categoryId: 'food_gastronomy', reviewStatus: 'published' },
      take: 5,
    });
    expect(foodQuestions.length).toBeGreaterThan(0);
    foodQuestions.forEach((q) => {
      expect(q.categoryId).toBe('food_gastronomy');
    });

    const match = await prisma.matchHistory.create({
      data: {
        roomCode: 'TEST99',
        mode: 'duel_1v1',
        categoryId: 'food_gastronomy',
        winnerId: 'bot_1',
        userId: 'bot_1',
        score: 500,
        correctAnswers: 5,
        totalQuestions: 5,
        rankingsJson: [{ userId: 'bot_1', score: 500 }],
      },
    });
    expect(match.roomCode).toBe('TEST99');
  });

  it('exposes Prisma ORM status in /health and /api/admin/prisma-sync', async () => {
    const healthRes = await request(app).get('/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.services.prisma).toBeDefined();
    expect(healthRes.body.services.prisma.orm).toBe('PrismaClient');
    expect(healthRes.body.services.prisma.connected).toBe(true);

    const syncRes = await request(app).post('/api/admin/prisma-sync');
    expect(syncRes.status).toBe(200);
    expect(syncRes.body.success).toBe(true);
    expect(syncRes.body.counts.categories).toBeGreaterThanOrEqual(19);
    expect(syncRes.body.counts.questions).toBeGreaterThan(150);
  }, 35000);
});
