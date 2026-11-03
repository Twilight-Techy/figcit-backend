// Advanced tools offered, not only restricted (Tab 6d, the Owner's reading of 3 Nov 2026: E-62).
// A plan with Advanced tools gets the fuller version of a suggested tool; a calm card offers one
// Advanced tool beside the suggestion; Amber and Red stay on the safety floor for every plan.
import { describe, expect, it } from 'vitest';
import {
  checkInOptionsOf,
  factsFromCheckIn,
  run,
  type Card,
  type CheckInValues,
  checkInCases,
  withoutRows,
} from '../src/index.js';
import { TOOL_SEED } from '../src/format/tool-seed.js';
import { mappedRules } from '../src/index.js';
import { imported } from './fixtures.js';
import { ruleset } from './support/engine.js';

const { options, catalogue } = checkInOptionsOf(imported.records);
const base = { sensations: [], context: {}, needs: [], justSupport: false };

function cardOf(c: CheckInValues, plan: string, timeline?: string): Card {
  const r = run(
    ruleset,
    factsFromCheckIn(c, options, catalogue, { timeline, facts: { 'signals.plan': plan } }),
  );
  if (!r.ok) throw new Error('refused');
  return r.card;
}
const tools = (card: Card): (string | null)[] =>
  [card.primary, ...card.alternatives].map((i) => i?.tool ?? null);
const advanced = (card: Card): string[] =>
  [card.primary, ...card.alternatives, ...card.queued, ...card.visible].flatMap((i) =>
    i?.advanced && i.tool ? [i.tool] : [],
  );

describe('the fuller versions Tab 6d names', () => {
  it('pair a free tool with an Advanced tool of the same pathway', () => {
    const pathway = new Map(TOOL_SEED.map(([code, , p]) => [code, p]));
    const pairs = [...mappedRules()]
      .filter((r) => r.tab === 'tools_tiers')
      .flatMap((r) => r.rule.then.filter((e) => e.kind === 'tools.version'))
      .map((e) => [String(e['tool']), String(e['version'])] as const);
    expect(pairs).toContainEqual(['move', 'movement_plus']);
    for (const [tool, version] of pairs) expect(pathway.get(tool)).toBe(pathway.get(version));
  });
});

describe('Tab 6d scenarios', () => {
  const ent2: CheckInValues = {
    ...base,
    state: { kind: 'grid', energy: 3, mood: 3 },
    emotions: [{ code: 'restless', intensity: 4 }],
    context: { environment: 'home' },
  };

  it('ENT.2 Free: Move, with one Advanced alternative of a new kind (Create), never first', () => {
    const card = cardOf(ent2, 'free');
    expect(tools(card)).toContain('move');
    expect(advanced(card)).toEqual(['create']);
    expect(card.primary?.advanced ?? false).toBe(false);
  });

  it('ENT.2 Plus: Advanced Movement in place of Move', () => {
    const card = cardOf(ent2, 'plus');
    expect(tools(card)).toContain('movement_plus');
    expect(tools(card)).not.toContain('move');
  });

  it('ENT.1 and ENT.6: Amber and Red are the safety floor, the same for Free and Plus', () => {
    const amber = {
      ...base,
      state: { kind: 'grid' as const, energy: 2, mood: 1 },
      emotions: [{ code: 'overwhelmed', intensity: 7 }],
    };
    const red = {
      ...base,
      state: { kind: 'grid' as const, energy: 1, mood: 1 },
      emotions: [{ code: 'distress', intensity: 9 }],
    };
    for (const c of [amber, red]) {
      expect(advanced(cardOf(c, 'plus'))).toEqual([]);
      expect(cardOf(c, 'plus')).toEqual(cardOf(c, 'free'));
    }
  });

  it('offers nothing to Free under strain (a harder feeling at High)', () => {
    const strained = { ...ent2, emotions: [{ code: 'anxious', intensity: 8 }] };
    const card = cardOf(strained, 'free');
    if (card.light === 'green' || card.light === 'yellow') expect(advanced(card)).toEqual([]);
  });

  it('ENT.4 Free: Simplify, with one Advanced Express tool offered', () => {
    const ent4: CheckInValues = {
      ...base,
      state: { kind: 'grid', energy: 3, mood: 2 },
      emotions: [{ code: 'anxious', intensity: 5 }],
      demand: { traits: ['asking_for_help_or_an_adjustment', 'involves_other_people_inherently'] },
    };
    const card = cardOf(ent4, 'free', 'T2');
    expect(tools(card)).toContain('simplify_rewrite');
    expect(advanced(card)).toHaveLength(1);
  });

  it('never takes the place of a support option, for any check-in (money never decides support)', () => {
    const offerRows = new Set(
      ruleset.rules
        .filter((r) => /tools_tiers · (Green|Yellow|Blue)/.test(r.ref))
        .map((r) => r.rowId),
    );
    const without = withoutRows(ruleset, offerRows);
    const support = (card: Card): string[] =>
      card.alternatives.flatMap((i) => ('action' in i.target ? [] : [JSON.stringify(i.target)]));
    const { cases } = checkInCases(ruleset, { options, newUser: {} }, { sample: 300 });
    for (const c of cases) {
      const input = { ...c.input, 'signals.plan': 'free' };
      const a = run(ruleset, input);
      const b = run(without, input);
      if (!a.ok || !b.ok) continue;
      for (const kept of support(b.card)) expect(support(a.card)).toContain(kept);
    }
  }, 60_000);

  // The workbook's Plus column picks Self-advocacy prep and Scripts because the task is a meeting:
  // a reading of context, not a fuller version. No general rule gives it; building it from the
  // example would fit the engine to an example (E-01). Left for the founder (E-62, T-33).
  it.todo('ENT.4 Plus: Self-advocacy prep, then Express Scripts (needs a context rule)');
});
