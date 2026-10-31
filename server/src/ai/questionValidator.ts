import { Question, CategoryId, DifficultyLevel } from '@trivia/shared';
import { DatabaseAdapter, computeQuestionHash } from '../db/prismaClient';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

const VALID_CATEGORIES: CategoryId[] = [
  'geography',
  'mathematics',
  'general_culture',
  'history',
  'science_tech',
  'space_astronomy',
  'sports',
  'cinema_tv',
  'music',
  'literature',
  'biology',
  'physics_chemistry',
  'logic_puzzles',
  'language_vocab',
  'art_culture',
  'mixed',
];

const VALID_DIFFICULTIES: DifficultyLevel[] = ['easy', 'medium', 'hard', 'expert'];

/**
 * 10-Point Authoritative Trivia Question Validator
 */
export function validateQuestion(
  q: Partial<Question>,
  db?: DatabaseAdapter
): ValidationResult {
  const errors: string[] = [];

  // Check 1: Soru metni boş olamaz, en az 10 karakter olmalı
  if (!q.text || typeof q.text !== 'string' || q.text.trim().length < 10) {
    errors.push('Check 1: Soru metni en az 10 karakter uzunluğunda olmalıdır.');
  }

  // Check 2: Tam olarak 4 seçenek bulunmalıdır
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    errors.push(`Check 2: Tam olarak 4 seçenek bulunmalıdır (Mevcut: ${q.options?.length || 0}).`);
  } else {
    // Check 3: Tüm seçenek metinleri boş olamaz
    const emptyOption = q.options.some((opt) => !opt.text || opt.text.trim().length === 0);
    if (emptyOption) {
      errors.push('Check 3: Hiçbir seçenek metni boş bırakılamaz.');
    }

    // Check 4: Seçenekler birbirinden farklı olmalıdır (tekrar eden şık olamaz)
    const normalizedOptions = q.options.map((opt) => opt.text.trim().toLowerCase());
    const uniqueOptions = new Set(normalizedOptions);
    if (uniqueOptions.size !== q.options.length) {
      errors.push('Check 4: Seçenekler birbirinden farklı olmalı, tekrar eden seçenek bulunamaz.');
    }

    // Check 5: Doğru cevap ID'si seçenekler arasında var olmalıdır
    const validOptionIds = q.options.map((opt) => opt.id);
    if (!q.correctOptionId || !validOptionIds.includes(q.correctOptionId)) {
      errors.push('Check 5: Belirtilen doğru cevap ID\'si (correctOptionId) seçenekler arasında bulunamadı.');
    }

    // Check 6: Tam olarak 1 adet doğru cevap olmalıdır
    const matchingCount = q.options.filter((opt) => opt.id === q.correctOptionId).length;
    if (matchingCount !== 1) {
      errors.push('Check 6: Tam olarak 1 adet doğru cevap eşleşmelidir.');
    }
  }

  // Check 7: Doğru cevabın açıklaması boş olamaz, en az 10 karakter olmalıdır
  if (!q.explanation || typeof q.explanation !== 'string' || q.explanation.trim().length < 10) {
    errors.push('Check 7: Doğru cevap açıklaması en az 10 karakter olmalı ve öğretici olmalıdır.');
  }

  // Check 8: Kategori ve zorluk seviyesi geçerli olmalıdır
  if (!q.categoryId || !VALID_CATEGORIES.includes(q.categoryId)) {
    errors.push(`Check 8: Geçersiz kategori (${q.categoryId}).`);
  }
  if (!q.difficulty || !VALID_DIFFICULTIES.includes(q.difficulty)) {
    errors.push(`Check 8: Geçersiz zorluk seviyesi (${q.difficulty}).`);
  }

  // Check 9: Soru dili geçerli olmalıdır ('tr')
  if (q.language && q.language !== 'tr') {
    errors.push(`Check 9: Desteklenen soru dili 'tr' olmalıdır (Mevcut: ${q.language}).`);
  }

  // Check 10: İçerik özgünlüğü ve mükerrer kayıt kontrolü (Duplicate hash)
  if (db && q.text && Array.isArray(q.options) && q.options.length === 4) {
    const hash = q.contentHash || computeQuestionHash(q.text, q.options);
    if (db.hasQuestionHash(hash)) {
      errors.push('Check 10: Bu soru veya çok benzer bir varyasyonu veritabanında zaten kayıtlıdır (Mükerrer hash).');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
