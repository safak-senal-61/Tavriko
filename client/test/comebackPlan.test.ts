import { describe, expect, it } from 'vitest';
import { COMEBACK_MESSAGES, planComebackReminders, shiftOutOfQuietHours } from '../src/services/comebackPlan';

const at = (h: number, m = 0, day = 10) => new Date(2026, 10, day, h, m, 0, 0).getTime();
const H = 3_600_000;

describe('shiftOutOfQuietHours', () => {
  it('gündüz saatlerini değiştirmez', () => {
    expect(shiftOutOfQuietHours(at(14))).toBe(at(14));
  });
  it('gece saatlerini sabah 10:00a kaydırır', () => {
    expect(shiftOutOfQuietHours(at(23))).toBe(at(10, 0, 11));
    expect(shiftOutOfQuietHours(at(3))).toBe(at(10));
    expect(shiftOutOfQuietHours(at(9, 29))).toBe(at(10));
    expect(shiftOutOfQuietHours(at(9, 30))).toBe(at(9, 30));
  });
});

describe('planComebackReminders', () => {
  it('ilk hatırlatma 2 saat sonra gelir', () => {
    const plan = planComebackReminders(at(12), 0);
    expect(plan[0].at).toBe(at(14));
    expect(plan.length).toBe(5);
  });
  it('hiçbir hatırlatma sessiz saate düşmez ve aralar en az 90 dk', () => {
    for (let hour = 0; hour < 24; hour++) {
      const plan = planComebackReminders(at(hour), hour);
      expect(plan.length).toBeGreaterThanOrEqual(3);
      plan.forEach((item, i) => {
        const d = new Date(item.at);
        const mins = d.getHours() * 60 + d.getMinutes();
        expect(mins >= 9 * 60 + 30 && mins < 22 * 60).toBe(true);
        if (i > 0) expect(item.at - plan[i - 1].at).toBeGreaterThanOrEqual(90 * 60_000);
      });
    }
  });
  it('mesajları döndürür', () => {
    const a = planComebackReminders(at(12), 0).map((p) => p.message.title);
    const b = planComebackReminders(at(12), 1).map((p) => p.message.title);
    expect(a[0]).not.toBe(b[0]);
    expect(new Set(a).size).toBe(a.length);
    expect(COMEBACK_MESSAGES.length).toBeGreaterThanOrEqual(5);
  });
  it('son hatırlatma ~3 gün içinde biter', () => {
    const plan = planComebackReminders(at(12), 0);
    expect(plan[plan.length - 1].at - at(12)).toBeLessThanOrEqual(73 * H);
  });
});
