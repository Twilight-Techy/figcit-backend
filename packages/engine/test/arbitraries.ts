// Shared fast-check arbitraries for the property and invariant tests.
import fc from 'fast-check';
import { TIMELINE_CODES, type EngineInput, type UserSignals } from '../src/index.js';
import { snapshot } from './helpers.js';

const emotionCodes = snapshot.emotions.map((e) => e.code);
const sensationCodes = snapshot.sensations.map((s) => s.code);
const environments = snapshot.environments.map((e) => e.code);
const flags = snapshot.sensitivityFlags.map((f) => f.code);
const needCodes = snapshot.needs.filter((n) => n.code !== 'urgent_help').map((n) => n.code);
export const traits = snapshot.demandTraits.map((t) => t.code);

export const inputArb: fc.Arbitrary<EngineInput> = fc.record(
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

export const signalsArb: fc.Arbitrary<UserSignals> = fc.record({
  plan: fc.constantFrom('free' as const, 'plus' as const),
  hasTrustedContact: fc.boolean(),
  meditationMakesWorse: fc.boolean(),
});
