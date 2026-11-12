import { Question, CategoryId, DifficultyLevel, QuestionOption, ALL_CATEGORIES } from '@trivia/shared';
import type { DatabaseAdapter } from '../db/prismaClient';

export interface ImportQuestionDetail {
  id: string;
  text: string;
  categoryId: CategoryId;
  categoryName: string;
  categoryIcon: string;
  difficulty: DifficultyLevel;
  difficultyName: string;
  targetPool: string;
  poolName: string;
  options: string[];
  correctAnswer: string;
}

export interface SkippedDuplicateDetail {
  text: string;
  matchedSignature: string;
}

export interface ImportResult {
  success: boolean;
  totalProcessed: number;
  importedCount: number;
  duplicateCount: number;
  /** Doldurulmamış şablon satırı olduğu için atlanan kayıt sayısı */
  templateSkippedCount: number;
  errorCount: number;
  questions: Question[];
  errors: string[];
  categoryBreakdown: Record<string, number>;
  difficultyBreakdown: Record<string, number>;
  poolBreakdown: Record<string, number>;
  importedDetails: ImportQuestionDetail[];
  skippedDuplicates: SkippedDuplicateDetail[];
}

export const CATEGORY_NAMES_TR: Record<CategoryId, { name: string; icon: string }> = {
  science_tech: { name: 'Bilim', icon: '⚛️' },
  history: { name: 'Tarih', icon: '🏛️' },
  geography: { name: 'Coğrafya', icon: '🌍' },
  sports: { name: 'Spor', icon: '🏀' },
  cinema_tv: { name: 'Sinema', icon: '🎬' },
  music: { name: 'Müzik', icon: '🎵' },
  art_culture: { name: 'Sanat', icon: '🎨' },
  physics_chemistry: { name: 'Teknoloji', icon: '💻' },
  nature_ecology: { name: 'Doğa', icon: '🌿' },
  biology: { name: 'Biyoloji', icon: '🧬' },
  food_gastronomy: { name: 'Yemek', icon: '🍲' },
  literature: { name: 'Edebiyat', icon: '📚' },
  space_astronomy: { name: 'Uzay', icon: '🚀' },
  animals_wildlife: { name: 'Hayvanlar', icon: '🐾' },
  mathematics: { name: 'Matematik', icon: '🔢' },
  logic_puzzles: { name: 'Oyun & Zeka', icon: '🎮' },
  language_vocab: { name: 'Dil & Kelime', icon: '💬' },
  general_culture: { name: 'Genel Kültür', icon: '💡' },
  gaming_videogames: { name: 'Video Oyunları', icon: '🎮' },
  anime_manga: { name: 'Anime & Manga', icon: '🍥' },
  cartoons_animation: { name: 'Çizgi Film', icon: '🎠' },
  comics_superheroes: { name: 'Çizgi Roman', icon: '🦸' },
  fantasy_fiction: { name: 'Fantastik', icon: '🐉' },
  social_internet: { name: 'Sosyal Medya', icon: '📱' },
  mythology_ancient: { name: 'Mitoloji', icon: '⚡' },
  hobbies_leisure: { name: 'Hobiler', icon: '🎣' },
  daily_life: { name: 'Günlük Hayat', icon: '👨‍👩‍👧' },
  turkey_special: { name: 'Türkiye', icon: '🇹🇷' },
  mixed: { name: 'Karışık Mod', icon: '🎲' },
};

export const DIFFICULTY_NAMES_TR: Record<DifficultyLevel, { name: string; color: string }> = {
  easy: { name: 'Kolay', color: '#10B981' },
  medium: { name: 'Orta', color: '#3B82F6' },
  hard: { name: 'Zor', color: '#F59E0B' },
  expert: { name: 'Uzman', color: '#EF4444' },
};

export const POOL_NAMES_TR: Record<string, string> = {
  standard: '🏆 Normal Havuz',
  daily_challenge: '📅 Günlük Meydan Okuma',
  custom_room: '⚔️ Özel Oda',
};

