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
  readonly description: string;
}

const effect = (spec: EffectSpec): EffectSpec => spec;

export const EFFECTS: readonly EffectSpec[] = [
  effect({
    kind: 'band.lower',
    class: 'requirement',
    params: { steps: { type: 'int', min: 1, max: 3 } },
    description: 'Move the band down (lower Order, towards Very Constrained)',
  }),
  effect({
    kind: 'band.cap',
    class: 'requirement',
    params: { to: { type: 'enum', domain: 'band' } },
    description: 'The band goes no lower than this (Tab 10 caps, e.g. E4M1 stops at Constrained)',
  }),
  effect({
    kind: 'band.hold',
    class: 'requirement',
    params: {},
    description: 'Keep the band as it is (no further change in this stage)',
  }),
  effect({
    kind: 'band.set',
    class: 'requirement',
    params: { to: { type: 'enum', domain: 'band' } },
    description: 'Set the baseline band (State stage: Tab 10 band rows, E4M1, NS-1)',
  }),
  effect({
    kind: 'band.limit_drop',
    class: 'requirement',
    params: { steps: { type: 'int', min: 0, max: 3 } },
    description:
      'The band falls at most this many steps below the baseline in one check-in (CAP-1)',
  }),
  effect({
    kind: 'band.limit_rise',
    class: 'requirement',
    params: { steps: { type: 'int', min: 0, max: 3 } },
    description:
      'On a re-check the band rises at most this many steps above the previous final band (RC-3, RC-4)',
  }),
  effect({
    kind: 'light.never',
    class: 'requirement',
    params: { light: { type: 'enum', domain: 'light' } },
    description: 'This light is not shown (RC-5: no automatic Blue after a safety override)',
  }),
  effect({
    kind: 'classes.add',
    class: 'modifier',
    params: { classes: { type: 'enum_list', domain: 'setting_class', min: 1 } },
    description: 'The setting counts as these classes (Tab 3b; read by CX-1 and MD-4)',
  }),
  effect({
    kind: 'light.set',
    class: 'requirement',
    params: { light: { type: 'enum', domain: 'light' } },
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
    kind: 'copy.use',
    class: 'modifier',
    params: { slot: { type: 'slot' }, key: { type: 'key' } },
    description: 'Use this wording key for the slot',
  }),
];
