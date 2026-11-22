import request from 'supertest';
import { createApp } from '../src/server';
import { db } from '../src/db/prismaClient';
import { Server } from 'http';

describe('Alt kategori soru seçimi (Keşfet)', () => {
  let app: any;
  let server: Server;
  let teardown: () => void;

  beforeAll(async () => {
    const created = createApp();
    app = created.app;
    teardown = created.close;
    await new Promise<void>((resolve) => {
      server = created.httpServer.listen(0, () => resolve());
    });
  });

  afterAll(async () => {
    teardown();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('yalnızca seçilen alt kategorinin sorularını döndürür, üst kategoriden doldurma yapmaz', () => {
    const rpg = db.getQuestions('gaming_videogames', 'medium', 5, [], 'Rol Yapma Oyunları (RPG)');
    expect(rpg.length).toBeGreaterThan(0);
    for (const q of rpg) {
      expect(q.subCategory).toBe('Rol Yapma Oyunları (RPG)');
    }
  });

  it('alt kategori id ile de eşleşir', () => {
    const fps = db.getQuestions('gaming_videogames', undefined, 5, [], 'fps_games');
    expect(fps.length).toBeGreaterThan(0);
    for (const q of fps) {
      expect(q.subCategory).toBe('Nişancı Oyunları (FPS)');
    }
  });

  it('practice yanıtı subCategory alanını içerir ve boş alt kategoride SUBCATEGORY_EMPTY döner', async () => {
    const ok = await request(app)
      .get('/api/questions/practice')
      .query({ category: 'gaming_videogames', subcategory: 'Nişancı Oyunları (FPS)', count: 5 });
    expect(ok.status).toBe(200);
    expect(ok.body.questions.length).toBeGreaterThan(0);
    for (const q of ok.body.questions) {
      expect(q.subCategory).toBe('Nişancı Oyunları (FPS)');
    }

    const empty = await request(app)
      .get('/api/questions/practice')
      .query({ category: 'gaming_videogames', subcategory: 'Uzay Oyunları', count: 5 });
    expect(empty.status).toBe(200);
    expect(empty.body.code).toBe('SUBCATEGORY_EMPTY');
    expect(empty.body.questions).toEqual([]);
  });

  it('karışık zorluk ("mixed") ile 15 soruluk düello havuzu farklı kategorilerden gelir', () => {
    const qs = db.getQuestions('mixed', 'mixed' as any, 15);
    expect(qs.length).toBe(15);
    expect(new Set(qs.map((q) => q.categoryId)).size).toBeGreaterThan(1);
  });

  it('aynı metin başka ID ile gelse bile kısa havuzda soru kopyalamaz', async () => {
    const bank = db as unknown as { questions: ReturnType<typeof db.getAllQuestions> };
    const original = bank.questions;
    const first = db.getQuestions('gaming_videogames', undefined, 1, [], 'fps_games')[0];
    bank.questions = [first, { ...first, id: 'duplicate-text' }];
    try {
      expect(db.getQuestions('gaming_videogames', undefined, 15, [first.id])).toHaveLength(1);
      const response = await request(app).get('/api/questions/practice').query({
        category: 'gaming_videogames', subcategory: 'fps_games', count: 15,
      });
      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(response.body.questions[0]).toMatchObject({ roundNumber: 1, totalRounds: 1 });
    } finally {
      bank.questions = original;
    }
  });
});
