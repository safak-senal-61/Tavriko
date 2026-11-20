/**
 * Çözülen soru geçmişi (anti-tekrar).
 *
 * Pratik/tek kişilik testlerde aynı sorunun tekrar gelmemesi için, kapsam
 * (kategori + alt kategori) bazında çözülen soru ID'leri cihazda saklanır.
 * Soru isteklerinde `seenIds` olarak sunucuya gönderilir; kategori havuzu
 * tükenirse sunucu tekrar dönmeye devam eder (bilinçli davranış).
 *
 * Depolama:
 *  - Web: localStorage (tek JSON anahtarı).
 *  - Mobil: expo-file-system ile documentDirectory altında JSON dosyası
 *    (SecureStore'un ~2KB değer limiti binlerce soru ID'sini almaz).
 *
 * Bellek dostu: kapsam başına en fazla MAX_IDS_PER_SCOPE ID saklanır (FIFO).
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const STORAGE_KEY = 'tavriko_seen_questions';
const FILE_NAME = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory.replace(/\/$/, '')}/.tavriko_seen_questions.json`
  : null;
const MAX_IDS_PER_SCOPE = 1200;

/** localStorage benzeri basit kalıcı depo arayüzü. */
interface SeenStore {
  [scope: string]: string[];
}

let cache: SeenStore | null = null;
let loaded = Platform.OS === 'web';
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function parseStore(raw: string | null): SeenStore {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Depoyu yükler (mobilde dosyadan, web'de localStorage'tan). */
async function ensureLoaded(): Promise<void> {
  if (loaded && cache) return;
  if (Platform.OS === 'web') {
    try {
      cache = parseStore(typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null);
    } catch {
      cache = {};
    }
  } else if (FILE_NAME) {
    try {
      const info = await FileSystem.getInfoAsync(FILE_NAME);
      cache = info.exists ? parseStore(await FileSystem.readAsStringAsync(FILE_NAME)) : {};
    } catch {
      cache = {};
    }
  } else {
    cache = {};
  }
  loaded = true;
}

/** Depoyu geri yazar (mobilde kısa gecikmeli — her soruda disk I/O olmasın). */
function persist(): void {
  if (!cache) return;
  const payload = JSON.stringify(cache);
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(STORAGE_KEY, payload);
    } catch {
      // Kota dolu vb. — sessiz geç.
    }
  } else if (FILE_NAME) {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
      FileSystem.writeAsStringAsync(FILE_NAME, payload, { encoding: FileSystem.EncodingType.UTF8 }).catch(() => {});
    }, 400);
  }
}

/** Kapsam anahtarı: alt kategori seçimleri ayrı havuzlar gibi işlenir. */
export function seenScopeKey(category: string, subCategory?: string): string {
  const cat = (category || 'mixed').trim().toLowerCase();
  const sub = (subCategory || '').trim().toLowerCase();
  return sub ? `${cat}|${sub}` : cat;
}

/** Kapsamda çözüldüğü kayıtlı soru ID'lerini döndürür. */
export async function getSeenQuestionIds(scope: string): Promise<string[]> {
  await ensureLoaded();
  return cache?.[scope] ? [...cache![scope]] : [];
}

/** Soru ID'lerini kapsama ekler (kapasite dolunca en eski atılır). */
export async function markQuestionsSeen(scope: string, ids: string[]): Promise<void> {
  if (!scope || !ids || !ids.length) return;
  await ensureLoaded();
  const existing = cache![scope] || [];
  const set = new Set(existing);
  for (const id of ids) if (id) set.add(id);
  let arr = Array.from(set);
  if (arr.length > MAX_IDS_PER_SCOPE) {
    arr = arr.slice(arr.length - MAX_IDS_PER_SCOPE);
  }
  cache![scope] = arr;
  persist();
}

/** Kapsamı (veya verilmeyse tüm geçmişi) sıfırlar. */
export async function resetSeenQuestions(scope?: string): Promise<void> {
  await ensureLoaded();
  if (scope) {
    delete cache![scope];
  } else {
    cache = {};
  }
  persist();
}