const CATEGORY_MAP_TR: Record<string, CategoryId> = {
  // Video Oyunları
  gaming: 'gaming_videogames',
  gaming_videogames: 'gaming_videogames',
  video_oyunlari: 'gaming_videogames',
  oyunlar: 'gaming_videogames',

  // Anime & Manga
  anime: 'anime_manga',
  manga: 'anime_manga',
  anime_manga: 'anime_manga',

  // Çizgi Film
  cartoons: 'cartoons_animation',
  cartoons_animation: 'cartoons_animation',
  cizgi_film: 'cartoons_animation',
  cizgifilm: 'cartoons_animation',

  // Çizgi Roman
  comics: 'comics_superheroes',
  comics_superheroes: 'comics_superheroes',
  cizgi_roman: 'comics_superheroes',

  // Fantastik
  fantasy: 'fantasy_fiction',
  fantasy_fiction: 'fantasy_fiction',
  fantastik: 'fantasy_fiction',

  // Sosyal Medya
  social: 'social_internet',
  social_internet: 'social_internet',
  sosyal_medya: 'social_internet',

  // Mitoloji
  mythology: 'mythology_ancient',
  mythology_ancient: 'mythology_ancient',
  mitoloji: 'mythology_ancient',

  // Hobiler
  hobbies: 'hobbies_leisure',
  hobbies_leisure: 'hobbies_leisure',
  hobiler: 'hobbies_leisure',

  // Günlük Hayat
  daily_life: 'daily_life',
  gunluk_hayat: 'daily_life',

  // Türkiye
  turkey: 'turkey_special',
  turkey_special: 'turkey_special',
  turkiye: 'turkey_special',

  // Coğrafya
  cografya: 'geography',
  coğrafya: 'geography',
  geography: 'geography',
  baskentler: 'geography',
  başkentler: 'geography',
  world_capitals: 'geography',

  // Tarih
  tarih: 'history',
  history: 'history',
  osmanli: 'history',
  osmanlı: 'history',
  ottoman_history: 'history',

  // Matematik
  matematik: 'mathematics',
  mathematics: 'mathematics',
  math: 'mathematics',

  // Genel Kültür
  genel: 'general_culture',
  genel_kultur: 'general_culture',
  'genel kültür': 'general_culture',
  general_culture: 'general_culture',
  general: 'general_culture',

  // Bilim
  bilim: 'science_tech',
  science: 'science_tech',
  science_tech: 'science_tech',
  bilim_teknoloji: 'science_tech',
  'bilim & teknoloji': 'science_tech',

  // Teknoloji
  teknoloji: 'physics_chemistry',
  technology: 'physics_chemistry',
  tech: 'physics_chemistry',
  fizik: 'physics_chemistry',
  kimya: 'physics_chemistry',
  physics_chemistry: 'physics_chemistry',

  // Uzay & Astronomi
  uzay: 'space_astronomy',
  astronomi: 'space_astronomy',
  space: 'space_astronomy',
  space_astronomy: 'space_astronomy',

  // Spor
  spor: 'sports',
  sports: 'sports',
  super_lig: 'sports',
  'süper lig': 'sports',
  super_lig_legends: 'sports',

  // Sinema & Dizi
  sinema: 'cinema_tv',
  dizi: 'cinema_tv',
  cinema: 'cinema_tv',
  cinema_tv: 'cinema_tv',
  yesilcam: 'cinema_tv',
  yeşilçam: 'cinema_tv',

  // Müzik
  muzik: 'music',
  müzik: 'music',
  music: 'music',
  turkish_pop_90s: 'music',

  // Edebiyat
  edebiyat: 'literature',
  literature: 'literature',

  // Biyoloji
  biyoloji: 'biology',
  biology: 'biology',

  // Oyun & Mantık & Zeka
  mantik: 'logic_puzzles',
  mantık: 'logic_puzzles',
  zeka: 'logic_puzzles',
  logic_puzzles: 'logic_puzzles',
  oyun: 'logic_puzzles',
  'oyun & zeka': 'logic_puzzles',
  oyun_zeka: 'logic_puzzles',
  games: 'logic_puzzles',

  // Dil & Kelime
  dil: 'language_vocab',
  kelime: 'language_vocab',
  language_vocab: 'language_vocab',

  // Sanat & Kültür
  sanat: 'art_culture',
  kultur: 'art_culture',
  kültür: 'art_culture',
  art_culture: 'art_culture',

  // Yemek & Mutfak
  yemek: 'food_gastronomy',
  mutfak: 'food_gastronomy',
  gastronomi: 'food_gastronomy',
  food_gastronomy: 'food_gastronomy',
  food: 'food_gastronomy',

  // Hayvanlar Alemi
  hayvan: 'animals_wildlife',
  hayvanlar: 'animals_wildlife',
  animals: 'animals_wildlife',
  wildlife: 'animals_wildlife',
  animals_wildlife: 'animals_wildlife',

  // Doğa & Ekoloji
  doga: 'nature_ecology',
  doğa: 'nature_ecology',
  ekoloji: 'nature_ecology',
  nature: 'nature_ecology',
  nature_ecology: 'nature_ecology',

  // Karma / Karışık Mod
  karma: 'mixed',
  mixed: 'mixed',
  karisik: 'mixed',
  karışık: 'mixed',
};

