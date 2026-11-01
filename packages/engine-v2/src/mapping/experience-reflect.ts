import type { Condition } from '../format/types.js';
import {
  action,
  all,
  belowHigh,
  containsAny,
  felt,
  forbid,
  high,
  not,
  path,
  propose,
  rule,
  set,
  tool,
  toolsOf,
  withTask,
} from './dsl.js';
import { trigger } from './experience.js';
import type { TabMapping } from './types.js';

// Tab 2 rows 27 to 34: the v3.2 Reflect and Meditate rows (shaded lilac) and the rumination row
// (M3, E-50). Their Reflect and Meditate proposals rank as optional offers (ADR 0004 §2 step 6),
// so a task due now goes first, and every one of them still passes the Tab 6c gates (RF, MD).

const OFFER =
  'Ranked as an optional Reflect or Meditate offer (ADR 0004 §2): a task due now goes first.';
/** Settings where a practice may not be possible as it is (Tab 3b ALL row's classes). */
export const SHARED_SETTING: Condition = containsAny('context.classes', [
  'public',
  'formal',
  'observed',
  'caring',
]);
/** "At High+ distress": any harder feeling rated High or Very High. */
const DISTRESSED: Condition = { fact: 'peak.negative', op: 'gte', value: { band: 'high' } };

export const EXPERIENCE_REFLECT: NonNullable<TabMapping['rows']> = {
  'Wanting to make sense of an experience · Mild or Moderate (0-6)': trigger({
    when: felt('wanting_to_make_sense_of_an_experience'),
    layer: 'offer',
    rules: [
      rule(belowHigh('wanting_to_make_sense_of_an_experience'), [
        propose('primary', path('reflect')),
        set('tools.prefer', { tools: ['reflect_checkout'] }),
      ]),
      rule(high('wanting_to_make_sense_of_an_experience'), [
        propose('primary', path('regulate')),
        propose('alternative', path('dump')),
        propose('visible', action('save_for_later')),
      ]),
    ],
    reason: `Reflect (the 3-prompt check-out) at Mild or Moderate. At High+ Regulate, Dump the alternative, and Reflect saved for later; RF-1 decides when it is offered again (Green or Blue). ${OFFER}`,
  }),
  'Relief / accomplishment after something hard · Any': trigger({
    when: felt('relief_accomplishment_after_something_hard'),
    layer: 'offer',
    rules: [
      rule({ fact: 'state.energy', op: 'lte', value: 2 }, [
        propose('primary', tool('rest')),
        propose('visible', action('save_for_later')),
      ]),
      rule(not({ fact: 'state.energy', op: 'lte', value: 2 }), [
        propose('alternative', path('reflect')),
        set('tools.prefer', { tools: ['my_patterns'] }),
      ]),
    ],
    reason: `Nothing forced: Reflect offered, saving what helped to My Patterns. Energy Very Low or Low (1-2): rest first and Reflect saved for later (ADR 0004: relief at low energy rests first). ${OFFER}`,
  }),
  'Recurring struggle noticed (SYSTEM-LED + user confirms) · n/a (pattern)': {
    mapping: 'unresolved',
    decides: 'founder',
    reason:
      'Needs a system signal no input carries: the same family, setting or avoided task logged 3+ times in 14 days, confirmed by the user, with pattern prompts on. It comes with the check-in records (M5) and IG-21 (which counts: family, setting or task?); the 3 and the 14 are tunable thresholds for the rule set, not code.',
  },
  'Anticipatory unease / dread · Mild or Moderate (0-6)': trigger({
    when: felt('anticipatory_unease_dread'),
    layer: 'offer',
    rules: [
      rule(belowHigh('anticipatory_unease_dread'), [
        propose('primary', path('meditate')),
        set('tools.prefer', { tools: ['settle_3', 'settle_5', 'settle_10'] }),
      ]),
      rule(all(belowHigh('anticipatory_unease_dread'), withTask), [
        propose('queued', path('adapt')),
        propose('queued', path('execute')),
      ]),
      rule(high('anticipatory_unease_dread'), [
        propose('primary', path('regulate')),
        set('tools.prefer', { tools: ['breathe', 'ground'] }),
      ]),
    ],
    reason: `A settling practice, "3-10 min" read as the 3, 5 and 10 minute settles; eyes-open and headphone variants in public come from the context filters (Tab 3b, Tab 6c D). With a task, Adapt then Execute (the "Prepare for an event" route). At High+ Regulate (Breathe, Ground) first; the Meditate alternative there is deferred (ADR 0004). ${OFFER}`,
  }),
  'Need for stillness / inner quiet · Any (not shutdown)': trigger({
    when: all(
      felt('need_for_stillness_inner_quiet'),
      not(felt('shutdown_freeze_numb', 'shutdown')),
    ),
    layer: 'offer',
    rules: [
      rule(null, [
        propose('primary', path('meditate')),
        set('tools.prefer', { tools: ['stillness'] }),
        propose('alternative', tool('breathe')),
      ]),
    ],
    reason: `Meditate (stillness, length chosen by the user), Breathe the shorter alternative. "Not shutdown" includes the shutdown sensations. ${OFFER}`,
  }),
  'Spiritual / faith need · Any': trigger({
    when: felt('spiritual_faith_need'),
    layer: 'offer',
    rules: [
      rule(not(DISTRESSED), [
        propose('primary', tool('own_practice')),
        propose('alternative', tool('groups')),
      ]),
      rule(DISTRESSED, [
        propose('primary', path('regulate')),
        propose('alternative', tool('own_practice')),
      ]),
      rule(SHARED_SETTING, [propose('alternative', path('adapt'))], 'context'),
    ],
    reason: `Only the user's own saved practice, never content the engine picks (MD-3); the faith or community group optional. "Setting does not allow it" read as a public, formal, observed or caring setting: Adapt (a quiet or prayer room) offered. At High+ distress (any harder feeling at High+) Regulate leads and the practice is the first alternative; "Support visible in Red" is the Red band row. ${OFFER}`,
  }),
  'Gratitude / contentment, wanting to savour · Mild or Moderate (0-6)': trigger({
    when: belowHigh('gratitude_contentment_wanting_to_savour'),
    layer: 'offer',
    rules: [
      rule(null, [
        propose('alternative', tool('gratitude_practice')),
        propose('alternative', tool('gratitude_note')),
      ]),
    ],
    reason: `"The user's choice, nothing forced": both offered as alternatives, neither as the primary. ${OFFER}`,
  }),
  'Rumination / replay loop (long-running) · Any': trigger({
    when: felt('rumination_replay_loop'),
    layer: 'guard',
    rules: [
      rule(null, [
        forbid(path('reflect')),
        propose('primary', path('dump')),
        propose('alternative', path('regulate')),
        propose('alternative', path('connect')),
        set('tools.exclude', { tools: toolsOf('meditate', ['settle_3']) }),
      ]),
    ],
    reason:
      'A guard (pattern 40): Reflect blocked; Dump primary, Regulate and Connect offered. "Meditate only short, eyes-open, breath-anchored" read as the 3-minute settle only; every other Meditate tool, the user\'s own practice included, is left out as written. Risk language is SF-1.',
  }),
};
