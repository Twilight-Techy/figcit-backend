// Property tests (ENGINEERING_RULES §13): invariants that hold for any valid input.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { evaluate, TIMELINE_CODES, type EngineInput, type UserSignals } from '../src/index.js';
import { snapshot } from './helpers.js';

const emotionCodes = snapshot.emotions.map((e) => e.code);
const sensationCodes = snapshot.sensations.map((s) => s.code);
const environments = snapshot.environments.map((e) => e.code);
const flags = snapshot.sensitivityFlags.map((f) => f.code);
const needCodes = snapshot.needs.filter((n) => n.code !== 'urgent_help').map((n) => n.code);
const traits = snapshot.demandTraits.map((t) => t.code);

const inputArb: fc.Arbitrary<EngineInput> = fc.record(
  {
    state: fc.oneof(
      fc.record({
        kind: fc.constant('grid' as const),
        energy: fc.integer({ min: 1, max: 4 }),
        mood: fc.integer({ min: 1, max: 4 }),
      }),
      fc.record({ kind: fc.constant('not_sure' as const) }),
    ),
    emotions: fc.array(
      fc.record({
        code: fc.constantFrom(...emotionCodes),
        intensity: fc.integer({ min: 0, max: 10 }),
      }),
      { maxLength: 3 },
    ),
    sensations: fc.array(
      fc.record({
        code: fc.constantFrom(...sensationCodes),
        intensity: fc.integer({ min: 0, max: 10 }),
      }),
      { maxLength: 4 },
    ),
    context: fc.record({
      environment: fc.constantFrom(...environments),
      sensitivity: fc.uniqueArray(fc.constantFrom(...flags), { maxLength: 4 }),
    }),
    needs: fc.uniqueArray(fc.constantFrom(...needCodes), { maxLength: 2 }),
    demand: fc.option(
      fc.record({
        timeline: fc.constantFrom(...TIMELINE_CODES),
        traits: fc.uniqueArray(fc.constantFrom(...traits), { maxLength: 3 }),
        puttingOff: fc.boolean(),
      }),
      { nil: undefined },
    ),
  },
  { requiredKeys: ['state'] },
) as fc.Arbitrary<EngineInput>;

const signalsArb: fc.Arbitrary<UserSignals> = fc.record({
  plan: fc.constantFrom('free' as const, 'plus' as const),
  hasTrustedContact: fc.boolean(),
  meditationMakesWorse: fc.boolean(),
});

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

  it('Red never has a task as the primary (demand deferred)', () => {
    fc.assert(
      fc.property(inputArb, signalsArb, (input, signals) => {
        const r = evaluate(input, snapshot, signals);
        if (r.light === 'red' && r.patterns[0] !== 17 && r.patterns[0] !== 22)
          expect(r.primary.pathway).not.toBe('execute');
        if (r.light === 'red') expect(r.supportVisible).toBe(true);
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
