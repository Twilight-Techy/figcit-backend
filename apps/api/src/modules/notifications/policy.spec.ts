import { describe, expect, it } from 'vitest';
import { decide, inQuietHours, type PolicyInput } from './policy.js';

const base: PolicyInput = {
  now: new Date('2026-10-28T12:00:00Z'),
  timeZone: 'Europe/London',
  category: 'tasks',
  style: 'gentle',
  categories: ['checkin', 'tasks', 'practices', 'recheck'],
  quietStart: null,
  quietEnd: null,
  inWorship: false,
  inWorshipUntil: null,
  taskNudgesToday: 0,
  light: null,
};

describe('notification policy', () => {
  it('sends in the day', () => {
    expect(decide(base)).toBe('sent');
  });
  it('holds in quiet hours across midnight', () => {
    expect(inQuietHours(23 * 60, 21 * 60, 8 * 60)).toBe(true);
    expect(inQuietHours(7 * 60, 21 * 60, 8 * 60)).toBe(true);
    expect(inQuietHours(9 * 60, 21 * 60, 8 * 60)).toBe(false);
    expect(decide({ ...base, now: new Date('2026-10-28T22:30:00Z') })).toBe('held_quiet_hours');
  });
  it('uses the local time zone', () => {
    expect(
      decide({ ...base, now: new Date('2026-10-28T20:30:00Z'), timeZone: 'Africa/Lagos' }),
    ).toBe('held_quiet_hours');
  });
  it('holds during worship until it ends', () => {
    expect(decide({ ...base, inWorship: true })).toBe('held_in_worship');
    expect(
      decide({ ...base, inWorship: true, inWorshipUntil: new Date('2026-10-28T11:00:00Z') }),
    ).toBe('sent');
  });
  it('caps task nudges and quiets them after a hard check-in', () => {
    expect(decide({ ...base, taskNudgesToday: 2 })).toBe('held_cap');
    expect(decide({ ...base, light: 'red' })).toBe('held_capacity');
    expect(decide({ ...base, light: 'red', category: 'practices' })).toBe('sent');
  });
  it('respects style and categories', () => {
    expect(decide({ ...base, style: 'off' })).toBe('held_style');
    expect(decide({ ...base, categories: ['checkin'] })).toBe('held_category');
  });
});
