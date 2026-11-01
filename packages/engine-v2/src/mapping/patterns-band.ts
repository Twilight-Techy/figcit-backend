import type { Condition } from '../format/types.js';
import {
  action,
  all,
  any,
  band,
  containsAny,
  copyOf,
  due,
  eq,
  forbid,
  is,
  lights,
  noDistress,
  noTask,
  not,
  path,
  pattern,
  peak,
  propose,
  remind,
  rule,
  set,
  tool,
  withTask,
} from './dsl.js';
import type { TabMapping } from './types.js';

// Tab 7 patterns read by band, by timeline or by the system (M3, E-50): 1-8, 14, 15, 27, 30, 31.
// The band patterns propose the band's default card in the lowest layer, so a feeling, a need or a
// task due now always picks first (ADR 0001 §2: the band sets what is allowed, the feeling picks).
// Every pattern puts its CTA wording on the proposal it belongs to (`card.p<n>.cta`).

const notT0: Condition = not(eq('demand.timeline', 'T0'));
const mildOrNone: Condition = any(noDistress, peak('lt', 'moderate'));
const drivers = (codes: readonly string[]): Condition => containsAny('drivers', codes);
/** Pattern 14's case: an Exploration- or Interest-led task with low or no urgency. */
const exploring: Condition = all(drivers(['exploration', 'interest']), due('T3', 'T4', 'T5', 'T6'));
const NOT_NOW =
  '"Not now" is on every card (Tab 7 non-negotiables), so it is not mapped per pattern.';

