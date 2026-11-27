/**
 * "Oyuna dön" hatırlatmalarının zamanlaması (saf fonksiyonlar, test edilebilir).
 *
 * Uygulama arka plana geçince cihazda yerel bildirimler planlanır; oyuncu
 * geri dönünce hepsi iptal edilir. İlk hatırlatma 2 saat sonra gelir.
 * Gece (22:00–09:30) bildirim atılmaz; o saate düşen hatırlatma sabah 10:00'a kayar.
 */

const HOUR = 3_600_000;
export const COMEBACK_OFFSETS_HOURS = [2, 5, 24, 48, 72] as const;
const QUIET_START_MINUTES = 22 * 60;
const QUIET_END_MINUTES = 9 * 60 + 30;
const MORNING_HOUR = 10;
/** Kayma sonrası birbirine bu kadar yakın düşen hatırlatmalardan sonraki atılır. */
const MIN_GAP_MS = 90 * 60_000;

export interface ComebackMessage {
  title: string;
  body: string;
  screen: 'home' | 'season' | 'friends' | 'events' | 'shop';
}

export const COMEBACK_MESSAGES: readonly ComebackMessage[] = [
  { title: 'Rakiplerin ısınıyor', body: 'Hızlı bir düello yapıp lig sıralamanı koru. Sadece 2 dakika.', screen: 'home' },
  { title: 'Ödüllerin seni bekliyor', body: 'Toplanmayı bekleyen sezon ödüllerin olabilir. Hemen bir göz at.', screen: 'season' },
  { title: 'Arkadaşların oyunda', body: 'Arkadaşlarını düelloya davet et, kim daha çok biliyor görelim.', screen: 'friends' },
  { title: 'Günlük görevler yenilendi', body: 'Görevleri tamamla, altın ve elmas kazan.', screen: 'events' },
  { title: 'Serini bozma', body: 'Bugün bir maç yap, serin ve sezon XP\'in artmaya devam etsin.', screen: 'home' },
  { title: 'Yeni sorular geldi', body: 'Bilgini test et, rekorunu bir adım daha yukarı taşı.', screen: 'home' },
];

/** Verilen an sessiz saatlere denk geliyorsa sabah 10:00'a kaydırır. */
export function shiftOutOfQuietHours(at: number): number {
  const date = new Date(at);
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= QUIET_START_MINUTES) {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    next.setHours(MORNING_HOUR, 0, 0, 0);
    return next.getTime();
  }
  if (minutes < QUIET_END_MINUTES) {
    const next = new Date(date);
    next.setHours(MORNING_HOUR, 0, 0, 0);
    return next.getTime();
  }
  return at;
}

export interface PlannedReminder {
  at: number;
  message: ComebackMessage;
}

/** `seed`: mesaj rotasyonu için (ör. gün numarası) — her seferinde aynı metin gelmesin. */
export function planComebackReminders(now: number, seed: number): PlannedReminder[] {
  const plan: PlannedReminder[] = [];
  let last = -Infinity;
  COMEBACK_OFFSETS_HOURS.forEach((hours, index) => {
    const at = shiftOutOfQuietHours(now + hours * HOUR);
    if (at - last < MIN_GAP_MS) return;
    last = at;
    const message = COMEBACK_MESSAGES[Math.abs(seed + index) % COMEBACK_MESSAGES.length];
    plan.push({ at, message });
  });
  return plan;
}
