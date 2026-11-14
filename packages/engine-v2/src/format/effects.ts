import type { Domain } from './registry.js';

/**
 * The effects a rule may have (DESIGN §4.3): a closed list, because each one is engine behaviour.
 * Adding one raises RULESET_FORMAT. Split from the registry only for size.
 */

export type ParamSpec =
  | { readonly type: 'enum'; readonly domain: Domain }
  | { readonly type: 'enum_list'; readonly domain: Domain; readonly min: number }
  | { readonly type: 'int'; readonly min: number; readonly max: number; readonly nullable?: true }
  | { readonly type: 'slot' }
  | { readonly type: 'target' }
  | { readonly type: 'key' };

export type EffectClass = 'requirement' | 'proposal' | 'modifier';

export interface EffectSpec {
  readonly kind: string;
  /**
   * `requirement`: a later layer can't overrule it; `proposal`: ranked by layer, then row order;
   * `modifier`: adds to the facts or the card's wording without deciding anything.
   */
  readonly class: EffectClass;
  readonly params: Readonly<Record<string, ParamSpec>>;
  /** Params that may be left out. */
  readonly optional?: readonly string[];
  /**
   * The derived fact it changes. A rule may only change it at or before the stage that sets it,
   * or the change would come after the fact was read (validate.ts).
   */
  readonly writes?: 'band.baseline' | 'band.final' | 'light' | 'context.classes';
  readonly description: string;
}

const effect = (spec: EffectSpec): EffectSpec => spec;

