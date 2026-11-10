import { Question } from '@trivia/shared';

/**
 * Sunucusuz ortamda (Vercel) aynı anda birden fazla Lambda örneği çalışabilir.
 * Eski kod her yazmada örneğin TÜM bellek içi soru listesini bulut deposuna
 * (questions_store.json) yazıyordu; bayat bir örnek bu şekilde diğer
 * örneklerin yaptığı güncellemeleri ezebiliyordu.
 *
 * Bu fonksiyon iki tarafı GÜVENLİ birleştirir:
 * - Yerel olarak değiştirilen/silinen sorularda YEREL sürüm kazanır
 *   (bu örneğin güncellemesi kalıcı olur).
 * - Örneğin hiç dokunmadığı sorularda BULUT sürümü kazanır
 *   (diğer örneklerin güncellemeleri korunur, ezilmez).
 * - Yalnızca yerelde olan (yeni eklenen) sorular buluta eklenir.
 * - Yalnızca bulutta olan sorular (başka örneklerin yeni eklediği) korunur.
 */
export function mergeQuestionStores(
  cloudQuestions: unknown,
  localQuestions: Question[],
  localEdits: Set<string>,
  localDeletes: Set<string>
): Question[] {
  if (!Array.isArray(cloudQuestions)) {
    // Bulut okunamadıysa mevcut davranışa dön: tam yerel liste yazılır.
    return [...localQuestions];
  }

  const byId = new Map<string, Question>();
  for (const raw of cloudQuestions) {
    const cq = raw as Question | null;
    if (cq && cq.id && !byId.has(cq.id)) {
      byId.set(cq.id, cq);
    }
  }

  // Yerel olarak silinenler buluttan çıkarılır
  for (const id of localDeletes) {
    byId.delete(id);
  }

  // Yerel değişiklikler ve yeni sorular yerel sürümle yazılır
  for (const q of localQuestions) {
    if (q && q.id && (localEdits.has(q.id) || !byId.has(q.id))) {
      byId.set(q.id, q);
    }
  }

  return [...byId.values()];
}
