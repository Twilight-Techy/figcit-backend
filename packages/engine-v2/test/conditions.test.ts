// Every comparison operator on every kind of fact (DESIGN §4.2), including the ones the v3.3
// workbook doesn't use yet: a rule written with them later must behave as the format says.
import { describe, expect, it } from 'vitest';
import { evaluate, salience } from '../src/engine/conditions.js';
import { RunState } from '../src/engine/state.js';
import type { Condition, EngineInput } from '../src/index.js';
import { withExtras as catalogue } from './fixtures.js';

const holds = (when: Condition, input: EngineInput): boolean =>
  evaluate(when, new RunState(input, catalogue), catalogue).ok;

describe('numbers', () => {
  const input = { 'signals.declines_session': 3 };
  it.each([
    ['gte', 3, true],
    ['gte', 4, false],
    ['gt', 2, true],
    ['gt', 3, false],
    ['lte', 3, true],
    ['lte', 2, false],
    ['lt', 4, true],
    ['lt', 3, false],
    ['eq', 3, true],
    ['eq', 4, false],
    ['ne', 4, true],
    ['ne', 3, false],
    ['in', 3, false], // not an ordering operator: never holds on a number
  ] as const)('%s %d → %s', (op, value, want) => {
    expect(holds({ fact: 'signals.declines_session', op, value }, input)).toBe(want);
  });
  it('never holds on a number that was not given (except absent)', () => {
    expect(holds({ fact: 'signals.declines_session', op: 'lt', value: 5 }, {})).toBe(false);
    expect(holds({ fact: 'signals.declines_session', op: 'absent' }, {})).toBe(true);
    expect(holds({ fact: 'signals.declines_session', op: 'present' }, input)).toBe(true);
  });
});

describe('intensities', () => {
  const input = { 'family.intensity': { shame_guilt: 7, numb_disconnected: null } };
  it('compares with a literal or a band’s lower bound', () => {
    expect(
      holds({ fact: 'family.intensity', key: 'shame_guilt', op: 'gte', value: 7 }, input),
    ).toBe(true);
    expect(
      holds(
        { fact: 'family.intensity', key: 'shame_guilt', op: 'gte', value: { band: 'high' } },
        input,
      ),
    ).toBe(true);
    expect(
      holds(
        { fact: 'family.intensity', key: 'shame_guilt', op: 'lt', value: { band: 'moderate' } },
        input,
      ),
    ).toBe(false);
  });
  it('treats an unknown band as no bound, so nothing holds', () => {
    expect(
      holds(
        { fact: 'family.intensity', key: 'shame_guilt', op: 'gte', value: { band: 'nope' } },
        input,
      ),
    ).toBe(false);
  });
  it('treats "not rated" as present but never compared (IG-04: never mild)', () => {
    const key = 'numb_disconnected';
    expect(holds({ fact: 'family.intensity', key, op: 'present' }, input)).toBe(true);
    expect(holds({ fact: 'family.intensity', key, op: 'lte', value: 3 }, input)).toBe(false);
  });
});

describe('sets', () => {
  const input = { needs: ['clear_my_head', 'rest_recover'] };
  it.each([
    ['contains', 'clear_my_head', true],
    ['contains', 'find_the_words', false],
    ['not_contains', 'find_the_words', true],
    ['not_contains', 'clear_my_head', false],
    ['contains_any', ['find_the_words', 'rest_recover'], true],
    ['contains_any', ['find_the_words'], false],
    ['contains_all', ['clear_my_head', 'rest_recover'], true],
    ['contains_all', ['clear_my_head', 'find_the_words'], false],
    ['not_empty', undefined, true],
    ['empty', undefined, false],
    ['gte', 'x', false], // not a set operator
  ] as const)('%s %j → %s', (op, value, want) => {
    const c = value === undefined ? { fact: 'needs', op } : { fact: 'needs', op, value };
    expect(holds(c as Condition, input)).toBe(want);
  });
  it('reads a set that was not given as empty', () => {
    expect(holds({ fact: 'needs', op: 'empty' }, {})).toBe(true);
  });
});

describe('enums and booleans', () => {
  const input = {
    'context.setting': 'work',
    'demand.present': true,
    'recheck.previous_band': 'constrained',
  };
  it.each([
    [{ fact: 'context.setting', op: 'eq', value: 'work' }, true],
    [{ fact: 'context.setting', op: 'is', value: 'work' }, true],
    [{ fact: 'context.setting', op: 'ne', value: 'work' }, false],
    [{ fact: 'context.setting', op: 'in', value: ['home_private_space', 'work'] }, true],
    [{ fact: 'context.setting', op: 'not_in', value: ['work'] }, false],
    [{ fact: 'demand.present', op: 'is', value: true }, true],
    [{ fact: 'demand.present', op: 'is', value: false }, false],
  ] as const)('%j → %s', (c, want) => {
    expect(holds(c as Condition, input)).toBe(want);
  });
  it('orders the band by the catalogue', () => {
    const band = (op: string, value: string): boolean =>
      holds({ fact: 'recheck.previous_band', op, value }, input);
    expect(band('gt', 'very_constrained')).toBe(true);
    expect(band('lt', 'very_constrained')).toBe(false);
    expect(band('lte', 'constrained')).toBe(true);
  });
});

describe('trees', () => {
  const input = { 'demand.present': true, needs: ['clear_my_head'] };
  const yes: Condition = { fact: 'demand.present', op: 'is', value: true };
  const no: Condition = { fact: 'needs', op: 'empty' };
  it('reports where an `all` failed', () => {
    expect(evaluate({ all: [yes, no] }, new RunState(input, catalogue), catalogue)).toEqual({
      ok: false,
      failedAt: '/all/1',
    });
  });
  it('fails an `any` at its own path, and `not` inverts', () => {
    const state = new RunState(input, catalogue);
    expect(evaluate({ any: [no, no] }, state, catalogue)).toEqual({ ok: false, failedAt: '/' });
    expect(evaluate({ any: [no, yes] }, state, catalogue)).toEqual({ ok: true });
    expect(evaluate({ not: yes }, state, catalogue)).toEqual({ ok: false, failedAt: '/' });
    expect(evaluate({ not: no }, state, catalogue)).toEqual({ ok: true });
    expect(evaluate(null, state, catalogue)).toEqual({ ok: true });
  });
});

describe('salience', () => {
  const state = new RunState(
    {
      'family.intensity': { shame_guilt: 6, distress_overwhelm: 9 },
      'sensation.intensity': { pain: 4 },
    },
    catalogue,
  );
  it('is the strongest rating a rule names, outside `not`', () => {
    const shame: Condition = { fact: 'family.intensity', key: 'shame_guilt', op: 'present' };
    const distress: Condition = { fact: 'families', op: 'contains', value: 'distress_overwhelm' };
    expect(salience({ any: [shame, distress] }, state)).toBe(9);
    expect(salience({ all: [shame, { not: distress }] }, state)).toBe(6);
    expect(salience({ fact: 'sensation.intensity', key: 'pain', op: 'present' }, state)).toBe(4);
    expect(salience(null, state)).toBe(0);
  });
});
