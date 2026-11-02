// Engine properties (ENGINEERING_RULES §13) over seeded random valid inputs (the explorer's
// generator, E-56), not fast-check: the generator already draws every input fact at the values the
// rules tell apart, and a seed makes any failure repeatable.
import { describe, expect, it } from 'vitest';
import { flowInputs, run, type Card, type EngineInput } from '../src/index.js';
import { ruleset } from './support/engine.js';

const all = flowInputs(ruleset, { sample: 3000, seed: 20261102 });
// The random part only (the sweep and the pairwise cover have their own tests).
const inputs = all.inputs.slice(-all.parts.sample);
const cards = inputs.map((input) => ({ input, result: run(ruleset, input, { trace: 'full' }) }));
const ok = cards.flatMap(({ input, result }) => (result.ok ? [{ input, card: result.card }] : []));

const items = (c: Card): Card['alternatives'] => [
  ...(c.primary ? [c.primary] : []),
  ...c.alternatives,
  ...c.queued,
  ...c.visible,
];
const where = (test: (c: Card, i: EngineInput) => boolean): EngineInput[] =>
  ok.filter(({ card, input }) => test(card, input)).map(({ input }) => input);

describe('engine properties', () => {
  it('accepts every valid input', () => {
    expect(ok).toHaveLength(inputs.length);
  });

  it('gives the same card and trace on a re-run', () => {
    for (const { input, result } of cards.slice(0, 500))
      expect(run(ruleset, input, { trace: 'full' })).toEqual(result);
  });

  it('shows the support screen whenever the risk screen fires', () => {
    expect(where((c, i) => i['safety.risk'] === true && c.kind !== 'support_screen')).toEqual([]);
  });

  it('never offers a task first in Amber or Red', () => {
    expect(
      where((c) => (c.light === 'amber' || c.light === 'red') && c.primary?.pathway === 'execute'),
    ).toEqual([]);
  });

  it('never offers an Advanced tool in Amber or Red', () => {
    expect(
      where((c) => (c.light === 'amber' || c.light === 'red') && items(c).some((x) => x.advanced)),
    ).toEqual([]);
  });

  it('keeps "Get support now" on every Red card', () => {
    const support = (c: Card): boolean =>
      c.visible.some((v) => 'action' in v.target && v.target.action === 'get_support_now');
    expect(where((c) => c.light === 'red' && !support(c))).toEqual([]);
  });

  it('has at most one primary and two alternatives, and never repeats a place', () => {
    for (const { card } of ok) {
      expect(card.alternatives.length).toBeLessThanOrEqual(2);
      const shown = [card.primary, ...card.alternatives]
        .filter((x) => x !== null)
        .map((x) => JSON.stringify(x.target));
      expect(new Set(shown).size).toBe(shown.length);
    }
  });
});
