// Property tests (ENGINEERING_RULES §13): invariants that hold for any valid input.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/index.js';
import { inputArb, signalsArb } from './arbitraries.js';
import { snapshot } from './helpers.js';

const advancedIds = new Set(snapshot.tools.filter((t) => t.tier === 'advanced').map((t) => t.id));
const floorIds = new Set(snapshot.tools.filter((t) => t.safetyFloor).map((t) => t.id));

describe('engine properties', () => {
  it('always returns one primary and at most two alternatives', () => {
    fc.assert(
      fc.property(inputArb, signalsArb, (input, signals) => {
        const r = evaluate(input, snapshot, signals);
        expect(r.primary).toBeDefined();
        expect(r.alternatives.length).toBeLessThanOrEqual(2);
        expect(r.alternatives.filter((a) => a.advanced).length).toBeLessThanOrEqual(1);
      }),
      { numRuns: 1500 },
    );
  });

  it('safety triggers always return Help', () => {
    fc.assert(
      fc.property(
        inputArb,
        signalsArb,
        fc.constantFrom('I want to die', 'thinking of hurting myself', 'I dont want to be here'),
        (input, signals, text) => {
          const r = evaluate({ ...input, freeText: [text] }, snapshot, signals);
          expect(r.primary.kind).toBe('support');
          expect(r.safety.triggered).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('no Advanced tools in Amber or Red, and floor tools only as the primary', () => {
    fc.assert(
      fc.property(inputArb, signalsArb, (input, signals) => {
        const r = evaluate(input, snapshot, signals);
        if (r.light !== 'amber' && r.light !== 'red') return;
        const ids = [r.primary, ...r.alternatives]
          .map((a) => a.toolId)
          .filter((id): id is string => id !== undefined);
        for (const id of ids) expect(advancedIds.has(id)).toBe(false);
        if (r.primary.toolId) expect(floorIds.has(r.primary.toolId)).toBe(true);
      }),
      { numRuns: 1500 },
    );
  });

  it('free users never get an Advanced primary', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const r = evaluate(input, snapshot, { plan: 'free' });
        if (r.primary.toolId) expect(advancedIds.has(r.primary.toolId)).toBe(false);
      }),
      { numRuns: 1500 },
    );
  });

  it('is deterministic', () => {
    fc.assert(
      fc.property(inputArb, signalsArb, (input, signals) => {
        expect(evaluate(input, snapshot, signals)).toEqual(evaluate(input, snapshot, signals));
      }),
      { numRuns: 300 },
    );
  });
});
