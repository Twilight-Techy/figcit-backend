import { readFileSync } from 'node:fs';
import type { Snapshot } from '@figcit/engine';
import { describe, expect, it } from 'vitest';
import {
  anyBanned,
  failedBars,
  percentile,
  scoreBreakDown,
  scoreDrivers,
  scoreParseNeed,
  summarise,
  type CaseResult,
} from './score.js';
import { loadSet } from './sets.js';

const snapshot = JSON.parse(
  readFileSync(
    new URL('../../../../../../packages/engine/fixtures/snapshot.json', import.meta.url),
    'utf8',
  ),
) as Snapshot;

const result = (over: Partial<CaseResult>): CaseResult => ({
  id: 'pn-001',
  outcome: 'ok',
  correct: true,
  withinRule: true,
  banned: false,
  latencyMs: 1000,
  withinTimeout: true,
  outputTokens: 50,
  output: null,
  ...over,
});

describe('eval sets', () => {
  it('meet the sizes in the issue and use real need codes', () => {
    const codes = new Set(snapshot.needs.map((n) => n.code));
    const parse = loadSet('parseNeed');
    expect(parse.cases.length).toBeGreaterThanOrEqual(80);
    expect(parse.cases.flatMap((c) => c.needs).every((n) => codes.has(n))).toBe(true);
    expect(loadSet('suggestDrivers').cases.length).toBeGreaterThanOrEqual(50);
    const caps = new Set(snapshot.timelines.map((t) => t.stepCap));
    const breakDown = loadSet('breakDownTask').cases;
    expect(breakDown.length).toBeGreaterThanOrEqual(50);
    expect(breakDown.every((c) => caps.has(c.stepCap))).toBe(true);
    const chips = new Set(snapshot.emotions.map((e) => e.code));
    const feelings = loadSet('mapFeeling').cases;
    expect(feelings.length).toBeGreaterThanOrEqual(50);
    expect(feelings.flatMap((c) => c.emotions).every((e) => chips.has(e))).toBe(true);
    expect(loadSet('splitTasks').cases.length).toBeGreaterThanOrEqual(30);
    expect(loadSet('sortDump').cases.length).toBeGreaterThanOrEqual(20);
    for (const t of ['simplify', 'rewrite', 'draft', 'structure', 'script'] as const)
      expect(loadSet(t).cases.length).toBeGreaterThanOrEqual(10);
  });
});

describe('scoring', () => {
  const heard: never[] = [];
  it('parseNeed is right when the first need is accepted', () => {
    const c = { id: 'pn-001', text: 'x', needs: ['rest', 'recover_event'] };
    expect(
      scoreParseNeed({ needs: ['recover_event'], heard, task: null, supportOnly: false }, c),
    ).toBe(true);
    expect(
      scoreParseNeed({ needs: ['clear_head', 'rest'], heard, task: null, supportOnly: false }, c),
    ).toBe(false);
    expect(scoreParseNeed({ needs: [], heard, task: null, supportOnly: false }, c)).toBe(false);
  });

  it('suggestDrivers is right only with accepted drivers, and none only when none fit', () => {
    const c = { id: 'sd-001', title: 'x', drivers: ['routine' as const] };
    expect(scoreDrivers({ drivers: ['routine'], demandCharacteristics: [] }, c)).toBe(true);
    expect(scoreDrivers({ drivers: ['routine', 'novelty'], demandCharacteristics: [] }, c)).toBe(
      false,
    );
    expect(scoreDrivers({ drivers: [], demandCharacteristics: [] }, c)).toBe(false);
    expect(scoreDrivers({ drivers: [], demandCharacteristics: [] }, { ...c, drivers: [] })).toBe(
      true,
    );
  });

  it('breakDownTask keeps the cap and short steps when strained', () => {
    const c = { id: 'bd-001', title: 'x', stepCap: 2, strained: true };
    const step = (minutes: number, text = 'Open the file') => ({ text, minutes });
    expect(scoreBreakDown({ steps: [step(5), step(3)], estimatedDemand: 'low' }, c)).toBe(true);
    expect(scoreBreakDown({ steps: [step(5), step(3), step(1)], estimatedDemand: 'low' }, c)).toBe(
      false,
    );
    expect(scoreBreakDown({ steps: [step(10)], estimatedDemand: 'low' }, c)).toBe(false);
    expect(
      scoreBreakDown({ steps: [step(2, 'Open it and then read')], estimatedDemand: 'low' }, c),
    ).toBe(false);
  });

  it('finds banned phrases anywhere in the output', () => {
    expect(anyBanned({ steps: [{ text: 'Finally start' }] })).toBe(true);
    expect(anyBanned({ steps: [{ text: 'Open the file' }] })).toBe(false);
  });
});

describe('summary and bars', () => {
  it('takes percentiles', () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(percentile([], 50)).toBeNull();
  });

  it('summarises a model run and checks the bars', () => {
    const s = summarise([
      result({}),
      result({ correct: false, outcome: 'invalid', latencyMs: 3000 }),
      result({ withinTimeout: false, latencyMs: 9000 }),
      result({ banned: true }),
    ]);
    expect(s.accuracy).toBe(0.75);
    expect(s.fallbackRate).toBe(0.25);
    expect(s.withinTimeout).toBe(0.75);
    expect(s.bannedHits).toBe(1);
    expect(s.tokensPerSecond).toBeCloseTo(200 / 14);
    expect(failedBars('parseNeed', s)).toEqual([
      'accuracy 75.0% < 85.0%',
      'banned phrases 1',
      'within timeout 75.0% < 95.0%',
    ]);
  });

  it('judges a rules run on quality only', () => {
    const s = summarise([result({ outcome: 'rules', latencyMs: null, withinTimeout: null })]);
    expect(s.withinTimeout).toBeNull();
    expect(failedBars('breakDownTask', s)).toEqual([]);
  });
});
