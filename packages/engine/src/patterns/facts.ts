// Facts the pattern rules read, derived once from stages 1–6.
import type { CompiledSnapshot } from '../snapshot.js';
import type { BandResult } from '../stages/band.js';
import type { ContextResult } from '../stages/context.js';
import type { DemandResult, NeedResult } from '../stages/demand.js';
import type { ExperienceResult } from '../stages/experience.js';
import type { StateResult } from '../stages/state.js';
import type {
  ActionKind,
  Band,
  EngineInput,
  Pathway,
  SavedPracticeSignal,
  UserSignals,
} from '../types.js';

export interface Facts {
  readonly cs: CompiledSnapshot;
  readonly input: EngineInput;
  readonly signals: UserSignals;
  readonly state: StateResult;
  readonly exp: ExperienceResult;
  readonly ctx: ContextResult;
  readonly band: BandResult;
  readonly needs: NeedResult;
  readonly demand: DemandResult;
  readonly safety: { readonly ruleId: string; readonly category: string } | null;
  /** Trend against the previous check-in when this is a re-check (G-ST3). */
  readonly trend?: 'improved' | 'same' | 'worse';
  /** The Blue recovery window is open (RC-1); demand stays gentle (RC-2). */
  readonly recovery: boolean;
}

export type StepSpec =
  | {
      readonly type: 'tool';
      readonly pathway: Pathway;
      readonly tools: readonly string[];
      readonly label?: string;
      readonly minutes?: number;
    }
  | {
      readonly type: 'action';
      readonly kind: ActionKind;
      readonly label?: string;
      readonly minutes?: number;
      readonly practiceId?: string;
    };

export interface Plan {
  readonly patterns: readonly number[];
  readonly primary: StepSpec;
  readonly queued?: StepSpec | undefined;
  readonly alternatives: readonly StepSpec[];
  readonly supportVisible?: boolean | undefined;
  /** Override of the pattern's headline / button for a specific variant (e.g. T0). */
  readonly title?: string | undefined;
  readonly button?: string | undefined;
  readonly suggestion?: string | undefined;
}

export const tool = (
  pathway: Pathway,
  tools: readonly string[],
  label?: string,
  minutes?: number,
): StepSpec =>
  label === undefined
    ? minutes === undefined
      ? { type: 'tool', pathway, tools }
      : { type: 'tool', pathway, tools, minutes }
    : minutes === undefined
      ? { type: 'tool', pathway, tools, label }
      : { type: 'tool', pathway, tools, label, minutes };

export const action = (kind: ActionKind, label?: string, minutes?: number): StepSpec =>
  label === undefined
    ? { type: 'action', kind }
    : minutes === undefined
      ? { type: 'action', kind, label }
      : { type: 'action', kind, label, minutes };

export const has = (f: Facts, family: string): boolean => f.exp.families.has(family);
export const level = (f: Facts, family: string): number => f.exp.families.get(family) ?? -1;
export const high = (f: Facts): number => f.cs.source.thresholds.high;
export const needs = (f: Facts, ...codes: readonly string[]): boolean =>
  codes.some((c) => f.needs.codes.has(c));
export const trait = (f: Facts, ...codes: readonly string[]): boolean =>
  codes.some((c) => f.demand.traits.has(c));
export const finalBand = (f: Facts): Band => f.band.final;
export const isRed = (f: Facts): boolean => f.band.final === 'very_constrained';
export const isAmberOrRed = (f: Facts): boolean =>
  f.band.final === 'very_constrained' || f.band.final === 'constrained';
export const timeline = (f: Facts): string | undefined => f.demand.timeline?.code;

/** Families that trigger a Regulate or Dump step when strong (Tab 2). Restlessness only adds movement. */
const REGULATE_FAMILIES = [
  'distress',
  'anxious',
  'anger',
  'sadness',
  'shame',
  'grief',
  'rejection',
  'anticipatory',
  'tiredness',
  'loneliness',
  'social_hangover',
];

/** Any negative family at High+ (Tab 2 "forced" rows), or racing thoughts at any intensity. */
export function strongTrigger(f: Facts): boolean {
  if (has(f, 'racing') || needs(f, 'clear_head')) return true;
  return REGULATE_FAMILIES.some((code) => level(f, code) >= high(f));
}

/** A milder Regulate offer: negative family below High, restlessness, or "help me feel calmer". */
export function mildTrigger(f: Facts): boolean {
  if (has(f, 'restlessness') || needs(f, 'feel_calmer', 'rest')) return true;
  return REGULATE_FAMILIES.some((code) => level(f, code) >= 0);
}

export function distressHigh(f: Facts): boolean {
  return level(f, 'distress') >= high(f);
}

export function restless(f: Facts): boolean {
  return has(f, 'restlessness') || f.exp.flags.has('restless');
}

/** Regulate tools in preference order for the moment (the context filter removes unusable ones). */
export function calmTools(f: Facts): readonly string[] {
  if (needs(f, 'rest') || has(f, 'tiredness')) return ['rest', 'breathe', 'ground'];
  if (restless(f)) return ['move', 'breathe', 'ground', 'sounds'];
  return ['breathe', 'ground', 'sounds', 'rest'];
}

export function hasSupportPathway(f: Facts): boolean {
  return isRed(f) || f.signals.safetyEventRecently === true;
}

export function practiceDue(f: Facts): SavedPracticeSignal | undefined {
  return f.signals.savedPractices?.find((p) => p.dueNow);
}

export function communicationDemand(f: Facts): boolean {
  return f.demand.present && trait(f, 'communication', 'ask_adjustment');
}

export function hasDemand(f: Facts): boolean {
  return f.demand.present;
}
