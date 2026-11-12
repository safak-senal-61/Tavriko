import { describe, it, expect } from 'vitest';
import { formatNotificationTime } from './notificationTime';

describe('formatNotificationTime', () => {
  const now = new Date(2026, 10, 13, 15, 0, 0);
  it('bugünü saatiyle gösterir', () => {
    const ts = new Date(2026, 10, 13, 9, 5).getTime();
    expect(formatNotificationTime({ id: 'a', createdAt: ts, timeText: 'Az önce' }, now)).toBe('Bugün 09:05');
  });
  it('dünü gösterir', () => {
    const ts = new Date(2026, 10, 12, 21, 30).getTime();
    expect(formatNotificationTime({ id: 'a', createdAt: ts, timeText: 'Az önce' }, now)).toBe('Dün 21:30');
  });
  it('eski günü tarihle gösterir', () => {
    const ts = new Date(2026, 9, 2, 8, 0).getTime();
    expect(formatNotificationTime({ id: 'a', createdAt: ts, timeText: 'Az önce' }, now)).toBe('2 Eki 08:00');
  });
  it('createdAt yoksa kimlikteki zamanı kullanır', () => {
    const ts = new Date(2026, 10, 13, 10, 7).getTime();
    expect(formatNotificationTime({ id: `notif_fr_${ts}`, timeText: 'Az önce' }, now)).toBe('Bugün 10:07');
  });
});
