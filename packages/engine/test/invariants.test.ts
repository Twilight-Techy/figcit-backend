// Invariants from Tab 10, Tab 6c and Tab 6d checked over random inputs and signals (fixed seed, so
// a failure is reproducible; ENGINEERING_RULES §13).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  evaluate,
  type Band,
  type EngineInput,
  type EngineResult,
  type UserSignals,
} from '../src/index.js';
import { inputArb } from './arbitraries.js';
import { snapshot } from './helpers.js';

const BANDS: readonly Band[] = ['very_constrained', 'constrained', 'conditional', 'available'];
const step = (b: Band): number => BANDS.indexOf(b);
const runs = { numRuns: 2500, seed: 20261029 };

const fullSignalsArb: fc.Arbitrary<UserSignals> = fc.record({
  plan: fc.constantFrom('free' as const, 'plus' as const),
  hasTrustedContact: fc.boolean(),
  meditationMakesWorse: fc.boolean(),
  bodyScanOptIn: fc.boolean(),
  safetyEventRecently: fc.boolean(),
  inSession: fc.boolean(),
  dismissedAdvanced: fc.boolean(),
  recoveryActive: fc.boolean(),
  personalisation: fc.boolean(),
});

const routineTraits = new Set(
  snapshot.demandTraits
    .filter((t) => t.drivers.length > 0 && t.drivers.every((d) => d === 'routine'))
    .map((t) => t.code),
);

/** Tab 0 E1M2.6: a mild feeling and a purely familiar task may keep "start with the familiar bit". */
function familiarOnly(input: EngineInput): boolean {
  const d = input.demand;
  if (!d || (input.needs ?? []).includes('rest')) return false;
  if (['T0', 'T1', 'TX'].includes(d.timeline)) return false;
  const traits = d.traits ?? [];
  const routine = d.timeline === 'TR' || d.puttingOff === true || traits.length > 0;
  return routine && traits.every((t) => routineTraits.has(t));
}

const actions = (r: EngineResult) => [r.primary, ...r.alternatives];

describe('Tab 10 band and safety invariants', () => {
  it('UP-0 and CAP-1: a check-in never raises the band and drops it at most two steps', () => {
    fc.assert(
      fc.property(inputArb, fullSignalsArb, (input, signals) => {
        const r = evaluate(input, snapshot, signals);
        const drop = step(r.band.baseline) - step(r.band.final);
        expect(drop).toBeGreaterThanOrEqual(0);
        expect(drop).toBeLessThanOrEqual(2);
      }),
      runs,
    );
  });

  it('DEM-0: adding a demand never changes the band', () => {
    fc.assert(
      fc.property(inputArb, fullSignalsArb, (input, signals) => {
        const { demand: _demand, ...rest } = input;
        const without = evaluate(rest, snapshot, signals);
        const withDemand = evaluate(input, snapshot, signals);
        expect(withDemand.band.final).toBe(without.band.final);
      }),
      runs,
    );
  });

  it('Red defers demand: no task primary (except patterns 17, 22 and a familiar-only task)', () => {
    fc.assert(
      fc.property(inputArb, fullSignalsArb, (input, signals) => {
        const r = evaluate(input, snapshot, signals);
        if (r.light !== 'red') return;
        expect(r.supportVisible).toBe(true);
        expect(r.drivers).toEqual([]);
        const allowed =
          r.patterns[0] === 17 ||
          r.patterns[0] === 22 ||
          (r.patterns[0] === 3 && familiarOnly(input));
        if (!allowed) expect(r.primary.pathway).not.toBe('execute');
      }),
      runs,
    );
  });

  it('Amber keeps Routine only and RC-2 keeps demand gentle in the recovery window', () => {
    fc.assert(
      fc.property(inputArb, fullSignalsArb, (input, signals) => {
        const r = evaluate(input, snapshot, signals);
        if (r.light === 'amber' || r.light === 'blue')
          for (const d of r.drivers) expect(d).toBe('routine');
        if (r.light === 'blue') expect(r.patterns).not.toContain(2);
      }),
      runs,
    );
  });

  it('MD-6 and SF-1: a safety trigger leads with support and nothing replaces it', () => {
    fc.assert(
      fc.property(inputArb, fullSignalsArb, (input, signals) => {
        const r = evaluate({ ...input, freeText: ['I want to die'] }, snapshot, signals);
        expect(r.primary.kind).toBe('support');
        expect(r.light).toBe('red');
        expect(r.notNow).toBe(false);
        expect(r.alternatives.some((a) => a.advanced)).toBe(false);
      }),
      { ...runs, numRuns: 500 },
    );
  });
});

