/**
 * The engine's vocabulary of mechanics (DECISION_LOG E-09, E-36): the stages it runs, the facts
 * it computes, the operators a condition may use and the effects a rule may have. These are code
 * because the engine implements them; adding one raises RULESET_FORMAT. The *values* they range
 * over (families, needs, contexts, thresholds ...) are rule set data, in the catalogue.
 *
 * Everything here is declarative: the validator, the JSON Schema and the format endpoint are all
 * generated from it, so they cannot disagree.
 */

/** Value domains. Their values live in the rule set's catalogue table. */
export const DOMAINS = [
  'cell',
  'band',
  'light',
  'family',
  'intensity_band',
  'sensation_group',
  'sensitivity_flag',
  'context',
  'setting_class',
  'timeline',
  'driver',
  'demand_characteristic',
  'need',
  'pathway',
  'tool',
  'pattern',
  'plan',
  'support',
  'practice_mode',
  'tier',
] as const;
export type Domain = (typeof DOMAINS)[number];

/** Domains whose values have an order (catalogue `Order`); `gte`/`lt` compare that order. */
export const ORDERED_DOMAINS: readonly Domain[] = ['band', 'intensity_band'];

/** What each domain is, for the catalogue and the dashboard. */
export const DOMAIN_INFO: Readonly<Record<Domain, string>> = {
  cell: 'State Grid cell (Tab 1)',
  band: 'Capacity band; Order as in Tab 10 (0 = Very Constrained ... 3 = Available)',
  light: 'Traffic light (Tab 10)',
  family: 'Experience family (Tab 2)',
  intensity_band: 'Intensity band with its 0-10 range (Tab 2)',
  sensation_group: 'Sensation group read by sensation-led rules (Tab 2; filled in M3, E-19)',
  sensitivity_flag: 'Sensitivity flag (Tab 3a)',
  context: 'Where the user is (Tab 3b)',
  setting_class: 'Class of setting used by CX-1 and Tab 3b (interpreted)',
  timeline: 'Timeline code (Tab 4)',
  driver: 'NUCRIPCE driver (Tab 5)',
  demand_characteristic: 'Demand characteristic (Tab 6)',
  need: 'Need, backend name (Tab 6b)',
  pathway: 'Support pathway (Tab 6d section A)',
  tool: 'Tool within a pathway (Tab 6d; filled in M3)',
  pattern: 'Recommendation pattern (Tab 7)',
  plan: 'Plan the user is on (Tab 6d, interpreted)',
  support: 'Support available right now (Figma S10; Tabs 3a, 3b and 6c read headphones)',
  practice_mode:
    'How an offered Reflect or Meditate practice may run (Tab 6c MD-2, MD-4, section D)',
  tier: 'Tool tier the Tab 6d rows mark: Advanced (paid) or the safety floor; other tools are free',
};

/** The engine's stages, in run order, each tied to its Tab 8 step. */
export const STAGES = [
  { key: 'safety', label: 'Safety screen', tab8: '0.' },
  { key: 'entry', label: 'Entry', tab8: '1.' },
  { key: 'state', label: 'State', tab8: '2.' },
  { key: 'not_sure', label: "'Not sure' path", tab8: '2b.' },
  { key: 'experience', label: 'Experience', tab8: '3.' },
  { key: 'intervention', label: 'Intervention inference', tab8: '4.' },
  { key: 'context', label: 'Context', tab8: '5.' },
  { key: 'demand', label: 'Demand', tab8: '6.' },
  { key: 'demand_analysis', label: 'Demand analysis', tab8: '7.' },
  { key: 'capacity_fit', label: 'Capacity-demand fit', tab8: '8.' },
  { key: 'drivers', label: 'NUCRIPCE', tab8: '9.' },
  { key: 'orchestration', label: 'Recommendation orchestration', tab8: '10.' },
  { key: 'entitlements', label: 'Entitlement filter', tab8: '10b.' },
  { key: 'feedback', label: 'Feedback / re-check', tab8: '11.' },
] as const;
export type StageKey = (typeof STAGES)[number]['key'];

/** Precedence layers for proposals, highest first (ADR 0001 §2). */
export const LAYERS = [
  { key: 'safety', label: 'Safety override' },
  { key: 'guard', label: 'Guards (shutdown, sensory overload, meditation, rumination)' },
  { key: 'band', label: 'What the band allows' },
  { key: 'trigger', label: 'Feeling, sensation or need' },
  { key: 'task_due', label: 'A task due now (T0)' },
  { key: 'offer', label: 'Optional Reflect and Meditate offers' },
  {
    key: 'default',
    label: "The band's default card, when nothing above proposes (patterns 1-8, 31)",
  },
] as const;
export type LayerKey = (typeof LAYERS)[number]['key'];

/** Places on the card an effect can fill or govern. `visible` is a button shown on the card. */
export const SLOTS = ['primary', 'alternative', 'queued', 'visible'] as const;