const DIFFICULTY_MAP_TR: Record<string, DifficultyLevel> = {
  kolay: 'easy',
  easy: 'easy',
  orta: 'medium',
  medium: 'medium',
  zor: 'hard',
  hard: 'hard',
  uzman: 'expert',
  expert: 'expert',
  // Şablon dosyasındaki Türkçe etiketler: Kolay / Standart / Zor / Çok Zor
  standart: 'medium',
  standard: 'medium',
  'çok zor': 'expert',
  'cok zor': 'expert',
  cok_zor: 'expert',
  çok_zor: 'expert',
  very_hard: 'expert',
};

/**
 * Alt kategori değerini (id veya ad) kategorinin kanonik adına çevirir.
 * Sayaçlar ve soru seçimi alt kategori ADI üzerinden çalıştığı için id ile
 * yüklenen sorular da (ör. "capitals_currencies") doğru gruba düşer.
 */
export function resolveSubCategoryName(categoryId: string, rawSub: unknown): string | undefined {
  if (rawSub === undefined || rawSub === null) return undefined;
  const value = String(rawSub).trim();
  if (!value) return undefined;
  const key = value.toLowerCase().replace(/[’`´]/g, "'");
  const norm = (t: string) => t.trim().toLowerCase().replace(/[’`´]/g, "'");
  const cat = ALL_CATEGORIES.find((c) => c.id === categoryId);
  const match = cat?.subCategories?.find((sc) => sc.id.toLowerCase() === key || norm(sc.name) === key);
  return match ? match.name : value;
}

