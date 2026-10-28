import { describe, expect, it } from 'vitest';
import { localParts, timelineFor } from './timeline.js';

const now = new Date('2026-10-28T09:00:00Z');
const at = (hours: number): Date => new Date(now.getTime() + hours * 3_600_000);

describe('timelineFor', () => {
  it('maps due dates to Tab 4 codes', () => {
    expect(timelineFor(null, now, 'Europe/London')).toBe('T6');
    expect(timelineFor(at(-1), now, 'Europe/London')).toBe('TX');
    expect(timelineFor(at(0.5), now, 'Europe/London')).toBe('T0');
    expect(timelineFor(at(5), now, 'Europe/London')).toBe('T1');
    expect(timelineFor(at(30), now, 'Europe/London')).toBe('T2');
    expect(timelineFor(at(24 * 20), now, 'Europe/London')).toBe('T3');
    expect(timelineFor(at(24 * 100), now, 'Europe/London')).toBe('T4');
    expect(timelineFor(at(24 * 400), now, 'Europe/London')).toBe('T5');
  });
  it('uses the user’s own day boundary', () => {
    // 23:30 UTC is still "today" in London (GMT) but tomorrow in Lagos (UTC+1).
    const late = new Date('2026-10-28T23:30:00Z');
    expect(timelineFor(late, now, 'Europe/London')).toBe('T1');
    expect(timelineFor(late, now, 'Africa/Lagos')).toBe('T2');
  });
  it('reads local minutes', () => {
    expect(localParts(new Date('2026-10-28T09:15:00Z'), 'Africa/Lagos').minutes).toBe(10 * 60 + 15);
  });
});
