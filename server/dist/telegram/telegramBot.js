"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramBotService = exports.DIFFICULTIES_CONFIG = exports.CATEGORIES_CONFIG = void 0;
const telegraf_1 = require("telegraf");
const evrenLlmGenerator_1 = require("../ai/evrenLlmGenerator");
const supabaseClient_1 = require("../db/supabaseClient");
const redisClient_1 = require("../cache/redisClient");
const logger_1 = require("../utils/logger");
const questionImporter_1 = require("../utils/questionImporter");
exports.CATEGORIES_CONFIG = [
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
exports.DIFFICULTIES_CONFIG = [
    { id: 'easy', name: 'Kolay', emoji: '🟢' },
    { id: 'medium', name: 'Orta', emoji: '🟡' },
    { id: 'hard', name: 'Zor', emoji: '🔴' },
    { id: 'expert', name: 'Uzman', emoji: '🟣' },
];
const CATEGORY_MAP = {
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
const DIFFICULTY_MAP = {
    kolay: 'easy',
    easy: 'easy',
    orta: 'medium',
    medium: 'medium',
    zor: 'hard',
    hard: 'hard',
    uzman: 'expert',
    expert: 'expert',
};
class TelegramBotService {
    bot = null;
    adminIds;
    db;
    roomManager;
    running = false;
    activeToken = null;
    isStarting = false;
    constructor(config) {
        this.db = config.db;
        this.roomManager = config.roomManager;
        const parsedAdmins = (config.adminIds || [])
            .map((id) => String(id).trim())
            .filter(Boolean);
        if (process.env.TELEGRAM_ADMIN_IDS) {
            process.env.TELEGRAM_ADMIN_IDS.split(',').forEach((id) => {
                if (id.trim())
                    parsedAdmins.push(id.trim());
            });
        }
        this.adminIds = new Set(parsedAdmins);
        const isTest = process.env.NODE_ENV === 'test';
        const token = config.token || process.env.TELEGRAM_BOT_TOKEN;
        if (!isTest && token && !token.includes('placeholder') && !token.includes('123456789:ABC')) {
            this.initBot(token);
        }
        else if (!token || token.includes('placeholder')) {
            console.log('[TelegramBot] TELEGRAM_BOT_TOKEN tanımlanmadı; simülasyon ve test modu aktif.');
        }
    }
    isRunning() {
        return this.running;
    }
    getActiveToken() {
        return this.activeToken ? `${this.activeToken.substring(0, 8)}...` : null;
    }
    async ensureBotReady() {
        if (this.bot)
            return true;
        const isTest = process.env.NODE_ENV === 'test';
        if (isTest)
            return false;
        let token = process.env.TELEGRAM_BOT_TOKEN;
        let savedAdmins = [];
        if (!token || token.includes('placeholder')) {
            try {
                const saved = await redisClient_1.cacheService.getCustomValue('tavriko:telegram:config');
                if (saved && saved.token) {
                    token = saved.token;
                    if (saved.adminIds && Array.isArray(saved.adminIds)) {
                        savedAdmins = saved.adminIds;
                    }
                }
            }
            catch { }
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
    async getBotInfo() {
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
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async configure(token, adminIds) {
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
                await redisClient_1.cacheService.setCustomValue('tavriko:telegram:config', {
                    token: token.trim(),
                    adminIds: Array.from(this.adminIds),
                });
            }
            catch (e) {
                console.warn('[TelegramBot] Token cache kaydedilemedi:', e.message);
            }
            let botMe = null;
            try {
                if (this.bot)
                    botMe = await this.bot.telegram.getMe();
            }
            catch { }
            return { ...initRes, bot: botMe };
        }
        return initRes;
    }
    async stopBot() {
        if (this.bot) {
            try {
                this.bot.stop('SIGINT');
            }
            catch { }
            this.bot = null;
            this.running = false;
        }
    }
    async handleWebhookUpdate(update) {
        if (!this.bot) {
            await this.ensureBotReady();
        }
        if (this.bot) {
            await this.bot.handleUpdate(update);
        }
    }
    async setWebhook(url) {
        if (!this.bot) {
            await this.ensureBotReady();
        }
        if (!this.bot) {
            return { success: false, message: 'Bot başlatılmamış veya token tanımlanmamış.' };
        }
        try {
            await this.bot.telegram.setWebhook(url, { drop_pending_updates: true });
            const info = await this.bot.telegram.getWebhookInfo();
            this.running = true;
            logger_1.logger.success('TELEGRAM', `Webhook güncellendi: ${url}`, info);
            this.setupMenuButton().catch(() => { });
            return { success: true, message: `Telegram Webhook başarıyla kuruldu: ${url}`, info };
        }
        catch (err) {
            logger_1.logger.error('TELEGRAM', `Webhook kurulum hatası: ${err.message}`);
            return { success: false, message: `Webhook kurulum hatası: ${err.message}` };
        }
    }
    async getWebhookInfo() {
        if (!this.bot) {
            await this.ensureBotReady();
        }
        if (!this.bot)
            return null;
        try {
            return await this.bot.telegram.getWebhookInfo();
        }
        catch {
            return null;
        }
    }
    async setupMenuButton() {
        if (!this.bot)
            return;
        try {
            const publicBase = (process.env.PUBLIC_APP_URL || 'https://tavriko-app.vercel.app').replace(/\/+$/, '');
            const webAppUrl = `${publicBase}/telegram-webapp`;
            await this.bot.telegram.setChatMenuButton({
                menuButton: {
                    type: 'web_app',
                    text: '🎮 Tavriko Aç',
                    web_app: { url: webAppUrl },
                },
            });
            console.log(`🤖 [TelegramBot] Web App menü butonu ayarlandı: ${webAppUrl}`);
            logger_1.logger.info('TELEGRAM', `Web App menü butonu kuruldu: ${webAppUrl}`);
        }
        catch (err) {
            console.warn('[TelegramBot] setChatMenuButton hatası:', err.message);
        }
    }
    async handleJsonQuestionInput(fromId, rawJson, sourceName = 'Telegram Girişi') {
        console.log(`🤖 [TelegramBot] handleJsonQuestionInput çağrıldı: fromId=${fromId}, source=${sourceName}, içerik boyutu=${rawJson?.length ?? 0}`);
        const importRes = (0, questionImporter_1.importQuestionsFromJson)(rawJson, this.db, `Telegram Admin (${fromId})`, true);
        console.log(`🤖 [TelegramBot] İçe aktarma sonucu: başarı=${importRes.success}, eklenen=${importRes.importedCount}, mükerrer=${importRes.duplicateCount}, hata=${importRes.errorCount}`);
        if (!importRes.success && importRes.importedCount === 0) {
            console.warn(`🤖 [TelegramBot] Soru içe aktarma başarısız. Hatalar:\n${importRes.errors.join('\n')}`);
            return (`❌ *Soru İçe Aktarma Başarısız Oldu*\n\n` +
                `• Kaynak: \`${sourceName}\`\n` +
                `• Hata Detayları:\n` +
                importRes.errors.map((e) => `  ⚠️ ${e}`).join('\n') +
                `\n\n📌 *Doğru Format Örneği İçin:* \`/json_ornek\` komutunu kullanabilirsiniz.`);
        }
        const categorySummary = Object.entries(importRes.categoryBreakdown)
            .map(([cat, cnt]) => `  • \`${cat}\`: *${cnt} soru*`)
            .join('\n');
        let msg = `🎉 *${importRes.importedCount} Adet Soru Başarıyla Havuza Eklendi!*\n\n` +
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
        logger_1.logger.success('TELEGRAM', `JSON Soru İçe Aktarma: ${importRes.importedCount} eklendi`, {
            fromId,
            sourceName,
            importedCount: importRes.importedCount,
        });
        return msg;
    }
    async initBot(token) {
        if (this.isStarting) {
            return { success: false, message: 'Bot zaten başlatılıyor, lütfen bekleyin.' };
        }
        this.isStarting = true;
        try {
            this.activeToken = token;
            this.bot = new telegraf_1.Telegraf(token);
            this.bot.catch((err) => {
                console.warn('[TelegramBot Error]:', err.message);
            });
            this.registerTelegrafHandlers();
            const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION);
            // Prefer Cloudflare Workers 24/7 Edge Webhook Gateway to avoid Vercel cold starts
            const cfGatewayWebhookUrl = 'https://tavriko-realtime.uncertainidentity8.workers.dev/telegram/webhook';
            const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || cfGatewayWebhookUrl;
            if (isVercel || process.env.NODE_ENV === 'production') {
                try {
                    await this.bot.telegram.setWebhook(webhookUrl, { drop_pending_updates: true });
                    console.log(`🤖 [TelegramBot] Webhook başarıyla ayarlandı: ${webhookUrl}`);
                    logger_1.logger.success('TELEGRAM', `Webhook başarıyla kuruldu: ${webhookUrl}`);
                    this.running = true;
                    this.setupMenuButton().catch(() => { });
                }
                catch (whErr) {
                    console.warn('[TelegramBot] setWebhook uyarısı:', whErr.message);
                    logger_1.logger.error('TELEGRAM', `Telegram setWebhook reddedildi: ${whErr.message}`, { webhookUrl });
                    this.running = false;
                    this.isStarting = false;
                    return {
                        success: false,
                        message: `Telegram Webhook kurulamadı: ${whErr.message}. Lütfen bot tokeninizi kontrol edin.`,
                    };
                }
            }
            else {
                // Reset any pending webhooks or conflicting update queues cleanly
                try {
                    await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
                }
                catch (e) {
                    console.warn('[TelegramBot] deleteWebhook uyarısı:', e.message);
                }
                this.bot.launch({
                    dropPendingUpdates: true,
                }).then(() => {
                    this.running = true;
                    console.log('🤖 [TelegramBot] Telegram Admin Bot başarıyla başlatıldı ve dinliyor.');
                }).catch((err) => {
                    this.running = false;
                    console.warn('[TelegramBot] Bot başlatılırken hata oluştu:', err.message);
                });
            }
            this.running = true;
            this.isStarting = false;
            return { success: true, message: 'Telegram Botu başarıyla başlatıldı ve komutları dinliyor.' };
        }
        catch (err) {
            this.running = false;
            this.isStarting = false;
            console.warn('[TelegramBot] Bot başlatılırken hata oluştu:', err.message);
            return { success: false, message: `Bot başlatılamadı: ${err.message}` };
        }
    }
    isAdmin(userId) {
        if (this.adminIds.size === 0) {
            return true;
        }
        return this.adminIds.has(String(userId));
    }
    getMainKeyboard() {
        const webAppUrl = `${(process.env.PUBLIC_APP_URL || 'https://tavriko-app.vercel.app').replace(/\/+$/, '')}/telegram-webapp`;
        return telegraf_1.Markup.keyboard([
            ['✨ Yeni Soru Üret', '📅 Günlük Soru Üret'],
            ['⚔️ Özel Oda Soru Üret', '📊 Soru Havuzu'],
            ['📥 JSON Soru Ekle', '⏳ Onay Bekleyenler'],
            ['🏆 Pro Lig Sıralaması', '🎮 Hızlı Oda Kur'],
            [telegraf_1.Markup.button.webApp('🎮 Tavriko WebApp Aç', webAppUrl), '❓ Yardım & Komutlar'],
        ]).resize();
    }
    getCategoryWizardKeyboard() {
        const buttons = [];
        for (let i = 0; i < exports.CATEGORIES_CONFIG.length; i += 2) {
            const row = [];
            row.push(telegraf_1.Markup.button.callback(`${exports.CATEGORIES_CONFIG[i].emoji} ${exports.CATEGORIES_CONFIG[i].name}`, `wiz_cat:${exports.CATEGORIES_CONFIG[i].id}`));
            if (i + 1 < exports.CATEGORIES_CONFIG.length) {
                row.push(telegraf_1.Markup.button.callback(`${exports.CATEGORIES_CONFIG[i + 1].emoji} ${exports.CATEGORIES_CONFIG[i + 1].name}`, `wiz_cat:${exports.CATEGORIES_CONFIG[i + 1].id}`));
            }
            buttons.push(row);
        }
        return telegraf_1.Markup.inlineKeyboard(buttons);
    }
    getDifficultyWizardKeyboard(categoryId) {
        const buttons = exports.DIFFICULTIES_CONFIG.map((d) => [
            telegraf_1.Markup.button.callback(`${d.emoji} ${d.name} Seviye`, `wiz_diff:${categoryId}:${d.id}`),
        ]);
        buttons.push([telegraf_1.Markup.button.callback('🔙 ↩️ Geri (Kategori Değiştir)', 'wiz_back:categories')]);
        return telegraf_1.Markup.inlineKeyboard(buttons);
    }
    getCountWizardKeyboard(categoryId, difficulty) {
        return telegraf_1.Markup.inlineKeyboard([
            [
                telegraf_1.Markup.button.callback('1️⃣ 1 Soru', `wiz_run:${categoryId}:${difficulty}:1`),
                telegraf_1.Markup.button.callback('3️⃣ 3 Soru', `wiz_run:${categoryId}:${difficulty}:3`),
                telegraf_1.Markup.button.callback('5️⃣ 5 Soru', `wiz_run:${categoryId}:${difficulty}:5`),
            ],
            [
                telegraf_1.Markup.button.callback('🔙 ↩️ Geri (Zorluk Değiştir)', `wiz_back:difficulty:${categoryId}`),
            ],
        ]);
    }
    formatQuestionCard(q) {
        const catObj = exports.CATEGORIES_CONFIG.find((c) => c.id === q.categoryId);
        const diffObj = exports.DIFFICULTIES_CONFIG.find((d) => d.id === q.difficulty);
        const catDisplay = catObj ? `${catObj.emoji} ${catObj.name}` : q.categoryId;
        const diffDisplay = diffObj ? `${diffObj.emoji} ${diffObj.name}` : q.difficulty;
        let poolTag = '🌐 Normal Kategori';
        if (q.targetPool === 'daily_challenge' || q.isDailyChallenge) {
            poolTag = '📅 Günlük Meydan Okuma';
        }
        else if (q.targetPool === 'custom_room' || q.isCustomRoomOnly) {
            poolTag = '⚔️ Özel Oda / Arkadaş';
        }
        const optLabels = ['A', 'B', 'C', 'D'];
        const optionsText = q.options
            .map((opt, i) => `${optLabels[i]}) ${opt.text} ${opt.id === q.correctOptionId ? '👈 (Doğru Cevap)' : ''}`)
            .join('\n');
        return (`━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📝 *Soru ID:* \`${q.id}\`\n` +
            `🎯 *Havuz:* ${poolTag}\n` +
            `🏷 *Kategori:* ${catDisplay} | 📊 *Zorluk:* ${diffDisplay}\n` +
            (q.subCategory ? `📌 *Kapsam:* ${q.subCategory}\n` : '') +
            `\n❓ *SORU:*\n*${q.text}*\n\n` +
            `🔘 *SEÇENEKLER:*\n${optionsText}\n\n` +
            `💡 *Açıklama:* ${q.explanation}\n` +
            (q.sourceOrVerification ? `🔍 *Doğrulama/Kaynak:* ${q.sourceOrVerification}\n` : '') +
            `━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }
    buildInlineKeyboard(q) {
        return telegraf_1.Markup.inlineKeyboard([
            [
                telegraf_1.Markup.button.callback('✅ Normal Kategoriye Al', `approve_cat:${q.id}`),
            ],
            [
                telegraf_1.Markup.button.callback('📅 Günlük Meydan Okuma', `approve_daily:${q.id}`),
                telegraf_1.Markup.button.callback('⚔️ Özel Oda / Arkadaş', `approve_custom:${q.id}`),
            ],
            [
                telegraf_1.Markup.button.callback('❌ Reddet', `reject:${q.id}`),
                telegraf_1.Markup.button.callback('🔄 Yeniden Üret', `wiz_run:${q.categoryId}:${q.difficulty}:1`),
            ],
        ]);
    }
    async replySafe(ctx, text, extra) {
        try {
            await ctx.replyWithMarkdown(text, extra);
            logger_1.logger.info('TELEGRAM', `Kullanıcıya yanıt gönderildi (ChatId: ${ctx?.chat?.id || ctx?.from?.id})`);
        }
        catch {
            try {
                const clean = text.replace(/[*_`]/g, '');
                await ctx.reply(clean, extra);
                logger_1.logger.info('TELEGRAM', `Kullanıcıya düz metin yanıt gönderildi (ChatId: ${ctx?.chat?.id || ctx?.from?.id})`);
            }
            catch (err) {
                logger_1.logger.error('TELEGRAM', `Mesaj iletim hatası: ${err.message}`, { chatId: ctx?.chat?.id });
                console.warn('[TelegramBot] Mesaj iletim hatası:', err.message);
            }
        }
    }
    async handleCommand(userId, text) {
        const parts = text.trim().split(/\s+/);
        const cmd = parts[0].toLowerCase();
        logger_1.logger.info('TELEGRAM', `Telegram komutu yürütülüyor: "${cmd}" (Kullanıcı: ${userId})`);
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
                    message: `👋 *Tavriko Bilgi Yarışması & Yönetim Botu*\n\n` +
                        `T.C. SSB EVREN platformundaki *GLM-5.3* yapay zekâ modeli ile güçlendirilen soru üretim, topluluk ve canlı maç altyapısına hoş geldiniz!\n\n` +
                        `*🎯 Soru Üretimi ve Manuel JSON Ekleme:*\n` +
                        `• \`/soru_uret [kategori] [zorluk] [adet]\` — Normal maçlar için yapay zekâ sorusu üretir\n` +
                        `• \`/gunluk_soru_uret [zorluk] [adet]\` — Günlük Meydan Okuma havuzu için soru üretir\n` +
                        `• \`/ozel_soru_uret [zorluk] [adet]\` — Özel Oda / Arkadaş düelloları için eğlenceli sorular üretir\n` +
                        `• \`/soru_ekle <json>\` — Manuel olarak 1 veya daha fazla soru ekler\n` +
                        `• \`/json_ornek\` — Örnek JSON soru formatı şablonunu gösterir\n` +
                        `• \`/bekleyenler\` — Onay kuyruğundaki soruları inceler\n` +
                        `• \`/istatistik\` — Soru havuzu metrikleri ve kategori dağılımı\n` +
                        `• \`/kategori\` — 18 yarışma kategorisini listeler\n` +
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
                    message: `📥 *Tavriko JSON Formatı Rehberi ve Örnek Şablon*\n\n` +
                        `Telegram'a doğrudan bir \`.json\` soru dosyası gönderebilir veya aşağıdaki şablona uygun JSON metnini sohbete yapıştırabilirsiniz:\n\n` +
                        `\`\`\`json\n${questionImporter_1.SAMPLE_QUESTION_JSON}\n\`\`\`\n\n` +
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
                        message: `⚠️ Lütfen komutun yanına JSON formatında soru verisini ekleyin.\n` +
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
                    message: `🎮 *Tavriko Web App Yönetim ve Oyun Portalı*\n\n` +
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
                const result = await (0, evrenLlmGenerator_1.generateQuestionsWithEvrenGLM)({
                    categoryId,
                    difficulty,
                    count,
                    db: this.db,
                });
                const summaryText = `✨ *${result.validCount} adet yeni soru Evren GLM-5.3 ile üretildi ve onay kuyruğuna alındı!*\n` +
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
                const result = await (0, evrenLlmGenerator_1.generateQuestionsWithEvrenGLM)({
                    categoryId: 'mixed',
                    difficulty,
                    count,
                    db: this.db,
                });
                return {
                    authorized: true,
                    message: `📅 *${result.validCount} adet Günlük Meydan Okuma sorusu üretildi!*\n` +
                        `Soruları aşağıdan inceleyip *[📅 Günlük Meydan Okuma]* butonu ile onaylayın.`,
                    questions: result.questions,
                };
            }
            case '/ozel_soru_uret': {
                const rawDiff = parts[1]?.toLowerCase() || 'medium';
                const count = Math.min(5, Math.max(1, parseInt(parts[2] || '3', 10)));
                const difficulty = DIFFICULTY_MAP[rawDiff] || 'medium';
                const result = await (0, evrenLlmGenerator_1.generateQuestionsWithEvrenGLM)({
                    categoryId: 'logic_puzzles',
                    difficulty,
                    count,
                    db: this.db,
                });
                return {
                    authorized: true,
                    message: `⚔️ *${result.validCount} adet Özel Oda / Arkadaş Düellosu sorusu üretildi!*\n` +
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
                    message: `📊 *Soru Havuzu ve Onay İstatistikleri:*\n\n` +
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
                const text = `👤 *OYUNCU PROFİLİ: ${prof.displayName}*\n` +
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
                const text = `🏆 *TAVRİKO PRO LİG CANLI LİDER TABLOSU*\n` +
                    `Sezon 1: Bilgi Çağı — İlk 10 Oyuncu\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    rows +
                    `\n\n🎮 *Yarışmaya Katılın:* https://tavriko-app.vercel.app/`;
                return { authorized: true, message: text };
            }
            case '/oda_kur': {
                const rawCat = parts[1]?.toLowerCase() || 'general_culture';
                const categoryId = CATEGORY_MAP[rawCat] || 'general_culture';
                const catObj = exports.CATEGORIES_CONFIG.find((c) => c.id === categoryId);
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
                    }
                    catch { }
                }
                const joinUrl = `https://tavriko-app.vercel.app/?joinRoom=${roomCode}`;
                const text = `🎮 *YENİ TAVRİKO ÖZEL ODASI OLUŞTURULDU!*\n` +
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
    async handleCallback(userId, data) {
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
                supabaseClient_1.supabaseService.updateQuestionStatus(questionId, 'published', String(userId)).catch(() => { });
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
                supabaseClient_1.supabaseService.updateQuestionStatus(questionId, 'published', String(userId)).catch(() => { });
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
                supabaseClient_1.supabaseService.updateQuestionStatus(questionId, 'published', String(userId)).catch(() => { });
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
                supabaseClient_1.supabaseService.updateQuestionStatus(questionId, 'rejected', String(userId), reason).catch(() => { });
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
    registerTelegrafHandlers() {
        if (!this.bot)
            return;
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
            await this.replySafe(ctx, `📚 *Adım 1/3: Soru Kategorisi Seçin*\n\nHangi kategoride soru üretmek istersiniz? Aşağıdaki butonlardan birine dokunun:`, this.getCategoryWizardKeyboard());
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
            if (!this.isAdmin(ctx.from.id))
                return;
            const text = ctx.message.text?.trim() || '';
            if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
                try {
                    const resMsg = await this.handleJsonQuestionInput(ctx.from.id, text, 'Mesaj İçi JSON');
                    await this.replySafe(ctx, resMsg, this.getMainKeyboard());
                }
                catch (err) {
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
                await this.replySafe(ctx, `📚 *Adım 1/3: Soru Kategorisi Seçin*\n\nHangi kategoride soru üretmek istersiniz? Aşağıdaki butonlardan birine dokunun:`, this.getCategoryWizardKeyboard());
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
                if (typeof ctx.sendPoll === 'function' && correctIdx >= 0) {
                    try {
                        await ctx.sendPoll(`❓ [Günün Sorusu] ${q.text}`.slice(0, 290), q.options.map((o) => o.text.slice(0, 95)), {
                            type: 'quiz',
                            correct_option_id: correctIdx,
                            explanation: (q.explanation || 'Tavriko Bilgi Yarışması').slice(0, 190),
                            is_anonymous: false,
                        });
                        return;
                    }
                    catch { }
                }
                await this.replySafe(ctx, res.message);
            }
            else {
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
            }
            catch (err) {
                await ctx.reply(`❌ Dosya işlenirken hata oluştu: ${err.message}`);
            }
        });
        // 5. Wizard & Inline Buton Etkileşimleri
        this.bot.on('callback_query', async (ctx) => {
            const data = ctx.callbackQuery?.data;
            if (!data)
                return;
            if (!this.isAdmin(ctx.from.id)) {
                try {
                    await ctx.answerCbQuery('⛔ Yetkiniz bulunmamaktadır.', { show_alert: true });
                }
                catch { }
                return;
            }
            // Adım 1: Kategori Seçildi -> Adım 2: Zorluk Seçimi
            if (data.startsWith('wiz_cat:')) {
                const categoryId = data.replace('wiz_cat:', '');
                const catObj = exports.CATEGORIES_CONFIG.find((c) => c.id === categoryId);
                const catName = catObj ? `${catObj.emoji} ${catObj.name}` : categoryId;
                try {
                    await ctx.answerCbQuery();
                    await ctx.editMessageText(`🎯 *Adım 2/3: Zorluk Seviyesi Seçin*\n\n` +
                        `• Seçilen Kategori: *${catName}*\n\n` +
                        `Soruların zorluk derecesini belirleyin:`, {
                        parse_mode: 'Markdown',
                        ...this.getDifficultyWizardKeyboard(categoryId),
                    });
                }
                catch (err) {
                    console.warn('[TelegramBot] editMessageText hatası:', err.message);
                }
                return;
            }
            // Adım 2: Zorluk Seçildi -> Adım 3: Adet Seçimi
            if (data.startsWith('wiz_diff:')) {
                const [, categoryId, difficulty] = data.split(':');
                const catObj = exports.CATEGORIES_CONFIG.find((c) => c.id === categoryId);
                const diffObj = exports.DIFFICULTIES_CONFIG.find((d) => d.id === difficulty);
                try {
                    await ctx.answerCbQuery();
                    await ctx.editMessageText(`🔢 *Adım 3/3: Soru Adedi Seçin*\n\n` +
                        `• Kategori: *${catObj ? `${catObj.emoji} ${catObj.name}` : categoryId}*\n` +
                        `• Zorluk: *${diffObj ? `${diffObj.emoji} ${diffObj.name}` : difficulty}*\n\n` +
                        `Tek seferde kaç soru üretilsin?`, {
                        parse_mode: 'Markdown',
                        ...this.getCountWizardKeyboard(categoryId, difficulty),
                    });
                }
                catch (err) {
                    console.warn('[TelegramBot] editMessageText hatası:', err.message);
                }
                return;
            }
            // Geri Butonları
            if (data === 'wiz_back:categories') {
                try {
                    await ctx.answerCbQuery();
                    await ctx.editMessageText(`📚 *Adım 1/3: Soru Kategorisi Seçin*\n\nHangi kategoride soru üretmek istersiniz? Aşağıdaki butonlardan birine dokunun:`, {
                        parse_mode: 'Markdown',
                        ...this.getCategoryWizardKeyboard(),
                    });
                }
                catch { }
                return;
            }
            if (data.startsWith('wiz_back:difficulty:')) {
                const categoryId = data.replace('wiz_back:difficulty:', '');
                const catObj = exports.CATEGORIES_CONFIG.find((c) => c.id === categoryId);
                try {
                    await ctx.answerCbQuery();
                    await ctx.editMessageText(`🎯 *Adım 2/3: Zorluk Seviyesi Seçin*\n\n` +
                        `• Seçilen Kategori: *${catObj ? `${catObj.emoji} ${catObj.name}` : categoryId}*\n\n` +
                        `Soruların zorluk derecesini belirleyin:`, {
                        parse_mode: 'Markdown',
                        ...this.getDifficultyWizardKeyboard(categoryId),
                    });
                }
                catch { }
                return;
            }
            // Adım 4: Üretimi Başlat
            if (data.startsWith('wiz_run:')) {
                const [, categoryId, difficulty, countStr] = data.split(':');
                const count = parseInt(countStr || '1', 10);
                const catObj = exports.CATEGORIES_CONFIG.find((c) => c.id === categoryId);
                const diffObj = exports.DIFFICULTIES_CONFIG.find((d) => d.id === difficulty);
                try {
                    await ctx.answerCbQuery('🚀 Soru üretimi başlatıldı!');
                    await ctx.editMessageText(`⏳ *SSB EVREN GLM-5.3 Soruları Hazırlıyor...*\n\n` +
                        `• Kategori: *${catObj ? `${catObj.emoji} ${catObj.name}` : categoryId}*\n` +
                        `• Zorluk: *${diffObj ? `${diffObj.emoji} ${diffObj.name}` : difficulty}*\n` +
                        `• Adet: *${count} soru*\n\n` +
                        `Yapay zekâ düşünme ve üretim adımı devam ediyor, lütfen bekleyin...`, { parse_mode: 'Markdown' });
                }
                catch { }
                // Evren GLM-5.3 çağrısı
                try {
                    const result = await (0, evrenLlmGenerator_1.generateQuestionsWithEvrenGLM)({
                        categoryId: categoryId,
                        difficulty: difficulty,
                        count,
                        db: this.db,
                    });
                    await ctx.replyWithMarkdown(`✨ *Üretim Tamamlandı!* (${result.validCount} adet yeni soru onay kuyruğunda)\n` +
                        `Aşağıdaki kartlardan her soruyu tek tek inceleyip *[✅ Onayla]* veya *[❌ Reddet]* butonuna basabilirsiniz:`);
                    for (const q of result.questions) {
                        const card = this.formatQuestionCard(q);
                        const keyboard = this.buildInlineKeyboard(q);
                        await this.replySafe(ctx, card, keyboard);
                    }
                }
                catch (err) {
                    await ctx.reply(`❌ Soru üretimi sırasında bir hata oluştu: ${err.message}`);
                }
                return;
            }
            // 5. Onaylama (Approve) İşlemleri
            if (data.startsWith('approve:') ||
                data.startsWith('approve_cat:') ||
                data.startsWith('approve_daily:') ||
                data.startsWith('approve_custom:')) {
                const res = await this.handleCallback(ctx.from.id, data);
                let tag = '✅ *[ONAYLANDI - KATEGORİ HAVUZUNDA]*';
                if (data.startsWith('approve_daily:')) {
                    tag = '📅 *[ONAYLANDI - GÜNLÜK MEYDAN OKUMA HAVUZUNDA]*';
                }
                else if (data.startsWith('approve_custom:')) {
                    tag = '⚔️ *[ONAYLANDI - ÖZEL ODA / ARKADAŞ HAVUZUNDA]*';
                }
                try {
                    await ctx.answerCbQuery(res.message, { show_alert: true });
                    const originalText = ctx.callbackQuery.message?.text || '';
                    await ctx.editMessageText(`${originalText}\n\n${tag}`, {
                        parse_mode: 'Markdown',
                        ...telegraf_1.Markup.inlineKeyboard([
                            [telegraf_1.Markup.button.callback('🎉 Havuzda Yayında', 'noop')],
                        ]),
                    });
                }
                catch {
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
                    const originalText = ctx.callbackQuery.message?.text || '';
                    await ctx.editMessageText(`${originalText}\n\n❌ *[REDDEDİLDİ]*`, {
                        parse_mode: 'Markdown',
                        ...telegraf_1.Markup.inlineKeyboard([
                            [telegraf_1.Markup.button.callback('❌ Reddedildi', 'noop')],
                        ]),
                    });
                }
                catch {
                    await this.replySafe(ctx, res.message);
                }
                return;
            }
            if (data === 'noop') {
                try {
                    await ctx.answerCbQuery('Bu soru zaten işlendi.');
                }
                catch { }
                return;
            }
        });
    }
}
exports.TelegramBotService = TelegramBotService;
