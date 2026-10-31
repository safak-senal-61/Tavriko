import { Telegraf, Markup } from 'telegraf';
import { DatabaseAdapter } from '../db/prismaClient';
import { generateQuestionsWithEvrenGLM } from '../ai/evrenLlmGenerator';
import { supabaseService } from '../db/supabaseClient';
import { CategoryId, DifficultyLevel, Question } from '@trivia/shared';

export interface TelegramBotConfig {
  token?: string;
  adminIds?: Array<number | string>;
  db: DatabaseAdapter;
}

export interface BotCommandResponse {
  authorized: boolean;
  message: string;
  questions?: Question[];
  extra?: any;
}

export interface BotCallbackResponse {
  authorized: boolean;
  success: boolean;
  message: string;
  question?: Question | null;
}

export const CATEGORIES_CONFIG: Array<{ id: CategoryId; name: string; emoji: string }> = [
  { id: 'geography', name: 'Coğrafya', emoji: '🌍' },
  { id: 'mathematics', name: 'Matematik', emoji: '📐' },
  { id: 'general_culture', name: 'Genel Kültür', emoji: '🌐' },
  { id: 'history', name: 'Tarih', emoji: '🏛️' },
  { id: 'science_tech', name: 'Bilim & Teknoloji', emoji: '🔬' },
  { id: 'space_astronomy', name: 'Uzay & Astronomi', emoji: '🚀' },
  { id: 'sports', name: 'Spor', emoji: '⚽' },
  { id: 'cinema_tv', name: 'Sinema & Dizi', emoji: '🎬' },
  { id: 'music', name: 'Müzik', emoji: '🎵' },
  { id: 'literature', name: 'Edebiyat', emoji: '📖' },
  { id: 'biology', name: 'Biyoloji', emoji: '🧬' },
  { id: 'physics_chemistry', name: 'Fizik & Kimya', emoji: '🧪' },
  { id: 'logic_puzzles', name: 'Mantık & Zeka', emoji: '💡' },
  { id: 'language_vocab', name: 'Dil & Kelime', emoji: '📝' },
  { id: 'art_culture', name: 'Sanat & Kültür', emoji: '🎨' },
  { id: 'mixed', name: 'Karma Sorular', emoji: '🎲' },
];

export const DIFFICULTIES_CONFIG: Array<{ id: DifficultyLevel; name: string; emoji: string }> = [
  { id: 'easy', name: 'Kolay', emoji: '🟢' },
  { id: 'medium', name: 'Orta', emoji: '🟡' },
  { id: 'hard', name: 'Zor', emoji: '🔴' },
  { id: 'expert', name: 'Uzman', emoji: '🟣' },
];

const CATEGORY_MAP: Record<string, CategoryId> = {
  cografya: 'geography',
  coğrafya: 'geography',
  geography: 'geography',
  matematik: 'mathematics',
  mathematics: 'mathematics',
  math: 'mathematics',
  genel_kultur: 'general_culture',
  'genel kültür': 'general_culture',
  genel: 'general_culture',
  general_culture: 'general_culture',
  tarih: 'history',
  history: 'history',
  bilim: 'science_tech',
  teknoloji: 'science_tech',
  science_tech: 'science_tech',
  uzay: 'space_astronomy',
  astronomi: 'space_astronomy',
  space_astronomy: 'space_astronomy',
  spor: 'sports',
  sports: 'sports',
  sinema: 'cinema_tv',
  dizi: 'cinema_tv',
  cinema_tv: 'cinema_tv',
  muzik: 'music',
  müzik: 'music',
  music: 'music',
  edebiyat: 'literature',
  turkce: 'literature',
  türkçe: 'literature',
  literature: 'literature',
  biyoloji: 'biology',
  biology: 'biology',
  fizik: 'physics_chemistry',
  kimya: 'physics_chemistry',
  physics_chemistry: 'physics_chemistry',
  mantik: 'logic_puzzles',
  mantık: 'logic_puzzles',
  logic_puzzles: 'logic_puzzles',
  kelime: 'language_vocab',
  dil: 'language_vocab',
  language_vocab: 'language_vocab',
  sanat: 'art_culture',
  kultur: 'art_culture',
  kültür: 'art_culture',
  art_culture: 'art_culture',
  karisik: 'mixed',
  karma: 'mixed',
  mixed: 'mixed',
};

