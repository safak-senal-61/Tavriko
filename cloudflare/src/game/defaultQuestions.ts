import { Question, CategoryId, DifficultyLevel } from '@trivia/shared';

export const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 'def_q_geo_1',
    categoryId: 'geography',
    difficulty: 'easy',
    text: 'Türkiye\'nin başkenti neresidir?',
    options: [
      { id: 'opt_1', text: 'İstanbul' },
      { id: 'opt_2', text: 'Ankara' },
      { id: 'opt_3', text: 'İzmir' },
      { id: 'opt_4', text: 'Bursa' },
    ],
    correctOptionId: 'opt_2',
    explanation: 'Türkiye Cumhuriyeti\'nin başkenti 13 Ekim 1923\'te Ankara olmuştur.',
    timeLimitSec: 15,
  },
  {
    id: 'def_q_geo_2',
    categoryId: 'geography',
    difficulty: 'medium',
    text: 'Dünyanın en uzun nehri aşağıdakilerden hangisidir?',
    options: [
      { id: 'opt_1', text: 'Amazon' },
      { id: 'opt_2', text: 'Nil' },
      { id: 'opt_3', text: 'Yangtze' },
      { id: 'opt_4', text: 'Mississippi' },
    ],
    correctOptionId: 'opt_2',
    explanation: 'Afrika kıtasında yer alan Nil Nehri yaklaşık 6.650 km uzunluğundadır.',
    timeLimitSec: 15,
  },
  {
    id: 'def_q_hist_1',
    categoryId: 'history',
    difficulty: 'easy',
    text: 'Cumhuriyet hangi yıl ilan edilmiştir?',
    options: [
      { id: 'opt_1', text: '1919' },
      { id: 'opt_2', text: '1920' },
      { id: 'opt_3', text: '1923' },
      { id: 'opt_4', text: '1924' },
    ],
    correctOptionId: 'opt_3',
    explanation: 'Türkiye Cumhuriyeti 29 Ekim 1923 tarihinde resmen ilan edilmiştir.',
    timeLimitSec: 15,
  },
  {
    id: 'def_q_hist_2',
    categoryId: 'history',
    difficulty: 'medium',
    text: 'İstanbul hangi padişah döneminde fethedilmiştir?',
    options: [
      { id: 'opt_1', text: 'Yavuz Sultan Selim' },
      { id: 'opt_2', text: 'Fatih Sultan Mehmet' },
      { id: 'opt_3', text: 'Kanuni Sultan Süleyman' },
      { id: 'opt_4', text: 'Yıldırım Bayezid' },
    ],
    correctOptionId: 'opt_2',
    explanation: 'İstanbul 29 Mayıs 1453\'te II. Mehmet (Fatih Sultan Mehmet) tarafından fethedildi.',
    timeLimitSec: 15,
  },
  {
    id: 'def_q_sci_1',
    categoryId: 'science_tech',
    difficulty: 'easy',
    text: 'Güneş sistemimizin en büyük gezegeni hangisidir?',
    options: [
      { id: 'opt_1', text: 'Mars' },
      { id: 'opt_2', text: 'Satürn' },
      { id: 'opt_3', text: 'Jüpiter' },
      { id: 'opt_4', text: 'Neptün' },
    ],
    correctOptionId: 'opt_3',
    explanation: 'Jüpiter, Güneş sistemindeki en büyük kütle ve hacme sahip gaz devidir.',
    timeLimitSec: 15,
  },
  {
    id: 'def_q_sci_2',
    categoryId: 'science_tech',
    difficulty: 'medium',
    text: 'Periyodik tabloda "Au" sembolü hangi elementi temsil eder?',
    options: [
      { id: 'opt_1', text: 'Gümüş' },
      { id: 'opt_2', text: 'Altın' },
      { id: 'opt_3', text: 'Bakır' },
      { id: 'opt_4', text: 'Alüminyum' },
    ],
    correctOptionId: 'opt_2',
    explanation: 'Au, Latince "Aurum" kelimesinden gelen Altın elementinin simgesidir.',
    timeLimitSec: 15,
  },
  {
    id: 'def_q_gen_1',
    categoryId: 'general_culture',
    difficulty: 'easy',
    text: 'Mona Lisa tablosu hangi ünlü ressama aittir?',
    options: [
      { id: 'opt_1', text: 'Vincent van Gogh' },
      { id: 'opt_2', text: 'Leonardo da Vinci' },
      { id: 'opt_3', text: 'Pablo Picasso' },
      { id: 'opt_4', text: 'Michelangelo' },
    ],
    correctOptionId: 'opt_2',
    explanation: 'Mona Lisa, Leonardo da Vinci tarafından 16. yüzyılın başlarında yapılmıştır.',
    timeLimitSec: 15,
  },
  {
    id: 'def_q_sport_1',
    categoryId: 'sports',
    difficulty: 'easy',
    text: 'Futbolda bir takım sahada kaç oyuncu ile mücadele eder?',
    options: [
      { id: 'opt_1', text: '9' },
      { id: 'opt_2', text: '10' },
      { id: 'opt_3', text: '11' },
      { id: 'opt_4', text: '12' },
    ],
    correctOptionId: 'opt_3',
    explanation: 'Standart futbol kurallarına göre bir takım 1 kaleci ve 10 saha oyuncusu olmak üzere 11 kişiyle sahaya çıkar.',
    timeLimitSec: 15,
  },
  {
    id: 'def_q_cine_1',
    categoryId: 'cinema_tv',
    difficulty: 'medium',
    text: 'Oscar ödüllerini dağıtan Akademi\'nin resmi adı nedir?',
    options: [
      { id: 'opt_1', text: 'Hollywood Sinema Birliği' },
      { id: 'opt_2', text: 'Sinema Sanatları ve Bilimleri Akademisi (AMPAS)' },
      { id: 'opt_3', text: 'Amerikan Film Enstitüsü' },
      { id: 'opt_4', text: 'Uluslararası Film Eleştirmenleri Federasyonu' },
    ],
    correctOptionId: 'opt_2',
    explanation: 'Oscar ödülleri, Sinema Sanatları ve Bilimleri Akademisi (AMPAS) tarafından verilir.',
    timeLimitSec: 15,
  },
  {
    id: 'def_q_music_1',
    categoryId: 'music',
    difficulty: 'easy',
    text: 'Piyano klavyesinde kaç tuş bulunur?',
    options: [
      { id: 'opt_1', text: '76' },
      { id: 'opt_2', text: '84' },
      { id: 'opt_3', text: '88' },
      { id: 'opt_4', text: '92' },
    ],
    correctOptionId: 'opt_3',
    explanation: 'Standart modern bir piyanoda 52 beyaz ve 36 siyah olmak üzere toplam 88 tuş bulunur.',
    timeLimitSec: 15,
  },
];

export function getFallbackQuestions(
  categoryId?: CategoryId,
  difficulty?: DifficultyLevel,
  count: number = 5
): Question[] {
  let pool = DEFAULT_QUESTIONS;

  if (categoryId && categoryId !== 'mixed') {
    const categoryMatches = pool.filter((q) => q.categoryId === categoryId);
    if (categoryMatches.length >= 2) {
      pool = categoryMatches;
    }
  }

  if (difficulty) {
    const difficultyMatches = pool.filter((q) => q.difficulty === difficulty);
    if (difficultyMatches.length >= 2) {
      pool = difficultyMatches;
    }
  }

  // Shuffle pool
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  // If count exceeds pool length, duplicate with new ids
  const result: Question[] = [];
  let idx = 0;
  while (result.length < count) {
    const base = shuffled[idx % shuffled.length];
    result.push({
      ...base,
      id: `${base.id}_round_${result.length + 1}_${Date.now()}`,
    });
    idx++;
  }
  return result.slice(0, count);
}