export const PATTERNS_BAND: NonNullable<TabMapping['rows']> = {
  '1': pattern({
    when: all(band('available'), noDistress, noTask),
    layer: 'default',
    rules: [
      rule(null, [
        propose('primary', action('open_home'), copyOf(1)),
        propose('alternative', action('check_in'), copyOf(1, 'alt.check_in')),
        propose('alternative', path('regulate'), copyOf(1, 'alt.regulate')),
      ]),
    ],
    reason: `"No distress trigger" read as no harder feeling at all. ${NOT_NOW}`,
  }),
  '2': pattern({
    when: all(band('available'), noDistress, withTask, not(exploring)),
    layer: 'default',
    rules: [
      rule(null, [
        propose('primary', path('execute'), copyOf(2)),
        propose('alternative', tool('breakdown'), copyOf(2, 'alt.breakdown')),
      ]),
    ],
    reason:
      'Straight to the task. Its "Explore this for 10 minutes?" wording is pattern 14\'s, which covers the Exploration- or Interest-led case.',
  }),
  '3': pattern({
    when: all(band('conditional'), mildOrNone, withTask, drivers(['routine']), notT0),
    layer: 'default',
    rules: [
      rule(null, [
        propose('primary', path('execute'), copyOf(3)),
        propose('alternative', path('regulate'), copyOf(3, 'alt.reset')),
        set('drivers.keep_only', { drivers: ['routine', 'interest'] }),
      ]),
    ],
    reason:
      '"Mild/no distress" read as no harder feeling above Mild. Not at T0, where pattern 15 applies "regardless of other tags".',
  }),
  '4': pattern({
    when: all(
      band('conditional'),
      any(noDistress, peak('lt', 'high')),
      withTask,
      notT0,
      not(all(mildOrNone, drivers(['routine']))),
    ),
    layer: 'default',
    rules: [
      rule(null, [
        propose('primary', path('regulate'), copyOf(4)),
        set('minutes.cap', { max: 2 }),
        propose('queued', path('execute')),
        propose('visible', action('skip_to_task'), copyOf(4, 'alt.skip')),
        set('drivers.keep_only', { drivers: ['routine', 'interest'] }),
      ]),
    ],
    reason:
      'A 2-minute reset, then the task, "Skip to task" always visible. It also covers Yellow with no trigger and a non-routine task (ADR 0001 §5). Not where pattern 3 or 15 applies.',
  }),
  '5': pattern({
    when: all(band('constrained'), peak('gte', 'moderate'), withTask),
    layer: 'default',
    rules: [
      rule(null, [
        propose('primary', path('regulate'), copyOf(5)),
        propose('queued', tool('breakdown')),
        propose('visible', action('try_anyway'), copyOf(5, 'alt.try_anyway')),
      ]),
    ],
    reason:
      'A short reset by default; a feeling that leads to Dump picks Dump instead (Tab 2, higher layer). Breakdown queued after, capped by Tab 4; Routine only, Urgency at T0/T1 and "try anyway" are the Amber band row.',
  }),
  '6': pattern({
    when: all(band('constrained', 'very_constrained'), noTask),
    layer: 'default',
    rules: [
      rule(null, [
        propose('primary', path('regulate'), copyOf(6)),
        propose('alternative', path('dump'), copyOf(6, 'alt.dump')),
        propose('alternative', path('connect'), copyOf(6, 'alt.connect')),
      ]),
    ],
    reason: '"Per Tab 2": a feeling picks first; this is the default when none does.',
    mapping: 'exact',
  }),
  '7': pattern({
    when: all(band('very_constrained'), peak('gte', 'high'), withTask),
    layer: 'default',
    rules: [
      rule(null, [propose('primary', path('regulate'), copyOf(7)), set('support.show')]),
      rule(notT0, [forbid(path('execute'))]),
    ],
    reason:
      'Care first, "Get support now" visible, the task off the card until a re-check improves. At T0 the smallest step stays queued (ADR 0001 §3, pattern 15).',
  }),
  '8': pattern({
    when: all(band('very_constrained'), noTask),
    layer: 'default',
    rules: [
      rule(null, [
        propose('primary', path('regulate'), copyOf(8)),
        propose('alternative', path('dump')),
        propose('alternative', path('connect')),
        set('support.show'),
      ]),
    ],
    reason: 'Regulate, Dump or Connect with "Get support now" visible.',
    mapping: 'exact',
  }),
  '14': pattern({
    when: all(band('available', 'conditional'), withTask, exploring),
    layer: 'default',
    rules: [
      rule(null, [
        propose('primary', path('execute'), copyOf(14)),
        propose('visible', action('save_for_later'), copyOf(14, 'alt.later')),
      ]),
    ],
    reason: '"Timeline T3-T6" read as low or no urgency; a task with no timeline is not counted.',
  }),
  '15': pattern({
    when: all(eq('demand.timeline', 'T0'), withTask),
    layer: 'task_due',
    rules: [
      rule(peak('gte', 'moderate'), [
        propose('primary', path('regulate'), copyOf(15, 'reset')),
        propose('queued', tool('smallest_step'), copyOf(15)),
      ]),
      rule(not(peak('gte', 'moderate')), [propose('primary', tool('smallest_step'), copyOf(15))]),
      rule(lights('red'), [set('minutes.cap', { max: 1 }), set('support.show')]),
    ],
    reason:
      '"Distress trigger active" read as a harder feeling at Moderate+: the shortest reset (Tab 4 caps it at 2 minutes; 1 minute in Red, ADR 0001 §3), then the smallest step. Urgency is the T0 row. "I need more time" has no card action yet (M4).',
  }),
  '27': pattern({
    when: is('state.not_sure', true),
    layer: 'default',
    rules: [rule(null, [propose('alternative', path('regulate'), copyOf(27))])],
    reason:
      'The body check is the app\'s Not-sure flow; "treat as Conditional" is NS-1. The gentle Regulate offer is the alternative here. "Pick a state anyway" is that flow\'s own button.',
  }),
  '30': pattern({
    when: { fact: 'signals.declines_session', op: 'gte', value: 3 },
    layer: 'default',
    rules: [
      rule(null, [
        ...[
          'regulate',
          'dump',
          'express',
          'connect',
          'execute',
          'adapt',
          'reflect',
          'meditate',
        ].map((p) => forbid(path(p))),
        propose('primary', action('open_home'), copyOf(30)),
        remind(1440, copyOf(30, 'alt.tomorrow')),
      ]),
    ],
    reason:
      '"Stop suggesting": no pathway is offered; Home and a reminder tomorrow instead. A forced step from a higher layer (distress, safety) still wins over this (M4 requirement order). The quiet period and "session" are IG-21.',
  }),
  '31': pattern({
    when: lights('blue'),
    layer: 'default',
    rules: [
      rule(withTask, [propose('primary', action('start_small'), copyOf(31))]),
      rule(null, [
        propose('alternative', tool('rest'), copyOf(31, 'alt.rest')),
        propose('alternative', path('reflect'), copyOf(31, 'alt.reflect')),
      ]),
    ],
    reason:
      'Blue: the queued task comes back small ("Start small"), rest or Reflect offered. The light, the window and the band steps are RC-1 to RC-5; Reflect still passes RF-1.',
  }),
};
