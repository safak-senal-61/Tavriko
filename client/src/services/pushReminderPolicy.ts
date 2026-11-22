const DAY_MS = 86_400_000;
const REMINDER_INTERVALS_DAYS = [3, 7, 14] as const;
export const PUSH_REMINDER_FOREGROUND_DELAY_MS = 12_000;

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
  const days = REMINDER_INTERVALS_DAYS[Math.min(preference.shown, REMINDER_INTERVALS_DAYS.length - 1)];
  return { ...preference, shown: preference.shown + 1, nextAt: now + days * DAY_MS };
}