describe('Tab 6d entitlement invariants', () => {
  it('ENT-3: no Advanced offer under strain, after a safety event, in a session or once dismissed', () => {
    fc.assert(
      fc.property(inputArb, fullSignalsArb, (input, signals) => {
        const r = evaluate(input, snapshot, signals);
        const offered = actions(r).filter((a) => a.advanced);
        expect(r.primary.advanced).not.toBe(true);
        expect(offered.length).toBeLessThanOrEqual(1);
        const blocked =
          r.light === 'amber' ||
          r.light === 'red' ||
          signals.plan === 'plus' ||
          signals.safetyEventRecently === true ||
          signals.inSession === true ||
          signals.dismissedAdvanced === true;
        if (blocked) expect(offered).toEqual([]);
      }),
      runs,
    );
  });

  it('ENT-5: free and Plus get the same band, light, pattern, gates and support', () => {
    fc.assert(
      fc.property(inputArb, fullSignalsArb, (input, signals) => {
        const a = evaluate(input, snapshot, { ...signals, plan: 'free' });
        const b = evaluate(input, snapshot, { ...signals, plan: 'plus' });
        expect(b.band).toEqual(a.band);
        expect(b.light).toBe(a.light);
        expect(b.patterns).toEqual(a.patterns);
        expect(b.supportVisible).toBe(a.supportVisible);
        const blocked = (r: EngineResult) =>
          r.gates
            .filter((g) => g.effect === 'blocked' && !g.rule.startsWith('ENT'))
            .map((g) => g.rule);
        expect(blocked(b)).toEqual(blocked(a));
      }),
      runs,
    );
  });

  it('stage 11: personalisation never moves the primary and needs consent', () => {
    fc.assert(
      fc.property(inputArb, fullSignalsArb, (input, signals) => {
        const scored = { ...signals, toolScores: { quick_message: 9, dump_text: 5 } };
        const base = evaluate(input, snapshot, signals);
        const ranked = evaluate(input, snapshot, scored);
        expect(ranked.primary).toEqual(base.primary);
        if (signals.personalisation !== true)
          expect(evaluate(input, snapshot, scored).alternatives).toEqual(base.alternatives);
      }),
      runs,
    );
  });
});

describe('re-check invariants (RC-1 to RC-5, G-ST3)', () => {
  const previousArb = fc.record({
    cellId: fc.constantFrom(...snapshot.cells.map((c) => c.id)),
    finalBand: fc.constantFrom(...BANDS),
    light: fc.constantFrom('green' as const, 'yellow' as const, 'amber' as const, 'red' as const),
    peakIntensity: fc.integer({ min: 0, max: 10 }),
    supportCompleted: fc.boolean(),
    safetyTriggered: fc.boolean(),
    pathway: fc.constantFrom('regulate' as const, 'reflect' as const, 'dump' as const),
  });

  it('RC-3 one step up; RC-5 no Blue after safety; worse shows support; RF-2 after Reflect', () => {
    fc.assert(
      fc.property(inputArb, fullSignalsArb, previousArb, (input, signals, prev) => {
        const r = evaluate({ ...input, recheckOf: prev }, snapshot, signals);
        expect(step(r.band.final)).toBeLessThanOrEqual(step(prev.finalBand) + 1);
        if (prev.safetyTriggered) expect(r.light).not.toBe('blue');
        if (r.light === 'blue') expect(prev.supportCompleted).toBe(true);
        if (r.recheck?.outcome === 'worse') {
          expect(r.light).not.toBe('blue');
          expect(r.supportVisible).toBe(true);
          if (prev.pathway === 'reflect')
            expect(actions(r).some((a) => a.pathway === 'reflect')).toBe(false);
        }
      }),
      runs,
    );
  });
});
