"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAMPLE_QUESTION_JSON = exports.POOL_NAMES_TR = exports.DIFFICULTY_NAMES_TR = exports.CATEGORY_NAMES_TR = void 0;
exports.parseAndNormalizeQuestions = parseAndNormalizeQuestions;
exports.importQuestionsFromJson = importQuestionsFromJson;
exports.CATEGORY_NAMES_TR = {
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
    mixed: { name: 'Karışık Mod', icon: '🎲' },
};
exports.DIFFICULTY_NAMES_TR = {
    easy: { name: 'Kolay', color: '#10B981' },
    medium: { name: 'Orta', color: '#3B82F6' },
    hard: { name: 'Zor', color: '#F59E0B' },
    expert: { name: 'Uzman', color: '#EF4444' },
};
exports.POOL_NAMES_TR = {
    standard: '🏆 Normal Havuz',
    daily_challenge: '📅 Günlük Meydan Okuma',
    custom_room: '⚔️ Özel Oda',
};
const CATEGORY_MAP_TR = {
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
    gaming: 'logic_puzzles',
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
const DIFFICULTY_MAP_TR = {
    kolay: 'easy',
    easy: 'easy',
    orta: 'medium',
    medium: 'medium',
    zor: 'hard',
    hard: 'hard',
    uzman: 'expert',
    expert: 'expert',
};
function parseAndNormalizeQuestions(rawInput) {
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
    // Markdown kod bloklarını temizle (```json ... ``` veya ``` ... ```)
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
    console.log(`🔍 [questionImporter] Metin ayrıştırılıyor (karakter uzunluğu: ${cleaned.length})...`);
    // Doğrudan JSON.parse denemesi
    try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
            console.log(`✅ [questionImporter] Standart JSON.parse başarılı (${parsed.length} soru).`);
            return parsed;
        }
        if (typeof parsed === 'object' && parsed !== null) {
            if (Array.isArray(parsed.questions))
                return parsed.questions;
            if (Array.isArray(parsed.sorular))
                return parsed.sorular;
            return [parsed];
        }
    }
    catch (parseError) {
        console.warn(`⚠️ [questionImporter] Doğrudan JSON.parse başarısız (${parseError.message}), kurtarma deneniyor...`);
    }
    // Regex kurtarma 1: Köşeli parantez içindeki dizi [ { ... }, { ... } ]
    const arrayMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
        try {
            const parsed = JSON.parse(arrayMatch[0]);
            if (Array.isArray(parsed)) {
                console.log(`✅ [questionImporter] Regex dizi eşleşmesiyle kurtarıldı (${parsed.length} soru).`);
                return parsed;
            }
        }
        catch (arrErr) {
            console.warn('⚠️ [questionImporter] Regex dizi JSON.parse hatası:', arrErr.message);
        }
    }
    // Regex kurtarma 2: Süslü parantez içindeki tekil obje { ... }
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
        try {
            const parsed = JSON.parse(objMatch[0]);
            if (typeof parsed === 'object' && parsed !== null) {
                console.log('✅ [questionImporter] Regex tekil obje eşleşmesiyle kurtarıldı (1 soru).');
                return [parsed];
            }
        }
        catch (objErr) {
            console.warn('⚠️ [questionImporter] Regex tekil obje JSON.parse hatası:', objErr.message);
        }
    }
    const snippet = cleaned.length > 140 ? cleaned.slice(0, 140) + '...' : cleaned;
    console.error('❌ [questionImporter] Geçersiz JSON içeriği:\n', snippet);
    throw new Error(`Geçerli bir JSON formatı bulunamadı. Lütfen JSON sözdizimini (çift tırnaklar, virgüller, köşeli parantezler) kontrol edin.\nÖnizleme: "${snippet}"`);
}
function importQuestionsFromJson(rawInput, db, addedBy = 'Telegram Admin', publishDirectly = true, defaultTargetPool = 'standard') {
    const result = {
        success: false,
        totalProcessed: 0,
        importedCount: 0,
        duplicateCount: 0,
        errorCount: 0,
        questions: [],
        errors: [],
        categoryBreakdown: {},
        difficultyBreakdown: {},
        poolBreakdown: {},
        importedDetails: [],
        skippedDuplicates: [],
    };
    let rawList = [];
    try {
        rawList = parseAndNormalizeQuestions(rawInput);
    }
    catch (err) {
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
    const existingSignatures = new Set(existingQuestions.map((q) => q.text.toLowerCase().replace(/[^a-z0-9ğüşıöç]/gi, '').trim()));
    for (let i = 0; i < rawList.length; i++) {
        const raw = rawList[i];
        const indexLabel = `Soru #${i + 1}`;
        const text = (raw.text || raw.soru || raw.question || raw.title || '').trim();
        if (!text || text.length < 5) {
            result.errorCount++;
            result.errors.push(`${indexLabel}: Soru metni çok kısa veya eksik.`);
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
        const categoryId = CATEGORY_MAP_TR[rawCat] || 'general_culture';
        // Determine difficulty
        const rawDiff = (raw.difficulty || raw.zorluk || 'medium')
            .toString()
            .toLowerCase()
            .trim();
        const difficulty = DIFFICULTY_MAP_TR[rawDiff] || 'medium';
        // Options extraction
        let options = [];
        const rawOptions = raw.options || raw.secenekler || raw.choices;
        if (Array.isArray(rawOptions)) {
            options = rawOptions.map((opt, idx) => {
                if (typeof opt === 'string') {
                    return { id: `opt_${String.fromCharCode(97 + idx)}`, text: opt.trim() };
                }
                return {
                    id: opt.id || `opt_${String.fromCharCode(97 + idx)}`,
                    text: (opt.text || opt.secenek || String(opt)).trim(),
                };
            });
        }
        else if (typeof rawOptions === 'object' && rawOptions !== null) {
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
        }
        else if (raw.correctOptionId && options.some((o) => o.id === raw.correctOptionId)) {
            correctOptionId = raw.correctOptionId;
        }
        else if (raw.dogruCevap) {
            const val = String(raw.dogruCevap).trim();
            const upper = val.toUpperCase();
            if (['A', 'B', 'C', 'D'].includes(upper)) {
                const idx = upper.charCodeAt(0) - 65;
                correctOptionId = options[idx]?.id || 'opt_a';
            }
            else {
                // Text match
                const matchedOpt = options.find((o) => o.text.toLowerCase() === val.toLowerCase());
                if (matchedOpt) {
                    correctOptionId = matchedOpt.id;
                }
            }
        }
        const explanation = (raw.explanation || raw.aciklama || 'Genel kültür ve bilimsel kaynaklarca doğrulanmış bilgidir.').trim();
        const sourceOrVerification = (raw.sourceOrVerification || raw.kaynak || addedBy).trim();
        // Target pool
        let targetPool = defaultTargetPool;
        const rawPool = (raw.targetPool || raw.havuz || '').toString().toLowerCase();
        if (rawPool.includes('gunluk') || rawPool.includes('daily')) {
            targetPool = 'daily_challenge';
        }
        else if (rawPool.includes('ozel') || rawPool.includes('custom') || rawPool.includes('oda')) {
            targetPool = 'custom_room';
        }
        else if (rawPool.includes('standard') || rawPool.includes('standart') || rawPool.includes('normal')) {
            targetPool = 'standard';
        }
        try {
            const created = db.createQuestion({
                categoryId,
                subCategory: raw.subCategory || raw.altKategori || undefined,
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
                categoryName: exports.CATEGORY_NAMES_TR[categoryId]?.name || categoryId,
                categoryIcon: exports.CATEGORY_NAMES_TR[categoryId]?.icon || '❓',
                difficulty,
                difficultyName: exports.DIFFICULTY_NAMES_TR[difficulty]?.name || difficulty,
                targetPool,
                poolName: exports.POOL_NAMES_TR[targetPool] || targetPool,
                options: options.map((o) => o.text),
                correctAnswer: correctOpt?.text || '',
            });
            console.log(`✅ [questionImporter] ${indexLabel} eklendi: "${text.slice(0, 35)}..." [${categoryId} / ${difficulty} / ${targetPool}]`);
        }
        catch (saveErr) {
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
exports.SAMPLE_QUESTION_JSON = `[
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
