import type { Action, LayerKey, StageKey } from './registry.js';

/** A value in a comparison: a literal, or an intensity band standing for its lower bound. */
export type ConditionValue =
  string | number | boolean | readonly string[] | { readonly band: string };

/** A comparison on one fact (DESIGN §4.2). */
export interface Comparison {
  readonly fact: string;
  /** For keyed facts, e.g. the family whose intensity is read. */
  readonly key?: string;
  readonly op: string;
  readonly value?: ConditionValue;
}

/** A condition: a small expression tree. Nothing can loop or call out. */
export type Condition =
  | { readonly all: readonly Condition[] }
  | { readonly any: readonly Condition[] }
  | { readonly not: Condition }
  | Comparison;

/** What an effect points at on the card. */
export type Target =
  { readonly pathway: string } | { readonly tool: string } | { readonly action: Action };

/** One effect; `kind` picks its parameters from the registry. */
export interface Effect {
  readonly kind: string;
  readonly [param: string]: unknown;
}

/** One executable rule: when the condition holds (or always, when null), apply the effects. */
export interface EngineRule {
  /** Runs in this stage instead of the row's (a band row sets the baseline and the light). */
  readonly stage?: StageKey;
  readonly when: Condition | null;
  readonly then: readonly Effect[];
  readonly note?: string;
}

/**
 * The engine columns of a workbook row (DESIGN §3.3): the structured form the engine runs. One
 * row may need several rules (a pattern's primary, alternatives and footer conditions).
 */
export interface EngineColumns {
  readonly stage: StageKey;
  /** Precedence of the row's proposals (ADR 0007 §2); required when it proposes anything. */
  readonly layer?: LayerKey;
  readonly rules: readonly EngineRule[];
  /** How the text was read; required when the mapping is `interpreted`. */
  readonly interpretation?: string;
}