const DIFFICULTY_MAP: Record<string, DifficultyLevel> = {
  kolay: 'easy',
  easy: 'easy',
  orta: 'medium',
  medium: 'medium',
  zor: 'hard',
  hard: 'hard',
  uzman: 'expert',
  expert: 'expert',
};

export class TelegramBotService {
  private bot: Telegraf | null = null;
  private adminIds: Set<string>;
  private db: DatabaseAdapter;
  private running: boolean = false;
  private activeToken: string | null = null;
  private isStarting: boolean = false;

  constructor(config: TelegramBotConfig) {
    this.db = config.db;
    const parsedAdmins = (config.adminIds || [])
      .map((id) => String(id).trim())
      .filter(Boolean);

    if (process.env.TELEGRAM_ADMIN_IDS) {
      process.env.TELEGRAM_ADMIN_IDS.split(',').forEach((id) => {
        if (id.trim()) parsedAdmins.push(id.trim());
      });
    }

    this.adminIds = new Set(parsedAdmins);

    const isTest = process.env.NODE_ENV === 'test';
    const token = config.token || process.env.TELEGRAM_BOT_TOKEN;
    if (!isTest && token && !token.includes('placeholder') && !token.includes('123456789:ABC')) {
      this.initBot(token);
    } else if (!token || token.includes('placeholder')) {
      console.log('[TelegramBot] TELEGRAM_BOT_TOKEN tanımlanmadı; simülasyon ve test modu aktif.');
    }
  }

  public isRunning(): boolean {
    return this.running;
  }

  public getActiveToken(): string | null {
    return this.activeToken ? `${this.activeToken.substring(0, 8)}...` : null;
  }

  public async configure(token: string, adminIds?: Array<number | string>): Promise<{ success: boolean; message: string }> {
    if (!token || token.trim().length < 15) {
      return { success: false, message: 'Geçersiz Telegram Bot Token formatı.' };
    }

    if (adminIds && adminIds.length > 0) {
      this.adminIds = new Set(adminIds.map((id) => String(id).trim()));
    }

    await this.stopBot();
    return this.initBot(token.trim());
  }

  public async stopBot(): Promise<void> {
    if (this.bot) {
      try {
        this.bot.stop('SIGINT');
      } catch {}
      this.bot = null;
      this.running = false;
    }
  }

  private async initBot(token: string): Promise<{ success: boolean; message: string }> {
    if (this.isStarting) {
      return { success: false, message: 'Bot zaten başlatılıyor, lütfen bekleyin.' };
    }
    this.isStarting = true;

    try {
      this.activeToken = token;
      this.bot = new Telegraf(token);

      this.bot.catch((err: any) => {
        console.warn('[TelegramBot Error]:', err.message);
      });

      this.registerTelegrafHandlers();

      // Reset any pending webhooks or conflicting update queues cleanly
      try {
        await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
      } catch (e: any) {
        console.warn('[TelegramBot] deleteWebhook uyarısı:', e.message);
      }

      this.bot.launch({
        dropPendingUpdates: true,
      }).then(() => {
        this.running = true;
        console.log('🤖 [TelegramBot] Telegram Admin Bot başarıyla başlatıldı ve dinliyor.');
      }).catch((err: any) => {
        this.running = false;
        console.warn('[TelegramBot] Bot başlatılırken hata oluştu:', err.message);
      });

      this.running = true;
      this.isStarting = false;
      return { success: true, message: 'Telegram Botu başarıyla başlatıldı ve komutları dinliyor.' };
    } catch (err: any) {
      this.running = false;
      this.isStarting = false;
      console.warn('[TelegramBot] Bot başlatılırken hata oluştu:', err.message);
      return { success: false, message: `Bot başlatılamadı: ${err.message}` };
    }
  }

