const HOUR_MS = 3_600_000;
const REMINDER_INTERVALS_HOURS = [6, 24, 48, 72] as const;
export const PUSH_REMINDER_FOREGROUND_DELAY_MS = 5_000;

export interface PushReminderPreference {
  shown: number;
  nextAt: number;
  stopped: boolean;
}

export const INITIAL_PUSH_REMINDER: PushReminderPreference = { shown: 0, nextAt: 0, stopped: false };

export function parsePushReminder(raw: string | null): PushReminderPreference {
  try {
    const data = raw ? JSON.parse(raw) : null;
    if (Number.isSafeInteger(data?.shown) && data.shown >= 0 &&
        Number.isSafeInteger(data?.nextAt) && data.nextAt >= 0 &&
        typeof data?.stopped === 'boolean') return data;
  } catch {
    // A damaged local preference must not break startup.
  }
  return INITIAL_PUSH_REMINDER;
}

export function pushReminderDue(preference: PushReminderPreference, now: number): boolean {
  return !preference.stopped && now >= preference.nextAt;
}

export function deferPushReminder(preference: PushReminderPreference, now: number): PushReminderPreference {
  return { ...preference, shown: preference.shown + 1, nextAt: now + reminderInterval(preference.shown) };
}

function reminderInterval(index: number) {
  return REMINDER_INTERVALS_HOURS[Math.min(index, REMINDER_INTERVALS_HOURS.length - 1)] * HOUR_MS;
}

/** Clamp old long schedules without resetting opt-outs or deferring overdue reminders. */
export function shortenPushReminderSchedule(preference: PushReminderPreference, now: number) {
  if (preference.stopped || !preference.shown) return preference;
  return { ...preference, nextAt: Math.min(preference.nextAt, now + reminderInterval(preference.shown - 1)) };
}
