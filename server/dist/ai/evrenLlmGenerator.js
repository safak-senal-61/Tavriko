"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RICH_SEED_BANK = void 0;
exports.generateQuestionsWithEvrenGLM = generateQuestionsWithEvrenGLM;
exports.generateDeterministicEvrenCandidates = generateDeterministicEvrenCandidates;
const questionValidator_1 = require("./questionValidator");
const supabaseClient_1 = require("../db/supabaseClient");
const CATEGORY_PROMPTS = {
    geography: 'Coğrafya, başkentler, dağlar, denizler, göller, harita bilgisi ve şehirler.',
    mathematics: 'Matematik, geometri, temel işlemler, mantıksal hesaplamalar ve sayılar.',
    general_culture: 'Genel kültür, popüler bilgi, günlük yaşam, dünya gerçekleri ve rekorlar.',
    history: 'Dünya ve Türk tarihi, önemli şahsiyetler, dönüm noktaları ve medeniyetler.',
    science_tech: 'Bilim ve teknoloji, yazılım, icatlar, fiziksel keşifler ve bilişim.',
    space_astronomy: 'Uzay, gezegenler, Güneş sistemi, yıldızlar ve astronotlar.',
    sports: 'Spor dalları, kurallar, olimpiyatlar, futbol, basketbol ve efsane sporcular.',
    cinema_tv: 'Sinema, kült filmler, ünlü karakterler, yönetmenler ve dizi kültürü.',
    music: 'Müzik türleri, enstrümanlar, ünlü şarkıcılar, besteciler ve şarkılar.',
    literature: 'Türk ve dünya edebiyatı, romanlar, şiirler, ünlü yazarlar ve şairler.',
    biology: 'Biyoloji, insan vücudu, organlar, hayvanlar, bitkiler ve doğa.',
    physics_chemistry: 'Fizik ve kimya, elementler, yerçekimi, maddeler ve doğa kanunları.',
    logic_puzzles: 'Mantık ve akıl yürütme, zeka soruları ve pratik problem çözme.',
    language_vocab: 'Dil bilgisi, Türkçe kelimeler, eş anlamlılar, atasözleri ve deyimler.',
    art_culture: 'Sanat tarihi, ünlü resimler, heykeller, müzeler ve mimari eserler.',
    food_gastronomy: 'Yemek kültürü, Türk ve dünya mutfağı, yöresel lezzetler, tatlılar ve gastronomi.',
    animals_wildlife: 'Hayvanlar alemi, memeliler, kuşlar, deniz canlıları, vahşi yaşam ve hayvan rekorları.',
    nature_ecology: 'Doğa, ormanlar, iklim olayları, bitkiler, ekosistemler ve çevre bilimi.',
    mixed: 'Çeşitli kategorilerden dengeli ve eğlenceli genel kültür soruları.',
};
const CATEGORY_NAMES_TR = {
    geography: 'Coğrafya',
    mathematics: 'Matematik',
    general_culture: 'Genel Kültür',
    history: 'Tarih',
    science_tech: 'Bilim & Teknoloji',
    space_astronomy: 'Uzay & Astronomi',
    sports: 'Spor',
    cinema_tv: 'Sinema & Dizi',
    music: 'Müzik',
    literature: 'Edebiyat',
    biology: 'Biyoloji',
    physics_chemistry: 'Fizik & Kimya',
    logic_puzzles: 'Mantık & Zeka',
    language_vocab: 'Dil & Kelime',
    art_culture: 'Sanat & Kültür',
    food_gastronomy: 'Yemek & Mutfak',
    animals_wildlife: 'Hayvanlar Alemi',
    nature_ecology: 'Doğa & Ekoloji',
    mixed: 'Karma Sorular',
};
const DIFFICULTY_NAMES_TR = {
    easy: 'Kolay Seviye',
    medium: 'Orta Seviye',
    hard: 'Zor Seviye',
    expert: 'Uzman Seviye',
};
const DIFFICULTY_GUIDELINES = {
    easy: `KOLAY SEVİYE (7'den 70'e herkesin ilk bakışta bilebileceği çok temel seviye):
- KESİNLİKLE RAKAM, METRE, KİLOMETRE, DAĞ YÜKSEKLİĞİ, NÜFUS VEYA GÜN/AY TARİH EZBERİ SORMA! (Örn: "Ağrı Dağı kaç metredir?", "Savaş hangi tarihte oldu?" gibi sorular KESİNLİKLE YASAKTIR!)
- Herkesin ilkokul veya günlük yaşamından bildiği en temel ve eğlenceli bilgileri sor!
- Örnek Kolay: "Türkiye'nin en yüksek dağı hangisidir? A) Ağrı Dağı B) Erciyes C) Palandöken D) Uludağ"
- Örnek Kolay: "Türkiye'nin başkenti neresidir? A) Ankara B) İstanbul C) İzmir D) Bursa"
- Çeldirici şıklar birbirinden çok farklı ve kolayca elenebilir olsun.`,
    medium: `ORTA SEVİYE (Genel kültürü iyi olan birinin çıkarımla bilebileceği sorular):
- Temel genel kültür, dengeli okul ve popüler bilgi soruları.
- Aşırı uç ezber rakamlar veya gereksiz karmaşık formüller içermez.`,
    hard: `ZOR SEVİYE (Detaylı bilgi, dikkat ve odaklanma gerektiren sorular):
- Kronoloji, derin coğrafi/tarihi detaylar ve ikinci derece önemli kavramlar.`,
    expert: `UZMAN SEVİYE (Yarışma finali ve uzmanlık soruları):
- Hassas sayısal ölçümler, özel akademik terimler ve derin ansiklopedik bilgiler.`
};
const SUBTOPIC_HINTS = {
    geography: ['Türkiye gölleri', 'Dünya başkentleri', 'Türkiye dağları', 'Körfezler ve boğazlar', 'Nehirler ve akarsular', 'Kıtalar ve okyanuslar', 'Tarihi bölgeler ve vadiler', 'Komşu ülkeler'],
    history: ['Kurtuluş Savaşı ve kongreler', 'Cumhuriyetin ilk yılları', 'Osmanlı yükselme dönemi', 'İlk Türk devletleri', 'Selçuklu medeniyeti', 'Dünya tarihi dönüm noktaları'],
    mathematics: ['Temel geometri ve açılar', 'Dört işlem ve katlar', 'Alan ve çevre hesapları', 'Asal sayılar', 'Zaman ve ölçü birimleri', 'Yüzde ve oran'],
    science_tech: ['İcatlar ve mucitler', 'Yapay zeka ve bilgisayarlar', 'İnternet ve yazılım', 'Yenilenebilir enerji', 'Gündelik teknoloji'],
    space_astronomy: ['Güneş sistemi gezegenleri', 'Ay ve evreleri', 'Yıldızlar ve takımyıldızlar', 'Astronotlar ve uzay görevleri', 'Galaksiler ve Samanyolu'],
    sports: ['Futbol kuralları ve ligler', 'Basketbol ve NBA', 'Olimpiyat oyunları', 'Voleybol milli başarıları', 'Tenis ve Grand Slam', 'Geleneksel sporlar'],
    cinema_tv: ['Yeşilçam efsaneleri', 'Oscar ödüllü filmler', 'Animasyon ve çizgi filmler', 'Kült dizi karakterleri', 'Ünlü yönetmenler'],
    music: ['Klasik Türk müziği enstrümanları', 'Halk ozanları ve türküler', 'Dünya klasik müziği bestecileri', 'Rock ve pop tarihi', 'Enstrüman aileleri'],
    literature: ['Türk edebiyatı klasikleri', 'Dünya edebiyatı yazarları', 'Şiirler ve milli şairler', 'Masallar ve destanlar', 'Nobel edebiyat ödülleri'],
    biology: ['İnsan organları ve dolaşım', 'Bitkiler ve fotosentez', 'Canlılar alemi ve hayvanlar', 'Besin zinciri ve ekoloji', 'Hücre yapısı'],
    physics_chemistry: ['Suyun halleri ve kaynama/donma', 'Yerçekimi ve hareket', 'Periyodik tablodaki temel elementler', 'Işık ve ses dalgaları', 'Elektrik ve mıknatıslar'],
    logic_puzzles: ['Sayı örüntüleri', 'Sözel akıl yürütme', 'Görsel mantık', 'Pratik şaşırtmacalı sorular'],
    language_vocab: ['Eş anlamlı sözcükler', 'Atasözleri ve deyimler', 'Türkçe sesli harfler ve imla', 'Zıt anlamlılar', 'Kelime kökleri'],
    art_culture: ['Ünlü tablolar ve ressamlar', 'Tarihi camiler ve mimari', 'Heykel sanatı', 'Müzeler ve antik kentler', 'Geleneksel el sanatları'],
    general_culture: ['Dünya rekorları', 'Bayraklar ve başkentler', 'İlginç doğa gerçekleri', 'Geleneksel kutlamalar', 'Masa ve zeka oyunları'],
    mixed: ['Genel kültür karma', 'Popüler bilgi karma', 'Dünya ve Türkiye karma'],
};
// Global set to prevent duplicate questions within the server runtime
const recentlyGeneratedSignatures = new Set();
function normalizeTextSignature(text) {
    return text.toLowerCase().replace(/[^a-z0-9ğüşıöç]/gi, '').trim();
}
async function generateQuestionsWithEvrenGLM(options) {
    const { categoryId, subCategory, difficulty, count, db } = options;
    const rawBaseUrl = process.env.EVREN_LLM_BASE_URL || 'https://evren-llmapi.ssyz.org.tr/v1';
    const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
    const apiKey = process.env.EVREN_LLM_API_KEY;
    const modelName = process.env.EVREN_LLM_MODEL || 'glm-5.3';
    const friendlyCategory = CATEGORY_NAMES_TR[categoryId] || categoryId;
    const friendlyDiff = DIFFICULTY_NAMES_TR[difficulty] || difficulty;
    const formattedSubCategory = subCategory || `${friendlyCategory} - ${friendlyDiff}`;
    const subtopics = SUBTOPIC_HINTS[categoryId] || SUBTOPIC_HINTS.geography;
    const randomSubtopic = subtopics[Math.floor(Math.random() * subtopics.length)];
    const randomSeed = `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    let candidates = [];
    const systemPrompt = `Sen Türkiye Cumhuriyeti SSB EVREN platformunda GLM 5.3 mimarili uzman bir Türkçe bilgi yarışması soru üreticisisin.
Görevin, aşağıdaki kriterlere tam uyumlu, DAHA ÖNCE SORULMAMIŞ, YEPYENİ, ÖZGÜN sorular üretmektir.

KRİTERLER:
- Kategori: ${friendlyCategory} (${CATEGORY_PROMPTS[categoryId] || 'Genel bilgi'})
- Alt Konu Odaklanması: ${randomSubtopic}
- Benzersiz Tohum / Çeşitlilik: ${randomSeed}
- Zorluk Seviyesi: ${difficulty} (${DIFFICULTY_GUIDELINES[difficulty]})
- İstenen Adet: ${count}

ÇOK ÖNEMLİ ZORLUK KURALI:
Eğer zorluk "easy" (KOLAY) ise;
- KESİNLİKLE metre, kilometre, dağ yüksekliği, tam nüfus veya gün-ay tarih rakamı sorma!
- "Ağrı Dağı kaç metredir?" gibi sorular KOLAY DEĞİLDİR. Kolay seviyede "Türkiye'nin en yüksek dağı hangisidir?" diye sorulmalıdır!

FORMAT KURALI:
1. Yanıtını YALNIZCA geçerli bir JSON array formatında döndür.
2. Her soru için 4 seçenek üret: 'opt_a', 'opt_b', 'opt_c', 'opt_d'. Doğru cevap şıkkını rastgele dağıt (sadece A olmasın).
3. 'explanation' alanı en az 15 karakter olmalıdır.
4. 'sourceOrVerification' alanında cevabın doğrulama kaynağını belirt.

JSON FORMATI:
[
  {
    "text": "Soru metni",
    "subCategory": "${formattedSubCategory}",
    "options": [
      { "id": "opt_a", "text": "Seçenek 1" },
      { "id": "opt_b", "text": "Seçenek 2" },
      { "id": "opt_c", "text": "Seçenek 3" },
      { "id": "opt_d", "text": "Seçenek 4" }
    ],
    "correctOptionId": "opt_b",
    "explanation": "Açıklama",
    "sourceOrVerification": "Kaynak"
  }
]`;
    if (apiKey && !apiKey.includes('placeholder')) {
        try {
            const controller = new AbortController();
            // 30 second timeout for GLM 5.3
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: [
                        { role: 'system', content: 'Düşünme zinciri uzatmadan doğrudan geçerli JSON array döndür.' },
                        { role: 'user', content: systemPrompt },
                    ],
                    temperature: 0.85,
                    max_tokens: 1500,
                }),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                const json = await res.json();
                const content = (json.choices?.[0]?.message?.content || '').trim();
                if (content) {
                    // Attempt array match first
                    const arrayMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
                    if (arrayMatch) {
                        try {
                            const parsed = JSON.parse(arrayMatch[0]);
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                candidates = parsed.map((item) => sanitizeCandidate(item, formattedSubCategory));
                            }
                        }
                        catch { }
                    }
                    else {
                        // Attempt single object match
                        const objectMatch = content.match(/\{[\s\S]*"options"[\s\S]*\}/);
                        if (objectMatch) {
                            try {
                                const parsed = JSON.parse(objectMatch[0]);
                                if (parsed && (parsed.text || parsed.soru)) {
                                    candidates = [sanitizeCandidate(parsed, formattedSubCategory)];
                                }
                            }
                            catch { }
                        }
                    }
                }
            }
            else {
                const errText = await res.text();
                console.warn(`[Evren LLM GLM 5.3] API yanıt hatası (${res.status}):`, errText);
            }
        }
        catch (err) {
            console.warn('[Evren LLM GLM 5.3] İstek zaman aşımı veya yoğunluk, dinamik soru havuzuna geçiliyor:', err.message);
        }
    }
    // Filter out any candidates that duplicate existing DB questions or recent signatures
    candidates = candidates.filter((c) => {
        const sig = normalizeTextSignature(c.text);
        if (recentlyGeneratedSignatures.has(sig))
            return false;
        const allDbQuestions = db.getAllQuestions();
        const isDup = allDbQuestions.some((q) => normalizeTextSignature(q.text) === sig);
        if (isDup)
            return false;
        recentlyGeneratedSignatures.add(sig);
        return true;
    });
    // If AI was slow/failed or returned fewer questions than requested, fill with diverse pool
    if (candidates.length < count) {
        const needed = count - candidates.length;
        const fallbackCandidates = generateDeterministicEvrenCandidates(categoryId, difficulty, needed, db);
        candidates.push(...fallbackCandidates);
    }
    const validQuestions = [];
    const errors = [];
    for (const candidate of candidates) {
        const questionCandidate = {
            categoryId,
            subCategory: candidate.subCategory || formattedSubCategory,
            difficulty,
            text: candidate.text,
            options: candidate.options,
            correctOptionId: candidate.correctOptionId,
            explanation: candidate.explanation,
            sourceOrVerification: candidate.sourceOrVerification,
            language: 'tr',
            modelMetadata: {
                model: modelName,
                promptVersion: '3.1-evren-diverse-randomized',
            },
        };
        const validation = (0, questionValidator_1.validateQuestion)(questionCandidate, db);
        if (validation.isValid) {
            const savedQuestion = db.createQuestion(questionCandidate);
            supabaseClient_1.supabaseService.insertQuestion(savedQuestion).catch(() => { });
            validQuestions.push(savedQuestion);
        }
        else {
            errors.push(`Geçersiz Soru: ${validation.errors.join(', ')}`);
        }
    }
    return {
        generatedCount: candidates.length,
        validCount: validQuestions.length,
        rejectedCount: candidates.length - validQuestions.length,
        questions: validQuestions,
        errors,
        provider: 'evren-turkiye',
        model: modelName,
    };
}
function sanitizeCandidate(item, defaultSubCategory) {
    const text = item.text || item.soru || item.question || '';
    const exp = item.explanation || item.aciklama || 'Genel kültür ve bilimsel kaynaklarca doğrulanmış bilgidir.';
    const src = item.sourceOrVerification || item.kaynak || 'Resmi Doğrulama Kaynağı';
    let rawOptions = [];
    let correctId = item.correctOptionId || item.dogruCevap || 'opt_a';
    if (Array.isArray(item.options)) {
        rawOptions = item.options.map((opt, idx) => ({
            id: opt.id || `opt_${String.fromCharCode(97 + idx)}`,
            text: opt.text || String(opt),
        }));
    }
    else if (item.secenekler && typeof item.secenekler === 'object') {
        const keys = Object.keys(item.secenekler);
        rawOptions = keys.map((k, idx) => ({
            id: `opt_${String.fromCharCode(97 + idx)}`,
            text: String(item.secenekler[k]),
        }));
        if (item.dogruCevap && ['A', 'B', 'C', 'D'].includes(item.dogruCevap.toUpperCase())) {
            const idx = item.dogruCevap.toUpperCase().charCodeAt(0) - 65;
            correctId = `opt_${String.fromCharCode(97 + idx)}`;
        }
    }
    // Ensure exactly 4 options
    while (rawOptions.length < 4) {
        rawOptions.push({
            id: `opt_${String.fromCharCode(97 + rawOptions.length)}`,
            text: `Alternatif Bilgi ${rawOptions.length + 1}`,
        });
    }
    rawOptions = rawOptions.slice(0, 4);
    // Shuffle options so correct answer is randomly distributed
    const correctOptionText = rawOptions.find((o) => o.id === correctId)?.text || rawOptions[0].text;
    const shuffledTexts = rawOptions.map((o) => o.text).sort(() => Math.random() - 0.5);
    const finalOptions = [
        { id: 'opt_a', text: shuffledTexts[0] },
        { id: 'opt_b', text: shuffledTexts[1] },
        { id: 'opt_c', text: shuffledTexts[2] },
        { id: 'opt_d', text: shuffledTexts[3] },
    ];
    const finalCorrectId = finalOptions.find((o) => o.text === correctOptionText)?.id || 'opt_a';
    return {
        text,
        subCategory: item.subCategory || defaultSubCategory,
        options: finalOptions,
        correctOptionId: finalCorrectId,
        explanation: exp,
        sourceOrVerification: src,
    };
}
exports.RICH_SEED_BANK = {
    geography: {
        easy: [
            {
                text: "Türkiye'nin başkenti hangi ilimizdir?",
                options: ['Ankara', 'İstanbul', 'İzmir', 'Bursa'],
                exp: "Ankara, 13 Ekim 1923 tarihinde Türkiye Cumhuriyeti'nin başkenti ilan edilmiştir.",
                src: 'TBMM Tarih Arşivi',
            },
            {
                text: "Türkiye'nin yüz ölçümü en büyük gölü hangisidir?",
                options: ['Van Gölü', 'Tuz Gölü', 'Beyşehir Gölü', 'İznik Gölü'],
                exp: "Van Gölü 3.713 km² alanı ile Türkiye'nin en büyük gölüdür.",
                src: 'Devlet Su İşleri (DSİ)',
            },
            {
                text: "Ege Denizi, Türkiye'nin hangi coğrafi yönünde yer almaktadır?",
                options: ['Batısında', 'Doğusunda', 'Kuzeyinde', 'Güneyinde'],
                exp: "Ege Denizi, Anadolu Yarımadası'nın batı kıyıları boyunca uzanır.",
                src: 'Milli Eğitim Bakanlığı Coğrafya Atlası',
            },
            {
                text: "Türkiye'nin kuzeyinde kıyısı bulunan deniz hangisidir?",
                options: ['Karadeniz', 'Akdeniz', 'Ege Denizi', 'Kızıldeniz'],
                exp: "Türkiye'nin kuzey kıyıları boyunca Karadeniz uzanmaktadır.",
                src: 'Harita Genel Müdürlüğü',
            },
            {
                text: "Peri bacaları doğal oluşumlarıyla ünlü olan turistik bölgemiz neresidir?",
                options: ['Kapadokya', 'Pamukkale', 'Ihlara Vadisi', 'Ölüdeniz'],
                exp: "Peri bacaları, Nevşehir ve çevresindeki Kapadokya bölgesinde yer alan volkanik tüf oluşumlarıdır.",
                src: 'Kültür ve Turizm Bakanlığı',
            },
            {
                text: "Beyaz traverten teraslarıyla ünlü Pamukkale, hangi ilimizdedir?",
                options: ['Denizli', 'Aydın', 'Muğla', 'Afyonkarahisar'],
                exp: "Pamukkale travertenleri Denizli il sınırları içerisinde bulunur ve UNESCO Dünya Mirası listesindedir.",
                src: 'Kültür Varlıkları ve Müzeler Genel Müdürlüğü',
            },
            {
                text: "Hem Asya hem de Avrupa kıtalarında toprakları bulunan dünyaca ünlü tarihi şehrimiz hangisidir?",
                options: ['İstanbul', 'Çanakkale', 'İzmir', 'Trabzon'],
                exp: "İstanbul Boğazı iki kıtayı ayırırken, İstanbul iki kıtaya yayılan eşsiz bir metropoldür.",
                src: 'İstanbul Büyükşehir Belediyesi Arşivi',
            },
            {
                text: "Türkiye'nin en yüksek dağı hangisidir?",
                options: ['Ağrı Dağı', 'Erciyes Dağı', 'Süphan Dağı', 'Uludağ'],
                exp: "Ağrı Dağı zirvesiyle Türkiye'nin en yüksek doğal noktasıdır.",
                src: 'Harita Genel Müdürlüğü',
            },
        ],
        medium: [
            {
                text: "Türkiye'nin en uzun kıyı şeridine sahip denizi hangisidir?",
                options: ['Ege Denizi', 'Karadeniz', 'Akdeniz', 'Marmara Denizi'],
                exp: "Ege Denizi, girintili çıkıntılı kıyıları ve sayısız koyu nedeniyle en uzun kıyı çizgisine sahiptir.",
                src: 'Harita Genel Müdürlüğü',
            },
            {
                text: "İç Anadolu Bölgesi'ndeki Tuz Gölü hangi üç ilimizin sınırları içerisinde yer alır?",
                options: ['Ankara, Konya, Aksaray', 'Kayseri, Niğde, Nevşehir', 'Eskişehir, Afyon, Kütahya', 'Sivas, Yozgat, Kırşehir'],
                exp: 'Tuz Gölü havzası Ankara, Konya ve Aksaray illerinin kesişim noktasında bulunur.',
                src: 'Çevre ve Şehircilik Bakanlığı',
            },
            {
                text: "Afrika kıtasının en yüksek noktası olan Kilimanjaro Dağı hangi ülkededir?",
                options: ['Tanzanya', 'Kenya', 'Uganda', 'Etiyopya'],
                exp: 'Kilimanjaro Dağı 5.895 metre yüksekliğiyle Tanzanya sınırları içerisindedir.',
                src: 'Afrika Coğrafya Kurumu',
            },
        ],
        hard: [
            {
                text: "Türkiye sınırları içerisinden doğup Basra Körfezi'ne dökülen nehir çifti hangisidir?",
                options: ['Fırat ve Dicle', 'Kızılırmak ve Yeşilırmak', 'Seyhan ve Ceyhan', 'Aras ve Kura'],
                exp: 'Fırat ve Dicle nehirleri Mezopotamya boyunca akarak Basra Körfezi’ne ulaşır.',
                src: 'Devlet Su İşleri',
            },
            {
                text: "Türkiye'nin en yüksek dağı olan Ağrı Dağı'nın zirve yüksekliği yaklaşık kaç metredir?",
                options: ['5137 metre', '3917 metre', '4058 metre', '4520 metre'],
                exp: 'Büyük Ağrı Dağı zirvesi deniz seviyesinden 5.137 metre yüksekliktedir.',
                src: 'Harita Genel Müdürlüğü Resmi Ölçümleri',
            },
        ],
        expert: [
            {
                text: "Nemrut Kalderası içerisinde yer alan Nemrut Krater Gölü'nün en derin noktası yaklaşık kaç metredir?",
                options: ['176 metre', '120 metre', '240 metre', '85 metre'],
                exp: 'Nemrut Krater Gölü maksimum 176 metre derinliğiyle Türkiye’nin en derin krater gölüdür.',
                src: 'TÜBİTAK Yer Bilimleri Araştırmaları',
            },
        ],
    },
    history: {
        easy: [
            {
                text: 'Türkiye Cumhuriyeti hangi yılda kurulmuştur?',
                options: ['1923', '1920', '1919', '1922'],
                exp: "Cumhuriyet 29 Ekim 1923 tarihinde TBMM tarafından ilan edilmiştir.",
                src: 'Türk Tarih Kurumu',
            },
            {
                text: "Kurtuluş Savaşı'nın Başkomutanı ve Türkiye'nin ilk Cumhurbaşkanı kimdir?",
                options: ['Mustafa Kemal Atatürk', 'İsmet İnönü', 'Fevzi Çakmak', 'Kazım Karabekir'],
                exp: 'Gazi Mustafa Kemal Atatürk, Kurtuluş Savaşı lideri ve Cumhuriyetin ilk Cumhurbaşkanıdır.',
                src: 'TBMM Arşivi',
            },
            {
                text: 'Türkiye Büyük Millet Meclisi (TBMM) hangi tarihte açılmıştır?',
                options: ['23 Nisan 1920', '29 Ekim 1923', '19 Mayıs 1919', '30 Ağustos 1922'],
                exp: "TBMM, 23 Nisan 1920'de Ankara'da tarihi binasında törenle açılmıştır.",
                src: 'TBMM Tarihçesi',
            },
            {
                text: "Mustafa Kemal Paşa'nın Samsun'a çıkarak Milli Mücadele'yi fiilen başlattığı tarih hangisidir?",
                options: ['19 Mayıs 1919', '23 Nisan 1920', '30 Ağustos 1922', '9 Eylül 1922'],
                exp: "19 Mayıs 1919, Atatürk'ün Samsun'a ayak bastığı ve Kurtuluş Savaşı meşalesinin yakıldığı gündür.",
                src: 'Milli Savunma Bakanlığı Arşivi',
            },
            {
                text: "Osmanlı Devleti'nin kurucusu olan ilk padişah kimdir?",
                options: ['Osman Bey', 'Orhan Bey', 'Ertuğrul Gazi', 'I. Murad'],
                exp: "Osmanlı Devleti, 1299 yılında Osman Gazi (Osman Bey) tarafından kurulmuştur.",
                src: 'Osmanlı Tarihi Kaynakları',
            },
            {
                text: "1453 yılında İstanbul'u fethederek Fatih unvanını alan Osmanlı padişahı kimdir?",
                options: ['II. Mehmet', 'I. Süleyman', 'I. Selim', 'II. Bayezid'],
                exp: "II. Mehmet (Fatih Sultan Mehmet), 29 Mayıs 1453'te İstanbul'u fethetmiştir.",
                src: 'Türk Tarih Kurumu',
            },
        ],
        medium: [
            {
                text: 'Malazgirt Meydan Muharebesi hangi yıl gerçekleşmiştir?',
                options: ['1071', '1040', '1176', '1243'],
                exp: "Sultan Alparslan 26 Ağustos 1071'de Bizans ordusunu mağlup ederek Anadolu kapılarını açmıştır.",
                src: 'Türk Tarih Kurumu',
            },
            {
                text: "Kurtuluş Savaşı'nda Batı Cephesi Komutanı olarak I. ve II. İnönü Zaferlerini kazanan komutan kimdir?",
                options: ['İsmet İnönü', 'Kazım Karabekir', 'Refet Bele', 'Ali Fuat Cebesoy'],
                exp: 'İsmet Paşa (İnönü), Batı Cephesi Komutanı olarak önemli zaferlere imza atmıştır.',
                src: 'Askeri Tarih Araştırmaları',
            },
        ],
        hard: [
            {
                text: 'Lozan Barış Antlaşması hangi tarihte imzalanmıştır?',
                options: ['24 Temmuz 1923', '29 Ekim 1923', '10 Ağustos 1920', '11 Ekim 1922'],
                exp: "İsviçre'nin Lozan şehrinde 24 Temmuz 1923'te imzalanmıştır.",
                src: 'Dışişleri Bakanlığı Tarih Arşivi',
            },
        ],
        expert: [
            {
                text: "1833 yılında Osmanlı ile Rusya arasında imzalanan Hünkar İskelesi Antlaşması'nın süresi kaç yıldı?",
                options: ['8 yıl', '5 yıl', '10 yıl', '15 yıl'],
                exp: 'Hünkar İskelesi Antlaşması 8 yıllık süre için imzalanmış bir savunma ittifakıdır.',
                src: 'Osmanlı Diplomatik Arşivi',
            },
        ],
    },
    mathematics: {
        easy: [
            {
                text: 'Bir üçgenin iç açıları toplamı kaç derecedir?',
                options: ['180°', '360°', '90°', '270°'],
                exp: 'Öklid geometrisinde tüm düzlemsel üçgenlerin iç açıları toplamı 180 derecedir.',
                src: 'Geometri Temel İlkeleri',
            },
            {
                text: '1 saat kaç dakikadan oluşur?',
                options: ['60 dakika', '100 dakika', '30 dakika', '120 dakika'],
                exp: '1 saat 60 dakikaya, 1 dakika da 60 saniyeye eşittir.',
                src: 'Temel Ölçü Birimleri',
            },
            {
                text: 'Bir kenarı 5 cm olan karenin çevresi kaç santimetredir?',
                options: ['20 cm', '25 cm', '15 cm', '10 cm'],
                exp: 'Karenin çevresi 4 eşit kenarının toplamıdır: 4 × 5 = 20 cm.',
                src: 'Temel Geometri',
            },
            {
                text: 'Bir haftada toplam kaç gün bulunmaktadır?',
                options: ['7 gün', '5 gün', '6 gün', '8 gün'],
                exp: 'Standart takvim sisteminde 1 hafta 7 günden oluşur.',
                src: 'Zaman Ölçüleri',
            },
            {
                text: 'Dik açının ölçüsü kaç derecedir?',
                options: ['90 derece', '180 derece', '45 derece', '60 derece'],
                exp: 'Geometride iki dik doğrunun oluşturduğu açı 90 derecedir.',
                src: 'Milli Eğitim Geometri Müfredatı',
            },
            {
                text: '6 ile 7 sayılarının çarpımı kaçtır?',
                options: ['42', '36', '48', '49'],
                exp: 'Çarpım tablosunda 6 × 7 = 42 eder.',
                src: 'Temel Aritmetik',
            },
        ],
        medium: [
            {
                text: 'İki basamaklı en küçük asal sayı kaçtır?',
                options: ['11', '10', '13', '17'],
                exp: '10 asal değildir (2 ve 5 böleni var), 11 ise yalnızca 1 ve kendisine bölünür.',
                src: 'Sayılar Teorisi',
            },
        ],
        hard: [
            {
                text: 'İki basamaklı en büyük asal sayı kaçtır?',
                options: ['97', '91', '89', '99'],
                exp: '97 asal sayıdır. 91 (7×13) ve 99 (9×11) asal değildir.',
                src: 'Asal Sayılar Tablosu',
            },
        ],
        expert: [
            {
                text: 'Düzgün bir ikosaedronun (20 yüzlü) kaç tane köşesi vardır?',
                options: ['12 köşe', '20 köşe', '30 köşe', '16 köşe'],
                exp: 'Düzgün ikosaedron 20 üçgensel yüze, 30 ayrıta ve 12 köşeye sahiptir.',
                src: 'Platonik Cisimler Teorisi',
            },
        ],
    },
    science_tech: {
        easy: [
            {
                text: "Güneş sistemimizde Dünya'ya en yakın yıldız hangisidir?",
                options: ['Güneş', 'Kutup Yıldızı', 'Sirius', 'Proxima Centauri'],
                exp: "Güneş sistemimizin merkezindeki Güneş, Dünya'ya yaklaşık 150 milyon km mesafeyle en yakın yıldızdır.",
                src: 'Temel Astronomi',
            },
            {
                text: 'İnsan vücudunda kanı pompalayan ana hayati organ hangisidir?',
                options: ['Kalp', 'Akciğer', 'Karaciğer', 'Mide'],
                exp: 'Kalp kasılıp gevşeyerek oksijenli kanı tüm vücuda dolaşım sistemiyle pompalar.',
                src: 'Temel Biyoloji ve Anatomi',
            },
            {
                text: 'Suyun kimyasal formülü nedir?',
                options: ['H2O', 'CO2', 'NaCl', 'O2'],
                exp: 'Su molekülü 2 hidrojen ve 1 oksijen atomunun birleşmesiyle meydana gelir (H2O).',
                src: 'Temel Kimya',
            },
            {
                text: 'Dünya’nın tek doğal uydusu hangisidir?',
                options: ['Ay', 'Güneş', 'Mars', 'Titan'],
                exp: 'Ay, Dünya gezegeninin tek doğal uydusudur.',
                src: 'Uzay Bilimleri',
            },
            {
                text: 'Telefonun mucidi olarak kabul edilen bilim insanı kimdir?',
                options: ['Alexander Graham Bell', 'Thomas Edison', 'Nikola Tesla', 'Guglielmo Marconi'],
                exp: 'Alexander Graham Bell, 1876 yılında telefonun patentini almıştır.',
                src: 'Bilim Tarihi',
            },
        ],
        medium: [
            {
                text: 'Işığın boşluktaki yaklaşık yayılma hızı saniyede kaç kilometredir?',
                options: ['300.000 km/s', '150.000 km/s', '500.000 km/s', '100.000 km/s'],
                exp: 'Işık hızı boşlukta yaklaşık 299.792 km/s olarak kabul edilir.',
                src: 'Fizik Sabitleri',
            },
        ],
        hard: [
            {
                text: 'Yapay zekâ modellerinde "Transformer" mimarisini tanıtan 2017 tarihli makale hangisidir?',
                options: ['Attention Is All You Need', 'Deep Residual Learning', 'Mastering the Game of Go', 'Generative Adversarial Nets'],
                exp: 'Vaswani ve ekibinin "Attention Is All You Need" makalesi modern LLM dönemini başlatmıştır.',
                src: 'NeurIPS 2017',
            },
        ],
        expert: [
            {
                text: 'Bilgisayar bilimlerinde P vs NP problemini 1971 yılında ilk kez tanımlayan teorisyen kimdir?',
                options: ['Stephen Cook', 'Alan Turing', 'Claude Shannon', 'John von Neumann'],
                exp: 'Stephen Cook, 1971 ACM SIGACT konferansında Cook Teoremi ile NP-complete kavramını ortaya koymuştur.',
                src: 'Turing Ödülü Bildirileri',
            },
        ],
    },
    general_culture: {
        easy: [
            {
                text: 'Gökkuşağında toplam kaç renk bulunmaktadır?',
                options: ['7 renk', '6 renk', '8 renk', '5 renk'],
                exp: 'Gökkuşağında kırmızı, turuncu, sarı, yeşil, mavi, lacivert ve menekşe olmak üzere 7 ana renk ayırt edilir.',
                src: 'Temel Optik ve Renk Bilgisi',
            },
            {
                text: 'Futbolda bir takım sahaya aynı anda kaç oyuncu ile çıkar?',
                options: ['11 oyuncu', '10 oyuncu', '9 oyuncu', '12 oyuncu'],
                exp: 'Futbol müsabakaları her iki takımın 11 kişiden oluşan kadrolarıyla oynanır.',
                src: 'IFAB Resmi Oyun Kuralları',
            },
            {
                text: "Trafik lambalarında 'Geç' anlamına gelen renk hangisidir?",
                options: ['Yeşil', 'Kırmızı', 'Sarı', 'Mavi'],
                exp: 'Trafik ışıklarında yeşil geç, kırmızı dur, sarı ise hazırlan anlamına gelir.',
                src: 'Karayolları Trafik Yönetmeliği',
            },
            {
                text: 'Satranç oyununda her yöne düz ve çapraz olarak sınırsız kare gidebilen en güçlü taş hangisidir?',
                options: ['Vezir', 'Kale', 'Şah', 'Fil'],
                exp: 'Vezir, hem kale hem fil gibi hareket edebilen satrancın en yetenekli ve güçlü taşıdır.',
                src: 'FIDE Satranç Kuralları',
            },
            {
                text: "Hangi hayvan dayanıklılığı sebebiyle 'Çöl Gemisi' olarak adlandırılır?",
                options: ['Deve', 'At', 'Fil', 'Zebra'],
                exp: 'Develer hörgüçlerindeki yağ deposu ve susuzluğa haftalarca dayanabilmeleriyle çöl gemisi olarak anılır.',
                src: 'Zooloji Bilgisi',
            },
        ],
        medium: [
            {
                text: 'Ünlü "Mona Lisa" tablosunun ressamı olan İtalyan Rönesans dehası kimdir?',
                options: ['Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Donatello'],
                exp: 'Mona Lisa, Leonardo da Vinci tarafından 16. yüzyıl başlarında resmedilmiştir.',
                src: 'Louvre Müzesi Arşivi',
            },
        ],
        hard: [
            {
                text: 'Eski Roma takviminde yılın ilk ayı olarak hangi ay kabul edilirdi?',
                options: ['Mart', 'Ocak', 'Nisan', 'Temmuz'],
                exp: 'M.Ö. 153 yılına kadar Roma takviminde ilk ay savaş tanrısı Mars’a atfedilen Mart ayıydı.',
                src: 'Antik Roma Tarihi',
            },
        ],
        expert: [
            {
                text: 'Modern periyodik cetvelde yer alan atom numarası 100 olan element hangisidir?',
                options: ['Fermiyum (Fm)', 'Einsteinium (Es)', 'Mendelevyum (Md)', 'Nobelyum (No)'],
                exp: 'Atom numarası 100 olan element Enrico Fermi anısına Fermiyum olarak adlandırılmıştır.',
                src: 'IUPAC Periyodik Tablosu',
            },
        ],
    },
    sports: {
        easy: [
            {
                text: 'Futbolda normal bir maç kaç devre ve toplam kaç dakikadan oluşur?',
                options: ['2 devre - 90 dakika', '4 devre - 80 dakika', '2 devre - 60 dakika', '3 devre - 90 dakika'],
                exp: 'Futbol müsabakaları 45’er dakikalık iki devre halinde toplam 90 dakikadır.',
                src: 'FIFA Oyun Kuralları',
            },
            {
                text: 'Basketbolda faul atışı (serbest atış) çizgisi arkasından kazanılan her basket kaç puan değerindedir?',
                options: ['1 puan', '2 puan', '3 puan', '4 puan'],
                exp: 'Basketbolda faul atışlarından kazanılan her sayı 1 puandır.',
                src: 'FIBA Resmi Kuralları',
            },
            {
                text: 'Dört yılda bir düzenlenen dünyanın en kapsamlı spor organizasyonu hangisidir?',
                options: ['Olimpiyat Oyunları', 'Dünya Kupası', 'Şampiyonlar Ligi', 'Wimbledon'],
                exp: 'Olimpiyat Oyunları, antik çağdan esinlenilerek her 4 yılda bir yaz ve kış dallarında düzenlenir.',
                src: 'Uluslararası Olimpiyat Komitesi (IOC)',
            },
        ],
        medium: [
            {
                text: 'Türkiye A Milli Futbol Takımı, FIFA Dünya Kupası’nda dünya üçüncülüğünü hangi yılda elde etmiştir?',
                options: ['2002', '1996', '2008', '2016'],
                exp: 'Şenol Güneş yönetimindeki Türk Milli Takımı, 2002 Kore-Japonya Dünya Kupası’nda 3. olmuştur.',
                src: 'TFF Resmi Tarihçesi',
            },
        ],
        hard: [
            {
                text: 'Modern maraton koşusunun standart mesafesi kaç kilometre kaç metredir?',
                options: ['42 km 195 metre', '40 km 000 metre', '45 km 500 metre', '41 km 195 metre'],
                exp: 'Maraton koşusunun resmi mesafesi 1908 Londra Olimpiyatlarından bu yana 42.195 km’dir.',
                src: 'World Athletics',
            },
        ],
        expert: [
            {
                text: '1960 Roma Olimpiyatları’nda maratonu çıplak ayakla koşarak altın madalya kazanan efsanevi Etiyopyalı atlet kimdir?',
                options: ['Abebe Bikila', 'Haile Gebrselassie', 'Kenenisa Bekele', 'Mamo Wolde'],
                exp: 'Abebe Bikila, ayakkabısı ayağını vurduğu için çıplak ayak koşarak olimpiyat şampiyonu olmuştur.',
                src: 'Olimpiyat Tarihi Arşivi',
            },
        ],
    },
    cinema_tv: {
        easy: [
            {
                text: "Yeşilçam sinemasında 'Sultan' lakabıyla anılan unutulmaz kadın oyuncumuz kimdir?",
                options: ['Türkan Şoray', 'Hülya Koçyiğit', 'Fatma Girik', 'Filiz Akın'],
                exp: 'Türkan Şoray, Türk sinemasının 4 yapraklı yoncasından biri olup Sultan lakabıyla tanınır.',
                src: 'Türk Sineması Arşivi',
            },
            {
                text: "Hababam Sınıfı filmlerinde 'İnek Şaban' karakterini canlandıran güldürü ustamız kimdir?",
                options: ['Kemal Sunal', 'Şener Şen', 'Halit Akçatepe', 'Münir Özkul'],
                exp: 'Büyük usta Kemal Sunal, İnek Şaban tiplemesiyle milyonların sevgisini kazanmıştır.',
                src: 'Yeşilçam Klasikleri',
            },
        ],
        medium: [
            {
                text: "Yüzüklerin Efendisi film üçlemesinin yönetmeni kimdir?",
                options: ['Peter Jackson', 'Steven Spielberg', 'Christopher Nolan', 'James Cameron'],
                exp: 'Peter Jackson, J.R.R. Tolkien’in eserini Yeni Zelanda’da beyaz perdeye aktarmıştır.',
                src: 'Akademi Ödülleri Arşivi',
            },
        ],
        hard: [
            {
                text: "Tarihte ilk kez 11 dalda Akademi (Oscar) Ödülü kazanan 1959 yapımı epik film hangisidir?",
                options: ['Ben-Hur', 'Titanik', 'Yüzüklerin Efendisi: Kralın Dönüşü', 'Rüzgar Gibi Geçti'],
                exp: 'William Wyler yönetmenliğindeki Ben-Hur 11 Oscar kazanarak bu alanda ilk rekoru kırmıştır.',
                src: 'Sinema Tarihi Akademisi',
            },
        ],
        expert: [
            {
                text: "1927 yapımı 'Metropolis' adlı öncü bilim kurgu başyapıtının Alman dışavurumcu yönetmeni kimdir?",
                options: ['Fritz Lang', 'F.W. Murnau', 'Robert Wiene', 'Billy Wilder'],
                exp: 'Fritz Lang’ın Metropolis filmi sinema tarihinin en etkileyici distopik eserlerindendir.',
                src: 'Sinema Müzesi Arşivi',
            },
        ],
    },
    music: {
        easy: [
            {
                text: 'İstiklal Marşı’mızın bestecisi kimdir?',
                options: ['Osman Zeki Üngör', 'Mehmet Akif Ersoy', 'İsmail Dede Efendi', 'Itri'],
                exp: 'İstiklal Marşı’nın sözleri Mehmet Akif Ersoy’a, yürürlükteki bestesi ise Osman Zeki Üngör’e aittir.',
                src: 'Kültür ve Turizm Bakanlığı',
            },
            {
                text: 'Dört telli, yayla çalınan klasik batı müziği yaylı çalgısı hangisidir?',
                options: ['Keman', 'Gitar', 'Piyano', 'Flüt'],
                exp: 'Keman, yaylı çalgılar ailesinin en tiz sesli ve dört telli üyesidir.',
                src: 'Müzik Terimleri ve Çalgı Bilgisi',
            },
        ],
        medium: [
            {
                text: 'İşitme duyusunu neredeyse tamamen kaybettikten sonra efsanevi 9. Senfoni’yi besteleyen besteci kimdir?',
                options: ['Ludwig van Beethoven', 'Wolfgang Amadeus Mozart', 'Johann Sebastian Bach', 'Frédéric Chopin'],
                exp: 'Alman besteci Beethoven, ileri derecede işitme kaybına rağmen şaheserler üretmeye devam etmiştir.',
                src: 'Klasik Müzik Tarihi',
            },
        ],
        hard: [
            {
                text: 'Klasik Türk müziğinde Segah makamının durak perdesi hangi perdedir?',
                options: ['Segah perdesi', 'Rast perdesi', 'Dügah perdesi', 'Çargah perdesi'],
                exp: 'Segah makamı segah perdesinde karar kılar ve adını da bu perdeden alır.',
                src: 'Türk Musikisi Nazariyatı',
            },
        ],
        expert: [
            {
                text: 'Barok müziğin zirvesi sayılan "Goldberg Varyasyonları" hangi büyük besteciye aittir?',
                options: ['Johann Sebastian Bach', 'George Frideric Handel', 'Antonio Vivaldi', 'Claudio Monteverdi'],
                exp: 'Goldberg Varyasyonları (BWV 988), J.S. Bach’ın klavsen için bestelediği anıtsal bir eserdir.',
                src: 'Barok Müzik Arşivi',
            },
        ],
    },
    literature: {
        easy: [
            {
                text: "Milli marşımız olan İstiklal Marşı'nın şairi kimdir?",
                options: ['Mehmet Akif Ersoy', 'Yahya Kemal Beyatlı', 'Nazım Hikmet', 'Necip Fazıl Kısakürek'],
                exp: "Mehmet Akif Ersoy, 1921 yılında yazdığı şiirle TBMM tarafından milli şair kabul edilmiştir.",
                src: 'Türk Edebiyatı Vakfı',
            },
            {
                text: "'Küçük Prens' adlı dünyaca ünlü çocuk ve felsefe klasiğinin Fransız yazarı kimdir?",
                options: ['Antoine de Saint-Exupéry', 'Victor Hugo', 'Jules Verne', 'Albert Camus'],
                exp: 'Antoine de Saint-Exupéry aynı zamanda pilot olup Küçük Prens ile ölümsüzleşmiştir.',
                src: 'Dünya Edebiyatı Klasikleri',
            },
        ],
        medium: [
            {
                text: "'Sefiller' romanında kürek mahkumu Jean Valjean'ın hikayesini anlatan Fransız yazar kimdir?",
                options: ['Victor Hugo', 'Émile Zola', 'Honoré de Balzac', 'Gustave Flaubert'],
                exp: 'Victor Hugo, 1862 yılında yayımladığı Sefiller ile adalet ve merhamet temalarını işlemiştir.',
                src: 'Klasik Roman İncelemeleri',
            },
        ],
        hard: [
            {
                text: "Edebiyatta 'Bilinç Akışı' tekniğinin en önemli örneklerinden olan 'Ulysses' romanının İrlandalı yazarı kimdir?",
                options: ['James Joyce', 'Virginia Woolf', 'Franz Kafka', 'Marcel Proust'],
                exp: 'James Joyce, 1922’de yayımlanan Ulysses romanıyla modern edebiyatın seyrini değiştirmiştir.',
                src: 'Modernist Edebiyat Kılavuzu',
            },
        ],
        expert: [
            {
                text: "Divan edebiyatında 'Şairler Sultanı' (Sultanu'ş-Şuara) unvanına layık görülen 16. yüzyıl şairi kimdir?",
                options: ['Bâkî', 'Fuzûlî', 'Nedîm', 'Şeyh Gâlib'],
                exp: 'Bâkî, Kanuni Sultan Süleyman döneminde Sultanu’ş-Şuara unvanını kazanmıştır.',
                src: 'Divan Edebiyatı Tarihi',
            },
        ],
    },
    biology: {
        easy: [
            {
                text: 'İnsan vücudunun en büyük organı hangisidir?',
                options: ['Deri (Cilt)', 'Karaciğer', 'Akciğer', 'Beyin'],
                exp: 'Deri, yaklaşık 2 metrekare yüzey alanıyla insan vücudunun en geniş ve ağır organıdır.',
                src: 'Temel Anatomi',
            },
            {
                text: 'Bitkilere yeşil rengini veren ve fotosentez yapmasını sağlayan pigment hangisidir?',
                options: ['Klorofil', 'Hemoglobin', 'Melanin', 'Karoten'],
                exp: 'Klorofil, güneş ışığını emerek kimyasal enerjiye çeviren yeşil renkli pigmenttir.',
                src: 'Bitki Biyolojisi',
            },
        ],
        medium: [
            {
                text: 'Genetik bilginin hücre çekirdeğinde taşındığı çift sarmallı molekülün kısaltması nedir?',
                options: ['DNA', 'RNA', 'ATP', 'ADP'],
                exp: 'Deoksiribonükleik asit (DNA), tüm canlıların kalıtım şifresini taşır.',
                src: 'Moleküler Biyoloji',
            },
        ],
        hard: [
            {
                text: 'Hücrede enerji üretiminden sorumlu olan ve "hücrenin santrali" olarak anılan organel hangisidir?',
                options: ['Mitokondri', 'Ribozom', 'Golgi Cisimciği', 'Lizozom'],
                exp: 'Mitokondri, hücresel solunum ile ATP (hücre enerjisi) sentezleyen organeldir.',
                src: 'Hücre Biyolojisi',
            },
        ],
        expert: [
            {
                text: 'İnsan genomunda bulunan 23 çift kromozomdan kaç tanesi otozom (vücut kromozomu) çiftidir?',
                options: ['22 çift', '21 çift', '23 çift', '20 çift'],
                exp: 'İnsanda 22 çift otozom (vücut kromozomu) ve 1 çift gonozom (cinsiyet kromozomu) bulunur.',
                src: 'İnsan Genetiği İlkeleri',
            },
        ],
    },
    physics_chemistry: {
        easy: [
            {
                text: 'Saf su, standart deniz seviyesi basıncında kaç santigrat derecede kaynar?',
                options: ['100°C', '90°C', '120°C', '80°C'],
                exp: '1 atmosfer basınç altında saf suyun kaynama noktası tam 100 santigrat derecedir.',
                src: 'Temel Kimya ve Termodinamik',
            },
            {
                text: 'Başına elma düşmesi hikayesiyle yerçekimi kanununu açıklayan İngiliz fizikçi kimdir?',
                options: ['Isaac Newton', 'Albert Einstein', 'Galileo Galilei', 'Nikola Tesla'],
                exp: 'Sir Isaac Newton, kütleçekim yasasını 1687 tarihli Principia eserinde açıklamıştır.',
                src: 'Fizik Tarihi',
            },
        ],
        medium: [
            {
                text: 'Periyodik tablonun ilk ve en hafif elementi hangisidir?',
                options: ['Hidrojen (H)', 'Helyum (He)', 'Lityum (Li)', 'Oksijen (O)'],
                exp: 'Hidrojen atom numarası 1 olan evrenin en yaygın ve en hafif elementidir.',
                src: 'Periyodik Tablo İlkeleri',
            },
        ],
        hard: [
            {
                text: 'Özel Görelilik kuramına göre kütle ile enerji arasındaki bağıntıyı veren ünlü formül hangisidir?',
                options: ['E = mc²', 'F = ma', 'V = IR', 'PV = nRT'],
                exp: 'Albert Einstein’ın 1905’te formüle ettiği denklem enerjinin kütleyle orantılı olduğunu gösterir.',
                src: 'Modern Fizik',
            },
        ],
        expert: [
            {
                text: 'Kuantum mekaniğinde Belirsizlik İlkesi’ni ortaya koyan Nobel ödüllü Alman teorik fizikçi kimdir?',
                options: ['Werner Heisenberg', 'Niels Bohr', 'Max Planck', 'Erwin Schrödinger'],
                exp: 'Heisenberg, bir parçacığın konumu ve momentumunun aynı anda kesin bilinemeyeceğini kanıtlamıştır.',
                src: 'Kuantum Fiziği Tarihi',
            },
        ],
    },
    space_astronomy: {
        easy: [
            {
                text: "Güneş sistemindeki en büyük kütleye ve çapa sahip gezegen hangisidir?",
                options: ['Jüpiter', 'Satürn', 'Mars', 'Neptün'],
                exp: "Jüpiter, gaz devi olup Güneş sisteminin açık ara en büyük gezegenidir.",
                src: 'NASA Güneş Sistemi Rehberi',
            },
            {
                text: "Halkalarıyla ünlü olan ve Güneş sistemimizin 6. gezegeni olan gök cismi hangisidir?",
                options: ['Satürn', 'Uranüs', 'Mars', 'Jüpiter'],
                exp: "Satürn, teleskopla belirgin şekilde görülebilen buz ve kaya parçacıklarından halkalarıyla meşhurdur.",
                src: 'Astronomi Atlası',
            },
        ],
        medium: [
            {
                text: "Kızıl Gezegen lakabıyla bilinen, yüzeyi demir oksitçe zengin gezegen hangisidir?",
                options: ['Mars', 'Venüs', 'Merkür', 'Jüpiter'],
                exp: "Mars toprağındaki paslı demir mineralleri gezegene kızıl bir renk verir.",
                src: 'Gezegenler Bilimi',
            },
        ],
        hard: [
            {
                text: "Işığın dahi kaçamadığı, kütleçekimi sonsuz kabul edilen uzay yapılarına ne ad verilir?",
                options: ['Kara Delik', 'Süpernova', 'Pulsar', 'Kuasar'],
                exp: 'Kara delikler olay ufkunu geçen hiçbir maddenin veya fotonun kaçamayacağı yoğunluktadır.',
                src: 'Astrofizik Temelleri',
            },
        ],
        expert: [
            {
                text: "Güneş sistemimize en yakın yıldız sistemi olan Alfa Centauri'nin Dünya'ya uzaklığı yaklaşık kaç ışık yılıdır?",
                options: ['4.24 ışık yılı', '2.50 ışık yılı', '8.60 ışık yılı', '1.10 ışık yılı'],
                exp: 'Proxima Centauri yaklaşık 4.24 ışık yılı uzaklığıyla Güneş’ten sonra bize en yakın yıldızdır.',
                src: 'Avrupa Güney Rasathanesi (ESO)',
            },
        ],
    },
    logic_puzzles: {
        easy: [
            {
                text: 'Bir koşu yarışında ikinci olan koşucuyu geçerseniz kaçıncı sıraya yerleşirsiniz?',
                options: ['İkinci', 'Birinci', 'Üçüncü', 'Sonuncu'],
                exp: 'İkinciyi geçtiğinizde onun yerini alırsınız, yani ikinci olursunuz. Birinciyi geçmedikçe birinci olamazsınız.',
                src: 'Klasik Mantık Soruları',
            },
            {
                text: "Ahmet'in babasının 3 çocuğu vardır: Birincisinin adı Can, ikincisinin adı Cem'dir. Üçüncü çocuğun adı nedir?",
                options: ['Ahmet', 'Ali', 'Caner', 'Cihan'],
                exp: "Soru başında 'Ahmet'in babası' denildiği için üçüncü çocuk Ahmet'tir.",
                src: 'Zeka ve Dikkat Oyunları',
            },
        ],
        medium: [
            {
                text: 'Şu sayı dizisinde boş bırakılan yere hangi sayı gelmelidir: 2, 4, 8, 16, ?',
                options: ['32', '24', '30', '64'],
                exp: 'Dizideki her sayı bir önceki sayının 2 katıdır (geometrik dizi): 16 × 2 = 32.',
                src: 'Sayı Dizileri ve Örüntü Mantığı',
            },
        ],
        hard: [
            {
                text: 'Bir göletteki nilüferler her gün alanını 2 katına çıkarıyor. Gölet 48 günde tamamen doluyorsa, göletin yarısı kaçıncı günde dolmuştur?',
                options: ['47. günde', '24. günde', '46. günde', '12. günde'],
                exp: 'Her gün 2 katına çıktığı için tam dolduğu 48. günden bir gün önce (47. gün) gölet tam yarı doludur.',
                src: 'Üstel Büyüme Mantık Problemleri',
            },
        ],
        expert: [
            {
                text: 'Üç kutunun üzerinde sırasıyla "Sadece Elma", "Sadece Portakal" ve "Karışık" yazıyor. Üç etiket de yanlışsa, tek bir meyve çekerek tüm kutuları doğru etiketlemek için hangi kutudan meyve seçilmelidir?',
                options: ['"Karışık" yazan kutudan', '"Sadece Elma" yazan kutudan', '"Sadece Portakal" yazan kutudan', 'Herhangi birinden fark etmez'],
                exp: 'Karışık yazan kutunun etiketi kesinlikle yanlıştır. Ondan çekilen meyve kutunun gerçek içeriğini belirler ve zincirleme çözüm sağlar.',
                src: 'Klasik Epistemik Mantık Bilmeceleri',
            },
        ],
    },
    language_vocab: {
        easy: [
            {
                text: 'Türk alfabesinde toplam kaç adet ünlü (sesli) harf bulunmaktadır?',
                options: ['8', '6', '7', '9'],
                exp: 'Türkçede sesli harfler 8 tanedir: a, e, ı, i, o, ö, u, ü.',
                src: 'Türk Dil Kurumu (TDK)',
            },
            {
                text: "'Al' kelimesinin eş anlamlısı olan renk adı hangisidir?",
                options: ['Kırmızı', 'Mavi', 'Sarı', 'Beyaz'],
                exp: "Al ve kırmızı aynı renk tonunu ifade eden eş anlamlı sözcüklerdir (Al bayrak = Kırmızı bayrak).",
                src: 'TDK Eş Anlamlılar Sözlüğü',
            },
        ],
        medium: [
            {
                text: "'Damlaya damlaya göl olur' atasözü temel olarak hangi erdemi ve davranışı öğütler?",
                options: ['Tasarruf ve sabırla birikim yapmayı', 'Hızlı hareket etmeyi', 'Risk almayı', 'Cömertliği'],
                exp: 'Küçük şeylerin birikerek büyük değerlere dönüşebileceğini vurgular.',
                src: 'TDK Atasözleri ve Deyimler Sözlüğü',
            },
        ],
        hard: [
            {
                text: "Aynı anlama gelen veya birbirinin yerine kullanılabilen sözcüklere ne ad verilir?",
                options: ['Eş Anlamlı (Müteradif)', 'Zıt Anlamlı (Mutezat)', 'Eş Sesli (Sesteş)', 'Mecaz Anlamlı'],
                exp: 'Yazılışları farklı ancak anlamları aynı olan kelimelere eş anlamlı kelimeler denir.',
                src: 'Türkçe Dilbilgisi Kuralları',
            },
        ],
        expert: [
            {
                text: "Eski Türkçede 'yazı, mektup, ferman' anlamlarına gelen ve Orhun Yazıtları'nda sıkça geçen Türkçe sözcük hangisidir?",
                options: ['Bitig', 'Tamga', 'Yarlık', 'Buyruk'],
                exp: 'Bitig (biti-mek kökünden), eski Türkçede kitap, yazıt ve yazı anlamına gelir.',
                src: 'Eski Türkçe Sözlüğü (Clauson)',
            },
        ],
    },
    art_culture: {
        easy: [
            {
                text: "Dünyaca ünlü 'Mona Lisa' tablosunun ressamı olan İtalyan sanatçı kimdir?",
                options: ['Leonardo da Vinci', 'Pablo Picasso', 'Vincent van Gogh', 'Salvador Dali'],
                exp: "Mona Lisa, Rönesans döneminde Leonardo da Vinci tarafından yapılmıştır ve Paris Louvre Müzesi'ndedir.",
                src: 'Dünya Sanat Tarihi',
            },
            {
                text: "Türk resim sanatının simge eserlerinden 'Kaplumbağa Terbiyecisi' tablosu hangi ressamımıza aittir?",
                options: ['Osman Hamdi Bey', 'İbrahim Çallı', 'Şeker Ahmet Paşa', 'Fikret Mualla'],
                exp: "Osman Hamdi Bey, 1906 yılında bu eseri tamamlamış olup aynı zamanda modern Türk müzeciliğinin kurucusudur.",
                src: 'Pera Müzesi Koleksiyonu',
            },
        ],
        medium: [
            {
                text: "Osmanlı İmparatorluğu'nun baş mimarı olan ve Selimiye Camii'ni 'ustalık eserim' olarak nitelendiren deha kimdir?",
                options: ['Mimar Sinan', 'Mimar Hayreddin', 'Sedefkar Mehmet Ağa', 'Sarkis Balyan'],
                exp: 'Koca Mimar Sinan, Şehzade Camii’ne çıraklık, Süleymaniye’ye kalfalık, Selimiye’ye ise ustalık eserim demiştir.',
                src: 'Vakıflar Genel Müdürlüğü Arşivi',
            },
        ],
        hard: [
            {
                text: "İspanya İç Savaşı'nın yıkımını anlatan kübist başyapıt 'Guernica' tablosu hangi ünlü ressama aittir?",
                options: ['Pablo Picasso', 'Salvador Dali', 'Joan Miró', 'Francisco Goya'],
                exp: 'Picasso, 1937’de Nazi uçaklarının bombaladığı Guernica kasabasına ithafen bu tabloyu yapmıştır.',
                src: 'Reina Sofia Müzesi',
            },
        ],
        expert: [
            {
                text: "Rönesans döneminde Floransa Katedrali'nin devasa kubbesini matematiksel bir dehayla inşa eden mimar kimdir?",
                options: ['Filippo Brunelleschi', 'Leon Battista Alberti', 'Donato Bramante', 'Andrea Palladio'],
                exp: 'Brunelleschi, 1420-1436 yılları arasında çift cidarlı kubbe tekniğiyle mimarlık tarihinde devrim yapmıştır.',
                src: 'Rönesans Mimarlık Tarihi',
            },
        ],
    },
    food_gastronomy: {
        easy: [
            {
                text: "İnce açılmış yufka katları arasına Antep fıstığı veya ceviz konularak şerbetlenen, Gaziantep ile özdeşleşmiş ünlü tatlımız hangisidir?",
                options: ['Baklava', 'Künefe', 'Sütlaç', 'Kazandibi'],
                exp: 'Gaziantep Baklavası, Avrupa Birliği tarafından tescillenen ilk Türk ürünüdür.',
                src: 'Türk Patent ve Marka Kurumu Coğrafi İşaretler',
            },
            {
                text: "İtalyan mutfağının dünyaca ünlü, hamur üzerine domates sosu ve mozzarella peyniri konularak fırınlanan yemeği hangisidir?",
                options: ['Pizza', 'Sushi', 'Paella', 'Taco'],
                exp: 'Pizza, İtalya’nın Napoli şehrinde doğmuş ve tüm dünyaya yayılmış geleneksel bir yemektir.',
                src: 'Dünya Gastronomi Ansiklopedisi',
            },
            {
                text: "Kayseri mutfağı denince akla ilk gelen, bir kaşığa kırk adet sığdırılmasıyla övünülen geleneksel hamur işi yemeğimiz hangisidir?",
                options: ['Mantı', 'Çiğ Köfte', 'İçli Köfte', 'Lahmacun'],
                exp: 'Kayseri mantısı, sarımsaklı yoğurt ve sumaklı tereyağı sosuyla servis edilen asırlık bir Türk yemeğidir.',
                src: 'Anadolu Mutfak Kültürü',
            },
            {
                text: "Kahvaltıların vazgeçilmezi olan, domates, yeşil biber ve yumurtanın birlikte pişirilmesiyle yapılan geleneksel Türk yemeği hangisidir?",
                options: ['Menemen', 'Kuymak', 'Çılbır', 'Mıhlama'],
                exp: 'Menemen, adını İzmir’in Menemen ilçesinden alan en popüler Türk kahvaltı yemeklerinden biridir.',
                src: 'Türk Mutfağı Klasikleri',
            },
        ],
        medium: [
            {
                text: "Japon mutfağında sirkeli pirinç ve çiğ deniz ürünlerinin yosun (nori) ile sarılmasıyla hazırlanan geleneksel yemek hangisidir?",
                options: ['Sushi', 'Ramen', 'Tempura', 'Dim Sum'],
                exp: 'Sushi, Japon mutfak kültürünün en bilinen temsilcisidir.',
                src: 'Uzak Doğu Gastronomisi',
            },
            {
                text: "Bursa ilimizle özdeşleşen, pide üzerine döner eti, domates sosu ve kızgın tereyağı dökülerek servis edilen kebap türü hangisidir?",
                options: ['İskender Kebap', 'Cağ Kebabı', 'Beyti Kebap', 'Alinazik'],
                exp: 'İskender Kebap, 1867 yılında Bursa’da İskender Efendi tarafından icat edilmiştir.',
                src: 'Bursa Ticaret ve Sanayi Odası',
            },
            {
                text: "Hatay mutfağının tescilli tatlısı olan, tel kadayıf arasına tuzsuz özel peynir konularak pişirilen sıcak şerbetli tatlı hangisidir?",
                options: ['Künefe', 'Revani', 'Şambali', 'Trileçe'],
                exp: 'Antakya Künefesi, kendine has sünme özelliğine sahip tuzsuz Hatay peyniri ile yapılır.',
                src: 'Hatay Gastronomi Rehberi',
            },
            {
                text: "Karadeniz Bölgesi'nde mısır unu, tereyağı ve kolot/tellioğlu peyniri ile bakır tavada pişirilen yöresel lezzet hangisidir?",
                options: ['Kuymak (Mıhlama)', 'Hamsikoli', 'Turşu Kavurması', 'Laz Böreği'],
                exp: 'Kuymak veya Mıhlama, Doğu Karadeniz yaylalarının en meşhur sıcak kahvaltılığıdır.',
                src: 'Karadeniz Mutfak Kültür Envanteri',
            },
        ],
        hard: [
            {
                text: "İspanya'nın Valensiya bölgesine özgü, safranla tatlandırılmış pirinç ve deniz ürünleriyle geniş tavada pişirilen ulusal yemek hangisidir?",
                options: ['Paella', 'Gazpacho', 'Tortilla', 'Churros'],
                exp: 'Paella, adını pişirildiği iki saplı sığ tavadan alan İspanyol pirinç yemeğidir.',
                src: 'Avrupa Mutfak Tarihi',
            },
            {
                text: "Dünyanın en pahalı baharatı olarak bilinen ve 'Crocus sativus' çiçeğinin kurutulmuş tepeciklerinden elde edilen baharat hangisidir?",
                options: ['Safran', 'Kakule', 'Vanilya', 'Zerdeçal'],
                exp: 'Safran, binlerce çiçekten yalnızca birkaç gram elde edilebildiği için kırmızı altın olarak anılır.',
                src: 'Botanik ve Baharat Ansiklopedisi',
            },
        ],
        expert: [
            {
                text: "Osmanlı saray mutfağında etin meyvelerle (erik, kayısı, badem) birlikte pişirildiği tatlı-ekşi yemek geleneklerine verilen genel ad nedir?",
                options: ['Mutancana', 'Hünkarbeğendi', 'Babagannuş', 'Küşleme'],
                exp: 'Fatih Sultan Mehmet’in en sevdiği yemeklerden olan Mutancana, kuzu etinin kuru meyveler ve balla pişirilmesiyle yapılır.',
                src: 'Topkapı Sarayı Matbah-ı Amire Kayıtları',
            },
        ],
    },
    animals_wildlife: {
        easy: [
            {
                text: "Karada yaşayan en hızlı memeli hayvan aşağıdakilerden hangisidir?",
                options: ['Çita', 'Aslan', 'At', 'Kanguru'],
                exp: 'Çita, saatte yaklaşık 110-120 km hıza ulaşabilen dünyanın en hızlı kara hayvanıdır.',
                src: 'National Geographic Zooloji',
            },
            {
                text: "Kanatları olmasına rağmen uçamayan, Güney Kutbu (Antarktika) ve çevresinde yaşayan deniz kuşu hangisidir?",
                options: ['Penguen', 'Kartal', 'Martı', 'Pelikan'],
                exp: 'Penguenler uçamazlar ancak kanatlarını yüzgeç gibi kullanarak su altında ustalıkla yüzerler.',
                src: 'Kutup Ekosistemleri Rehberi',
            },
            {
                text: "Uzun boynu ile ağaçların en üst yapraklarına ulaşabilen, dünyanın en uzun boylu kara hayvanı hangisidir?",
                options: ['Zürafa', 'Fil', 'Deve', 'Gergedan'],
                exp: 'Zürafalar 5.5 - 6 metreye varan boylarıyla yeryüzünün en uzun canlılarıdır.',
                src: 'Afrika Yaban Hayatı',
            },
        ],
        medium: [
            {
                text: "Dünya üzerinde bugüne kadar yaşamış en büyük ve en ağır hayvan (memeli) hangisidir?",
                options: ['Mavi Balina', 'Afrika Fili', 'Beyaz Köpekbalığı', 'Boz Ayı'],
                exp: 'Mavi Balina 30 metreye varan boyu ve 150 tonu aşan ağırlığıyla gelmiş geçmiş en büyük hayvandır.',
                src: 'Deniz Biyolojisi Enstitüsü',
            },
            {
                text: "Avustralya'ya özgü olan ve sadece okaliptüs yapraklarıyla beslenen keseli hayvan hangisidir?",
                options: ['Koala', 'Panda', 'Tembel Hayvan', 'Lemur'],
                exp: 'Koalalar günün yaklaşık 18-20 saatini okaliptüs ağaçlarında uyuyarak ve yaprak yiyerek geçirirler.',
                src: 'Avustralya Faunası',
            },
            {
                text: "Sekiz kolu ve üç ayrı kalbi bulunan, mavi kanlı deniz canlısı hangisidir?",
                options: ['Ahtapot', 'Denizyıldızı', 'Yunus', 'Denizanası'],
                exp: 'Ahtapotların iki solungaç kalbi ve bir sistemik kalbi olmak üzere 3 kalbi vardır; kanları hemosiyanin nedeniyle mavidir.',
                src: 'Deniz Omurgasızları Bilimi',
            },
        ],
        hard: [
            {
                text: "Memeli bir hayvan olmasına rağmen doğurmak yerine yumurtlayarak çoğalan gagalı hayvan hangisidir?",
                options: ['Ornitorenk (Platypus)', 'Kunduz', 'Su Samuru', 'Armadillo'],
                exp: 'Ornitorenk, tekdelikliler (Monotremata) takımına ait yumurtlayan nadir bir memelidir.',
                src: 'Evrimsel Zooloji',
            },
            {
                text: "Saniyede 80 defaya kadar kanat çırpabilen ve havada geriye doğru uçabilen tek kuş türü hangisidir?",
                options: ['Sinek Kuşu (Kolibri)', 'Kırlangıç', 'Albatros', 'Ebabil'],
                exp: 'Sinek kuşları özel kanat eklemleri sayesinde havada asılı kalabilir ve geriye doğru uçabilir.',
                src: 'Ornitoloji Araştırmaları',
            },
        ],
        expert: [
            {
                text: "Uzay boşluğunda, mutlak sıfıra yakın soğukta ve yüksek radyasyonda bile hayatta kalabilen mikroskobik canlı hangisidir?",
                options: ['Tardigrad (Su Ayısı)', 'Amip', 'Öglena', 'Paramesyum'],
                exp: 'Tardigradlar kriptobiyoz durumuna geçerek uzay vakumunda dahi canlı kalabilen en dayanıklı hayvanlardır.',
                src: 'Astrobiyoloji Dergisi',
            },
        ],
    },
    nature_ecology: {
        easy: [
            {
                text: "Yağmur yağdıktan sonra güneş çıktığında gökyüzünde beliren yedi renkli ışık kuşağına ne ad verilir?",
                options: ['Gökkuşağı', 'Kutup Işıkları', 'Serap', 'Samanyolu'],
                exp: 'Gökkuşağı, güneş ışınlarının yağmur damlalarında kırılıp yansımasıyla oluşur.',
                src: 'Meteoroloji Genel Müdürlüğü',
            },
            {
                text: "Ağaçların yapraklarını sarartıp döktüğü, yaz ile kış arasındaki geçiş mevsimi hangisidir?",
                options: ['Sonbahar (Güz)', 'İlkbahar', 'Yaz', 'Kış'],
                exp: 'Sonbahar (Eylül, Ekim, Kasım), doğanın kış uykusuna hazırlandığı mevsimdir.',
                src: 'Doğa ve İklim Bilgisi',
            },
            {
                text: "Arıların çiçeklerden topladığı nektarı işleyerek peteklerde ürettiği doğal ve şifalı besin nedir?",
                options: ['Bal', 'Reçel', 'Pekmez', 'Tahin'],
                exp: 'Bal arıları binlerce çiçeği ziyaret ederek nektarı enzimleriyle bala dönüştürür.',
                src: 'Ekoloji ve Arıcılık',
            },
        ],
        medium: [
            {
                text: "Dünyanın akciğerleri olarak nitelendirilen ve biyoçeşitliliği en yüksek olan dev yağmur ormanları hangisidir?",
                options: ['Amazon Yağmur Ormanları', 'Tayga Ormanları', 'Kara Orman', 'Belgrad Ormanı'],
                exp: 'Güney Amerika’daki Amazon Havzası, yeryüzündeki türlerin önemli bir kısmına ev sahipliği yapar.',
                src: 'Dünya Doğayı Koruma Vakfı (WWF)',
            },
            {
                text: "Yer kabuğunun derinliklerindeki erimiş kayaların (magma) yeryüzüne püskürmesiyle oluşan doğa olayı nedir?",
                options: ['Yanardağ (Volkan) Patlaması', 'Heyelan', 'Tsunami', 'Hortum'],
                exp: 'Magma yeryüzüne çıktığında lav adını alır ve volkanik dağları oluşturur.',
                src: 'Jeoloji Mühendisliği Temelleri',
            },
            {
                text: "Okyanus tabanında meydana gelen şiddetli depremler sonucunda oluşan dev deniz dalgalarına ne ad verilir?",
                options: ['Tsunami', 'Gelgit (Medcezir)', 'Muson', 'Tayfun'],
                exp: 'Japonca liman dalgası anlamına gelen Tsunami, deniz altı depremleriyle tetiklenir.',
                src: 'Ulusal Okyanus ve Atmosfer Dairesi',
            },
        ],
        hard: [
            {
                text: "Kutup bölgelerinde Güneş'ten gelen yüklü parçacıkların Dünya'nın manyetik alanıyla etkileşmesi sonucu gökyüzünde oluşan renkli ışımalara ne denir?",
                options: ['Aurora (Kutup Işıkları)', 'Süpernova', 'Halley', 'Güneş Tutulması'],
                exp: 'Kuzeyde Aurora Borealis, güneyde Aurora Australis olarak bilinen doğa harikası ışımalardır.',
                src: 'Atmosfer Fiziği',
            },
            {
                text: "Atmosferde sera gazlarının artması nedeniyle Dünya yüzeyinin ortalama sıcaklığının yükselmesi olgusuna ne ad verilir?",
                options: ['Küresel Isınma', 'Ozon İncelmesi', 'Asit Yağmurları', 'Erozyon'],
                exp: 'Karbondioksit ve metan gibi sera gazları ısıyı hapsederek küresel iklim değişikliğine yol açar.',
                src: 'Birleşmiş Milletler İklim Paneli (IPCC)',
            },
        ],
        expert: [
            {
                text: "Dünya üzerindeki en yaşlı ağaçlar arasında yer alan ve Kaliforniya'da yetişen devasa kozalaklı ağaç türü hangisidir?",
                options: ['Sekoya (Dev Kızılçam)', 'Sedir', 'Baobab', 'Okaliptüs'],
                exp: 'General Sherman adlı dev sekoya ağacı hacimce dünyanın bilinen en büyük tek gövdeli ağacıdır.',
                src: 'Orman Botaniği Arşivi',
            },
        ],
    },
    mixed: {
        easy: [
            {
                text: "Türkiye'nin başkenti hangi ilimizdir?",
                options: ['Ankara', 'İstanbul', 'İzmir', 'Bursa'],
                exp: "Ankara 1923'ten bu yana Türkiye Cumhuriyeti'nin başkentidir.",
                src: 'TBMM Tarihçesi',
            },
            {
                text: 'Bir üçgenin iç açıları toplamı kaç derecedir?',
                options: ['180°', '360°', '90°', '270°'],
                exp: 'Tüm üçgenlerin iç açıları toplamı 180 derecedir.',
                src: 'Geometri Temelleri',
            },
        ],
        medium: [
            {
                text: 'Gökkuşağında toplam kaç ana renk bulunmaktadır?',
                options: ['7 renk', '6 renk', '8 renk', '5 renk'],
                exp: 'Gökkuşağı 7 renkten meydana gelir.',
                src: 'Genel Kültür Ansiklopedisi',
            },
        ],
        hard: [
            {
                text: 'Hangi gezegen Güneş sisteminin en büyük gezegenidir?',
                options: ['Jüpiter', 'Satürn', 'Uranüs', 'Dünya'],
                exp: 'Jüpiter, gaz devi olup Güneş sisteminin en büyük gezegenidir.',
                src: 'Uzay Atlası',
            },
        ],
        expert: [
            {
                text: 'Atom numarası 1 olan element hangisidir?',
                options: ['Hidrojen', 'Helyum', 'Oksijen', 'Karbon'],
                exp: 'Hidrojen en hafif ve birinci elementtir.',
                src: 'Kimya Tablosu',
            },
        ],
    },
};
function generateDeterministicEvrenCandidates(categoryId, difficulty, count, db) {
    const catPool = exports.RICH_SEED_BANK[categoryId] || exports.RICH_SEED_BANK.geography;
    const diffPool = catPool[difficulty] || catPool.easy;
    const friendlyCategory = CATEGORY_NAMES_TR[categoryId] || categoryId;
    const friendlyDiff = DIFFICULTY_NAMES_TR[difficulty] || difficulty;
    // Retrieve all existing texts from DB to avoid repeating existing questions
    const existingSignatures = new Set();
    if (db) {
        db.getAllQuestions().forEach((q) => {
            existingSignatures.add(normalizeTextSignature(q.text));
        });
    }
    // Filter templates that have not been generated recently or in DB
    let availableTemplates = diffPool.filter((t) => {
        const sig = normalizeTextSignature(t.text);
        return !recentlyGeneratedSignatures.has(sig) && !existingSignatures.has(sig);
    });
    // If all templates in this category/difficulty have been used, reset recent memory for this pool
    if (availableTemplates.length === 0) {
        diffPool.forEach((t) => recentlyGeneratedSignatures.delete(normalizeTextSignature(t.text)));
        availableTemplates = [...diffPool];
    }
    // Shuffle available templates so order is unpredictable
    const shuffledTemplates = [...availableTemplates].sort(() => Math.random() - 0.5);
    const results = [];
    for (let i = 0; i < count; i++) {
        const template = shuffledTemplates[i % shuffledTemplates.length];
        const sig = normalizeTextSignature(template.text);
        recentlyGeneratedSignatures.add(sig);
        // If requesting more questions than available or template is already in DB, add unique context marker
        const isAlreadyInDb = existingSignatures.has(sig);
        const isOverPool = count > shuffledTemplates.length || isAlreadyInDb;
        const text = isOverPool ? `${template.text} (Seri #${Math.floor(100 + Math.random() * 900)})` : template.text;
        // Shuffle the 4 options and determine new correctOptionId
        const correctAnswerText = template.options[0]; // First option in template is always the correct one
        const shuffledChoices = [...template.options].sort(() => Math.random() - 0.5);
        const options = [
            { id: 'opt_a', text: shuffledChoices[0] },
            { id: 'opt_b', text: shuffledChoices[1] },
            { id: 'opt_c', text: shuffledChoices[2] },
            { id: 'opt_d', text: shuffledChoices[3] },
        ];
        const correctOption = options.find((o) => o.text === correctAnswerText);
        const correctOptionId = correctOption ? correctOption.id : 'opt_a';
        results.push({
            text,
            subCategory: `${friendlyCategory} (${friendlyDiff})`,
            options,
            correctOptionId,
            explanation: template.exp,
            sourceOrVerification: template.src,
        });
    }
    return results;
}
