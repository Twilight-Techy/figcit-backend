import { describe, expect, it } from 'vitest';
import { dueNow, nextOccurrence, parseRule } from './rrule.js';

describe('rrule subset', () => {
  it('parses daily and weekly rules', () => {
    expect(parseRule('FREQ=DAILY;BYHOUR=13;BYMINUTE=15')).toEqual({
      freq: 'DAILY',
      byDay: [0, 1, 2, 3, 4, 5, 6],
      minutes: 795,
    });
    expect(parseRule('RRULE:FREQ=WEEKLY;BYDAY=MO,FR;BYHOUR=7')?.byDay).toEqual([1, 5]);
    expect(parseRule('FREQ=YEARLY')).toBeNull();
    expect(parseRule('FREQ=DAILY;BYHOUR=99')).toBeNull();
  });
  it('knows when a practice is due', () => {
    const rule = parseRule('FREQ=DAILY;BYHOUR=13;BYMINUTE=0');
    if (!rule) throw new Error('rule');
    expect(dueNow(rule, new Date('2026-10-28T13:10:00Z'), 'Europe/London')).toBe(true);
    expect(dueNow(rule, new Date('2026-10-28T15:00:00Z'), 'Europe/London')).toBe(false);
  });
  it('finds the next occurrence', () => {
    const rule = parseRule('FREQ=DAILY;BYHOUR=7;BYMINUTE=30');
    if (!rule) throw new Error('rule');
    expect(
      nextOccurrence(rule, new Date('2026-10-28T09:00:00Z'), 'Europe/London').toISOString(),
    ).toBe('2026-10-29T07:30:00.000Z');
  });
});
