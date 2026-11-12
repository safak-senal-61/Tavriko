import type { NotificationItem } from '@trivia/shared';

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/** Bildirim kimliği "notif_xxx_<epochMs>" biçiminde ise zamanı oradan çıkarır (eski kayıtlar için). */
function timestampFromId(id: string): number | null {
  const m = /(\d{13})$/.exec(id || '');
  if (!m) return null;
  const ts = Number(m[1]);
  return Number.isFinite(ts) ? ts : null;
}

export function getNotificationTimestamp(item: Pick<NotificationItem, 'id' | 'createdAt'>): number | null {
  const ts = Number(item.createdAt);
  if (Number.isFinite(ts) && ts > 0) return ts;
  return timestampFromId(item.id);
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Tam saatli bildirim zamanı (cihazın yerel saat dilimine göre):
 *  - Bugün  → "Bugün 14:32"
 *  - Dün    → "Dün 21:05"
 *  - Diğer  → "12 Kas 14:32" (farklı yıl ise "12 Kas 2025 14:32")
 */
export function formatNotificationTime(item: Pick<NotificationItem, 'id' | 'createdAt' | 'timeText'>, now: Date = new Date()): string {
  const ts = getNotificationTimestamp(item);
  if (ts === null) return item.timeText || '';
  const d = new Date(ts);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return `Bugün ${time}`;
  if (diffDays === 1) return `Dün ${time}`;
  const year = d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year} ${time}`;
}
