// The explorer's check-ins and the state grid (E-61): every case is a check-in the app could
// send, turned into engine input as a real check-in is; and which rules no check-in can reach.
import { describe, expect, it } from 'vitest';
import {
  checkInCases,
  checkInOptionsOf,
  checkInput,
  explore,
  factsFromCheckIn,
  producible,
  stateGrid,
  unreachable,
  type CaseContext,
  type Condition,
} from '../src/index.js';
import { imported } from './fixtures.js';
import { ruleset } from './support/engine.js';

const { options, catalogue } = checkInOptionsOf(imported.records);
const newUser = {
  'signals.declines_session': 0,
  'signals.safety_event_recently': false,
  'signals.days_very_constrained': 0,
};
const ctx: CaseContext = { options, newUser, riskText: 'risk words' };
const set = checkInCases(ruleset, ctx, { sample: 300 });
const offered = (kind: keyof typeof options, code: string): boolean =>
  options[kind].some((o) => o.code === code);

describe('the check-ins the explorer runs', () => {
  it('uses only the options a version offers, and gives valid engine input', () => {
    for (const c of set.cases) {
      for (const e of c.checkIn.emotions) expect(offered('feeling', e.code)).toBe(true);
      for (const n of c.checkIn.needs) expect(offered('need', n)).toBe(true);
      expect(checkInput(c.input, catalogue)).toEqual([]);
    }
  });

  it('turns each check-in into input as a real check-in does', () => {
    for (const c of set.cases.slice(0, 500)) {
      const server = Object.fromEntries(
        Object.entries(c.input).filter(
          ([k]) => k.startsWith('signals.') || k.startsWith('prefs.') || k === 'safety.risk',
        ),
      );
      const { 'signals.rejected': _rejected, ...withoutRejected } = c.input;
      expect(
        factsFromCheckIn(c.checkIn, options, catalogue, {
          timeline: c.checkIn.demand?.timeline,
          facts: Object.fromEntries(
            Object.entries(server).filter(([k]) => k !== 'signals.rejected'),
          ),
        }),
      ).toEqual(withoutRejected);
    }
  });

  it('keeps what the app lets through: a task for a task need, no task with "just support"', () => {
    for (const c of set.cases) {
      if (c.checkIn.justSupport) expect(c.checkIn.demand).toBeUndefined();
      if (c.account === 'browse') {
        expect(c.signals).toEqual({});
        expect(c.input['signals.declines_session']).toBeUndefined();
      }
      if (c.declined.length > 0) expect(c.input['signals.rejected']).toHaveLength(1);
      if (c.checkIn.ownWords) expect(c.input['safety.risk']).toBe(true);
    }
  });

  it('is the same for the same seed', () => {
    const again = checkInCases(ruleset, ctx, { sample: 300 });
    expect(again.cases.length).toBe(set.cases.length);
    expect(again.cases[set.cases.length - 1]).toEqual(set.cases.at(-1));
  });

  it('gives every check-in a card with something on it, and breaks no fixed rule', () => {
    const report = explore(
      ruleset,
      set.cases.map((c) => c.input),
    );
    expect(report.refused).toBe(0);
    expect(report.noOutcome.count).toBe(0);
    expect(report.violations).toEqual([]);
  }, 30_000);
});

describe('rules no check-in can reach', () => {
  const can = producible(options, catalogue);
  const family = (key: string): Condition => ({ fact: 'family.intensity', key, op: 'present' });

  it('names the value no option gives', () => {
    expect(unreachable(family('social_hangover_masking_fatigue'), can)).toEqual([
      'family.intensity · social_hangover_masking_fatigue',
    ]);
    expect(unreachable(family('distress_overwhelm'), can)).toBeNull();
    expect(unreachable({ fact: 'needs', op: 'contains', value: 'get_urgent_help' }, can)).toEqual([
      'needs · get_urgent_help',
    ]);
  });

  it('follows the tree: all fails on one part, any only on every part, not is possible', () => {
    const no = family('social_hangover_masking_fatigue');
    const yes = family('distress_overwhelm');
    expect(unreachable({ all: [yes, no] }, can)).not.toBeNull();
    expect(unreachable({ any: [yes, no] }, can)).toBeNull();
    expect(unreachable({ not: no }, can)).toBeNull();
    expect(unreachable({ fact: 'signals.in_session', op: 'is', value: true }, can)).toBeNull();
  });
});

describe('the state grid', () => {
  const grid = stateGrid(ruleset, ctx, { feeling: 'anxious', intensity: 7, account: 'free' });

  it('has the 16 cells, each with only its state and the feeling picked', () => {
    expect(grid.map((c) => c.cell)).toHaveLength(16);
    const first = grid[0];
    expect(first?.case.checkIn).toEqual({
      state: { kind: 'grid', energy: 1, mood: 1 },
      emotions: [{ code: 'anxious', intensity: 7 }],
      sensations: [],
      context: {},
      needs: [],
      justSupport: false,
    });
  }, 30_000);

  it("lists only the single answers that change a cell's card", () => {
    for (const cell of grid)
      for (const ch of cell.changes)
        expect([ch.outcome.light, ch.outcome.key]).not.toEqual([
          cell.outcome?.light,
          cell.outcome?.key,
        ]);
    expect(grid.some((c) => c.changes.length > 0)).toBe(true);
  });
});