  public isAdmin(userId: number | string): boolean {
    if (this.adminIds.size === 0) {
      return true;
    }
    return this.adminIds.has(String(userId));
  }

  public getMainKeyboard() {
    return Markup.keyboard([
      ['✨ Yeni Soru Üret', '📊 Soru Havuzu'],
      ['⏳ Onay Bekleyenler', '❓ Yardım & Bilgi'],
    ]).resize();
  }

  public getCategoryWizardKeyboard() {
    const buttons = [];
    for (let i = 0; i < CATEGORIES_CONFIG.length; i += 2) {
      const row = [];
      row.push(Markup.button.callback(`${CATEGORIES_CONFIG[i].emoji} ${CATEGORIES_CONFIG[i].name}`, `wiz_cat:${CATEGORIES_CONFIG[i].id}`));
      if (i + 1 < CATEGORIES_CONFIG.length) {
        row.push(Markup.button.callback(`${CATEGORIES_CONFIG[i + 1].emoji} ${CATEGORIES_CONFIG[i + 1].name}`, `wiz_cat:${CATEGORIES_CONFIG[i + 1].id}`));
      }
      buttons.push(row);
    }
    return Markup.inlineKeyboard(buttons);
  }

  public getDifficultyWizardKeyboard(categoryId: string) {
    const buttons = DIFFICULTIES_CONFIG.map((d) => [
      Markup.button.callback(`${d.emoji} ${d.name} Seviye`, `wiz_diff:${categoryId}:${d.id}`),
    ]);
    buttons.push([Markup.button.callback('🔙 ↩️ Geri (Kategori Değiştir)', 'wiz_back:categories')]);
    return Markup.inlineKeyboard(buttons);
  }

