import { mergeQuestionStores } from '../src/utils/questionStoreMerge';
import { Question } from '@trivia/shared';

const q = (id: string, over: Partial<Question> = {}): Question =>
  ({
    id,
    categoryId: 'geography',
    difficulty: 'easy',
    text: `Soru ${id}`,
    options: [
      { id: 'opt_a', text: 'A' },
      { id: 'opt_b', text: 'B' },
      { id: 'opt_c', text: 'C' },
      { id: 'opt_d', text: 'D' },
    ],
    correctOptionId: 'opt_a',
    explanation: '',
    timeLimitSec: 15,
    reviewStatus: 'published',
    contentHash: `hash_${id}`,
    createdAt: new Date().toISOString(),
    language: 'tr',
    ...over,
  } as Question);

describe('mergeQuestionStores — bayat örnek havuzu ezmemeli', () => {
  it('dokunulmayan sorularda bulut sürümü kazanır (diğer örneğin güncellemesi korunur)', () => {
    // Örnek A: q_1'i alt kategorili güncellemiş (bulutta)
    const cloud = [q('q_1', { subCategory: 'Türkiye’nin Bölgeleri' }), q('q_2')];
    // Örnek B: q_1'in ESKİ sürümünü hafızasında tutuyor, sadece q_2'yi düzenlemiş
    const local = [q('q_1'), q('q_2', { subCategory: 'Başkentler ve Para Birimleri' })];
    const edits = new Set(['q_2']);

    const merged = mergeQuestionStores(cloud, local, edits, new Set());
    const byId = new Map(merged.map((m) => [m.id, m]));

    // q_1: örnek B dokunmadı → buluttaki (güncel) sürüm korunmalı
    expect(byId.get('q_1')?.subCategory).toBe('Türkiye’nin Bölgeleri');
    // q_2: örnek B düzenledi → yerel sürüm yazılmalı
    expect(byId.get('q_2')?.subCategory).toBe('Başkentler ve Para Birimleri');
    expect(merged).toHaveLength(2);
  });

  it('yerel silinen sorular buluttan çıkarılır', () => {
    const cloud = [q('q_1'), q('q_2'), q('q_3')];
    const local = [q('q_2'), q('q_3')];
    const merged = mergeQuestionStores(cloud, local, new Set(), new Set(['q_1']));

    expect(merged.map((m) => m.id).sort()).toEqual(['q_2', 'q_3']);
  });

  it('yalnızca bulutta olan yeni sorular korunur, yalnızca yerelde olan eklenir', () => {
    const cloud = [q('cloud_only')];
    const local = [q('local_only')];

    const merged = mergeQuestionStores(cloud, local, new Set(), new Set());
    expect(merged.map((m) => m.id).sort()).toEqual(['cloud_only', 'local_only']);
  });

  it('bulut okunamadıysa tam yerel liste yazılır (eski davranış)', () => {
    const local = [q('q_1'), q('q_2')];
    const merged = mergeQuestionStores(null, local, new Set(), new Set());

    expect(merged).toHaveLength(2);
  });

  it('geçersiz bulut verisi (dizi değil) tam yerel listeye düşer', () => {
    const local = [q('q_1')];
    expect(mergeQuestionStores({ hata: true }, local, new Set(), new Set())).toHaveLength(1);
    expect(mergeQuestionStores(undefined, local, new Set(), new Set())).toHaveLength(1);
  });

  it('düzenlenen ve bulutta olmayan (yeni) soru yerel sürümle eklenir', () => {
    const cloud = [q('q_1')];
    const local = [q('q_1'), q('yeni', { subCategory: 'Geometri' })];
    const merged = mergeQuestionStores(cloud, local, new Set(['yeni']), new Set());

    expect(merged).toHaveLength(2);
    expect(merged.find((m) => m.id === 'yeni')?.subCategory).toBe('Geometri');
  });
});
