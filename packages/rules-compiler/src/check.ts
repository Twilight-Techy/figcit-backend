// The pass rule for a workbook scenario, shared with the admin snapshot report. It mirrors the
// engine's own scenario test (packages/engine/test/scenarios.test.ts).
import type { EngineResult } from '@figcit/engine';
import type { Fixture } from './fixtures.js';

// Tab 0 uses baseline bands (v2 layout), so band-driven neighbours are equivalent there (B-08).
const TAB0_GROUPS: readonly (readonly number[])[] = [
  [6, 8],
  [5, 7],
  [3, 4],
  [4, 15],
];
const TAB0B_GROUPS: readonly (readonly number[])[] = [[6, 8]];

function samePattern(
  actual: number,
  expected: readonly number[],
  groups: readonly (readonly number[])[],
): boolean {
  if (expected.includes(actual)) return true;
  const first = expected[0] ?? -1;
  return groups.some((g) => g.includes(actual) && g.includes(first));
}

export function checkFixture(fixture: Fixture, result: EngineResult): boolean {
  if (fixture.expect.light && result.light !== fixture.expect.light) return false;
  if (fixture.ref.startsWith('REC.') && fixture.input.recheckOf?.helped === 'not_really') {
    return (
      result.recheck?.rule === 'RC-4' && result.primary.pathway !== fixture.input.recheckOf.pathway
    );
  }
  if (fixture.ref.startsWith('REC.') || fixture.ref === 'RF.6')
    return result.recheck?.rule === 'RC-1' && result.patterns.includes(31);
  return samePattern(
    result.patterns[0] ?? 0,
    fixture.expect.patterns,
    fixture.source === 'tab0' ? TAB0_GROUPS : TAB0B_GROUPS,
  );
}
