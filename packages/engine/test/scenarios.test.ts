// Every worked scenario in workbook Tabs 0 and 0b (ENGINEERING_RULES §13).
import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/index.js';
import { scenarios, snapshot } from './helpers.js';

// Tab 0 uses baseline bands (v2 layout), so band-driven neighbours are equivalent there (B-08).
const TAB0_GROUPS = [
  [6, 8],
  [5, 7],
  [3, 4],
  [4, 15],
];
const TAB0B_GROUPS = [[6, 8]];

function samePattern(
  actual: number,
  expected: readonly number[],
  groups: readonly (readonly number[])[],
): boolean {
  if (expected.includes(actual)) return true;
  const first = expected[0] ?? -1;
  return groups.some((g) => g.includes(actual) && g.includes(first));
}

describe('workbook scenarios', () => {
  it('has fixtures for both scenario tabs', () => {
    expect(scenarios.filter((s) => s.source === 'tab0').length).toBeGreaterThanOrEqual(96);
    expect(scenarios.filter((s) => s.source === 'tab0b').length).toBeGreaterThanOrEqual(90);
  });

  for (const fixture of scenarios) {
    it(`${fixture.ref}: pattern ${fixture.expect.patterns.join(' + ')}${fixture.expect.light ? `, ${fixture.expect.light}` : ''}`, () => {
      const result = evaluate(fixture.input, snapshot, fixture.signals);
      if (fixture.ref.startsWith('REC.') && fixture.input.recheckOf?.helped === 'not_really') {
        // RC-4: no Blue, and a different route from the one that didn't help.
        expect(result.recheck?.rule).toBe('RC-4');
        expect(result.primary.pathway).not.toBe(fixture.input.recheckOf.pathway);
      } else if (fixture.ref.startsWith('REC.') || fixture.ref === 'RF.6') {
        expect(result.recheck?.rule).toBe('RC-1');
        expect(result.patterns).toContain(31);
      } else {
        const groups = fixture.source === 'tab0' ? TAB0_GROUPS : TAB0B_GROUPS;
        expect(
          samePattern(result.patterns[0] ?? 0, fixture.expect.patterns, groups),
          `got ${result.patterns.join('+')}`,
        ).toBe(true);
      }
      if (fixture.expect.light) expect(result.light).toBe(fixture.expect.light);
    });
  }
});
