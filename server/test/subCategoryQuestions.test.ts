import request from 'supertest';
import { createApp } from '../src/server';
import { db } from '../src/db/prismaClient';
import { Server } from 'http';

describe('Alt kategori soru seçimi (Keşfet)', () => {
  let app: any;
  let server: Server;
  let teardown: () => void;

  beforeAll((done) => {
    const created = createApp();
    app = created.app;
    teardown = created.close;
    server = created.httpServer.listen(0, () => done());
  });

  afterAll((done) => {
    teardown();
    server.close(done);
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
});
