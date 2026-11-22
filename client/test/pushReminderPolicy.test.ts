import { describe, expect, it } from 'vitest';
import {
  deferPushReminder, INITIAL_PUSH_REMINDER, parsePushReminder, pushReminderDue,
} from '../src/services/pushReminderPolicy';

const DAY = 86_400_000;

describe('push reminders', () => {
  it('spaces suggestions by 3, 7, then 14 days and never more often than every 14 days thereafter', () => {
    let now = 1_700_000_000_000;
    let preference = INITIAL_PUSH_REMINDER;
    for (const days of [3, 7, 14, 14]) {
      expect(pushReminderDue(preference, now)).toBe(true);
      preference = deferPushReminder(preference, now);
      expect(preference.nextAt).toBe(now + days * DAY);
      expect(pushReminderDue(preference, preference.nextAt - 1)).toBe(false);
      now = preference.nextAt;
    }
  });

  it('honors the persistent stop choice and rejects corrupted data', () => {
    const stored = { shown: 3, nextAt: 100, stopped: true };
    expect(parsePushReminder(JSON.stringify(stored))).toEqual(stored);
    expect(pushReminderDue(stored, 999)).toBe(false);
    expect(parsePushReminder('invalid json')).toEqual(INITIAL_PUSH_REMINDER);
    expect(parsePushReminder(JSON.stringify({ ...stored, shown: -1 }))).toEqual(INITIAL_PUSH_REMINDER);
  });
});
