import { describe, expect, it } from 'vitest';
import {
  deferPushReminder, INITIAL_PUSH_REMINDER, parsePushReminder, pushReminderDue, shortenPushReminderSchedule,
  PUSH_REMINDER_FOREGROUND_DELAY_MS,
} from '../src/services/pushReminderPolicy';

const HOUR = 3_600_000;

describe('push reminders', () => {
  it('first waits five seconds, then spaces suggestions by 6, 24, 48 and 72 hours', () => {
    expect(PUSH_REMINDER_FOREGROUND_DELAY_MS).toBe(5_000);
    let now = 1_700_000_000_000;
    let preference = INITIAL_PUSH_REMINDER;
    for (const hours of [6, 24, 48, 72, 72]) {
      expect(pushReminderDue(preference, now)).toBe(true);
      preference = deferPushReminder(preference, now);
      expect(preference.nextAt).toBe(now + hours * HOUR);
      expect(pushReminderDue(preference, preference.nextAt - 1)).toBe(false);
      now = preference.nextAt;
    }
  });

  it('shortens legacy schedules while preserving opt-outs and already-due reminders', () => {
    const now = 1_700_000_000_000;
    const old = { shown: 1, nextAt: now + 72 * HOUR, stopped: false };
    expect(shortenPushReminderSchedule(old, now).nextAt).toBe(now + 6 * HOUR);
    expect(shortenPushReminderSchedule({ ...old, stopped: true }, now).nextAt).toBe(old.nextAt);
    expect(shortenPushReminderSchedule({ ...old, nextAt: now - 1 }, now).nextAt).toBe(now - 1);
  });

  it('honors the persistent stop choice and rejects corrupted data', () => {
    const stored = { shown: 3, nextAt: 100, stopped: true };
    expect(parsePushReminder(JSON.stringify(stored))).toEqual(stored);
    expect(pushReminderDue(stored, 999)).toBe(false);
    expect(parsePushReminder('invalid json')).toEqual(INITIAL_PUSH_REMINDER);
    expect(parsePushReminder(JSON.stringify({ ...stored, shown: -1 }))).toEqual(INITIAL_PUSH_REMINDER);
  });
});