export const EFFECTS: readonly EffectSpec[] = [
  effect({
    kind: 'band.lower',
    class: 'requirement',
    params: { steps: { type: 'int', min: 1, max: 3 } },
    writes: 'band.final',
    description: 'Move the band down (lower Order, towards Very Constrained)',
  }),
  effect({
    kind: 'band.cap',
    class: 'requirement',
    params: { to: { type: 'enum', domain: 'band' } },
    writes: 'band.final',
    description: 'The band goes no lower than this (Tab 10 caps, e.g. E4M1 stops at Constrained)',
  }),
  effect({
    kind: 'band.hold',
    class: 'requirement',
    params: {},
    writes: 'band.final',
    description: 'Keep the band as it is (no further change in this stage)',
  }),
  effect({
    kind: 'band.set',
    class: 'requirement',
    params: { to: { type: 'enum', domain: 'band' } },
    writes: 'band.baseline',
    description: 'Set the baseline band (State stage: Tab 10 band rows, E4M1, NS-1)',
  }),
  effect({
    kind: 'band.limit_drop',
    class: 'requirement',
    params: { steps: { type: 'int', min: 0, max: 3 } },
    writes: 'band.final',
    description:
      'The band falls at most this many steps below the baseline in one check-in (CAP-1)',
  }),
  effect({
    kind: 'band.limit_rise',
    class: 'requirement',
    params: { steps: { type: 'int', min: 0, max: 3 } },
    writes: 'band.final',
    description:
      'On a re-check the band rises at most this many steps above the previous final band (RC-3, RC-4)',
  }),
  effect({
    kind: 'light.never',
    class: 'requirement',
    params: { light: { type: 'enum', domain: 'light' } },
    writes: 'light',
    description: 'This light is not shown (RC-5: no automatic Blue after a safety override)',
  }),
  effect({
    kind: 'light.overlay',
    class: 'requirement',
    params: { light: { type: 'enum', domain: 'light' } },
    writes: 'light',
    description:
      "Show this light over the band's (Blue recovery, RC-1); light.never still stops it (RC-5)",
  }),
  effect({
    kind: 'classes.add',
    class: 'modifier',
    params: { classes: { type: 'enum_list', domain: 'setting_class', min: 1 } },
    writes: 'context.classes',
    description: 'The setting counts as these classes (Tab 3b; read by CX-1 and MD-4)',
  }),
  effect({
    kind: 'mode.no_words',
    class: 'requirement',
    params: {},
    description:
      'No-words mode: tap-only tools, eyes open, nothing to read or decide (v5.0 FE-2, BS-3; pattern 16)',
  }),
  effect({
    kind: 'light.set',
    class: 'requirement',
    params: { light: { type: 'enum', domain: 'light' } },
    writes: 'light',
    description: 'Set the light',
  }),
  effect({
    kind: 'stop',
    class: 'requirement',
    params: {},
    description: 'Safety override: pause every other layer and show the support screen',
  }),
  effect({
    kind: 'require',
    class: 'requirement',
    params: { slot: { type: 'slot' }, target: { type: 'target' } },
    description: 'This must fill the slot',
  }),
  effect({
    kind: 'forbid',
    class: 'requirement',
    params: { slot: { type: 'slot' }, target: { type: 'target' } },
    optional: ['slot'],
    description: 'This must not appear (in the slot, or anywhere)',
  }),
  effect({
    kind: 'propose',
    class: 'proposal',
    params: { slot: { type: 'slot' }, target: { type: 'target' }, copy: { type: 'key' } },
    optional: ['copy'],
    description: 'Suggest this for the slot',
  }),
  effect({
    kind: 'tools.exclude',
    class: 'requirement',
    params: { tools: { type: 'enum_list', domain: 'tool', min: 1 } },
    description: 'These tools are not offered',
  }),
  effect({
    kind: 'tools.prefer',
    class: 'proposal',
    params: { tools: { type: 'enum_list', domain: 'tool', min: 1 } },
    description: 'Prefer these tools within their pathway',
  }),
  effect({
    kind: 'support.show',
    class: 'requirement',
    params: {},
    description: '"Get support now" is visible',
  }),
  effect({
    kind: 'step_cap.set',
    class: 'requirement',
    params: { max: { type: 'int', min: 1, max: 20, nullable: true } },
    description: 'At most this many task steps (null: no cap)',
  }),
  effect({
    kind: 'minutes.cap',
    class: 'requirement',
    params: { max: { type: 'int', min: 1, max: 60 } },
    description:
      'An offered support session lasts at most this many minutes (T0: a 1-2 minute reset)',
  }),
  effect({
    kind: 'drivers.add',
    class: 'modifier',
    params: {
      drivers: { type: 'enum_list', domain: 'driver', min: 1 },
      weight: { type: 'int', min: 1, max: 4 },
    },
    optional: ['weight'],
    description:
      'Tag these NUCRIPCE drivers; weight 1 (low) to 4 (maximum) ranks them (Tab 4 urgency weights)',
  }),
  effect({
    kind: 'drivers.keep_only',
    class: 'requirement',
    params: { drivers: { type: 'enum_list', domain: 'driver', min: 0 } },
    description: 'Keep only these drivers (none: drop all)',
  }),
  effect({
    kind: 'practice.limit',
    class: 'requirement',
    params: {
      modes: { type: 'enum_list', domain: 'practice_mode', min: 1 },
      max_minutes: { type: 'int', min: 1, max: 60 },
      tools: { type: 'enum_list', domain: 'tool', min: 1 },
    },
    optional: ['max_minutes', 'tools'],
    description:
      'A practice offered here (these tools, or every Reflect and Meditate tool) runs only in these modes, and for at most this long (MD-2, MD-4, Tab 6c D)',
  }),
  effect({
    kind: 'reminder.offer',
    class: 'proposal',
    params: { minutes: { type: 'int', min: 1, max: 1440 }, copy: { type: 'key' } },
    optional: ['copy'],
    description: 'Offer "Remind me in N minutes" on the card (patterns 20, 29, 30, 37)',
  }),
  effect({
    kind: 'tools.tier',
    class: 'modifier',
    params: {
      tier: { type: 'enum', domain: 'tier' },
      tools: { type: 'enum_list', domain: 'tool', min: 1 },
    },
    description:
      'These tools are of this tier (the Tab 6d section A rows; ENT-9 changes are rule edits)',
  }),
  effect({
    kind: 'tier.limit',
    class: 'requirement',
    params: {
      tier: { type: 'enum', domain: 'tier' },
      max: { type: 'int', min: 0, max: 3 },
      slot: { type: 'slot' },
    },
    optional: ['slot'],
    description: 'At most this many tools of this tier on the card, or in that slot (ENT-1, ENT-3)',
  }),
  effect({
    kind: 'tier.require',
    class: 'requirement',
    params: { tier: { type: 'enum', domain: 'tier' }, slot: { type: 'slot' } },
    description:
      "The slot's tool must be of this tier (Tab 6d D: a safety-floor tool in Amber and Red)",
  }),
  effect({
    kind: 'tools.version',
    class: 'modifier',
    params: { tool: { type: 'enum', domain: 'tool' }, version: { type: 'enum', domain: 'tool' } },
    description:
      "This Advanced tool is the fuller version of that free one (Tab 6d section A: 'Advanced Movement' for Move)",
  }),
  effect({
    kind: 'tools.upgrade',
    class: 'requirement',
    params: { tier: { type: 'enum', domain: 'tier' } },
    description:
      "Use a tool's fuller version of this tier in its place, where one exists and the card allows it (Tab 6d: the best-fit tool the plan includes; E-62)",
  }),
  effect({
    kind: 'tier.offer',
    class: 'requirement',
    params: { tier: { type: 'enum', domain: 'tier' } },
    description:
      "Offer one tool of this tier from the card's suggested pathway as an alternative (Tab 6d: one labelled Advanced alternative in Green, Yellow or Blue; E-62)",
  }),
  effect({
    kind: 'tools.swap',
    class: 'modifier',
    params: { from: { type: 'enum', domain: 'tool' }, to: { type: 'target' } },
    description:
      'v5.0 CX-R: where you are, this tool is shown as that one instead (Breathe → Breathe (discreet)); the best-ranked swap wins',
  }),
  effect({
    kind: 'tasks.order',
    class: 'modifier',
    params: {
      first: { type: 'enum_list', domain: 'task_chip', min: 0 },
      later: { type: 'enum_list', domain: 'task_chip', min: 0 },
    },
    optional: ['later'],
    description:
      'v5.0 TK-2: the order tasks are shown in for this colour, by chip; `later` ones wait (Amber)',
  }),
  effect({
    kind: 'alternatives.limit',
    class: 'requirement',
    params: { max: { type: 'int', min: 0, max: 2 } },
    description: 'v5.0: at most this many alternatives (pattern 49: none beside the silent tool)',
  }),
  effect({
    kind: 'pattern.set',
    class: 'modifier',
    params: { pattern: { type: 'enum', domain: 'pattern' } },
    description:
      "v5.0: the card's pattern (Tab 11), which gives its headline; the best-ranked rule's wins",
  }),
  effect({
    kind: 'suggestion.set',
    class: 'modifier',
    params: { copy: { type: 'key' } },
    description:
      'v5.0 TK-4: with no task, the task that fits right now (Tab 10 list); the best-ranked wins',
  }),
  effect({
    kind: 'screen.urgent',
    class: 'requirement',
    params: {},
    description:
      "v5.0 SF-4: with stop, the urgent screen (999 and the nation's 111 line, pattern 50) instead of the support screen",
  }),
  effect({
    kind: 'copy.use',
    class: 'modifier',
    params: { slot: { type: 'slot' }, key: { type: 'key' } },
    description: 'Use this wording key for the slot',
  }),
];
