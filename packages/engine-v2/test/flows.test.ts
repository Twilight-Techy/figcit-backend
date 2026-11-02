// The explorer's input sets (M7, DESIGN §8; E-21): all flows, pairwise cover, safety impact.
import { describe, expect, it } from 'vitest';
import {
  COMPUTED_FROM,
  compare,
  explore,
  factsRead,
  FACTS,
  flowInputs,
  pairwise,
  safetyInputs,
  seeded,
  withoutRows,
} from '../src/index.js';
import { ruleset } from './support/engine.js';

/** Every pair of values across two dimensions, as `i:a|j:b`. */
const pairsOf = (rows: readonly number[][]): Set<string> => {
  const out = new Set<string>();
  for (const r of rows)
    for (let i = 0; i < r.length; i += 1)
      for (let j = i + 1; j < r.length; j += 1)
        out.add(`${String(i)}:${String(r[i])}|${String(j)}:${String(r[j])}`);
  return out;
};

describe('pairwise', () => {
  it('covers every pair of values of every two dimensions', () => {
    const sizes = [3, 5, 2, 4, 7];
    const rows = pairwise(sizes, seeded(7));
    let want = 0;
    for (let i = 0; i < sizes.length; i += 1)
      for (let j = i + 1; j < sizes.length; j += 1) want += (sizes[i] ?? 0) * (sizes[j] ?? 0);
    expect(pairsOf(rows).size).toBe(want);
    // Never more rows than all combinations, and near the lower bound (largest two dimensions).
    expect(rows.length).toBeGreaterThanOrEqual(7 * 5);
    expect(rows.length).toBeLessThan(7 * 5 * 2);
  });
  it('is repeatable for a seed', () => {
    expect(pairwise([4, 4, 3], seeded(3))).toEqual(pairwise([4, 4, 3], seeded(3)));
  });
});

describe('the all-flows set', () => {
  const set = flowInputs(ruleset, { sample: 500 });

  it('adds a pairwise cover and a sample to the sweep, without repeats', () => {
    expect(set.parts.sweep).toBe(3468);
    expect(set.parts.pairwise).toBeGreaterThan(500);
    expect(set.parts.sample).toBe(500);
    expect(set.inputs.length).toBeLessThanOrEqual(
      set.parts.sweep + set.parts.pairwise + set.parts.sample,
    );
    expect(JSON.stringify(flowInputs(ruleset, { sample: 500 }).inputs)).toBe(
      JSON.stringify(set.inputs),
    );
  });

  it('tests every intensity at each band edge (3/4, 6/7, 8/9)', () => {
    const levels = new Set(
      set.inputs.flatMap((i) =>
        Object.values((i['family.intensity'] as Record<string, number | null> | undefined) ?? {}),
      ),
    );
    for (const n of [3, 4, 6, 7, 8, 9]) expect(levels.has(n)).toBe(true);
    expect(levels.has(null)).toBe(true);
  });

  it('gives a task whenever it gives a timeline', () => {
    for (const i of set.inputs) if ('demand.timeline' in i) expect(i['demand.present']).toBe(true);
  });

  it('runs clean: the engine refuses none of them and no fixed rule breaks', () => {
    const report = explore(ruleset, set.inputs);
    expect(report.refused).toBe(0);
    expect(report.counts).toEqual({});
  }, 120_000);
});

describe('explore', () => {
  const report = explore(ruleset, undefined, { light: 'amber', primary: 'execute' });

  it('maps each state and feeling to its most common outcome', () => {
    const cell = report.map.find((c) => c.cell === 'E1M1' && c.family === 'none');
    expect(cell?.n).toBeGreaterThan(0);
    expect(cell?.share).toBeLessThanOrEqual(cell?.n ?? 0);
    expect(report.map.reduce((n, c) => n + c.n, 0)).toBe(report.ran - report.refused);
  });

  it('answers a query: which inputs give a task as the primary in Amber (none may)', () => {
    expect(report.matches).toEqual({ count: 0, examples: [] });
  });

  it('answers a query by rule: the inputs a row fired on', () => {
    const row = ruleset.rules.find((r) => r.ref.includes('EX-1'))?.rowId ?? '';
    const q = explore(ruleset, undefined, { rows: new Set([row]) });
    const counts = ruleset.rules.filter((r) => r.rowId === row).map((r) => q.fired[r.id] ?? 0);
    // An input matches when any of the row's rules fired: at least the busiest rule, at most all.
    expect(q.matches?.count).toBeGreaterThanOrEqual(Math.max(...counts));
    expect(q.matches?.count).toBeLessThanOrEqual(counts.reduce((a, b) => a + b, 0));
    expect(q.matches?.count).toBeGreaterThan(0);
  });
});

describe('what a rule affects', () => {
  it('is the cards that change when the row is taken out', () => {
    const row = ruleset.rules.find((r) => r.ref.includes('EX-1'))?.rowId ?? '';
    const r = compare(ruleset, withoutRows(ruleset, new Set([row])));
    expect(r.changed).toBeGreaterThan(0);
    expect(compare(ruleset, withoutRows(ruleset, new Set(['no such row']))).changed).toBe(0);
  }, 60_000);
});

describe('the safety impact set (E-21)', () => {
  it('knows the inputs behind every computed fact', () => {
    for (const f of FACTS.filter((x) => x.computed))
      expect(COMPUTED_FROM[f.name], f.name).toBeDefined();
  });

  it('runs every combination of what the safety rows read, when that is few enough', () => {
    const rows = new Set(ruleset.rules.filter((r) => r.ref.includes('SF-')).map((r) => r.rowId));
    expect(rows.size).toBeGreaterThan(0);
    const facts = factsRead(ruleset, rows);
    expect(facts.length).toBeGreaterThan(0);
    const set = safetyInputs(ruleset, rows);
    expect(set.facts).toEqual(facts);
    if (set.exhaustive) expect(set.inputs.length).toBeLessThanOrEqual(set.combinations);
    expect(explore(ruleset, set.inputs).counts).toEqual({});
  }, 120_000);

  it('falls back to pairs over the same inputs when there are too many combinations', () => {
    const rows = new Set(ruleset.rules.map((r) => r.rowId));
    const set = safetyInputs(ruleset, rows, 100);
    expect(set.exhaustive).toBe(false);
    expect(set.combinations).toBeGreaterThan(100);
    expect(set.inputs.length).toBeGreaterThan(0);
  });
});
