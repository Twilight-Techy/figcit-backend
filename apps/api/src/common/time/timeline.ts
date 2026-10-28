import type { TimelineCode } from '@figcit/engine';

/** Minutes after midnight and the calendar date in a time zone (IANA). */
export function localParts(
  at: Date,
  timeZone: string,
): { date: string; minutes: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(at);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '0';
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    weekday: weekdays.indexOf(get('weekday')),
  };
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Timeline code from a due date (Tab 4): the backend assigns it so users never pick a code.
 * T0 ≤ 60 min, T1 later today, T2 ≤ 7 days, T3 ≤ 4 weeks, T4 ≤ 12 months, T5 beyond, TX past due.
 */
export function timelineFor(
  dueAt: Date | null | undefined,
  now: Date,
  timeZone: string,
): TimelineCode {
  if (!dueAt) return 'T6';
  const ms = dueAt.getTime() - now.getTime();
  if (ms < 0) return 'TX';
  if (ms <= HOUR) return 'T0';
  if (localParts(dueAt, timeZone).date === localParts(now, timeZone).date) return 'T1';
  if (ms <= 7 * DAY) return 'T2';
  if (ms <= 28 * DAY) return 'T3';
  if (ms <= 365 * DAY) return 'T4';
  return 'T5';
}
