import { describe, expect, it } from 'vitest';
import { sustainedFlag } from './sustained.js';

const now = new Date('2026-10-28T12:00:00Z');
const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000);
const days = { red: 7, noImprovement: 14 };

describe('SF-2', () => {
  it('flags a week of Very Constrained', () => {
    expect(
      sustainedFlag(
        [6.5, 4, 2, 0.5].map((d) => ({ at: at(d), band: 'very_constrained' })),
        now,
        days,
      ),
    ).toBe('sustained_red');
  });
  it('does not flag a short run or one better day', () => {
    expect(
      sustainedFlag(
        [3, 2, 1].map((d) => ({ at: at(d), band: 'very_constrained' })),
        now,
        days,
      ),
    ).toBeNull();
    expect(
      sustainedFlag(
        [6.5, 4, 2, 0.5].map((d, i) => ({
          at: at(d),
          band: i === 2 ? 'conditional' : 'very_constrained',
        })),
        now,
        days,
      ),
    ).toBeNull();
  });
  it('flags two weeks with no improvement', () => {
    const pts = [13.5, 11, 9, 7, 5, 3, 1].map((d, i) => ({
      at: at(d),
      band: i % 2 ? 'constrained' : 'very_constrained',
    }));
    expect(sustainedFlag(pts, now, days)).toBe('no_improvement');
  });
});
