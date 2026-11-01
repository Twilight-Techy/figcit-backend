import type { Condition } from '../format/types.js';
import {
  action,
  all,
  any,
  band,
  containsAny,
  copyOf,
  due,
  felt,
  high,
  not,
  path,
  pattern,
  propose,
  remind,
  rule,
  set,
  tool,
  withTask,
} from './dsl.js';
import { COMMUNICATION } from './experience.js';
import type { TabMapping } from './types.js';

// Tab 7 patterns read by feeling, sensation or need (M3, E-50): 9-13, 16-26, 28, 29. They rank in
// the trigger layer with Tab 2 and Tab 6b (ADR 0001 §2 step 4), or as guards (16, 19). Where a
// Tab 2 row already routes the same feeling, the pattern proposes the same targets with its
// wording and alternatives; the engine merges equal proposals (M4).

/** The task is for or to another person (Tab 6). */
const forOthers: Condition = containsAny('demand.characteristics', [
  'involves_other_people_inherently',
  'asking_for_help_or_an_adjustment',
]);
const collaborationIfOthers = rule(forOthers, [set('drivers.add', { drivers: ['collaboration'] })]);
const LIVE_MEETING = ['meeting_classroom', 'seminar_room_tutorial', 'online_meeting_camera_on'];

export const PATTERNS_TRIGGER: NonNullable<TabMapping['rows']> = {
  '9': pattern({
    when: all(
      felt('word_finding_communication_difficulty', 'word_finding'),
      withTask,
      any(COMMUNICATION, forOthers),
    ),
    layer: 'trigger',
    rules: [
      rule(not(band('very_constrained')), [propose('primary', path('express'), copyOf(9))]),
      rule(band('very_constrained'), [
        propose('primary', path('regulate')),
        propose('queued', path('express'), copyOf(9)),
      ]),
      rule(null, [propose('alternative', tool('simplify_rewrite'), copyOf(9, 'alt.simplify'))]),
      collaborationIfOthers,
    ],
    reason:
      '"Communication-type demand" read as a communication need or a task involving other people. Regulate first only in Very Constrained.',
  }),
  '10': pattern({
    when: all(high('anger_frustration'), withTask, COMMUNICATION),
    layer: 'trigger',
    rules: [
      rule(null, [
        propose('primary', path('express'), copyOf(10)),
        propose('alternative', path('regulate'), copyOf(10, 'alt.regulate_first')),
      ]),
      collaborationIfOthers,
    ],
    reason: 'A draft the user sends themselves; Regulate offered first. As the Tab 2 anger row.',
  }),
  '11': pattern({
    when: all(felt('loneliness_isolation'), { fact: 'demand.present', op: 'is', value: false }),
    layer: 'trigger',
    rules: [
      rule(null, [
        propose('primary', path('connect'), copyOf(11)),
        propose('alternative', path('regulate'), copyOf(11, 'alt.regulate')),
      ]),
    ],
    reason: 'As written.',
    mapping: 'exact',
  }),
  '12': pattern({
    when: felt('disconnected_misaligned'),
    layer: 'trigger',
    rules: [
      rule(null, [propose('primary', path('adapt'), copyOf(12)), propose('queued', tool('rerun'))]),
    ],
    reason:
      'Adapt, then the one-tap re-run with the adapted conditions. "Keep as is" is "Not now" in other words.',
  }),
  '13': pattern({
    when: all({ fact: 'sensitivity.count', op: 'gte', value: 2 }, withTask),
    layer: 'trigger',
    rules: [
      rule(null, [
        propose('primary', path('adapt'), copyOf(13)),
        propose('queued', path('execute')),
        propose('visible', action('skip_to_task'), copyOf(13, 'alt.start_anyway')),
      ]),
    ],
    reason:
      'Two or more flags: the single-flag case is deferred (ADR 0001). "Focus-demanding" read as any task.',
  }),
  '16': pattern({
    when: felt('shutdown_freeze_numb', 'shutdown'),
    layer: 'guard',
    rules: [
      rule(null, [
        propose('primary', tool('breathe'), copyOf(16)),
        propose('alternative', tool('quick_message'), copyOf(16, 'alt.quiet_message')),
      ]),
      rule(band('very_constrained'), [set('support.show')]),
    ],
    reason:
      'Tap-only Breathe; the "I need quiet" message. Forcing Regulate and deferring the task are the Tab 2 shutdown row.',
  }),
  '17': pattern({
    when: all(felt('task_paralysis_can_t_start'), withTask),
    layer: 'trigger',
    rules: [
      rule({ fact: 'band.final', op: 'gt', value: 'constrained' }, [
        propose('primary', tool('smallest_step'), copyOf(17)),
      ]),
      rule({ fact: 'band.final', op: 'lte', value: 'constrained' }, [
        propose('primary', path('regulate')),
        propose('queued', tool('smallest_step'), copyOf(17)),
      ]),
      rule(null, [
        propose('alternative', tool('breakdown'), copyOf(17, 'alt.break_down')),
        propose('alternative', tool('ai_body_double'), copyOf(17, 'alt.body_double')),
        set('drivers.add', { drivers: ['interest', 'novelty'] }),
      ]),
    ],
    reason:
      'As the Tab 2 row, with the "first two minutes" wording; the Interest/Novelty hook tags both.',
  }),
  '18': pattern({
    when: all(felt('shame_guilt'), due('TX'), withTask),
    layer: 'trigger',
    rules: [
      rule(not(high('shame_guilt')), [
        propose('primary', path('express'), copyOf(18)),
        propose('alternative', path('regulate'), copyOf(18, 'alt.reset_first')),
      ]),
      rule(high('shame_guilt'), [propose('queued', path('express'), copyOf(18))]),
      rule(null, [propose('queued', tool('smallest_step'))]),
    ],
    reason:
      'Repair: the message, then the smallest step; the self-compassion reset is forced at High+ (Tab 2). "If T0 and safety-critical" needs a safety-critical mark no input carries (IG-17): not mapped.',
  }),
  '19': pattern({
    when: all(high('sensory_overload_building_meltdown_risk', 'sensory_overload'), {
      fact: 'sensitivity.count',
      op: 'gte',
      value: 2,
    }),
    layer: 'guard',
    rules: [
      rule(null, [
        propose('primary', path('adapt'), copyOf(19)),
        propose('alternative', tool('step_out'), copyOf(19, 'alt.leave_early')),
        set('support.show'),
      ]),
      rule({ not: { fact: 'context.supports', op: 'contains', value: 'headphones' } }, [
        set('copy.use', { slot: 'visible', key: copyOf(19, 'alt.headphones') }),
      ]),
    ],
    reason:
      '"Find a quieter spot"; leaving read as Step out; "Put headphones on" a prompt when headphones are not marked available. Deferring the task is the Tab 2 row.',
  }),
  '20': pattern({
    when: all(felt('hyperfocus_lock_time_blindness', 'hyperfocus'), withTask),
    layer: 'trigger',
    rules: [
      rule(null, [
        propose('primary', tool('stop_points'), copyOf(20)),
        propose('queued', tool('rest')),
        remind(20, copyOf(20, 'alt.remind')),
        propose('visible', action('skip_to_task'), copyOf(20, 'alt.keep_going')),
      ]),
    ],
    reason: 'A stop point and a break, never a lock-out: "Keep going" is skip to task.',
  }),
  '21': pattern({
    when: all(felt('boredom_under_stimulation'), withTask),
    layer: 'trigger',
    rules: [
      rule(null, [
        propose('primary', path('adapt'), copyOf(21)),
        propose('visible', action('skip_to_task'), copyOf(21, 'alt.just_start')),
        set('drivers.add', { drivers: ['novelty', 'interest'] }),
      ]),
    ],
    reason: 'As the Tab 2 row, with its wording; "Just start" is skip to task.',
  }),
  '22': pattern({
    when: all(
      any(felt('confusion_decision_paralysis'), containsAny('needs', ['decide_what_matters_now'])),
      withTask,
    ),
    layer: 'trigger',
    rules: [
      rule(null, [
        propose('primary', path('dump'), copyOf(22)),
        propose('queued', tool('pick_one')),
      ]),
    ],
    reason:
      'Dump the list, then pick ONE of three; the rest parked. "2+ tasks" read as any task, as the app takes one task list per check-in (IG-15). "Dump it all first" is the primary itself here.',
  }),
  '23': pattern({
    when: felt('social_hangover_masking_fatigue'),
    layer: 'trigger',
    rules: [
      rule(null, [
        propose('primary', tool('rest'), copyOf(23)),
        propose('visible', action('save_for_later'), copyOf(23, 'alt.later')),
      ]),
    ],
    reason:
      'A quiet reset; "Do it later" is save for later. No Connect and Routine only are the Tab 2 row.',
  }),
  '24': pattern({
    when: high('pain_illness_flare', 'pain'),
    layer: 'trigger',
    rules: [
      rule(null, [
        propose('primary', tool('rest'), copyOf(24)),
        propose('alternative', tool('help_templates'), copyOf(24, 'alt.adjustment')),
      ]),
      rule(all(withTask, due('T0', 'T1')), [
        propose('queued', tool('smallest_step'), copyOf(24, 'essential')),
      ]),
    ],
    reason:
      'High+ (a pain sensation rated High+). "Persistent" needs history (IG-21): not mapped. "The essential part, gently" is the task\'s smallest step when it is due soon (T0/T1), queued after rest, as the Tab 2 row never lets the task lead. "Ask for an adjustment" is the free help templates.',
  }),
  '25': pattern({
    when: felt('grief_loss'),
    layer: 'trigger',
    rules: [
      rule(null, [
        propose('primary', path('connect'), copyOf(25)),
        propose('alternative', path('adapt'), copyOf(25, 'alt.adapt')),
      ]),
      rule(withTask, [propose('visible', action('skip_to_task'), copyOf(25, 'alt.as_planned'))]),
      rule(high('grief_loss'), [set('support.show')]),
    ],
    reason: '"Go ahead as planned" is skip to task, only with a task.',
  }),
  '26': pattern({
    when: felt('rejection_sensitivity_hurt'),
    layer: 'trigger',
    rules: [
      rule(not(high('rejection_sensitivity_hurt')), [propose('primary', path('dump'), copyOf(26))]),
      rule(high('rejection_sensitivity_hurt'), [propose('queued', path('dump'), copyOf(26))]),
      rule(null, [
        propose('alternative', path('express'), copyOf(26, 'alt.draft')),
        propose('alternative', path('connect'), copyOf(26, 'alt.talk')),
      ]),
      rule(COMMUNICATION, [set('drivers.add', { drivers: ['collaboration'] })]),
      rule({ fact: 'context.setting', op: 'in', value: LIVE_MEETING }, [
        set('tools.prefer', { tools: ['breathe', 'ground'] }),
      ]),
    ],
    reason:
      '"A reply is needed" read as a communication need. "In a live meeting" read as a meeting, seminar or camera-on call: a discreet reset (Breathe, Ground) first; contributing in the chat is the user\'s choice.',
  }),
  '28': {
    mapping: 'reference',
    reason:
      "Run by Tab 10 SF-1 (stop, support screen). The screen's fixed, clinically reviewed copy and numbers are content for Clinical Safety sign-off (M4), never generated.",
  },
  '29': pattern({
    when: felt('interoception_signals_unmet', 'interoception_unmet'),
    layer: 'trigger',
    rules: [
      rule(null, [
        propose('primary', tool('rest'), copyOf(29)),
        remind(10, copyOf(29, 'alt.remind')),
      ]),
    ],
    reason: 'Body basics first; "Skip" is "Not now".',
    mapping: 'exact',
  }),
};
