import crypto from 'crypto';
import { Telegraf, Markup } from 'telegraf';
import { DatabaseAdapter } from '../db/prismaClient';
import { generateQuestionsWithEvrenGLM } from '../ai/evrenLlmGenerator';
import { supabaseService } from '../db/supabaseClient';
import { CategoryId, DifficultyLevel, Question } from '@trivia/shared';
import { GameRoomManager } from '../engine/GameRoomManager';
import { cacheService } from '../cache/redisClient';
import { logger } from '../utils/logger';
import { importQuestionsFromJson, SAMPLE_QUESTION_JSON } from '../utils/questionImporter';

export interface TelegramBotConfig {
  token?: string;
  adminIds?: Array<number | string>;
  db: DatabaseAdapter;
  roomManager?: GameRoomManager;
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
  { id: 'gaming_videogames', name: 'Video Oyunları', emoji: '🎮' },
  { id: 'anime_manga', name: 'Anime & Manga', emoji: '🍥' },
  { id: 'cartoons_animation', name: 'Çizgi Film', emoji: '🎠' },
  { id: 'comics_superheroes', name: 'Çizgi Roman', emoji: '🦸' },
  { id: 'fantasy_fiction', name: 'Fantastik', emoji: '🐉' },
  { id: 'social_internet', name: 'Sosyal Medya', emoji: '📱' },
  { id: 'mythology_ancient', name: 'Mitoloji', emoji: '⚡' },
  { id: 'hobbies_leisure', name: 'Hobiler', emoji: '🎣' },
  { id: 'animals_wildlife', name: 'Hayvanlar', emoji: '🐾' },
  { id: 'food_gastronomy', name: 'Yemek & Gastronomi', emoji: '🍲' },
  { id: 'nature_ecology', name: 'Doğa & Ekoloji', emoji: '🌿' },
  { id: 'daily_life', name: 'Günlük Hayat', emoji: '👨‍👩‍👧' },
  { id: 'turkey_special', name: 'Türkiye', emoji: '🇹🇷' },
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
  gaming: 'gaming_videogames',
  gaming_videogames: 'gaming_videogames',
  oyun: 'gaming_videogames',
  oyunlar: 'gaming_videogames',
  video_oyunlari: 'gaming_videogames',
  anime: 'anime_manga',
  manga: 'anime_manga',
  anime_manga: 'anime_manga',
  cartoons: 'cartoons_animation',
  cizgi_film: 'cartoons_animation',
  cizgifilm: 'cartoons_animation',
  animasyon: 'cartoons_animation',
  comics: 'comics_superheroes',
  cizgi_roman: 'comics_superheroes',
  cizgiroman: 'comics_superheroes',
  fantasy: 'fantasy_fiction',
  fantastik: 'fantasy_fiction',
  social: 'social_internet',
  sosyal: 'social_internet',
  sosyal_medya: 'social_internet',
  mythology: 'mythology_ancient',
  mitoloji: 'mythology_ancient',
  hobbies: 'hobbies_leisure',
  hobiler: 'hobbies_leisure',
  hayvanlar: 'animals_wildlife',
  hayvan: 'animals_wildlife',
  animals: 'animals_wildlife',
  animals_wildlife: 'animals_wildlife',
  yemek: 'food_gastronomy',
  gastra: 'food_gastronomy',
  food: 'food_gastronomy',
  food_gastronomy: 'food_gastronomy',
  doga: 'nature_ecology',
  doğa: 'nature_ecology',
  ekoloji: 'nature_ecology',
  nature: 'nature_ecology',
  nature_ecology: 'nature_ecology',
  daily_life: 'daily_life',
  gunluk: 'daily_life',
  toplum: 'daily_life',
  turkey: 'turkey_special',
  turkiye: 'turkey_special',
  turkiyeye_ozel: 'turkey_special',
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

const DEFAULT_TELEGRAM_WEBHOOK_URL = 'https://tavriko-realtime.uncertainidentity8.workers.dev/telegram/webhook';
const WEBHOOK_REPAIR_INTERVAL_MS = 5 * 60 * 1000;
const WEBAPP_INIT_DATA_MAX_AGE_SEC = 24 * 60 * 60;

/**
 * Telegram webhook gizli anahtarını türetir.
 * Telegram yalnızca A-Z, a-z, 0-9, _ ve - karakterlerine izin verir (1-256).
 * TELEGRAM_WEBHOOK_SECRET tanımlıysa ondan, değilse bot tokeninden türetilir;
 * böylece ek bir ortam değişkeni olmadan da webhook doğrulaması çalışır.
 */
export function deriveTelegramWebhookSecret(botToken: string, configuredSecret?: string | null): string {
  const base = (configuredSecret && configuredSecret.trim()) || botToken;
  return crypto.createHash('sha256').update(`tavriko-telegram-webhook:${base}`).digest('hex');
}

export function safeEqualStrings(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * Telegram WebApp initData imzasını doğrular.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * Geçerliyse Telegram kullanıcı kimliğini döndürür.
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  nowSec: number = Math.floor(Date.now() / 1000)
): string | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return null;
    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (!safeEqualStrings(computed, hash.toLowerCase())) return null;
    const authDate = Number(params.get('auth_date'));
    if (!Number.isFinite(authDate) || nowSec - authDate > WEBAPP_INIT_DATA_MAX_AGE_SEC) return null;
    const user = JSON.parse(params.get('user') || 'null');
    if (!user || user.id === undefined || user.id === null) return null;
    return String(user.id);
  } catch {
    return null;
  }
}

export class TelegramBotService {
  private bot: Telegraf | null = null;
  private adminIds: Set<string>;
  private db: DatabaseAdapter;
  private roomManager?: GameRoomManager;
  private running: boolean = false;
  private activeToken: string | null = null;
  private isStarting: boolean = false;
  private lastWebhookRepairAt = 0;