/** Card actions the engine knows how to render; each has fixed behaviour in the app. */
export const ACTIONS = [
  'get_support_now',
  'try_anyway',
  'skip_to_task',
  'start_small',
  'save_for_later',
  'open_home',
  'check_in',
] as const;
export type Action = (typeof ACTIONS)[number];

// ---- facts ----

export type FactType = 'enum' | 'set' | 'number' | 'intensity' | 'boolean';

export interface FactSpec {
  readonly name: string;
  readonly type: FactType;
  /** The domain of an `enum` or `set` fact's values. */
  readonly domain?: Domain;
  /** A keyed fact has one value per key, e.g. the intensity of each family. */
  readonly keyedBy?: Domain;
  /** Inclusive bounds of a `number` fact. */
  readonly min?: number;
  readonly max?: number;
  /** The stage that sets it. */
  readonly stage: StageKey;
  /**
   * Set by rules during the run (the band, the light, setting classes, drivers), so a rule can
   * read it only at or after that stage; input facts are known from the start.
   */
  readonly derived?: true;
  readonly description: string;
}

const fact = (spec: FactSpec): FactSpec => spec;

export const FACTS: readonly FactSpec[] = [
  fact({
    name: 'safety.risk',
    type: 'boolean',
    stage: 'safety',
    description: 'An immediate-risk option was chosen or the free-text screen flagged risk (IG-20)',
  }),
  fact({
    name: 'entry.support_only',
    type: 'boolean',
    stage: 'entry',
    description: '"I just want support": no state, feelings or task given',
  }),
  fact({
    name: 'state.cell',
    type: 'enum',
    domain: 'cell',
    stage: 'state',
    description: 'The State Grid cell (Energy x Mood)',
  }),
  fact({
    name: 'state.energy',
    type: 'number',
    min: 1,
    max: 4,
    stage: 'state',
    description: 'Energy, 1-4',
  }),
  fact({
    name: 'state.mood',
    type: 'number',
    min: 1,
    max: 4,
    stage: 'state',
    description: 'Mood, 1-4',
  }),
  fact({
    name: 'state.not_sure',
    type: 'boolean',
    stage: 'not_sure',
    description: 'The user tapped "Not sure" at the State step',
  }),
  fact({
    name: 'band.baseline',
    type: 'enum',
    domain: 'band',
    stage: 'state',
    derived: true,
    description: 'Band set by the cell (Tab 1, Tab 10)',
  }),
  fact({
    name: 'band.final',
    type: 'enum',
    domain: 'band',
    stage: 'capacity_fit',
    derived: true,
    description: 'Band after the modifiers (Tab 10)',
  }),
  fact({
    name: 'light',
    type: 'enum',
    domain: 'light',
    stage: 'capacity_fit',
    derived: true,
    description: 'Light shown on the card',
  }),
  fact({
    name: 'families',
    type: 'set',
    domain: 'family',
    stage: 'experience',
    description: 'Experience families present',
  }),
  fact({
    name: 'family.intensity',
    type: 'intensity',
    keyedBy: 'family',
    stage: 'experience',
    description: 'Intensity of one family (0-10)',
  }),
  fact({
    name: 'peak.negative',
    type: 'intensity',
    stage: 'experience',
    description: 'Highest intensity among the harder (negative) families',
  }),
  fact({
    name: 'sensation.intensity',
    type: 'intensity',
    keyedBy: 'sensation_group',
    stage: 'experience',
    description: 'Intensity of a sensation group (0-10)',
  }),
  fact({
    name: 'sensitivity.flags',
    type: 'set',
    domain: 'sensitivity_flag',
    stage: 'context',
    description: 'Sensitivity flags set',
  }),
  fact({
    name: 'sensitivity.count',
    type: 'number',
    min: 0,
    max: 20,
    stage: 'context',
    description: 'How many sensitivity flags are set',
  }),
  fact({
    name: 'context.setting',
    type: 'enum',
    domain: 'context',
    stage: 'context',
    description: 'Where the user is',
  }),
  fact({
    name: 'context.classes',
    type: 'set',
    domain: 'setting_class',
    stage: 'context',
    derived: true,
    description: 'Classes of that setting (public, formal ...)',
  }),
  fact({
    name: 'needs',
    type: 'set',
    domain: 'need',
    stage: 'intervention',
    description: 'Needs the user picked',
  }),
  fact({
    name: 'demand.present',
    type: 'boolean',
    stage: 'demand',
    description: 'A task or demand was given',
  }),
  fact({
    name: 'demand.timeline',
    type: 'enum',
    domain: 'timeline',
    stage: 'demand_analysis',
    description: 'Timeline code of the demand',
  }),
  fact({
    name: 'demand.characteristics',
    type: 'set',
    domain: 'demand_characteristic',
    stage: 'demand_analysis',
    description: 'Characteristics of the demand',
  }),
  fact({
    name: 'drivers',
    type: 'set',
    domain: 'driver',
    stage: 'drivers',
    derived: true,
    description: 'NUCRIPCE drivers tagged',
  }),
  fact({
    name: 'signals.plan',
    type: 'enum',
    domain: 'plan',
    stage: 'entitlements',
    description: "The user's plan",
  }),
  fact({
    name: 'signals.declines_session',
    type: 'number',
    min: 0,
    max: 1000,
    stage: 'orchestration',
    description: 'Recommendations declined this session',
  }),
  fact({
    name: 'signals.days_very_constrained',
    type: 'number',
    min: 0,
    max: 3650,
    stage: 'capacity_fit',
    description: 'Days in a row at Very Constrained (SF-2)',
  }),
  fact({
    name: 'signals.days_without_improvement',
    type: 'number',
    min: 0,
    max: 3650,
    stage: 'capacity_fit',
    description: 'Days with no improvement (SF-2)',
  }),
  fact({
    name: 'signals.recovery_window_open',
    type: 'boolean',
    stage: 'feedback',
    description: 'A Blue recovery window is open',
  }),
  fact({
    name: 'signals.practice_due',
    type: 'boolean',
    stage: 'orchestration',
    description: 'A saved practice is due now',
  }),
  fact({
    name: 'recheck.present',
    type: 'boolean',
    stage: 'feedback',
    description: 'This run is a re-check after an action',
  }),
  fact({
    name: 'recheck.previous_light',
    type: 'enum',
    domain: 'light',
    stage: 'feedback',
    description: 'Light of the check-in being re-checked',
  }),
  fact({
    name: 'recheck.intensity_change',
    type: 'number',
    min: -10,
    max: 10,
    stage: 'feedback',
    description: 'Change in peak negative intensity since the check-in (negative = better)',
  }),
  fact({
    name: 'recheck.previous_band',
    type: 'enum',
    domain: 'band',
    stage: 'feedback',
    description: 'Final band of the check-in being re-checked (RC-3)',
  }),
  fact({
    name: 'recheck.band_improved',
    type: 'boolean',
    stage: 'feedback',
    description: 'The new baseline band is above the previous final band (RC-1 "better cell")',
  }),
  fact({
    name: 'recheck.support_completed',
    type: 'boolean',
    stage: 'feedback',
    description: 'The support offered last time was completed (RC-1)',
  }),
  fact({
    name: 'signals.safety_event_recently',
    type: 'boolean',
    stage: 'safety',
    description: 'A safety override happened recently (RC-5, ENT-3)',
  }),
  fact({
    name: 'context.supports',
    type: 'set',
    domain: 'support',
    stage: 'context',
    description: 'Support available right now (headphones, someone with me ...)',
  }),
  fact({
    name: 'recheck.previous_pathway',
    type: 'enum',
    domain: 'pathway',
    stage: 'feedback',
    description:
      'Pathway of the primary on the card being re-checked (RF-2 "the re-check after Reflect")',
  }),
  fact({
    name: 'prefs.meditation_worse',
    type: 'boolean',
    stage: 'entry',
    description: 'The user has said meditation makes them feel worse (MD-2); a saved setting',
  }),
  fact({
    name: 'prefs.body_scan_opt_in',
    type: 'boolean',
    stage: 'entry',
    description: 'The user has opted in to body-scan practice (Tab 6c B); a saved setting',
  }),
  fact({
    name: 'signals.advanced_dismissed',
    type: 'boolean',
    stage: 'entitlements',
    description: 'The user dismissed the Advanced alternative, which ENT-3 says is remembered',
  }),
  fact({
    name: 'signals.in_session',
    type: 'boolean',
    stage: 'entitlements',
    description:
      'The user is in a support session (ENT-3 "during a session"; not defined yet, IG-21)',
  }),
  fact({
    name: 'signals.rejected',
    type: 'set',
    domain: 'pathway',
    stage: 'orchestration',
    description:
      'Pathways the user just said "Not now" to (Tab 7: not repeated immediately; "immediately" is IG-21)',
  }),
];

// ---- conditions ----

export const OPS_BY_TYPE: Readonly<Record<FactType, readonly string[]>> = {
  enum: ['eq', 'ne', 'in', 'not_in', 'present', 'absent'],
  set: ['contains', 'not_contains', 'contains_any', 'contains_all', 'empty', 'not_empty'],
  number: ['eq', 'ne', 'gte', 'gt', 'lte', 'lt', 'present', 'absent'],
  intensity: ['gte', 'gt', 'lte', 'lt', 'present', 'absent'],
  boolean: ['is'],
};
/** Extra operators for enum facts over an ordered domain. */
export const ORDERED_OPS: readonly string[] = ['gte', 'gt', 'lte', 'lt'];
/** Operators that take no value. */
export const UNARY_OPS: readonly string[] = ['present', 'absent', 'empty', 'not_empty'];

/** Size limits so a rule stays readable and cheap to run. */
export const LIMITS = {
  depth: 6,
  nodes: 64,
  children: 16,
  listValues: 40,
  rulesPerRow: 16,
  effectsPerRule: 12,
  text: 2_000,
} as const;
