import { localParts } from './timeline.js';

// A small RRULE subset for practices and reminders: FREQ=DAILY or FREQ=WEEKLY;BYDAY=MO,TU…,
// with BYHOUR and BYMINUTE in the user's time zone. Enough for prayer times and routines (TR).

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export interface SimpleRule {
  readonly freq: 'DAILY' | 'WEEKLY';
  readonly byDay: readonly number[]; // 0 = Sunday
  readonly minutes: number; // local minutes after midnight
}

export function parseRule(rule: string | null | undefined): SimpleRule | null {
  if (!rule) return null;
  const parts = new Map(
    rule
      .replace(/^RRULE:/, '')
      .split(';')
      .map((p) => p.split('=') as [string, string]),
  );
  const freq = parts.get('FREQ');
  if (freq !== 'DAILY' && freq !== 'WEEKLY') return null;
  const hour = Number(parts.get('BYHOUR') ?? '9');
  const minute = Number(parts.get('BYMINUTE') ?? '0');
  if (
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59
  )
    return null;
  const byDay = (parts.get('BYDAY') ?? '')
    .split(',')
    .map((d) => DAYS.indexOf(d))
    .filter((d) => d >= 0);
  return {
    freq,
    byDay: freq === 'WEEKLY' && byDay.length > 0 ? byDay : [0, 1, 2, 3, 4, 5, 6],
    minutes: hour * 60 + minute,
  };
}

/** Is an occurrence within `windowMinutes` of now (either side)? */
export function dueNow(rule: SimpleRule, now: Date, timeZone: string, windowMinutes = 30): boolean {
  const local = localParts(now, timeZone);
  if (!rule.byDay.includes(local.weekday)) return false;
  return Math.abs(local.minutes - rule.minutes) <= windowMinutes;
}

/** Next occurrence after `from` (searches up to 8 days; minute precision). */
export function nextOccurrence(rule: SimpleRule, from: Date, timeZone: string): Date {
  const start = localParts(from, timeZone);
  for (let day = 0; day <= 8; day += 1) {
    const candidateDay = (start.weekday + day) % 7;
    if (!rule.byDay.includes(candidateDay)) continue;
    const deltaMinutes = day * 1440 + rule.minutes - start.minutes;
    if (deltaMinutes > 0)
      return new Date(from.getTime() + deltaMinutes * 60_000 - (from.getTime() % 60_000));
  }
  return new Date(from.getTime() + 86_400_000);
}
