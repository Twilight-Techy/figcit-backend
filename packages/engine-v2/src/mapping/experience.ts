import type { Condition, EngineRule } from '../format/types.js';
import {
  action,
  all,
  any,
  belowHigh,
  containsAny,
  eq,
  felt,
  forbid,
  high,
  is,
  lights,
  mapped,
  must,
  not,
  path,
  propose,
  rule,
  set,
  tool,
  toolsOf,
  withTask,
} from './dsl.js';
import type { RowMapping, TabMapping } from './types.js';

// Tab 2 (experience → intervention), read for the engine (M3, E-50). Each row runs at Tab 8 step 4
// in the "feeling, sensation or need" layer unless it is a guard (ADR 0004 §2). Tab 8 step 3 rates
// each feeling on its own, so a row reads its own family's intensity. Which feeling leads when
// several fire ("use the HIGHEST intensity") is ranking, done by the engine (M4), not a row.

/** "Need involves communication": the communication needs (Tab 6b) or the help-asking task (Tab 6). */
export const COMMUNICATION: Condition = any(
  containsAny('needs', [
    'find_the_words',
    'ask_for_help_or_an_adjustment',
    'prepare_to_speak_up_for_myself',
  ]),
  containsAny('demand.characteristics', ['asking_for_help_or_an_adjustment']),
);

/** "Demand deferred", read as Red reads it (Tab 10): no task step, no way to the task, no drivers. */
export const DEFER_DEMAND = [
  forbid(path('execute')),
  forbid(action('try_anyway')),
  forbid(action('skip_to_task')),
  forbid(action('start_small')),
  set('drivers.keep_only', { drivers: [] }),
];

/** "Demand reduced to the minimum": the task never leads; if there is one, only its smallest step. */
const MINIMUM_DEMAND = [
  rule(null, [forbid(path('execute'), 'primary')]),
  rule(withTask, [propose('queued', tool('smallest_step'))]),
];

const SENSATION = 'The matching S09 sensations trigger it too (E-19 sensation groups).';
const T0: Condition = eq('demand.timeline', 'T0');

/** Every rule of a row is gated by the row's own trigger. */
const gated = (trigger: Condition, rules: EngineRule[]) =>
  rules.map((r) => ({ ...r, when: r.when ? all(trigger, r.when) : trigger }));

/** A Tab 2 row: runs at Tab 8 step 4, every rule gated by the row's trigger. */
export function trigger(m: {
  readonly when: Condition;
  readonly rules: EngineRule[];
  readonly reason: string;
  readonly mapping?: 'exact' | 'interpreted';
  readonly layer?: 'trigger' | 'guard' | 'offer';
}): RowMapping {
  return mapped({
    stage: 'intervention',
    layer: m.layer ?? 'trigger',
    rules: gated(m.when, m.rules),
    reason: m.reason,
    mapping: m.mapping ?? 'interpreted',
  });
}

