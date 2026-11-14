// Rules Engine v5.0: plans (Tab 9) and each tool's plan (Tab 17). The card stays within the
// user's plan (ENT-1), never upsells under strain (ENT-3) and shows at most one labelled paid tool
// otherwise (ENT-11); a free version leads where the best fit is paid (T-20).
import { describe, expect, it } from 'vitest';
import { run, type Card, type CardItem, type EngineInput } from '../src/index.js';
import { TOOL_PLANS } from '../src/mapping/v5-plans.js';
import { catalogue, read, ruleset } from './support/v5.js';

const cardOf = (input: EngineInput): Card => {
  const r = run(ruleset, input);
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.card;
};
const items = (card: Card): CardItem[] => [
  ...(card.primary ? [card.primary] : []),
  ...card.alternatives,
];
const paid = (card: Card, plan?: 'premium'): CardItem[] =>
  items(card).filter((i) => i.plan !== undefined && (plan === undefined || i.plan === plan));

/** Every state, emotion and slider, with and without a body sign, at home and at an appointment. */
function sweep(): EngineInput[] {
  const cells = (catalogue.get('cell') ?? []).filter((c) => /^E\dM\d$/i.test(c.code));
  const emotions = [undefined, ...(catalogue.get('family') ?? []).map((f) => f.code)];
  const out: EngineInput[] = [];
  const feelings = emotions.flatMap((emotion) =>
    emotion ? [2, 5, 8].map((level) => ({ 'family.intensity': { [emotion]: level } })) : [{}],
  );
  const contexts = [[], ['tension']].flatMap((body) =>
    ['home', 'appointment_or_meeting'].map((setting) => ({
      'body.signs': body,
      'context.setting': setting,
      'context.can_step_away': false,
    })),
  );
  for (const cell of cells)
    for (const feeling of feelings)
      for (const context of contexts)
        out.push({
          'state.energy': Number(cell.code[1]),
          'state.mood': Number(cell.code[3]),
          ...feeling,
          ...context,
        });
  return out;
}

describe("Rules Engine v5.0: each tool's plan (Tab 17)", () => {
  it("gives every paid tool the plan Tab 17's Plan column says", () => {
    // A tool listed again under "v5.0 — New labels" (Create) takes the newer row.
    const plans = new Map<string, string>();
    for (const r of read.records.filter((x) => x.tab === 'labels' && x.role === 'rule')) {
      const plan = r.columns.find((c) => c.header === 'Plan')?.text.trim() ?? '';
      if (plan !== '') plans.set(r.sourceRef, plan);
    }
    const fromTab = Object.fromEntries(
      [...plans]
        .filter(([, plan]) => !plan.startsWith('Free'))
        .map(([id, plan]) => [id, plan.startsWith('Premium') ? 'premium' : 'prime']),
    );
    expect(TOOL_PLANS).toEqual(fromTab);
  });

  it('labels a paid tool on the card with its plan', () => {
    // Not good enough, Mild, in Green: Tab 18's best fit is What helped (Prime).
    const card = cardOf({
      'state.energy': 3,
      'state.mood': 3,
      'family.intensity': { not_good_enough: 2 },
      'signals.plan': 'premium',
    });
    expect(card.primary?.tool).toBe('rfl_helped');
    expect(card.primary?.plan).toBe('prime');
  });
});

describe('Rules Engine v5.0: entitlements (Tab 9)', { timeout: 120_000 }, () => {
  it('T-20: a free user gets the best free tool first, and one labelled Prime alternative', () => {
    const card = cardOf({
      'state.energy': 3,
      'state.mood': 3,
      'family.intensity': { not_good_enough: 2 },
    });
    expect(card.light).toBe('green');
    expect(card.primary?.tool).toBe('rfl_today');
    expect(card.primary?.plan).toBeUndefined();
    expect(card.alternatives.map((a) => [a.tool, a.plan])).toContainEqual(['rfl_helped', 'prime']);
  });

  it('ENT-3: a free user under strain sees no paid tool (strong difficult feeling in Yellow)', () => {
    const card = cardOf({
      'state.energy': 2,
      'state.mood': 3,
      'family.intensity': { not_good_enough: 8 },
      'context.setting': 'appointment_or_meeting',
      'context.can_step_away': false,
    });
    expect(paid(card)).toEqual([]);
  });

  const inputs = sweep();
  const free = inputs.map((input) => ({ input, card: cardOf(input) }));
  const prime = inputs.map((input) => ({
    input,
    card: cardOf({ ...input, 'signals.plan': 'prime' }),
  }));
  const where = (x: { input: EngineInput; card: Card }) =>
    `${JSON.stringify(x.input)} → ${x.card.light ?? '-'}: ${items(x.card)
      .map((i) => `${i.tool ?? '@'}${i.plan ? `(${i.plan})` : ''}`)
      .join(', ')}`;

  it('ENT-1: a free user never gets a paid primary, and a Prime user never a Premium one', () => {
    expect(
      free
        .filter((x) => x.card.primary?.plan !== undefined)
        .map(where)
        .slice(0, 5),
    ).toEqual([]);
    expect(
      prime
        .filter((x) => x.card.primary?.plan === 'premium')
        .map(where)
        .slice(0, 5),
    ).toEqual([]);
  });

  it('ENT-3 and ENT-11: no paid tool in Amber or Red, at most one otherwise (T-19)', () => {
    const strained = (c: Card) => c.light === 'amber' || c.light === 'red';
    expect(free.filter((x) => strained(x.card) && paid(x.card).length > 0).map(where)).toEqual([]);
    expect(free.filter((x) => paid(x.card).length > 1).map(where)).toEqual([]);
    expect(
      prime.filter((x) => strained(x.card) && paid(x.card, 'premium').length > 0).map(where),
    ).toEqual([]);
  });

  it('ENT-1: every card still has a primary on the free plan', () => {
    expect(
      free
        .filter((x) => x.card.kind === 'card' && x.card.primary === null)
        .map(where)
        .slice(0, 5),
    ).toEqual([]);
  });
});
