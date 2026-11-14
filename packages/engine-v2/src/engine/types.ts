import type { Catalogue, Issue } from '../format/catalogue.js';
import type { LayerKey, StageKey } from '../format/registry.js';
import type { Condition, Effect, Target } from '../format/types.js';

/**
 * The engine's input: the input facts by name (DESIGN §5), in standard values only. Keyed facts
 * are objects (`{ "family.intensity": { "anxious_fearful": 7, "grief_loss": null } }`, where null
 * is felt but not rated). Facts the engine works out (`computed`) or rules set (`derived`) are
 * never sent. A boolean that is left out is false; a set that is left out is empty.
 */
export type EngineInput = Readonly<Record<string, unknown>>;

/** One rule of a published row, in run order. */
export interface CompiledRule {
  /** `<row id>#<rule index>`: stable across versions, as the row ID is. */
  readonly id: string;
  readonly rowId: string;
  /** "tab · reference", for people. */
  readonly ref: string;
  readonly stage: StageKey;
  /** The row's layer; null for a row that only sets requirements or facts. */
  readonly layer: LayerKey | null;
  /** 0, or 1 when it reads a derived fact that rules of its own stage set (it runs after them). */
  readonly wave: 0 | 1;
  readonly when: Condition | null;
  readonly then: readonly Effect[];
  /** Position in run order; also the tie-break between proposals of one layer. */
  readonly seq: number;
}

export interface CompiledRuleset {
  readonly rules: readonly CompiledRule[];
  readonly catalogue: Catalogue;
  /** Rows left out because they don't pass the format check, and run-order problems. */
  readonly issues: readonly Issue[];
  /** Rows not run because they are not `exact` or `interpreted` (exempt, E-11). */
  readonly exempt: number;
}

/** A row as the engine needs it: the stored record and its stable ID. */
export interface EngineRow {
  readonly id: string;
  readonly tab: string;
  readonly sourceRef: string;
  readonly order: number;
  readonly status: string;
  readonly mapping: string;
  readonly engine: unknown;
}

/** One thing on the card. */
export interface CardItem {
  readonly target: Target;
  /** The pathway of a pathway or tool target. */
  readonly pathway: string | null;
  /** The tool the button opens; a pathway resolves to its best allowed tool. */
  readonly tool: string | null;
  /** The tool is Advanced (Tab 6d); the app labels it. */
  readonly advanced: boolean;
  /** Wording key of the CTA or option (M4 copy). */
  readonly copy: string | null;
  /** Further wording keys from the same row (tone, e.g. no blame). */
  readonly tone: readonly string[];
  /** The rule whose proposal or requirement put it here. */
  readonly from: string;
  /** v5.0 (LBL-1): the tool's approved user_label and user_description, the only words shown. */
  readonly label?: string;
  readonly description?: string | null;
}

export interface Card {
  /** `support_screen`: the safety override (pattern 28); nothing else is shown. */
  readonly kind: 'card' | 'support_screen' | 'urgent_screen';
  readonly band: string | null;
  readonly light: string | null;
  readonly primary: CardItem | null;
  /** At most two (Tab 7 non-negotiables). */
  readonly alternatives: readonly CardItem[];
  /** In order: what follows the primary. */
  readonly queued: readonly CardItem[];
  /** Buttons always shown: "Get support now" first, then actions such as "Skip to task". */
  readonly visible: readonly CardItem[];
  /** Wording keys of prompts shown on the card (e.g. headphones). */
  readonly prompts: readonly string[];
  readonly reminder: { readonly minutes: number; readonly copy: string | null } | null;
  readonly supportVisible: boolean;
  /** NUCRIPCE tags kept, strongest first. */
  readonly drivers: readonly { readonly code: string; readonly weight: number }[];
  readonly stepCap: number | null;
  readonly minutesCap: number | null;
  /** How offered practices may run here (MD-2, MD-4, Tab 6c D). */
  readonly practice: readonly {
    readonly modes: readonly string[];
    readonly maxMinutes: number | null;
    readonly tools: readonly string[] | null;
  }[];
  /** v5.0: the card's pattern (Tab 11), which gives its headline. */
  readonly pattern?: string;
  /** v5.0 TK-4: with no task, the wording key of the task that fits right now (Tab 10). */
  readonly suggestion?: string;
  /** No-words mode (v5.0 FE-2, BS-3): tap-only tools, eyes open; absent when off. */
  readonly noWords?: true;
  /** The input the primary's rule matched on: "Because you said X". */
  readonly because: readonly {
    readonly fact: string;
    readonly key?: string;
    readonly value: unknown;
  }[];
}

/** What happened to one proposal, for "what influenced this". */
export interface ProposalFate {
  readonly from: string;
  readonly slot: string;
  readonly target: Target;
  readonly fate:
    'used' | 'merged' | 'outranked' | 'blocked' | 'no_tool' | 'over_limit' | 'duplicate';
  /** The requirement or proposal that decided it. */
  readonly by?: string;
}

export interface RuleCheck {
  readonly rule: string;
  readonly ref: string;
  readonly matched: boolean;
  /** Path of the first part of the condition that failed. */
  readonly failedAt?: string;
}

export interface Trace {
  readonly level: 'light' | 'full';
  /** IDs of the rules that matched, in run order. */
  readonly fired: readonly string[];
  /** Full trace only: each stage's checks and the facts at its end. */
  readonly stages?: readonly {
    readonly stage: StageKey;
    readonly checks: readonly RuleCheck[];
    readonly facts: Readonly<Record<string, unknown>>;
  }[];
  readonly proposals?: readonly ProposalFate[];
  /** Things worth knowing: a conflict settled, a key ignored. */
  readonly notes: readonly string[];
}

export type RunResult =
  | { readonly ok: true; readonly card: Card; readonly trace: Trace }
  | { readonly ok: false; readonly issues: readonly Issue[] };