  constructor(config: TelegramBotConfig) {
    this.db = config.db;
    this.roomManager = config.roomManager;
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

  public async ensureBotReady(): Promise<boolean> {
    if (this.bot) return true;
    const isTest = process.env.NODE_ENV === 'test';
    if (isTest) return false;

    let token = process.env.TELEGRAM_BOT_TOKEN;
    let savedAdmins: string[] = [];

    if (!token || token.includes('placeholder')) {
      try {
        const saved = await cacheService.getCustomValue<{ token: string; adminIds?: string[] }>('tavriko:telegram:config');
        if (saved && saved.token) {
          token = saved.token;
          if (saved.adminIds && Array.isArray(saved.adminIds)) {
            savedAdmins = saved.adminIds;
          }
        }
      } catch {}
    }

    if (token && !token.includes('placeholder') && token.trim().length >= 15) {
      if (savedAdmins.length > 0) {
        savedAdmins.forEach((id) => this.adminIds.add(String(id).trim()));
      }
      const res = await this.initBot(token.trim());
      return res.success;
    }
    return false;
  }

  public async getBotInfo(): Promise<{ success: boolean; bot?: any; webhook?: any; error?: string }> {
    await this.ensureBotReady();
    if (!this.bot) {
      return { success: false, error: 'Telegram bot tokeni henüz ayarlanmadı.' };
    }
    try {
      const [me, webhook] = await Promise.all([
        this.bot.telegram.getMe(),
        this.bot.telegram.getWebhookInfo(),
      ]);
      return { success: true, bot: me, webhook };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async configure(token: string, adminIds?: Array<number | string>): Promise<{ success: boolean; message: string; bot?: any }> {
    if (!token || token.trim().length < 15) {
      return { success: false, message: 'Geçersiz Telegram Bot Token formatı.' };
    }

    if (adminIds && adminIds.length > 0) {
      this.adminIds = new Set(adminIds.map((id) => String(id).trim()));
    }

    await this.stopBot();
    const initRes = await this.initBot(token.trim());
    if (initRes.success) {
      try {
        await cacheService.setCustomValue('tavriko:telegram:config', {
          token: token.trim(),
          adminIds: Array.from(this.adminIds),
        });
      } catch (e: any) {
        console.warn('[TelegramBot] Token cache kaydedilemedi:', e.message);
      }
      let botMe: any = null;
      try {
        if (this.bot) botMe = await this.bot.telegram.getMe();
      } catch {}
      return { ...initRes, bot: botMe };
    }
    return initRes;
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

  public async handleWebhookUpdate(update: any): Promise<void> {
    if (!this.bot) {
      await this.ensureBotReady();
    }
    if (this.bot) {
      await this.bot.handleUpdate(update);
    }
  }

  public async setWebhook(url: string): Promise<{ success: boolean; message: string; info?: any }> {
    if (!this.bot) {
      await this.ensureBotReady();
    }
    if (!this.bot) {
      return { success: false, message: 'Bot başlatılmamış veya token tanımlanmamış.' };
    }
    try {
      await this.bot.telegram.setWebhook(url, {
        drop_pending_updates: true,
        secret_token: this.webhookSecretFor(this.activeToken),
      });
      this.lastWebhookRepairAt = Date.now();
      const info = await this.bot.telegram.getWebhookInfo();
      this.running = true;
      logger.success('TELEGRAM', `Webhook güncellendi: ${url}`, info);
      this.setupMenuButton().catch(() => {});
      return { success: true, message: `Telegram Webhook başarıyla kuruldu: ${url}`, info };
    } catch (err: any) {
      logger.error('TELEGRAM', `Webhook kurulum hatası: ${err.message}`);
      return { success: false, message: `Webhook kurulum hatası: ${err.message}` };
    }
  }

  public async getWebhookInfo(): Promise<any> {
    if (!this.bot) {
      await this.ensureBotReady();
    }
    if (!this.bot) return null;
    try {
      return await this.bot.telegram.getWebhookInfo();
    } catch {
      return null;
    }
  }

  private webhookSecretFor(token: string | null): string | undefined {
    if (!token) return undefined;
    return deriveTelegramWebhookSecret(token, process.env.TELEGRAM_WEBHOOK_SECRET);
  }

  /** Bot tokenini (ortam değişkeni veya kayıtlı yapılandırma) botu başlatmadan çözer. */
  private async resolveToken(): Promise<string | null> {
    if (this.activeToken) return this.activeToken;
    const envToken = process.env.TELEGRAM_BOT_TOKEN;
    if (envToken && !envToken.includes('placeholder') && envToken.trim().length >= 15) {
      return envToken.trim();
    }
    try {
      const saved = await cacheService.getCustomValue<{ token: string; adminIds?: string[] }>('tavriko:telegram:config');
      if (saved?.adminIds && Array.isArray(saved.adminIds)) {
        saved.adminIds.forEach((id) => this.adminIds.add(String(id).trim()));
      }
      if (saved?.token && saved.token.trim().length >= 15) return saved.token.trim();
    } catch {}
    return null;
  }

  /** Webhook isteklerinde beklenen gizli anahtar (bot yapılandırılmamışsa null). */
  public async getWebhookSecret(): Promise<string | null> {
    const token = await this.resolveToken();
    return this.webhookSecretFor(token) || null;
  }

  /**
   * Webhook anahtarı uyuşmadığında Telegram tarafındaki kaydı doğru anahtarla yeniler.
   * Kötüye kullanıma karşı her sunucu örneğinde en fazla 5 dakikada bir çalışır.
   */
  public async repairWebhook(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastWebhookRepairAt < WEBHOOK_REPAIR_INTERVAL_MS) return false;
    this.lastWebhookRepairAt = now;
    if (!this.bot) {
      // initBot üretimde webhook'u anahtarla birlikte kurar.
      return this.ensureBotReady();
    }
    try {
      const info = await this.bot.telegram.getWebhookInfo();
      const url = info?.url || process.env.TELEGRAM_WEBHOOK_URL || DEFAULT_TELEGRAM_WEBHOOK_URL;
      await this.bot.telegram.setWebhook(url, {
        drop_pending_updates: false,
        secret_token: this.webhookSecretFor(this.activeToken),
      });
      logger.info('TELEGRAM', `Webhook gizli anahtarla yeniden kuruldu: ${url}`);
      return true;
    } catch (err: any) {
      logger.error('TELEGRAM', `Webhook onarımı başarısız: ${err.message}`);
      return false;
    }
  }

  /** Telegram WebApp initData'sının bir yöneticiden geldiğini doğrular. */
  public async verifyWebAppInitData(initData: string): Promise<boolean> {
    const token = await this.resolveToken();
    if (!token) return false;
    const userId = verifyTelegramInitData(initData, token);
    if (!userId) return false;
    // HTTP yönetici erişimi için yönetici listesi açıkça tanımlı olmalıdır.
    return this.adminIds.size > 0 && this.adminIds.has(userId);
  }

  public async setupMenuButton(): Promise<void> {
    if (!this.bot) return;
    try {
      const publicBase = (process.env.PUBLIC_APP_URL || 'https://tavriko-app.vercel.app').replace(/\/+$/, '');
      const webAppUrl = `${publicBase}/telegram-webapp`;
      await (this.bot.telegram as any).setChatMenuButton({
        menuButton: {
          type: 'web_app',
          text: '🎮 Tavriko Aç',
          web_app: { url: webAppUrl },
        },
      });
      console.log(`🤖 [TelegramBot] Web App menü butonu ayarlandı: ${webAppUrl}`);
      logger.info('TELEGRAM', `Web App menü butonu kuruldu: ${webAppUrl}`);
    } catch (err: any) {
      console.warn('[TelegramBot] setChatMenuButton hatası:', err.message);
    }
  }

  public async handleJsonQuestionInput(
    fromId: number,
    rawJson: string,
    sourceName = 'Telegram Girişi'
  ): Promise<string> {
    console.log(`🤖 [TelegramBot] handleJsonQuestionInput çağrıldı: fromId=${fromId}, source=${sourceName}, içerik boyutu=${rawJson?.length ?? 0}`);
    const importRes = importQuestionsFromJson(rawJson, this.db, `Telegram Admin (${fromId})`, true);
    console.log(`🤖 [TelegramBot] İçe aktarma sonucu: başarı=${importRes.success}, eklenen=${importRes.importedCount}, mükerrer=${importRes.duplicateCount}, hata=${importRes.errorCount}`);

    if (!importRes.success && importRes.importedCount === 0) {
      console.warn(`🤖 [TelegramBot] Soru içe aktarma başarısız. Hatalar:\n${importRes.errors.join('\n')}`);
      return (
        `❌ *Soru İçe Aktarma Başarısız Oldu*\n\n` +
        `• Kaynak: \`${sourceName}\`\n` +
        `• Hata Detayları:\n` +
        importRes.errors.map((e) => `  ⚠️ ${e}`).join('\n') +
        `\n\n📌 *Doğru Format Örneği İçin:* \`/json_ornek\` komutunu kullanabilirsiniz.`
      );
    }

    const categorySummary = Object.entries(importRes.categoryBreakdown)
      .map(([cat, cnt]) => `  • \`${cat}\`: *${cnt} soru*`)
      .join('\n');

    let msg =
      `🎉 *${importRes.importedCount} Adet Soru Başarıyla Havuza Eklendi!*\n\n` +
      `📁 *Kaynak:* \`${sourceName}\`\n` +
      `✅ *Eklenen:* ${importRes.importedCount} soru\n` +
      `📋 *Toplam Okunan:* ${importRes.totalProcessed}\n` +
      (importRes.duplicateCount > 0 ? `🔁 *Mükerrer (Atlandı):* ${importRes.duplicateCount}\n` : '') +
      (importRes.errorCount > 0 ? `⚠️ *Hatalı Soru:* ${importRes.errorCount}\n` : '') +
      `\n*Kategori Dağılımı:*\n${categorySummary}\n\n` +
      `✨ Sorular doğrudan yayınlandı ve oyunda çözülmeye hazır!`;

    if (importRes.errors.length > 0) {
      msg += `\n\n⚠️ *Bazı Uyarılar:*\n` + importRes.errors.slice(0, 3).map((e) => `• ${e}`).join('\n');
    }

    logger.success('TELEGRAM', `JSON Soru İçe Aktarma: ${importRes.importedCount} eklendi`, {
      fromId,
      sourceName,
      importedCount: importRes.importedCount,
    });

    return msg;
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

      const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION);
      // Prefer Cloudflare Workers 24/7 Edge Webhook Gateway to avoid Vercel cold starts
      const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || DEFAULT_TELEGRAM_WEBHOOK_URL;

      if (isVercel || process.env.NODE_ENV === 'production') {
        try {
          // secret_token zorunlu: webhook uç noktası bu anahtarı doğrular. Önceden
          // anahtarsız kuruluyordu ve her soğuk başlatmada sıfırlanıyordu; bu yüzden
          // tüm Telegram güncellemeleri (/start, butonlar) 401 ile reddediliyordu.
          // Soğuk başlatmalarda bekleyen mesajlar silinmez (drop_pending_updates: false).
          await this.bot.telegram.setWebhook(webhookUrl, {
            drop_pending_updates: false,
            secret_token: this.webhookSecretFor(token),
          });
          this.lastWebhookRepairAt = Date.now();
          console.log(`🤖 [TelegramBot] Webhook başarıyla ayarlandı: ${webhookUrl}`);
          logger.success('TELEGRAM', `Webhook başarıyla kuruldu: ${webhookUrl}`);
          this.running = true;
          this.setupMenuButton().catch(() => {});
        } catch (whErr: any) {
          console.warn('[TelegramBot] setWebhook uyarısı:', whErr.message);
          logger.error('TELEGRAM', `Telegram setWebhook reddedildi: ${whErr.message}`, { webhookUrl });
          this.running = false;
          this.isStarting = false;
          return {
            success: false,
            message: `Telegram Webhook kurulamadı: ${whErr.message}. Lütfen bot tokeninizi kontrol edin.`,
          };
        }
      } else {
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
      }

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
    const webAppUrl = `${(process.env.PUBLIC_APP_URL || 'https://tavriko-app.vercel.app').replace(/\/+$/, '')}/telegram-webapp`;
    return Markup.keyboard([
      ['✨ Yeni Soru Üret', '📅 Günlük Soru Üret'],
      ['⚔️ Özel Oda Soru Üret', '📊 Soru Havuzu'],
      ['📥 JSON Soru Ekle', '⏳ Onay Bekleyenler'],
      ['🏆 Pro Lig Sıralaması', '🎮 Hızlı Oda Kur'],
      [Markup.button.webApp('🎮 Tavriko WebApp Aç', webAppUrl), '❓ Yardım & Komutlar'],
    ]).resize();
  }

  // Sihirbaz kategori klavyesi sayfalama: sayfa başına 12 kategori (6 satır x 2)
  public getCategoryWizardKeyboard(page: number = 0) {
    const PER_PAGE = 12;
    const totalPages = Math.max(1, Math.ceil(CATEGORIES_CONFIG.length / PER_PAGE));
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    const start = safePage * PER_PAGE;
    const slice = CATEGORIES_CONFIG.slice(start, start + PER_PAGE);

    const buttons = [];
    for (let i = 0; i < slice.length; i += 2) {
      const row = [];
      row.push(Markup.button.callback(`${slice[i].emoji} ${slice[i].name}`, `wiz_cat:${slice[i].id}`));
      if (i + 1 < slice.length) {
        row.push(Markup.button.callback(`${slice[i + 1].emoji} ${slice[i + 1].name}`, `wiz_cat:${slice[i + 1].id}`));
      }
      buttons.push(row);
    }

    // Sayfa gezinme satırı
    if (totalPages > 1) {
      const navRow = [];
      if (safePage > 0) navRow.push(Markup.button.callback('◀️ Önceki', `wiz_cat_page:${safePage - 1}`));
      navRow.push(Markup.button.callback(`📄 ${safePage + 1}/${totalPages}`, 'wiz_page_info'));
      if (safePage < totalPages - 1) navRow.push(Markup.button.callback('Sonraki ▶️', `wiz_cat_page:${safePage + 1}`));
      buttons.push(navRow);
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

    let poolTag = '🌐 Normal Kategori';
    if (q.targetPool === 'daily_challenge' || q.isDailyChallenge) {
      poolTag = '📅 Günlük Meydan Okuma';
    } else if (q.targetPool === 'custom_room' || q.isCustomRoomOnly) {
      poolTag = '⚔️ Özel Oda / Arkadaş';
    }

    const optLabels = ['A', 'B', 'C', 'D'];
    const optionsText = q.options
      .map((opt, i) => `${optLabels[i]}) ${opt.text} ${opt.id === q.correctOptionId ? '👈 (Doğru Cevap)' : ''}`)
      .join('\n');

    return (
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 *Soru ID:* \`${q.id}\`\n` +
      `🎯 *Havuz:* ${poolTag}\n` +
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
        Markup.button.callback('✅ Normal Kategoriye Al', `approve_cat:${q.id}`),
      ],
      [
        Markup.button.callback('📅 Günlük Meydan Okuma', `approve_daily:${q.id}`),
        Markup.button.callback('⚔️ Özel Oda / Arkadaş', `approve_custom:${q.id}`),
      ],
      [
        Markup.button.callback('❌ Reddet', `reject:${q.id}`),
        Markup.button.callback('🔄 Yeniden Üret', `wiz_run:${q.categoryId}:${q.difficulty}:1`),
      ],
    ]);
  }

  private async replySafe(ctx: any, text: string, extra?: any) {
    try {
      await ctx.replyWithMarkdown(text, extra);
      logger.info('TELEGRAM', `Kullanıcıya yanıt gönderildi (ChatId: ${ctx?.chat?.id || ctx?.from?.id})`);
    } catch {
      try {
        const clean = text.replace(/[*_`]/g, '');
        await ctx.reply(clean, extra);
        logger.info('TELEGRAM', `Kullanıcıya düz metin yanıt gönderildi (ChatId: ${ctx?.chat?.id || ctx?.from?.id})`);
      } catch (err: any) {
        logger.error('TELEGRAM', `Mesaj iletim hatası: ${err.message}`, { chatId: ctx?.chat?.id });
        console.warn('[TelegramBot] Mesaj iletim hatası:', err.message);
      }
    }
  }

  public async handleCommand(userId: number | string, text: string): Promise<BotCommandResponse> {
    const parts = text.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();

    logger.info('TELEGRAM', `Telegram komutu yürütülüyor: "${cmd}" (Kullanıcı: ${userId})`);

    // Admin-only commands check
    const adminOnlyCommands = ['/soru_uret', '/bekleyenler', '/gunluk_soru_uret', '/ozel_soru_uret', '/soru_ekle', '/json_ekle'];
    if (adminOnlyCommands.includes(cmd) && !this.isAdmin(userId)) {
      return {
        authorized: false,
        message: '⛔ Bu bot yalnızca yetkili yöneticiler içindir. Erişim yetkiniz bulunmamaktadır.',
      };
    }

    switch (cmd) {
      case '/start':
      case '/yardim':
      case '/help': {
        const publicBase = (process.env.PUBLIC_APP_URL || 'https://tavriko-app.vercel.app').replace(/\/+$/, '');
        return {
          authorized: true,
          message:
            `👋 *Tavriko Bilgi Yarışması & Yönetim Botu*\n\n` +
            `T.C. SSB EVREN platformundaki *GLM-5.3* yapay zekâ modeli ile güçlendirilen soru üretim, topluluk ve canlı maç altyapısına hoş geldiniz!\n\n` +
            `*🎯 Soru Üretimi ve Manuel JSON Ekleme:*\n` +
            `• \`/soru_uret [kategori] [zorluk] [adet]\` — Normal maçlar için yapay zekâ sorusu üretir\n` +
            `• \`/gunluk_soru_uret [zorluk] [adet]\` — Günlük Meydan Okuma havuzu için soru üretir\n` +
            `• \`/ozel_soru_uret [zorluk] [adet]\` — Özel Oda / Arkadaş düelloları için eğlenceli sorular üretir\n` +
            `• \`/soru_ekle <json>\` — Manuel olarak 1 veya daha fazla soru ekler\n` +
            `• \`/json_ornek\` — Örnek JSON soru formatı şablonunu gösterir\n` +
            `• \`/bekleyenler\` — Onay kuyruğundaki soruları inceler\n` +
            `• \`/istatistik\` — Soru havuzu metrikleri ve kategori dağılımı\n` +
            `• \`/kategori\` — ${CATEGORIES_CONFIG.length} yarışma kategorisinin tamamını listeler\n` +
            `• \`/ara_soru <kelime>\` — Soru havuzunda arama yapar\n\n` +
            `*🎮 Oyuncu & Topluluk Komutları:*\n` +
            `• \`/profil <kullanıcı_adı>\` — Seviye, LP, galibiyet oranı ve unvanı gösterir\n` +
            `• \`/lig\` veya \`/siralama\` — Pro Lig canlı lider tablosundaki ilk 10 oyuncuyu listeler\n` +
            `• \`/oda_kur [kategori]\` — Anında 6 haneli oda kodu ve doğrudan yarışma bağlantısı üretir\n` +
            `• \`/gunun_sorusu\` — Telegram içinden oylanabilen interaktif günün sorusunu gönderir\n` +
            `• \`/webapp\` — Telegram Web App yönetim portalı bağlantısını gönderir\n\n` +
            `📁 *Dosya ile Soru Yükleme:* Bu sohbete doğrudan bir \`.json\` soru dosyası yükleyerek anında havuza aktarabilirsiniz!\n` +
            `👉 Aşağıdaki butonları kullanarak da adımları tek dokunuşla başlatabilirsiniz!`,
        };
      }

      case '/json_ornek':
      case '/format':
      case '/ornek_json': {
        return {
          authorized: true,
          message:
            `📥 *Tavriko JSON Formatı Rehberi ve Örnek Şablon*\n\n` +
            `Telegram'a doğrudan bir \`.json\` soru dosyası gönderebilir veya aşağıdaki şablona uygun JSON metnini sohbete yapıştırabilirsiniz:\n\n` +
            `\`\`\`json\n${SAMPLE_QUESTION_JSON}\n\`\`\`\n\n` +
            `*Alan Açıklamaları:*\n` +
            `• \`text\` (veya \`soru\`): Soru metni (Zorunlu)\n` +
            `• \`options\` (veya \`secenekler\`): 4 seçenek içeren dizi (Zorunlu)\n` +
            `• \`correctAnswerIndex\`: 0, 1, 2 veya 3 (veya \`dogruCevap\`: 'A', 'B', 'C', 'D' veya doğru şıkkın tam metni)\n` +
            `• \`categoryId\` (veya \`kategori\`): geography, history, science_tech, sports vb.\n` +
            `• \`difficulty\` (veya \`zorluk\`): easy, medium, hard, expert (veya kolay, orta, zor, uzman)\n` +
            `• \`explanation\` (veya \`aciklama\`): Doğru cevabın açıklaması\n` +
            `• \`targetPool\` (veya \`havuz\`): standard (Genel), daily_challenge (Günlük), custom_room (Özel Oda)\n\n` +
            `💡 *İpucu:* Tek bir soru eklemek için sadece bir JSON objesi \`{ ... }\` de gönderebilirsiniz!`,
        };
      }

      case '/soru_ekle':
      case '/json_ekle': {
        const rawJson = parts.slice(1).join(' ').trim();
        if (!rawJson) {
          return {
            authorized: true,
            message:
              `⚠️ Lütfen komutun yanına JSON formatında soru verisini ekleyin.\n` +
              `Örnek:\n\`/soru_ekle {"soru": "...", "secenekler": ["A", "B", "C", "D"], "dogruCevap": "A"}\`\n\n` +
              `Şablon görmek için: \`/json_ornek\``,
          };
        }
        const msg = await this.handleJsonQuestionInput(Number(userId), rawJson, 'Komut Girişi');
        return {
          authorized: true,
          message: msg,
        };
      }

      case '/webapp': {
        const publicBase = (process.env.PUBLIC_APP_URL || 'https://tavriko-app.vercel.app').replace(/\/+$/, '');
        const webAppUrl = `${publicBase}/telegram-webapp`;
        return {
          authorized: true,
          message:
            `🎮 *Tavriko Web App Yönetim ve Oyun Portalı*\n\n` +
            `Tüm yönetim ve oyun araçlarına Telegram içinden doğrudan erişebilirsiniz:\n` +
            `• Bağlantı: ${webAppUrl}\n\n` +
            `Ayrıca mesaj yazma kutusunun yanındaki *[🎮 Tavriko Aç]* butonuna dokunarak da mini app'i açabilirsiniz.`,
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
          `• Model: \`${result.model}\`\n\n` +
          `Aşağıdaki butonlarla soruyu *Kategori*, *Günlük Meydan Okuma* veya *Özel Oda* havuzuna onaylayabilirsiniz:`;

        return {
          authorized: true,
          message: summaryText,
          questions: result.questions,
        };
      }

      case '/gunluk_soru_uret': {
        const rawDiff = parts[1]?.toLowerCase() || 'medium';
        const count = Math.min(5, Math.max(1, parseInt(parts[2] || '3', 10)));
        const difficulty = DIFFICULTY_MAP[rawDiff] || 'medium';

        const result = await generateQuestionsWithEvrenGLM({
          categoryId: 'mixed',
          difficulty,
          count,
          db: this.db,
        });

        return {
          authorized: true,
          message:
            `📅 *${result.validCount} adet Günlük Meydan Okuma sorusu üretildi!*\n` +
            `Soruları aşağıdan inceleyip *[📅 Günlük Meydan Okuma]* butonu ile onaylayın.`,
          questions: result.questions,
        };
      }

      case '/ozel_soru_uret': {
        const rawDiff = parts[1]?.toLowerCase() || 'medium';
        const count = Math.min(5, Math.max(1, parseInt(parts[2] || '3', 10)));
        const difficulty = DIFFICULTY_MAP[rawDiff] || 'medium';

        const result = await generateQuestionsWithEvrenGLM({
          categoryId: 'logic_puzzles',
          difficulty,
          count,
          db: this.db,
        });

        return {
          authorized: true,
          message:
            `⚔️ *${result.validCount} adet Özel Oda / Arkadaş Düellosu sorusu üretildi!*\n` +
            `Soruları aşağıdan inceleyip *[⚔️ Özel Oda / Arkadaş]* butonu ile onaylayın.`,
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

      case '/profil': {
        const query = parts.slice(1).join(' ').trim();
        if (!query) {
          return {
            authorized: true,
            message: '⚠️ Lütfen sorgulamak istediğiniz kullanıcı adı veya ID belirtin.\nÖrnek: `/profil safak` veya `/profil user_123`',
          };
        }
        const prof = await this.db.findUserByUsernameOrId(query);
        if (!prof) {
          return {
            authorized: true,
            message: `❌ "${query}" kullanıcı adına sahip oyuncu bulunamadı.`,
          };
        }
        const totalMatches = prof.stats?.totalMatches ?? 0;
        const wins = prof.stats?.wins ?? 0;
        const bestStreak = prof.stats?.bestStreak ?? 0;
        const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
        const text =
          `👤 *OYUNCU PROFİLİ: ${prof.displayName}*\n` +
          `🆔 Kullanıcı: \`@${prof.username || prof.id}\`\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🏅 *Lig Puanı:* ${prof.rankPoints || 0} LP (${prof.rankTitle || 'Çaylak'})\n` +
          `⭐ *Seviye:* Seviye ${prof.level || 1} (${prof.xp || 0} XP)\n` +
          `🎯 *Maç İstatistiği:* ${totalMatches} maç | ${wins} galibiyet (%${winRate})\n` +
          `🔥 *En Yüksek Seri:* ${bestStreak} doğru cevap\n` +
          `🪙 *Bakiye:* ${prof.coins || 0} Altın | 💎 ${prof.gems || 0} Elmas\n` +
          `🎒 *Envanter:* ${(prof.inventory || []).length} eşya\n` +
          `👑 *Durum:* ${prof.hasPremiumPass ? '⭐ Premium Pass Aktif' : 'Ücretsiz Oyuncu'}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━`;
        return { authorized: true, message: text };
      }

      case '/lig':
      case '/siralama': {
        const top = this.db.getLeaderboard(10);
        if (top.length === 0) {
          return { authorized: true, message: '🏆 Henüz lider tablosunda kayıtlı oyuncu yok.' };
        }
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        const rows = top.map((p, idx) => {
          const m = medals[idx] || `${idx + 1}.`;
          return `${m} *${p.displayName}* (@${p.username}) — *${p.rankPoints} LP* (Sv. ${p.level})`;
        }).join('\n');
        const text =
          `🏆 *TAVRİKO PRO LİG CANLI LİDER TABLOSU*\n` +
          `Sezon 1: Bilgi Çağı — İlk 10 Oyuncu\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          rows +
          `\n\n🎮 *Yarışmaya Katılın:* https://tavriko-app.vercel.app/`;
        return { authorized: true, message: text };
      }

      case '/oda_kur': {
        const rawCat = parts[1]?.toLowerCase() || 'general_culture';
        const categoryId = CATEGORY_MAP[rawCat] || 'general_culture';
        const catObj = CATEGORIES_CONFIG.find((c) => c.id === categoryId);
        const catName = catObj ? `${catObj.emoji} ${catObj.name}` : 'Genel Kültür';

        let roomCode = 'TAV' + Math.floor(100 + Math.random() * 900);
        if (this.roomManager) {
          try {
            const room = this.roomManager.createRoom({
              hostId: 'tg_' + userId,
              hostName: 'Telegram Grubu',
              category: categoryId,
              difficulty: 'medium',
              totalRounds: 7,
              mode: 'friends_private',
            });
            roomCode = room.code;
          } catch {}
        }

        const joinUrl = `https://tavriko-app.vercel.app/?joinRoom=${roomCode}`;
        const text =
          `🎮 *YENİ TAVRİKO ÖZEL ODASI OLUŞTURULDU!*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🔑 *Oda Kodu:* \`${roomCode}\`\n` +
          `🏷 *Kategori:* ${catName}\n` +
          `📊 *Zorluk:* 🟡 Orta | *Soru:* 7 Tur\n\n` +
          `👉 *Hemen Oyna:* [BURAYA TIKLAYARAK KATIL](${joinUrl})\n\n` +
          `Veya Tavriko oyununda *"Özel Oda"* sekmesine girip \`${roomCode}\` kodunu yazın!`;
        return { authorized: true, message: text, extra: { roomCode, joinUrl } };
      }

      case '/gunun_sorusu': {
        const daily = this.db.getDailyChallenge();
        const q = daily.questions[Math.floor(Math.random() * daily.questions.length)] || this.db.getQuestions('mixed', undefined, 1)[0];
        if (!q) {
          return { authorized: true, message: 'Şu anda soru bulunamadı.' };
        }
        return {
          authorized: true,
          message: this.formatQuestionCard(q),
          questions: [q],
        };
      }

      case '/ara_soru': {
        const kw = parts.slice(1).join(' ').trim();
        if (!kw) {
          return { authorized: true, message: 'Lütfen aramak istediğiniz kelimeyi girin. Örn: `/ara_soru Osmanlı`' };
        }
        const results = this.db.searchQuestions(kw, 5);
        if (results.length === 0) {
          return { authorized: true, message: `🔍 "${kw}" ile eşleşen soru bulunamadı.` };
        }
        return {
          authorized: true,
          message: `🔍 *"${kw}" ile eşleşen ${results.length} soru bulundu:*`,
          questions: results,
        };
      }

      default:
        return {
          authorized: true,
          message: `❓ Bilinmeyen komut: ${cmd}. Yardım ve komut listesi için /yardim yazabilirsiniz.`,
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
      case 'approve':
      case 'approve_cat': {
        const questionId = args[0];
        const updated = this.db.approveQuestion(questionId, String(userId), 'standard');
        if (!updated) {
          return { authorized: true, success: false, message: 'Soru bulunamadı.' };
        }
        supabaseService.updateQuestionStatus(questionId, 'published', String(userId)).catch(() => {});
        return {
          authorized: true,
          success: true,
          message: `✅ Soru [${questionId}] KATEGORİ havuzuna ONAYLANDI ve canlıya alındı!`,
          question: updated,
        };
      }

      case 'approve_daily': {
        const questionId = args[0];
        const updated = this.db.approveQuestion(questionId, String(userId), 'daily_challenge');
        if (!updated) {
          return { authorized: true, success: false, message: 'Soru bulunamadı.' };
        }
        supabaseService.updateQuestionStatus(questionId, 'published', String(userId)).catch(() => {});
        return {
          authorized: true,
          success: true,
          message: `📅 Soru [${questionId}] GÜNLÜK MEYDAN OKUMA havuzuna ONAYLANDI!`,
          question: updated,
        };
      }

      case 'approve_custom': {
        const questionId = args[0];
        const updated = this.db.approveQuestion(questionId, String(userId), 'custom_room');
        if (!updated) {
          return { authorized: true, success: false, message: 'Soru bulunamadı.' };
        }
        supabaseService.updateQuestionStatus(questionId, 'published', String(userId)).catch(() => {});
        return {
          authorized: true,
          success: true,
          message: `⚔️ Soru [${questionId}] ÖZEL ODA / ARKADAŞ havuzuna ONAYLANDI!`,
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

    this.bot.hears('📅 Günlük Soru Üret', async (ctx) => {
      if (!this.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Bu komut yalnızca yetkili yöneticiler içindir.');
      }
      const res = await this.handleCommand(ctx.from.id, '/gunluk_soru_uret');
      await this.replySafe(ctx, res.message);
      if (res.questions && res.questions.length > 0) {
        for (const q of res.questions) {
          const card = this.formatQuestionCard(q);
          const keyboard = this.buildInlineKeyboard(q);
          await this.replySafe(ctx, card, keyboard);
        }
      }
    });

    this.bot.hears('⚔️ Özel Oda Soru Üret', async (ctx) => {
      if (!this.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Bu komut yalnızca yetkili yöneticiler içindir.');
      }
      const res = await this.handleCommand(ctx.from.id, '/ozel_soru_uret');
      await this.replySafe(ctx, res.message);
      if (res.questions && res.questions.length > 0) {
        for (const q of res.questions) {
          const card = this.formatQuestionCard(q);
          const keyboard = this.buildInlineKeyboard(q);
          await this.replySafe(ctx, card, keyboard);
        }
      }
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

    this.bot.hears('🏆 Pro Lig Sıralaması', async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, '/lig');
      await this.replySafe(ctx, res.message, this.getMainKeyboard());
    });

    this.bot.hears('🎮 Hızlı Oda Kur', async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, '/oda_kur');
      await this.replySafe(ctx, res.message, this.getMainKeyboard());
    });

    this.bot.hears(['❓ Yardım & Bilgi', '❓ Yardım & Komutlar'], async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, '/start');
      await this.replySafe(ctx, res.message, this.getMainKeyboard());
    });

    this.bot.hears('📥 JSON Soru Ekle', async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, '/json_ornek');
      await this.replySafe(ctx, res.message, this.getMainKeyboard());
    });

    this.bot.hears('🎮 Tavriko WebApp Aç', async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, '/webapp');
      await this.replySafe(ctx, res.message, this.getMainKeyboard());
    });

    // Otomatik JSON Tespit Edici: Kullanıcı doğrudan { ... } veya [ ... ] şeklinde JSON yapıştırırsa
    this.bot.hears(/^\s*(\[|\{)/s, async (ctx) => {
      if (!this.isAdmin(ctx.from.id)) return;
      const text = ctx.message.text?.trim() || '';
      if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
        try {
          const resMsg = await this.handleJsonQuestionInput(ctx.from.id, text, 'Mesaj İçi JSON');
          await this.replySafe(ctx, resMsg, this.getMainKeyboard());
        } catch (err: any) {
          await ctx.reply(`⚠️ JSON işlenirken bir sorun oluştu: ${err.message}`);
        }
      }
    });

    // 3. Özel Komut Dinleyicileri
    this.bot.command(['json_ornek', 'format', 'ornek_json'], async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, '/json_ornek');
      await this.replySafe(ctx, res.message);
    });

    this.bot.command(['soru_ekle', 'json_ekle'], async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, ctx.message.text.trim());
      await this.replySafe(ctx, res.message);
    });

    this.bot.command('webapp', async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, '/webapp');
      await this.replySafe(ctx, res.message);
    });
    this.bot.command('soru_uret', async (ctx) => {
      const text = ctx.message.text.trim();
      const parts = text.split(/\s+/);
      if (parts.length === 1) {
        await this.replySafe(
          ctx,
          `📚 *Adım 1/3: Soru Kategorisi Seçin*\n\nHangi kategoride soru üretmek istersiniz? Aşağıdaki butonlardan birine dokunun:`,
          this.getCategoryWizardKeyboard()
        );
        return;
      }

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

    this.bot.command('gunluk_soru_uret', async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, ctx.message.text.trim());
      await this.replySafe(ctx, res.message);
      if (res.questions && res.questions.length > 0) {
        for (const q of res.questions) {
          const card = this.formatQuestionCard(q);
          const keyboard = this.buildInlineKeyboard(q);
          await this.replySafe(ctx, card, keyboard);
        }
      }
    });

    this.bot.command('ozel_soru_uret', async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, ctx.message.text.trim());
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

    this.bot.command('profil', async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, ctx.message.text);
      await this.replySafe(ctx, res.message);
    });

    this.bot.command(['lig', 'siralama'], async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, ctx.message.text);
      await this.replySafe(ctx, res.message);
    });

    this.bot.command('oda_kur', async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, ctx.message.text);
      await this.replySafe(ctx, res.message);
    });

    this.bot.command(['gunun_sorusu', 'quiz'], async (ctx) => {
      const res = await this.handleCommand(ctx.from.id, '/gunun_sorusu');
      if (res.questions && res.questions.length > 0) {
        const q = res.questions[0];
        const correctIdx = q.options.findIndex((o) => o.id === q.correctOptionId);
        if (typeof (ctx as any).sendPoll === 'function' && correctIdx >= 0) {
          try {
            await (ctx as any).sendPoll(
              `❓ [Günün Sorusu] ${q.text}`.slice(0, 290),
              q.options.map((o) => o.text.slice(0, 95)),
              {
                type: 'quiz',
                correct_option_id: correctIdx,
                explanation: (q.explanation || 'Tavriko Bilgi Yarışması').slice(0, 190),
                is_anonymous: false,
              }
            );
            return;
          } catch {}
        }
        await this.replySafe(ctx, res.message);
      } else {
        await this.replySafe(ctx, res.message);
      }
    });

    this.bot.command('ara_soru', async (ctx) => {
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

    // 4. Belge / Dosya Yükleme (.json dosya desteği)
    this.bot.on('document', async (ctx) => {
      if (!this.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Yetkiniz bulunmamaktadır.');
      }
      const doc = ctx.message.document;
      const fileName = doc.file_name || 'sorular.json';
      const isJsonExt = fileName.toLowerCase().endsWith('.json');
      const isJsonMime = doc.mime_type?.includes('json');

      if (!isJsonExt && !isJsonMime) {
        return ctx.reply('ℹ️ Yalnızca .json uzantılı veya JSON formatındaki soru dosyaları desteklenmektedir.');
      }

      try {
        await ctx.reply(`⏳ "${fileName}" dosyası okunuyor ve sorular doğrulanıyor...`);
        const fileLink = await ctx.telegram.getFileLink(doc.file_id);
        const response = await fetch(fileLink.href);
        if (!response.ok) {
          throw new Error(`Dosya indirilemedi (HTTP ${response.status})`);
        }
        const fileContent = await response.text();
        const resMsg = await this.handleJsonQuestionInput(ctx.from.id, fileContent, `Dosya: ${fileName}`);
        await this.replySafe(ctx, resMsg, this.getMainKeyboard());
      } catch (err: any) {
        await ctx.reply(`❌ Dosya işlenirken hata oluştu: ${err.message}`);
      }
    });

    // 5. Wizard & Inline Buton Etkileşimleri
    this.bot.on('callback_query', async (ctx) => {
      const data = (ctx.callbackQuery as any)?.data;
      if (!data) return;

      if (!this.isAdmin(ctx.from.id)) {
        try {
          await ctx.answerCbQuery('⛔ Yetkiniz bulunmamaktadır.', { show_alert: true });
        } catch {}
        return;
      }

      // Sayfa bilgisi butonu (yalnızca spinner'ı kapatır)
      if (data === 'wiz_page_info') {
        try {
          await ctx.answerCbQuery();
        } catch {}
        return;
      }

      // Kategori sayfası değiştirme (sihirbaz)
      if (data.startsWith('wiz_cat_page:')) {
        const page = parseInt(data.replace('wiz_cat_page:', ''), 10) || 0;
        try {
          await ctx.answerCbQuery();
          await ctx.editMessageText(
            `📚 *Adım 1/3: Soru Kategorisi Seçin* (Sayfa ${page + 1})\n\nHangi kategoride soru üretmek istersiniz? Aşağıdaki butonlardan birine dokunun:`,
            {
              parse_mode: 'Markdown',
              ...this.getCategoryWizardKeyboard(page),
            }
          );
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

      // 5. Onaylama (Approve) İşlemleri
      if (
        data.startsWith('approve:') ||
        data.startsWith('approve_cat:') ||
        data.startsWith('approve_daily:') ||
        data.startsWith('approve_custom:')
      ) {
        const res = await this.handleCallback(ctx.from.id, data);
        let tag = '✅ *[ONAYLANDI - KATEGORİ HAVUZUNDA]*';
        if (data.startsWith('approve_daily:')) {
          tag = '📅 *[ONAYLANDI - GÜNLÜK MEYDAN OKUMA HAVUZUNDA]*';
        } else if (data.startsWith('approve_custom:')) {
          tag = '⚔️ *[ONAYLANDI - ÖZEL ODA / ARKADAŞ HAVUZUNDA]*';
        }

        try {
          await ctx.answerCbQuery(res.message, { show_alert: true });
          const originalText = (ctx.callbackQuery.message as any)?.text || '';
          await ctx.editMessageText(
            `${originalText}\n\n${tag}`,
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('🎉 Havuzda Yayında', 'noop')],
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