  public getCountWizardKeyboard(categoryId: string, difficulty: string) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('1️⃣ 1 Soru', `wiz_run:${categoryId}:${difficulty}:1`),
        Markup.button.callback('3️⃣ 3 Soru', `wiz_run:${categoryId}:${difficulty}:3`),
        Markup.button.callback('5️⃣ 5 Soru', `wiz_run:${categoryId}:${difficulty}:5`),
      ],
      [
        Markup.button.callback('🔙 ↩️ Geri (Zorluk Değiştir)', `wiz_back:difficulty:${categoryId}`),
      ],
    ]);
  }

  public formatQuestionCard(q: Question): string {
    const catObj = CATEGORIES_CONFIG.find((c) => c.id === q.categoryId);
    const diffObj = DIFFICULTIES_CONFIG.find((d) => d.id === q.difficulty);
    const catDisplay = catObj ? `${catObj.emoji} ${catObj.name}` : q.categoryId;
    const diffDisplay = diffObj ? `${diffObj.emoji} ${diffObj.name}` : q.difficulty;

    const optLabels = ['A', 'B', 'C', 'D'];
    const optionsText = q.options
      .map((opt, i) => `${optLabels[i]}) ${opt.text} ${opt.id === q.correctOptionId ? '👈 (Doğru Cevap)' : ''}`)
      .join('\n');

    return (
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 *Soru ID:* \`${q.id}\`\n` +
      `🏷 *Kategori:* ${catDisplay} | 📊 *Zorluk:* ${diffDisplay}\n` +
      (q.subCategory ? `📌 *Kapsam:* ${q.subCategory}\n` : '') +
      `\n❓ *SORU:*\n*${q.text}*\n\n` +
      `🔘 *SEÇENEKLER:*\n${optionsText}\n\n` +
      `💡 *Açıklama:* ${q.explanation}\n` +
      (q.sourceOrVerification ? `🔍 *Doğrulama/Kaynak:* ${q.sourceOrVerification}\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━━━━━━`
    );
  }

  public buildInlineKeyboard(q: Question) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Onayla ve Yayına Al', `approve:${q.id}`),
        Markup.button.callback('❌ Reddet', `reject:${q.id}`),
      ],
      [
        Markup.button.callback('🔄 Bu Kategoride Yeniden Üret', `wiz_run:${q.categoryId}:${q.difficulty}:1`),
      ],
    ]);
  }

  private async replySafe(ctx: any, text: string, extra?: any) {
    try {
      await ctx.replyWithMarkdown(text, extra);
    } catch {
      try {
        const clean = text.replace(/[*_`]/g, '');
        await ctx.reply(clean, extra);
      } catch (err: any) {
        console.warn('[TelegramBot] Mesaj iletim hatası:', err.message);
      }
    }
  }

  public async handleCommand(userId: number | string, text: string): Promise<BotCommandResponse> {
    if (!this.isAdmin(userId)) {
      return {
        authorized: false,
        message: '⛔ Bu bot yalnızca yetkili yöneticiler içindir. Erişim yetkiniz bulunmamaktadır.',
      };
    }

    const parts = text.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();

    switch (cmd) {
      case '/start':
      case '/yardim':
      case '/help': {
        return {
          authorized: true,
          message:
            `👋 *TriviaVerse Yönetim & Soru Onay Botuna Hoş Geldiniz!*\n\n` +
            `Bu bot üzerinden T.C. SSB EVREN platformundaki *GLM-5.3* yapay zekâ modelini kullanarak 16 kategoride sorular üretebilir ve onaylayarak doğrudan canlı oyuna dahil edebilirsiniz.\n\n` +
            `👉 *Nasıl Soru Üretilir?*\n` +
            `Aşağıdaki *"✨ Yeni Soru Üret"* butonuna basarak adım adım kategori, zorluk ve adet seçimi yapabilirsiniz. Kod veya komut yazmanıza gerek yoktur!`,
        };
      }

      case '/kategori': {
        const categories = this.db.getCategories();
        const listText = categories
          .map((c) => `• *${c.name}* (\`${c.id}\`): ${c.description}`)
          .join('\n');

        return {
          authorized: true,
          message: `📚 *Aktif Yarışma Kategorileri (${categories.length}):*\n\n${listText}`,
        };
      }

      case '/soru_uret': {
        const rawCat = parts[1]?.toLowerCase() || 'genel';
        const rawDiff = parts[2]?.toLowerCase() || 'orta';
        const count = Math.min(5, Math.max(1, parseInt(parts[3] || '1', 10)));

        const categoryId = CATEGORY_MAP[rawCat] || 'general_culture';
        const difficulty = DIFFICULTY_MAP[rawDiff] || 'medium';

        const result = await generateQuestionsWithEvrenGLM({
          categoryId,
          difficulty,
          count,
          db: this.db,
        });

        const summaryText =
          `✨ *${result.validCount} adet yeni soru Evren GLM-5.3 ile üretildi ve onay kuyruğuna alındı!*\n` +
          `• Kategori: \`${categoryId}\`\n` +
          `• Zorluk: \`${difficulty}\`\n` +
          `• Model: \`${result.model}\``;

        return {
          authorized: true,
          message: summaryText,
          questions: result.questions,
        };
      }

      case '/bekleyenler': {
        const pending = this.db.getQuestionsByStatus('pending_review', 5);
        if (pending.length === 0) {
          return {
            authorized: true,
            message: '🎉 Şu anda onay bekleyen soru bulunmamaktadır! Tüm sorular incelendi.',
          };
        }

        return {
          authorized: true,
          message: `⏳ *Onay Bekleyen Sorular (Toplam: ${pending.length} adet gösteriliyor):*`,
          questions: pending,
        };
      }

      case '/istatistik': {
        const stats = this.db.getReviewStats();
        const catStats = Object.entries(stats.byCategory || {})
          .map(([cat, cnt]) => `  • ${cat}: ${cnt}`)
          .join('\n');

        return {
          authorized: true,
          message:
            `📊 *Soru Havuzu ve Onay İstatistikleri:*\n\n` +
            `• Toplam Soru: *${stats.total}*\n` +
            `• ✅ Canlıda Yayında: *${stats.published}*\n` +
            `• ⏳ Onay Bekleyen: *${stats.pending}*\n` +
            `• ❌ Reddedilen: *${stats.rejected}*\n\n` +
            `*Kategorilere Göre Dağılım:*\n${catStats || '  Henüz soru yok'}`,
        };
      }

      default:
        return {
          authorized: true,
          message: `❓ Bilinmeyen komut: ${cmd}. Yardım için aşağıdaki butonları kullanabilirsiniz.`,
        };
    }
  }

  public async handleCallback(userId: number | string, data: string): Promise<BotCallbackResponse> {
    if (!this.isAdmin(userId)) {
      return {
        authorized: false,
        success: false,
        message: '⛔ Bu işlemi yapmaya yetkiniz bulunmamaktadır.',
      };
    }

    const [action, ...args] = data.split(':');

    switch (action) {
      case 'approve': {
        const questionId = args[0];
        const updated = this.db.approveQuestion(questionId, String(userId));
        if (!updated) {
          return { authorized: true, success: false, message: 'Soru bulunamadı.' };
        }
        supabaseService.updateQuestionStatus(questionId, 'published', String(userId)).catch(() => {});
        return {
          authorized: true,
          success: true,
          message: `✅ Soru [${questionId}] ONAYLANDI ve canlı soru havuzuna eklendi!`,
          question: updated,
        };
      }

      case 'reject': {
        const questionId = args[0];
        const reason = args[1] || 'Yönetici tarafından onaylanmadı.';
        const updated = this.db.rejectQuestion(questionId, String(userId), reason);
        if (!updated) {
          return { authorized: true, success: false, message: 'Soru bulunamadı.' };
        }
        supabaseService.updateQuestionStatus(questionId, 'rejected', String(userId), reason).catch(() => {});
        return {
          authorized: true,
          success: true,
          message: `❌ Soru [${questionId}] REDDEDİLDİ.`,
          question: updated,
        };
      }

      default:
        return {
          authorized: true,
          success: false,
          message: `İşlem tamamlandı.`,
        };
    }
  }

  private registerTelegrafHandlers() {
    if (!this.bot) return;

    // 1. /start ve Yardım Menüsü
    this.bot.command(['start', 'yardim', 'help'], async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, ctx.message.text);
      await this.replySafe(ctx, res.message, this.getMainKeyboard());
    });

    // 2. Alt Menü Butonları Dinleyicileri
    this.bot.hears('✨ Yeni Soru Üret', async (ctx) => {
      if (!this.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Bu botu yalnızca yetkili yöneticiler kullanabilir.');
      }
      await this.replySafe(
        ctx,
        `📚 *Adım 1/3: Soru Kategorisi Seçin*\n\nHangi kategoride soru üretmek istersiniz? Aşağıdaki butonlardan birine dokunun:`,
        this.getCategoryWizardKeyboard()
      );
    });

    this.bot.hears('📊 Soru Havuzu', async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, '/istatistik');
      await this.replySafe(ctx, res.message, this.getMainKeyboard());
    });

    this.bot.hears('⏳ Onay Bekleyenler', async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, '/bekleyenler');
      await this.replySafe(ctx, res.message, this.getMainKeyboard());
      if (res.questions && res.questions.length > 0) {
        for (const q of res.questions) {
          const card = this.formatQuestionCard(q);
          const keyboard = this.buildInlineKeyboard(q);
          await this.replySafe(ctx, card, keyboard);
        }
      }
    });

    this.bot.hears('❓ Yardım & Bilgi', async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, '/start');
      await this.replySafe(ctx, res.message, this.getMainKeyboard());
    });

    // 3. /soru_uret Komutu (Parametresiz girilirse sihirbazı açar)
    this.bot.command('soru_uret', async (ctx) => {
      const text = ctx.message.text.trim();
      const parts = text.split(/\s+/);
      if (parts.length === 1) {
        // Parametre yoksa doğrudan adım 1'i başlat
        await this.replySafe(
          ctx,
          `📚 *Adım 1/3: Soru Kategorisi Seçin*\n\nHangi kategoride soru üretmek istersiniz? Aşağıdaki butonlardan birine dokunun:`,
          this.getCategoryWizardKeyboard()
        );
        return;
      }

      // Parametre varsa doğrudan üret
      const res = await this.handleCommand(ctx.from.id, text);
      await this.replySafe(ctx, res.message);
      if (res.questions && res.questions.length > 0) {
        for (const q of res.questions) {
          const card = this.formatQuestionCard(q);
          const keyboard = this.buildInlineKeyboard(q);
          await this.replySafe(ctx, card, keyboard);
        }
      }
    });

    this.bot.command('kategori', async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, ctx.message.text);
      await this.replySafe(ctx, res.message);
    });

    this.bot.command('bekleyenler', async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, ctx.message.text);
      await this.replySafe(ctx, res.message);
      if (res.questions && res.questions.length > 0) {
        for (const q of res.questions) {
          const card = this.formatQuestionCard(q);
          const keyboard = this.buildInlineKeyboard(q);
          await this.replySafe(ctx, card, keyboard);
        }
      }
    });

    this.bot.command('istatistik', async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, ctx.message.text);
      await this.replySafe(ctx, res.message);
    });

    // 4. Wizard & Inline Buton Etkileşimleri
    this.bot.on('callback_query', async (ctx) => {
      const data = (ctx.callbackQuery as any)?.data;
      if (!data) return;

      if (!this.isAdmin(ctx.from.id)) {
        try {
          await ctx.answerCbQuery('⛔ Yetkiniz bulunmamaktadır.', { show_alert: true });
        } catch {}
        return;
      }

      // Adım 1: Kategori Seçildi -> Adım 2: Zorluk Seçimi
      if (data.startsWith('wiz_cat:')) {
        const categoryId = data.replace('wiz_cat:', '');
        const catObj = CATEGORIES_CONFIG.find((c) => c.id === categoryId);
        const catName = catObj ? `${catObj.emoji} ${catObj.name}` : categoryId;

        try {
          await ctx.answerCbQuery();
          await ctx.editMessageText(
            `🎯 *Adım 2/3: Zorluk Seviyesi Seçin*\n\n` +
            `• Seçilen Kategori: *${catName}*\n\n` +
            `Soruların zorluk derecesini belirleyin:`,
            {
              parse_mode: 'Markdown',
              ...this.getDifficultyWizardKeyboard(categoryId),
            }
          );
        } catch (err: any) {
          console.warn('[TelegramBot] editMessageText hatası:', err.message);
        }
        return;
      }

      // Adım 2: Zorluk Seçildi -> Adım 3: Adet Seçimi
      if (data.startsWith('wiz_diff:')) {
        const [, categoryId, difficulty] = data.split(':');
        const catObj = CATEGORIES_CONFIG.find((c) => c.id === categoryId);
        const diffObj = DIFFICULTIES_CONFIG.find((d) => d.id === difficulty);

        try {
          await ctx.answerCbQuery();
          await ctx.editMessageText(
            `🔢 *Adım 3/3: Soru Adedi Seçin*\n\n` +
            `• Kategori: *${catObj ? `${catObj.emoji} ${catObj.name}` : categoryId}*\n` +
            `• Zorluk: *${diffObj ? `${diffObj.emoji} ${diffObj.name}` : difficulty}*\n\n` +
            `Tek seferde kaç soru üretilsin?`,
            {
              parse_mode: 'Markdown',
              ...this.getCountWizardKeyboard(categoryId, difficulty),
            }
          );
        } catch (err: any) {
          console.warn('[TelegramBot] editMessageText hatası:', err.message);
        }
        return;
      }

      // Geri Butonları
      if (data === 'wiz_back:categories') {
        try {
          await ctx.answerCbQuery();
          await ctx.editMessageText(
            `📚 *Adım 1/3: Soru Kategorisi Seçin*\n\nHangi kategoride soru üretmek istersiniz? Aşağıdaki butonlardan birine dokunun:`,
            {
              parse_mode: 'Markdown',
              ...this.getCategoryWizardKeyboard(),
            }
          );
        } catch {}
        return;
      }

      if (data.startsWith('wiz_back:difficulty:')) {
        const categoryId = data.replace('wiz_back:difficulty:', '');
        const catObj = CATEGORIES_CONFIG.find((c) => c.id === categoryId);
        try {
          await ctx.answerCbQuery();
          await ctx.editMessageText(
            `🎯 *Adım 2/3: Zorluk Seviyesi Seçin*\n\n` +
            `• Seçilen Kategori: *${catObj ? `${catObj.emoji} ${catObj.name}` : categoryId}*\n\n` +
            `Soruların zorluk derecesini belirleyin:`,
            {
              parse_mode: 'Markdown',
              ...this.getDifficultyWizardKeyboard(categoryId),
            }
          );
        } catch {}
        return;
      }

      // Adım 4: Üretimi Başlat
      if (data.startsWith('wiz_run:')) {
        const [, categoryId, difficulty, countStr] = data.split(':');
        const count = parseInt(countStr || '1', 10);
        const catObj = CATEGORIES_CONFIG.find((c) => c.id === categoryId);
        const diffObj = DIFFICULTIES_CONFIG.find((d) => d.id === difficulty);

        try {
          await ctx.answerCbQuery('🚀 Soru üretimi başlatıldı!');
          await ctx.editMessageText(
            `⏳ *SSB EVREN GLM-5.3 Soruları Hazırlıyor...*\n\n` +
            `• Kategori: *${catObj ? `${catObj.emoji} ${catObj.name}` : categoryId}*\n` +
            `• Zorluk: *${diffObj ? `${diffObj.emoji} ${diffObj.name}` : difficulty}*\n` +
            `• Adet: *${count} soru*\n\n` +
            `Yapay zekâ düşünme ve üretim adımı devam ediyor, lütfen bekleyin...`,
            { parse_mode: 'Markdown' }
          );
        } catch {}

        // Evren GLM-5.3 çağrısı
        try {
          const result = await generateQuestionsWithEvrenGLM({
            categoryId: categoryId as CategoryId,
            difficulty: difficulty as DifficultyLevel,
            count,
            db: this.db,
          });

          await ctx.replyWithMarkdown(
            `✨ *Üretim Tamamlandı!* (${result.validCount} adet yeni soru onay kuyruğunda)\n` +
            `Aşağıdaki kartlardan her soruyu tek tek inceleyip *[✅ Onayla]* veya *[❌ Reddet]* butonuna basabilirsiniz:`
          );

          for (const q of result.questions) {
            const card = this.formatQuestionCard(q);
            const keyboard = this.buildInlineKeyboard(q);
            await this.replySafe(ctx, card, keyboard);
          }
        } catch (err: any) {
          await ctx.reply(`❌ Soru üretimi sırasında bir hata oluştu: ${err.message}`);
        }
        return;
      }

      // 5. Onaylama (Approve) İşlemi
      if (data.startsWith('approve:')) {
        const questionId = data.replace('approve:', '');
        const res = await this.handleCallback(ctx.from.id, data);
        try {
          await ctx.answerCbQuery('✅ Soru onaylandı ve yayına alındı!', { show_alert: true });
          const originalText = (ctx.callbackQuery.message as any)?.text || '';
          await ctx.editMessageText(
            `${originalText}\n\n✅ *[ONAYLANDI - CANLIDA YAYINDA]*`,
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('🎉 Canlıda Yayında', 'noop')],
              ]),
            }
          );
        } catch {
          await this.replySafe(ctx, res.message);
        }
        return;
      }

      // 6. Reddetme (Reject) İşlemi
      if (data.startsWith('reject:')) {
        const questionId = data.replace('reject:', '');
        const res = await this.handleCallback(ctx.from.id, data);
        try {
          await ctx.answerCbQuery('❌ Soru reddedildi.', { show_alert: false });
          const originalText = (ctx.callbackQuery.message as any)?.text || '';
          await ctx.editMessageText(
            `${originalText}\n\n❌ *[REDDEDİLDİ]*`,
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('❌ Reddedildi', 'noop')],
              ]),
            }
          );
        } catch {
          await this.replySafe(ctx, res.message);
        }
        return;
      }

      if (data === 'noop') {
        try {
          await ctx.answerCbQuery('Bu soru zaten işlendi.');
        } catch {}
        return;
      }
    });
  }
}