export function parseAndNormalizeQuestions(rawInput: any): any[] {
  console.log('🔍 [questionImporter] parseAndNormalizeQuestions çağrıldı, girdi tipi:', typeof rawInput);

  if (rawInput === undefined || rawInput === null || rawInput === '') {
    throw new Error('JSON verisi boş gönderilemez.');
  }

  // 1. Girdi zaten bir dizi ise doğrudan dön
  if (Array.isArray(rawInput)) {
    console.log(`✅ [questionImporter] Girdi doğrudan ${rawInput.length} elemanlı dizi olarak algılandı.`);
    return rawInput;
  }

  // 2. Girdi bir obje ise alt alanları incele
  if (typeof rawInput === 'object' && rawInput !== null) {
    if (Array.isArray(rawInput.questions)) {
      console.log(`✅ [questionImporter] 'questions' dizisi bulundu (${rawInput.questions.length} soru).`);
      return rawInput.questions;
    }
    if (Array.isArray(rawInput.sorular)) {
      console.log(`✅ [questionImporter] 'sorular' dizisi bulundu (${rawInput.sorular.length} soru).`);
      return rawInput.sorular;
    }
    if (typeof rawInput.jsonContent === 'string') {
      return parseAndNormalizeQuestions(rawInput.jsonContent);
    }
    if (typeof rawInput.json === 'string') {
      return parseAndNormalizeQuestions(rawInput.json);
    }
    if (typeof rawInput.content === 'string') {
      return parseAndNormalizeQuestions(rawInput.content);
    }
    if (rawInput.text || rawInput.soru || rawInput.question) {
      console.log('✅ [questionImporter] Tek bir soru objesi algılandı.');
      return [rawInput];
    }
    // Sayısal indexli obje kontrolü ({ "0": {...}, "1": {...} })
    const values = Object.values(rawInput);
    if (values.length > 0 && typeof values[0] === 'object' && values[0] !== null) {
      console.log(`✅ [questionImporter] Sayısal/anahtarlı obje dizisi dönüştürüldü (${values.length} soru).`);
      return values;
    }
  }

  // 3. Girdi string ise
  const strInput = String(rawInput);
  let cleaned = strInput.trim();

  // Markdown kod bloklarını temizle (metin başında veya içinde ```json ... ``` varsa ayıkla)
  const mdMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (mdMatch) {
    cleaned = mdMatch[1].trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  // Akıllı / kıvrık tırnakları standart tırnaklara dönüştür
  cleaned = cleaned
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'");

  console.log(`🔍 [questionImporter] Metin ayrıştırılıyor (karakter uzunluğu: ${cleaned.length})...`);

  // Adım 3.1: Doğrudan JSON.parse denemesi
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      console.log(`✅ [questionImporter] Standart JSON.parse başarılı (${parsed.length} soru).`);
      return parsed;
    }
    if (typeof parsed === 'object' && parsed !== null) {
      if (Array.isArray(parsed.questions)) return parsed.questions;
      if (Array.isArray(parsed.sorular)) return parsed.sorular;
      return [parsed];
    }
  } catch (parseError: any) {
    console.warn(`⚠️ [questionImporter] Standart JSON.parse başarısız (${parseError.message}), esnek onarım deneniyor...`);
  }

  // Adım 3.2: Yorumları ve virgülden sonra gelen gereksiz virgülleri (trailing comma) temizle
  let sanitized = cleaned
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,\s*([}\]])/g, '$1');

  try {
    const parsed = JSON.parse(sanitized);
    if (Array.isArray(parsed)) {
      console.log(`✅ [questionImporter] Trailing comma temizliğiyle başarıyla çözüldü (${parsed.length} soru).`);
      return parsed;
    }
    if (typeof parsed === 'object' && parsed !== null) {
      if (Array.isArray(parsed.questions)) return parsed.questions;
      if (Array.isArray(parsed.sorular)) return parsed.sorular;
      return [parsed];
    }
  } catch {}

  // Adım 3.3: Tırnaksız veya tek tırnaklı anahtarları çift tırnak yap (örn: { text: '...' } -> { "text": "..." })
  let relaxed = sanitized
    .replace(/([{,]\s*)(['"]?)([a-zA-Z0-9_]+)\2(\s*:)/g, '$1"$3"$4')
    .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, ': "$1"')
    .replace(/\[\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, '["$1"')
    .replace(/,\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, ', "$1"')
    .replace(/,\s*([}\]])/g, '$1');

  try {
    const parsed = JSON.parse(relaxed);
    if (Array.isArray(parsed)) {
      console.log(`✅ [questionImporter] Esnek regex tırnak onarımıyla çözüldü (${parsed.length} soru).`);
      return parsed;
    }
    if (typeof parsed === 'object' && parsed !== null) {
      if (Array.isArray(parsed.questions)) return parsed.questions;
      if (Array.isArray(parsed.sorular)) return parsed.sorular;
      return [parsed];
    }
  } catch {}

  // Adım 3.4: Metin içindeki tüm tekil { ... } soru objelerini ayıkla (dizi parantezi veya aradaki virgül bozuk olsa dahi kurtar)
  const extractedList: any[] = [];
  const objRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  let match: RegExpExecArray | null;
  while ((match = objRegex.exec(sanitized)) !== null) {
    const candidate = match[0].trim();
    try {
      const singleObj = JSON.parse(candidate.replace(/,\s*}/g, '}'));
      if (singleObj && (singleObj.text || singleObj.soru || singleObj.question)) {
        extractedList.push(singleObj);
      }
    } catch {
      try {
        const repairedSingle = candidate
          .replace(/([{,]\s*)(['"]?)([a-zA-Z0-9_]+)\2(\s*:)/g, '$1"$3"$4')
          .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, ': "$1"')
          .replace(/\[\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, '["$1"')
          .replace(/,\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, ', "$1"')
          .replace(/,\s*}/g, '}');
        const singleObj = JSON.parse(repairedSingle);
        if (singleObj && (singleObj.text || singleObj.soru || singleObj.question)) {
          extractedList.push(singleObj);
        }
      } catch {}
    }
  }

  if (extractedList.length > 0) {
    console.log(`✅ [questionImporter] Parçalı regex kurtarma ile ${extractedList.length} adet soru objesi başarıyla kurtarıldı!`);
    return extractedList;
  }

  // Ayrıştırma tamamen başarısız: Satır numaralı ayrıntılı hata üret
  const lines = cleaned.split('\n');
  let errLineNum = 1;
  let lineSnippet = lines[0] || '';
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (line.includes('{') || line.includes('}') || line.includes('"')) {
      errLineNum = idx + 1;
      lineSnippet = line.trim();
    }
  }

  const snippet = cleaned.length > 120 ? cleaned.slice(0, 120) + '...' : cleaned;
  console.error('❌ [questionImporter] Geçersiz JSON içeriği:\n', snippet);

  throw new Error(
    `Geçerli bir JSON formatı bulunamadı (Olası hata Satır ${errLineNum}: "${lineSnippet}"). Lütfen çift tırnak ve virgül dizilimini kontrol edin veya "Örnek Şablon" butonuna dokunarak şablonu inceleyin.`
  );
}

export function importQuestionsFromJson(
  rawInput: any,
  db: DatabaseAdapter,
  addedBy = 'Telegram Admin',
  publishDirectly = true,
  defaultTargetPool: 'standard' | 'daily_challenge' | 'custom_room' = 'standard'
): ImportResult {
  const result: ImportResult = {
    success: false,
    totalProcessed: 0,
    importedCount: 0,
    duplicateCount: 0,
    templateSkippedCount: 0,
    errorCount: 0,
    questions: [],
    errors: [],
    categoryBreakdown: {},
    difficultyBreakdown: {},
    poolBreakdown: {},
    importedDetails: [],
    skippedDuplicates: [],
  };

  let rawList: any[] = [];
  try {
    rawList = parseAndNormalizeQuestions(rawInput);
  } catch (err: any) {
    console.error('❌ [questionImporter] Ayrıştırma hatası:', err.message);
    result.errors.push(err.message);
    return result;
  }

  result.totalProcessed = rawList.length;
  console.log(`🚀 [questionImporter] Toplam ${rawList.length} soru işleniyor. Hedef Havuz: ${defaultTargetPool}, Yayın Durumu: ${publishDirectly ? 'Doğrudan Yayın' : 'Onay Sırası'}`);

  if (rawList.length === 0) {
    result.errors.push('İçeride soru verisi bulunamadı.');
    return result;
  }

  const existingQuestions = db.getAllQuestions();
  const existingSignatures = new Set(
    existingQuestions.map((q) => q.text.toLowerCase().replace(/[^a-z0-9ğüşıöç]/gi, '').trim())
  );

  for (let i = 0; i < rawList.length; i++) {
    const raw = rawList[i];
    const indexLabel = `Soru #${i + 1}`;

    const text = (raw.text || raw.soru || raw.question || raw.title || '').trim();
    if (!text || text.length < 5) {
      result.errorCount++;
      result.errors.push(`${indexLabel}: Soru metni çok kısa veya eksik.`);
      continue;
    }

    // Şablon dosyasındaki henüz doldurulmamış satırlar ("DOLDUR: ...") sessizce atlanır;
    // böylece şablon olduğu gibi yüklense bile veritabanına yer tutucu soru girmez.
    if (/^doldur\s*:/i.test(text)) {
      result.templateSkippedCount++;
      continue;
    }

    const textSig = text.toLowerCase().replace(/[^a-z0-9ğüşıöç]/gi, '').trim();
    if (existingSignatures.has(textSig)) {
      result.duplicateCount++;
      result.skippedDuplicates.push({
        text: text.slice(0, 90),
        matchedSignature: textSig,
      });
      console.warn(`🔁 [questionImporter] ${indexLabel} mükerrer atlandı: "${text.slice(0, 35)}..."`);
      continue;
    }

    // Determine category
    const rawCat = (raw.categoryId || raw.kategori || raw.category || 'general_culture')
      .toString()
      .toLowerCase()
      .trim();
    const categoryId: CategoryId = CATEGORY_MAP_TR[rawCat] || 'general_culture';

    // Determine difficulty
    const rawDiff = (raw.difficulty || raw.zorluk || 'medium')
      .toString()
      .toLowerCase()
      .trim();
    const difficulty: DifficultyLevel = DIFFICULTY_MAP_TR[rawDiff] || 'medium';

    // Options extraction
    let options: QuestionOption[] = [];
    const rawOptions = raw.options || raw.secenekler || raw.choices;

    if (Array.isArray(rawOptions)) {
      options = rawOptions.map((opt: any, idx: number) => {
        if (typeof opt === 'string') {
          return { id: `opt_${String.fromCharCode(97 + idx)}`, text: opt.trim() };
        }
        return {
          id: opt.id || `opt_${String.fromCharCode(97 + idx)}`,
          text: (opt.text || opt.secenek || String(opt)).trim(),
        };
      });
    } else if (typeof rawOptions === 'object' && rawOptions !== null) {
      const keys = Object.keys(rawOptions);
      options = keys.map((k, idx) => ({
        id: `opt_${String.fromCharCode(97 + idx)}`,
        text: String(rawOptions[k]).trim(),
      }));
    }

    if (options.length < 4) {
      result.errorCount++;
      result.errors.push(`${indexLabel} ("${text.slice(0, 30)}..."): 4 seçenek bulunmalıdır (bulunan: ${options.length}).`);
      continue;
    }
    options = options.slice(0, 4);

    // Determine correct option id
    let correctOptionId = 'opt_a';
    if (typeof raw.correctAnswerIndex === 'number' && raw.correctAnswerIndex >= 0 && raw.correctAnswerIndex < 4) {
      correctOptionId = options[raw.correctAnswerIndex].id;
    } else if (raw.correctOptionId && options.some((o) => o.id === raw.correctOptionId)) {
      correctOptionId = raw.correctOptionId;
    } else if (raw.dogruCevap) {
      const val = String(raw.dogruCevap).trim();
      const upper = val.toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(upper)) {
        const idx = upper.charCodeAt(0) - 65;
        correctOptionId = options[idx]?.id || 'opt_a';
      } else {
        // Text match
        const matchedOpt = options.find((o) => o.text.toLowerCase() === val.toLowerCase());
        if (matchedOpt) {
          correctOptionId = matchedOpt.id;
        }
      }
    }

    const explanation =
      (raw.explanation || raw.aciklama || 'Genel kültür ve bilimsel kaynaklarca doğrulanmış bilgidir.').trim();
    const sourceOrVerification = (raw.sourceOrVerification || raw.kaynak || addedBy).trim();

    // Target pool
    let targetPool: 'standard' | 'daily_challenge' | 'custom_room' = defaultTargetPool;
    const rawPool = (raw.targetPool || raw.havuz || '').toString().toLowerCase();
    if (rawPool.includes('gunluk') || rawPool.includes('daily')) {
      targetPool = 'daily_challenge';
    } else if (rawPool.includes('ozel') || rawPool.includes('custom') || rawPool.includes('oda')) {
      targetPool = 'custom_room';
    } else if (rawPool.includes('standard') || rawPool.includes('standart') || rawPool.includes('normal')) {
      targetPool = 'standard';
    }

    try {
      const created = db.createQuestion({
        categoryId,
        subCategory: resolveSubCategoryName(
          categoryId,
          raw.subCategoryId || raw.subCategory || raw.altKategori || raw.altKategoriId
        ),
        difficulty,
        text,
        options,
        correctOptionId,
        explanation,
        sourceOrVerification,
        reviewStatus: publishDirectly ? 'published' : 'pending_review',
        targetPool,
        isDailyChallenge: targetPool === 'daily_challenge',
        isCustomRoomOnly: targetPool === 'custom_room',
        reviewedBy: publishDirectly ? addedBy : undefined,
        reviewedAt: publishDirectly ? new Date().toISOString() : undefined,
      });

      result.importedCount++;
      result.questions.push(created);
      existingSignatures.add(textSig);
      result.categoryBreakdown[categoryId] = (result.categoryBreakdown[categoryId] || 0) + 1;
      result.difficultyBreakdown[difficulty] = (result.difficultyBreakdown[difficulty] || 0) + 1;
      result.poolBreakdown[targetPool] = (result.poolBreakdown[targetPool] || 0) + 1;

      const correctOpt = options.find((o) => o.id === correctOptionId);
      result.importedDetails.push({
        id: created.id,
        text: created.text,
        categoryId,
        categoryName: CATEGORY_NAMES_TR[categoryId]?.name || categoryId,
        categoryIcon: CATEGORY_NAMES_TR[categoryId]?.icon || '❓',
        difficulty,
        difficultyName: DIFFICULTY_NAMES_TR[difficulty]?.name || difficulty,
        targetPool,
        poolName: POOL_NAMES_TR[targetPool] || targetPool,
        options: options.map((o) => o.text),
        correctAnswer: correctOpt?.text || '',
      });

      console.log(`✅ [questionImporter] ${indexLabel} eklendi: "${text.slice(0, 35)}..." [${categoryId} / ${difficulty} / ${targetPool}]`);
    } catch (saveErr: any) {
      result.errorCount++;
      const errMsg = `${indexLabel}: Kayıt hatası: ${saveErr.message}`;
      console.error(`❌ [questionImporter] ${errMsg}`);
      result.errors.push(errMsg);
    }
  }

  result.success = result.importedCount > 0;
  console.log(`🏁 [questionImporter] İşlem tamamlandı. Eklenen: ${result.importedCount}, Mükerrer: ${result.duplicateCount}, Hatalı: ${result.errorCount}`);
  return result;
}

export const SAMPLE_QUESTION_JSON = `[
  {
    "text": "Türkiye'nin başkenti hangi ilimizdir?",
    "options": ["Ankara", "İstanbul", "İzmir", "Bursa"],
    "correctAnswerIndex": 0,
    "categoryId": "geography",
    "difficulty": "easy",
    "explanation": "Ankara 13 Ekim 1923'te Türkiye'nin başkenti ilan edilmiştir.",
    "targetPool": "standard"
  },
  {
    "text": "Fatih Sultan Mehmet İstanbul'u kaç yılında fethetmiştir?",
    "options": ["1453", "1071", "1299", "1923"],
    "correctAnswerIndex": 0,
    "categoryId": "history",
    "difficulty": "easy",
    "explanation": "İstanbul 29 Mayıs 1453 tarihinde fethedilmiştir.",
    "targetPool": "standard"
  },
  {
    "text": "Periyodik tabloda 'Au' sembolü hangi elementi temsil eder?",
    "options": ["Altın", "Gümüş", "Bakır", "Alüminyum"],
    "correctAnswerIndex": 0,
    "categoryId": "physics_chemistry",
    "difficulty": "medium",
    "explanation": "Au, Latince 'Aurum' kelimesinden gelen Altın elementinin sembolüdür.",
    "targetPool": "daily_challenge"
  }
]`;
