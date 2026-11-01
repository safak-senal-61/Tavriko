import { Question, CategoryId, DifficultyLevel, QuestionOption } from '@trivia/shared';
import type { DatabaseAdapter } from '../db/prismaClient';

export interface ImportResult {
  success: boolean;
  totalProcessed: number;
  importedCount: number;
  duplicateCount: number;
  errorCount: number;
  questions: Question[];
  errors: string[];
  categoryBreakdown: Record<string, number>;
}

const CATEGORY_MAP_TR: Record<string, CategoryId> = {
  cografya: 'geography',
  coğrafya: 'geography',
  geography: 'geography',
  tarih: 'history',
  history: 'history',
  matematik: 'mathematics',
  mathematics: 'mathematics',
  genel: 'general_culture',
  genel_kultur: 'general_culture',
  'genel kültür': 'general_culture',
  general_culture: 'general_culture',
  bilim: 'science_tech',
  teknoloji: 'science_tech',
  bilim_teknoloji: 'science_tech',
  'bilim & teknoloji': 'science_tech',
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
  literature: 'literature',
  biyoloji: 'biology',
  biology: 'biology',
  fizik: 'physics_chemistry',
  kimya: 'physics_chemistry',
  physics_chemistry: 'physics_chemistry',
  mantik: 'logic_puzzles',
  mantık: 'logic_puzzles',
  zeka: 'logic_puzzles',
  logic_puzzles: 'logic_puzzles',
  dil: 'language_vocab',
  kelime: 'language_vocab',
  language_vocab: 'language_vocab',
  sanat: 'art_culture',
  kultur: 'art_culture',
  kültür: 'art_culture',
  art_culture: 'art_culture',
  yemek: 'food_gastronomy',
  mutfak: 'food_gastronomy',
  gastronomi: 'food_gastronomy',
  food_gastronomy: 'food_gastronomy',
  hayvanlar: 'animals_wildlife',
  animals_wildlife: 'animals_wildlife',
  doga: 'nature_ecology',
  doğa: 'nature_ecology',
  ekoloji: 'nature_ecology',
  nature_ecology: 'nature_ecology',
  karma: 'mixed',
  mixed: 'mixed',
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
};

export function parseAndNormalizeQuestions(jsonString: string): any[] {
  let cleaned = jsonString.trim();

  // Strip markdown code fences if wrapped in ```json ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  // Attempt direct JSON parse
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'object' && parsed !== null) {
      if (Array.isArray((parsed as any).questions)) return (parsed as any).questions;
      if (Array.isArray((parsed as any).sorular)) return (parsed as any).sorular;
      return [parsed];
    }
  } catch {}

  // Attempt to find JSON array regex match: [ { ... }, { ... } ]
  const arrayMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  // Attempt to find single JSON object regex match: { ... }
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const parsed = JSON.parse(objMatch[0]);
      if (typeof parsed === 'object' && parsed !== null) return [parsed];
    } catch {}
  }

  throw new Error('Geçerli bir JSON formatı bulunamadı. Lütfen JSON sözdizimini kontrol edin.');
}

export function importQuestionsFromJson(
  rawInput: string | any[],
  db: DatabaseAdapter,
  addedBy = 'Telegram Admin',
  publishDirectly = true
): ImportResult {
  const result: ImportResult = {
    success: false,
    totalProcessed: 0,
    importedCount: 0,
    duplicateCount: 0,
    errorCount: 0,
    questions: [],
    errors: [],
    categoryBreakdown: {},
  };

  let rawList: any[] = [];
  try {
    if (Array.isArray(rawInput)) {
      rawList = rawInput;
    } else {
      rawList = parseAndNormalizeQuestions(String(rawInput));
    }
  } catch (err: any) {
    result.errors.push(err.message);
    return result;
  }

  result.totalProcessed = rawList.length;
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

    const textSig = text.toLowerCase().replace(/[^a-z0-9ğüşıöç]/gi, '').trim();
    if (existingSignatures.has(textSig)) {
      result.duplicateCount++;
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
    let targetPool: 'standard' | 'daily_challenge' | 'custom_room' = 'standard';
    const rawPool = (raw.targetPool || raw.havuz || '').toString().toLowerCase();
    if (rawPool.includes('gunluk') || rawPool.includes('daily')) {
      targetPool = 'daily_challenge';
    } else if (rawPool.includes('ozel') || rawPool.includes('custom') || rawPool.includes('oda')) {
      targetPool = 'custom_room';
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
    } catch (saveErr: any) {
      result.errorCount++;
      result.errors.push(`${indexLabel}: Kayıt hatası: ${saveErr.message}`);
    }
  }

  result.success = result.importedCount > 0;
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
