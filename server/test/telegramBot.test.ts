import { TelegramBotService } from '../src/telegram/telegramBot';
import { DatabaseAdapter } from '../src/db/prismaClient';

describe('Telegram Bot Management & Admin Approval Workflow', () => {
  let db: DatabaseAdapter;
  let botService: TelegramBotService;
  const ADMIN_ID = 123456789;
  const UNAUTHORIZED_ID = 999999999;

  beforeEach(() => {
    db = new DatabaseAdapter();
    botService = new TelegramBotService({
      adminIds: [ADMIN_ID],
      db,
    });
  });

  it('rejects unauthorized users with access denied message', async () => {
    const res = await botService.handleCommand(UNAUTHORIZED_ID, '/bekleyenler');
    expect(res.authorized).toBe(false);
    expect(res.message).toContain('yetkiniz bulunmamaktadır');
  });

  it('allows authorized admin to list categories via /kategori', async () => {
    const res = await botService.handleCommand(ADMIN_ID, '/kategori');
    expect(res.authorized).toBe(true);
    expect(res.message).toContain('Kategoriler');
    expect(res.message).toContain('Coğrafya');
    expect(res.message).toContain('Matematik');
  });

  it('allows authorized admin to generate questions via /soru_uret', async () => {
    const res = await botService.handleCommand(ADMIN_ID, '/soru_uret matematik zor 1');
    expect(res.authorized).toBe(true);
    expect(res.message).toContain('Evren GLM-5.3 ile üretildi');
    expect(res.questions?.length).toBe(1);

    const generated = res.questions![0];
    expect(generated.categoryId).toBe('mathematics');
    expect(generated.difficulty).toBe('hard');
    expect(generated.reviewStatus).toBe('pending_review');
  }, 35000);

  it('allows authorized admin to view stats via /istatistik', async () => {
    const res = await botService.handleCommand(ADMIN_ID, '/istatistik');
    expect(res.authorized).toBe(true);
    expect(res.message).toContain('İstatistik');
    expect(res.message).toContain('Toplam Soru');
  });

  it('approves a pending question when admin clicks approve callback', async () => {
    const q = db.createQuestion({
      categoryId: 'history',
      difficulty: 'medium',
      text: 'TBMM hangi tarihte açılmıştır?',
      options: [
        { id: 'opt_a', text: '23 Nisan 1920' },
        { id: 'opt_b', text: '29 Ekim 1923' },
        { id: 'opt_c', text: '19 Mayıs 1919' },
        { id: 'opt_d', text: '30 Ağustos 1922' },
      ],
      correctOptionId: 'opt_a',
      explanation: 'TBMM 23 Nisan 1920 tarihinde Ankara\'da açılmıştır.',
    });

    expect(q.reviewStatus).toBe('pending_review');

    // Admin clicks approve
    const callbackRes = await botService.handleCallback(ADMIN_ID, `approve:${q.id}`);
    expect(callbackRes.success).toBe(true);
    expect(callbackRes.message).toContain('ONAYLANDI');

    const updated = db.getQuestionById(q.id);
    expect(updated?.reviewStatus).toBe('published');
    expect(updated?.reviewedBy).toBe(String(ADMIN_ID));
  });

  it('rejects a pending question when admin clicks reject callback', async () => {
    const q = db.createQuestion({
      categoryId: 'history',
      difficulty: 'medium',
      text: 'Hatalı tarih sorusu?',
      options: [
        { id: 'opt_a', text: '1' },
        { id: 'opt_b', text: '2' },
        { id: 'opt_c', text: '3' },
        { id: 'opt_d', text: '4' },
      ],
      correctOptionId: 'opt_a',
      explanation: 'Geçersiz soru',
    });

    const callbackRes = await botService.handleCallback(ADMIN_ID, `reject:${q.id}`);
    expect(callbackRes.success).toBe(true);
    expect(callbackRes.message).toContain('REDDEDİLDİ');

    const updated = db.getQuestionById(q.id);
    expect(updated?.reviewStatus).toBe('rejected');
  });

  it('approves a pending question to daily challenge pool via approve_daily callback', async () => {
    const q = db.createQuestion({
      categoryId: 'science_tech',
      difficulty: 'medium',
      text: 'Güneş sistemindeki en büyük gezegen hangisidir?',
      options: [
        { id: 'opt_a', text: 'Jüpiter' },
        { id: 'opt_b', text: 'Satürn' },
        { id: 'opt_c', text: 'Mars' },
        { id: 'opt_d', text: 'Dünya' },
      ],
      correctOptionId: 'opt_a',
      explanation: 'Jüpiter güneş sisteminin en büyük gezegenidir.',
    });

    const callbackRes = await botService.handleCallback(ADMIN_ID, `approve_daily:${q.id}`);
    expect(callbackRes.success).toBe(true);
    expect(callbackRes.message).toContain('GÜNLÜK MEYDAN OKUMA');

    const updated = db.getQuestionById(q.id);
    expect(updated?.reviewStatus).toBe('published');
    expect(updated?.targetPool).toBe('daily_challenge');
    expect(updated?.isDailyChallenge).toBe(true);
  });

  it('approves a pending question to custom room pool via approve_custom callback', async () => {
    const q = db.createQuestion({
      categoryId: 'logic_puzzles',
      difficulty: 'hard',
      text: 'Hangisi bir mantık paradoksudur?',
      options: [
        { id: 'opt_a', text: 'Yalancı Paradoksu' },
        { id: 'opt_b', text: 'Newton Kanunu' },
        { id: 'opt_c', text: 'Pisagor Teoremi' },
        { id: 'opt_d', text: 'Arşimet İlkesi' },
      ],
      correctOptionId: 'opt_a',
      explanation: 'Yalancı paradoksu klasik bir felsefi mantık paradoksudur.',
    });

    const callbackRes = await botService.handleCallback(ADMIN_ID, `approve_custom:${q.id}`);
    expect(callbackRes.success).toBe(true);
    expect(callbackRes.message).toContain('ÖZEL ODA');

    const updated = db.getQuestionById(q.id);
    expect(updated?.reviewStatus).toBe('published');
    expect(updated?.targetPool).toBe('custom_room');
    expect(updated?.isCustomRoomOnly).toBe(true);
  });

  it('returns Pro League leaderboard via /lig', async () => {
    const res = await botService.handleCommand(ADMIN_ID, '/lig');
    expect(res.authorized).toBe(true);
    expect(res.message).toContain('LİDER TABLOSU');
  });

  it('creates custom room via /oda_kur', async () => {
    const res = await botService.handleCommand(ADMIN_ID, '/oda_kur tarih');
    expect(res.authorized).toBe(true);
    expect(res.message).toContain('ÖZEL ODASI OLUŞTURULDU');
    expect(res.message).toContain('joinRoom=');
  });

  it('returns daily challenge question via /gunun_sorusu', async () => {
    const res = await botService.handleCommand(ADMIN_ID, '/gunun_sorusu');
    expect(res.authorized).toBe(true);
    expect(res.questions?.length).toBeGreaterThan(0);
  });

  it('denies callback execution to unauthorized users', async () => {
    const callbackRes = await botService.handleCallback(UNAUTHORIZED_ID, 'approve:q_123');
    expect(callbackRes.success).toBe(false);
    expect(callbackRes.message).toContain('yetkiniz bulunmamaktadır');
  });

  it('shows JSON format guide via /json_ornek', async () => {
    const res = await botService.handleCommand(ADMIN_ID, '/json_ornek');
    expect(res.authorized).toBe(true);
    expect(res.message).toContain('Tavriko JSON Formatı Rehberi');
    expect(res.message).toContain('correctAnswerIndex');
  });

  it('imports manual questions via /soru_ekle with raw JSON', async () => {
    const sampleQuestion = JSON.stringify({
      soru: 'Test Sorusudur: Ankara hangi ülkenin başkentidir?',
      secenekler: ['Türkiye', 'Almanya', 'Fransa', 'İtalya'],
      dogruCevap: 'A',
      kategori: 'geography',
      zorluk: 'kolay',
      aciklama: 'Ankara Türkiye Cumhuriyeti başkentidir.',
      havuz: 'standard',
    });

    const res = await botService.handleCommand(ADMIN_ID, `/soru_ekle ${sampleQuestion}`);
    expect(res.authorized).toBe(true);
    expect(res.message).toContain('Başarıyla Havuza Eklendi');
  });

  it('provides webapp link via /webapp', async () => {
    const res = await botService.handleCommand(ADMIN_ID, '/webapp');
    expect(res.authorized).toBe(true);
    expect(res.message).toContain('/telegram-webapp');
  });
});
