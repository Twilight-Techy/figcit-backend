// Re-check and recovery, RC-1 to RC-5 (Tab 10), and pattern 31.
import type { Facts, Plan } from './patterns/index.js';
import { bandAt, bandStep, type BandResult } from './stages/band.js';
import type { Band, PreviousOutcome } from './types.js';

export interface Recheck {
  readonly outcome: 'improved' | 'same' | 'worse';
  readonly rule: 'RC-1' | 'RC-4' | 'RC-5';
  readonly band: BandResult;
  readonly blue: boolean;
}

type PartialFacts = Omit<Facts, 'band'>;

function outcomeOf(f: PartialFacts, prev: PreviousOutcome): Recheck['outcome'] {
  const drop = f.cs.source.thresholds.recheckImprovedIntensityDrop;
  const prevCell = f.cs.cellById.get(prev.cellId);
  const prevBase = prevCell ? bandStep(prevCell.band) : bandStep(prev.finalBand);
  const newBase = f.state.cell ? bandStep(f.state.cell.band) : prevBase;
  // Worse = a lower state or stronger feelings, not modifiers re-applied to the same picture.
  if (newBase < prevBase || f.exp.peak - prev.peakIntensity >= drop) return 'worse';
  return newBase > prevBase || prev.peakIntensity - f.exp.peak >= drop ? 'improved' : 'same';
}

function withBand(band: BandResult, final: Band, reason: string): BandResult {
  if (final === band.final) return band;
  return {
    ...band,
    final,
    modifiers: [
      ...band.modifiers,
      { rule: 'RC-3', steps: bandStep(final) - bandStep(band.final), reason },
    ],
  };
}

/** Compares a re-check with the outcome that preceded it. */
export function assessRecheck(f: PartialFacts, band: BandResult): Recheck | undefined {
  const prev = f.input.recheckOf;
  if (!prev) return undefined;
  const outcome = outcomeOf(f, prev);
  const prevStep = bandStep(prev.finalBand);
  // RC-3: the band rises at most one step per re-check.
  const capped = withBand(
    band,
    bandStep(band.final) > prevStep + 1 ? bandAt(prevStep + 1) : band.final,
    'one step up per re-check',
  );
  if (prev.safetyTriggered) return { outcome, rule: 'RC-5', band: capped, blue: false };
  const eligible = prev.supportCompleted && prev.light !== 'green' && prev.light !== 'blue';
  if (outcome === 'improved' && eligible)
    return { outcome, rule: 'RC-1', band: capped, blue: true };
  // RC-4: no improvement keeps the previous light; only a worse re-check lowers it.
  const held =
    outcome === 'same'
      ? withBand(band, prev.finalBand, 'unchanged re-check keeps the previous band')
      : capped;
  return { outcome, rule: 'RC-4', band: held, blue: false };
}

export function recoveryPlan(f: Facts): Plan {
  const demand = f.demand.present;
  return {
    patterns: [31],
    primary: demand
      ? { type: 'tool', pathway: 'execute', tools: ['smallest_step'], label: 'Start small' }
      : {
          type: 'tool',
          pathway: 'regulate',
          tools: ['rest', 'sounds', 'breathe'],
          label: 'Wind down',
        },
    alternatives: [
      { type: 'tool', pathway: 'regulate', tools: ['rest'], label: 'Rest a bit longer' },
      {
        type: 'tool',
        pathway: 'reflect',
        tools: ['what_helped', 'reflect_checkout'],
        label: 'Reflect on what helped',
      },
    ],
    title: demand
      ? "You're steadier — want to pick up gently?"
      : "You're steadier — rest is still a good choice",
  };
}

/** RC-4: don't repeat the route that didn't help; lead with the first different one. */
export function differentRoute(plan: Plan, f: Facts): Plan {
  const prev = f.input.recheckOf;
  if (!prev?.pathway || plan.primary.type !== 'tool' || plan.primary.pathway !== prev.pathway)
    return plan;
  const next = plan.alternatives.find((a) => a.type === 'tool' && a.pathway !== prev.pathway);
  if (!next) return plan;
  return {
    ...plan,
    primary: next,
    alternatives: [plan.primary, ...plan.alternatives.filter((a) => a !== next)],
    title: "Let's try a different way in",
  };
}