/** Tab 2 rows 1 to 26; the v3.2 Reflect and Meditate rows are in experience-reflect.ts. */
export const EXPERIENCE_CORE: NonNullable<TabMapping['rows']> = {
  'Distress / overwhelm · High or Very High (7-10)': trigger({
    when: high('distress_overwhelm'),
    rules: [rule(null, [must('primary', path('regulate')), set('support.show')])],
    reason:
      'Regulate is the forced primary; "Get support now" is visible in every band (ADR 0004 §7).',
    mapping: 'exact',
  }),
  'Racing / disorganised thoughts · Any': trigger({
    when: felt('racing_disorganised_thoughts', 'racing'),
    rules: [
      rule(null, [propose('primary', path('dump')), propose('alternative', path('regulate'))]),
    ],
    reason: `Dump primary, Regulate the alternative. ${SENSATION}`,
  }),
  'Anxious / fearful · High or Very High (7-10)': trigger({
    when: high('anxious_fearful'),
    rules: [
      rule(null, [propose('primary', path('regulate'))]),
      rule(all(withTask, not(COMMUNICATION)), [propose('queued', path('execute'))]),
      rule(all(withTask, COMMUNICATION), [propose('queued', path('express'))]),
    ],
    reason:
      '"Regulate first" is proposed, not forced (EX-1 and the band force it where they apply). "Execute or Express" read as Express when the need or the task is about communicating, else Execute; either is queued after Regulate.',
  }),
  'Anxious / fearful · Mild or Moderate (0-6)': trigger({
    when: belowHigh('anxious_fearful'),
    rules: [rule(null, [propose('alternative', path('regulate'))])],
    reason:
      'Nothing forced; Regulate offered as an alternative (ADR 0004: mild anxiety is an alternative, never the primary). A skipped intensity matches neither anxious row (IG-04).',
    mapping: 'exact',
  }),
  'Anger / frustration · High or Very High (7-10)': trigger({
    when: all(high('anger_frustration'), COMMUNICATION),
    rules: [
      rule(null, [propose('primary', path('express')), propose('alternative', path('regulate'))]),
    ],
    reason:
      '"Need involves communication" read as in the anxious row. Express drafts never send by themselves (Tab 7 non-negotiables); the optional Regulate is the alternative. Without a communication need the row does nothing; EX-1 still lowers the band.',
  }),
  'Word-finding / communication difficulty · Any': trigger({
    when: felt('word_finding_communication_difficulty', 'word_finding'),
    rules: [rule(null, [propose('primary', path('express'))])],
    reason: `Express primary. ${SENSATION}`,
  }),
  'Loneliness / isolation · Any': trigger({
    when: felt('loneliness_isolation'),
    rules: [rule(null, [propose('primary', path('connect'))])],
    reason: 'Connect primary.',
    mapping: 'exact',
  }),
  'Sadness / low mood · High or Very High (7-10)': trigger({
    when: high('sadness_low_mood'),
    rules: [
      rule(null, [propose('primary', path('regulate')), propose('alternative', path('connect'))]),
    ],
    reason:
      'The card has one primary (Tab 6d D), so "co-primary" reads as Regulate primary and Connect the first alternative, in the order written.',
  }),
  'Restlessness · Any': trigger({
    when: felt('restlessness', 'restless'),
    rules: [
      rule(null, [
        propose('alternative', path('regulate')),
        set('tools.prefer', { tools: ['move', 'movement_plus'] }),
      ]),
    ],
    reason: `Regulate added to the alternatives, movement tools first (ADR 0004: restlessness is an alternative, never the primary). ${SENSATION}`,
  }),
  'Disconnected/Misaligned · Any': trigger({
    when: felt('disconnected_misaligned'),
    rules: [rule(null, [propose('primary', path('adapt'))])],
    reason:
      'Adapt primary. The "Detached" sensation is a different experience (feeling unreal, pattern 41) and does not trigger this row.',
    mapping: 'exact',
  }),
  'Positive activation · High or Very High (7-10)': trigger({
    when: high('positive_activation'),
    rules: [
      rule(
        all({ fact: 'sensitivity.count', op: 'gte', value: 1 }, withTask),
        [propose('primary', path('adapt')), propose('queued', path('execute'))],
        'context',
      ),
    ],
    reason:
      '"Sensitivity flags present" read as at least one; "a focus-demanding Execute" as any task, since no characteristic marks focus demand. Otherwise nothing.',
  }),
  'Calm / content, no distress · Any': {
    mapping: 'reference',
    reason:
      'No intervention: the card goes to the task, or home (Tab 8 step 6). Reflect and Meditate "on request, never pushed" means the user opens them; nothing is proposed.',
  },
  'Shame / guilt · Any (forced Regulate at High+)': trigger({
    when: felt('shame_guilt'),
    rules: [
      rule(high('shame_guilt'), [
        must('primary', path('regulate')),
        set('copy.use', { slot: 'primary', key: 'card.regulate.self_compassion' }),
        propose('queued', path('express'), 'card.express.repair'),
        propose('queued', tool('smallest_step')),
      ]),
      rule(not(high('shame_guilt')), [
        propose('primary', path('express'), 'card.express.repair'),
        propose('queued', tool('smallest_step')),
      ]),
    ],
    reason:
      'A self-compassion Regulate is forced at High+; below that, or with the intensity skipped, the row starts at Express. The queue is in order: the short repair message (never sent by the app), then the smallest repair step. "No blame or streak language" is card-wide (Tab 7 non-negotiables).',
  }),
  'Shutdown / freeze / numb · Any': trigger({
    when: felt('shutdown_freeze_numb', 'shutdown'),
    layer: 'guard',
    rules: [
      rule(null, [
        must('primary', path('regulate')),
        forbid(path('express')),
        forbid(path('dump')),
        forbid(path('reflect')),
        set('tools.exclude', { tools: toolsOf('connect', ['quick_message']) }),
        ...DEFER_DEMAND,
      ]),
    ],
    reason: `A guard (ADR 0004 §2). Regulate forced; "no typing or speaking" read as no Express, Dump or Reflect; Connect only as the one-tap pre-written message; demand deferred as Red defers it. "Lowers the band" is EX-1. ${SENSATION}`,
  }),
  "Task paralysis / can't start · Any": trigger({
    when: felt('task_paralysis_can_t_start'),
    rules: [
      rule(
        { fact: 'band.final', op: 'gt', value: 'constrained' },
        [
          propose('primary', tool('smallest_step'), 'card.execute.two_minute_start'),
          propose('alternative', tool('ai_body_double')),
        ],
        'orchestration',
      ),
      rule(
        { fact: 'band.final', op: 'lte', value: 'constrained' },
        [
          propose('primary', path('regulate')),
          propose('queued', tool('smallest_step'), 'card.execute.two_minute_start'),
          propose('alternative', tool('ai_body_double')),
        ],
        'orchestration',
      ),
    ],
    reason:
      'Execute: the 2-minute start on the smallest step, the body double offered with it. In Constrained or lower a Regulate comes first and the start is queued; read once the final band is known.',
  }),
  'Sensory overload building / meltdown risk · High or Very High (7-10)': trigger({
    when: high('sensory_overload_building_meltdown_risk', 'sensory_overload'),
    layer: 'guard',
    rules: [
      rule(null, [
        propose('primary', path('adapt')),
        propose('queued', path('regulate')),
        set('tools.prefer', { tools: ['step_out', 'breathe', 'ground'] }),
      ]),
      rule(not(T0), DEFER_DEMAND),
      rule(T0, [forbid(path('execute'), 'primary'), propose('queued', tool('smallest_step'))]),
    ],
    reason:
      'A guard. Adapt first (reduce input; pattern 19 "Find a quieter spot"), then Regulate with Step out, Breathe and Ground first. Demand deferred as Red defers it, unless due now (T0): then only its smallest step, after the reset. High+ only (ADR 0004); a sensation counts only when rated High+. "Lowers the band" is EX-1.',
  }),
  'Hyperfocus lock / time blindness · Any': trigger({
    when: felt('hyperfocus_lock_time_blindness', 'hyperfocus'),
    rules: [rule(null, [propose('primary', tool('stop_points')), propose('queued', tool('rest'))])],
    reason: `Adapt (set a stop point), then a short rest for body basics. Nothing removes the task: "a reminder, never a lock-out", resuming is the user's choice. ${SENSATION}`,
  }),
  'Boredom / under-stimulation · Any': trigger({
    when: all(felt('boredom_under_stimulation'), withTask),
    rules: [
      rule(null, [
        propose('primary', path('adapt')),
        propose('alternative', path('regulate')),
        set('tools.prefer', { tools: ['move', 'movement_plus'] }),
        propose('queued', path('execute')),
        set('drivers.add', { drivers: ['novelty', 'interest'] }),
      ]),
    ],
    reason:
      '"Adapt or movement Regulate" read as Adapt primary and movement Regulate the alternative; then the task, with Novelty and Interest tagged as its hooks. No task: nothing.',
  }),
  'Social hangover / masking fatigue · Any': trigger({
    when: felt('social_hangover_masking_fatigue'),
    rules: [
      rule(null, [
        propose('primary', tool('rest')),
        propose('alternative', tool('stillness')),
        forbid(path('connect')),
        set('drivers.keep_only', { drivers: ['routine'] }),
      ]),
      rule(
        not(all(is('recheck.present', true), lights('blue'))),
        [forbid(path('reflect'))],
        'orchestration',
      ),
    ],
    reason:
      'Recovery rest (quiet, low input) primary; silent stillness the alternative; no Connect; the task only if Routine. Reflect only on a re-check that shows Blue, read once the light is known.',
  }),
  'Confusion / decision paralysis · Any': trigger({
    when: felt('confusion_decision_paralysis'),
    rules: [rule(null, [propose('primary', path('dump')), propose('queued', tool('pick_one'))])],
    reason: 'Dump, then Pick-one-of-three. Keeping the rest is what Dump does with its items.',
    mapping: 'exact',
  }),
  'Grief / loss · Any (Support pathway visible at High+)': trigger({
    when: felt('grief_loss'),
    rules: [
      rule(null, [
        propose('primary', path('connect')),
        propose('alternative', path('regulate')),
        propose('alternative', path('adapt')),
        propose('alternative', tool('own_practice')),
      ]),
      ...MINIMUM_DEMAND,
      rule(high('grief_loss'), [set('support.show'), forbid(path('reflect'))]),
    ],
    reason:
      '"Co-primary" read as Connect primary, Regulate the first alternative; then Adapt and the user\'s own saved practice, in that order (the engine keeps two). Demand reduced to its smallest step, never leading. At High+: "Get support now" and no Reflect.',
  }),
  'Pain / illness flare (SENSATION-LED: Body) · Any (lowers band at High+)': trigger({
    when: felt('pain_illness_flare', 'pain'),
    rules: [
      rule(null, [propose('primary', tool('rest')), propose('alternative', path('adapt'))]),
      ...MINIMUM_DEMAND,
    ],
    reason:
      'Recovery rest primary, Adapt (pace, scope, ask for an adjustment) the alternative; the task reduced to its smallest step, never leading. "Lowers band at High+" is EX-1. The pain sensations trigger it, as does the family.',
  }),
  'Rejection sensitivity / hurt · Any (Regulate first at High+)': trigger({
    when: felt('rejection_sensitivity_hurt'),
    rules: [
      rule(not(high('rejection_sensitivity_hurt')), [
        propose('primary', path('dump')),
        propose('alternative', path('express')),
      ]),
      rule(high('rejection_sensitivity_hurt'), [
        propose('primary', path('regulate')),
        propose('queued', path('dump')),
        propose('alternative', path('express')),
      ]),
      rule(null, [set('copy.use', { slot: 'primary', key: 'card.tone.no_forced_positivity' })]),
    ],
    reason:
      'Dump (stop the replay) primary, Express (a draft, never sent) the alternative; at High+ Regulate first with Dump queued. "No forced positivity" is a wording key.',
  }),
  'Interoception signals unmet (SENSATION-LED: Interoception) · Any': trigger({
    when: felt('interoception_signals_unmet', 'interoception_unmet'),
    rules: [rule(null, [propose('primary', tool('rest'), 'card.recovery.meet_need')])],
    reason:
      'Recovery first: meet the need. "Re-check, continue" is the feedback step after any session (Tab 8 step 11), not a rule here.',
  }),
  'Immediate risk language · Any': {
    mapping: 'reference',
    reason:
      'Run by Tab 10 SF-1: the same trigger (the Hopeless chip at any intensity, or the free-text flag) and the same stop with the support screen. One rule, so the trace names one source.',
  },
  "'Not sure how I feel' · n/a": {
    mapping: 'reference',
    reason:
      'The picture-based check-in is the app\'s Not-sure flow (Figma S150, S152); "treat as Conditional" is Tab 10 NS-1.',
  },
};
