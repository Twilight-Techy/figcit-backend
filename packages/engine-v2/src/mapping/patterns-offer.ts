import type { Condition } from '../format/types.js';
import {
  all,
  any,
  belowHigh,
  containsAny,
  copyOf,
  due,
  eq,
  felt,
  forbid,
  is,
  lights,
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
  toolsOf,
  withTask,
} from './dsl.js';
import { SHARED_SETTING } from './experience-reflect.js';
import { REFLECT_ASKED } from './reflect-meditate.js';
import type { TabMapping } from './types.js';

// Tab 7 patterns 32-41: the Reflect and Meditate offers rank last (ADR 0007 §2 step 6) and still
// pass the Tab 6c gates; 40 and 41 are guards. (M3, E-50)

/** "Amber when calm" (MD-1b): no harder feeling at Moderate or above. */
const amberCalm: Condition = all(
  lights('amber'),
  any({ fact: 'peak.negative', op: 'absent' }, peak('lt', 'moderate')),
);
/** Amber with a harder feeling at Moderate+ (MD-1c), or Red. */
const UNSETTLED: Condition = any(lights('red'), all(lights('amber'), peak('gte', 'moderate')));
const SAVED_PRACTICE: Condition = any(
  is('signals.practice_due', true),
  containsAny('needs', ['pray_or_do_my_practice']),
);

export const PATTERNS_OFFER: NonNullable<TabMapping['rows']> = {
  '32': pattern({
    when: all(
      any(
        felt('wanting_to_make_sense_of_an_experience'),
        containsAny('needs', ['make_sense_of_today']),
      ),
      noTask,
      any(lights('green', 'blue'), all(lights('yellow'), not(peak('gte', 'high')))),
    ),
    layer: 'offer',
    rules: [
      rule(null, [
        propose('primary', path('reflect'), copyOf(32)),
        set('tools.prefer', { tools: ['reflect_checkout', 'my_patterns'] }),
      ]),
    ],
    reason:
      'Green, Blue, or Yellow below High: the 3-prompt check-out, saving to My Patterns optional. Amber is RF-1\'s "save for later"; Red and rumination are pattern 40.',
  }),
  '33': pattern({
    when: all(
      felt('relief_accomplishment_after_something_hard'),
      noTask,
      lights('green', 'yellow'),
    ),
    layer: 'offer',
    rules: [
      rule(null, [
        propose('primary', path('reflect'), copyOf(33)),
        set('tools.prefer', { tools: ['reflect_checkout'] }),
        propose('alternative', tool('rest'), copyOf(33, 'alt.rest')),
      ]),
    ],
    reason:
      'Relief in Green or Yellow. "The end of a demanding session or day" and "a task just completed" need signals no input carries (IG-21): not mapped.',
  }),
  '34': pattern({
    when: all(is('signals.recurring_struggle', true), lights('green', 'yellow', 'blue')),
    layer: 'offer',
    rules: [
      rule(null, [
        propose('primary', path('reflect'), copyOf(34)),
        set('tools.prefer', { tools: ['pattern_review', 'my_patterns'] }),
        propose('alternative', path('adapt')),
        propose('alternative', path('express')),
      ]),
    ],
    reason:
      'The pattern review in plain words, then Adapt or Express (an adjustment request). The signal is the records\' (3+ in 14 days, confirmed; E-53). "Don\'t show me this pattern" is the user switching pattern prompts off, which the signal already honours.',
  }),
  '35': pattern({
    when: all(
      lights('green', 'yellow'),
      withTask,
      any(
        containsAny('needs', ['prepare_to_speak_up_for_myself']),
        containsAny('demand.characteristics', ['reflective_work_required_by_a_course_or_job']),
      ),
    ),
    layer: 'offer',
    rules: [
      rule(null, [
        propose('primary', path('reflect'), copyOf(35)),
        propose('queued', path('express')),
        propose('alternative', path('express'), copyOf(35, 'alt.draft_now')),
        set('drivers.add', { drivers: ['collaboration', 'challenge'] }),
      ]),
      rule(due('T0', 'T1', 'T2', 'TX'), [propose('queued', path('execute'))]),
    ],
    reason:
      'Reflect, then Express (never sent by itself), then Execute "if there is a deadline", read as a timeline T0 to T2 or overdue. Urgency is the timeline\'s.',
  }),
  '36': pattern({
    when: all(
      belowHigh('anticipatory_unease_dread'),
      withTask,
      due('T0', 'T1', 'T2'),
      any(lights('green', 'yellow'), amberCalm),
    ),
    layer: 'offer',
    rules: [
      rule(null, [
        propose('primary', path('meditate'), copyOf(36)),
        set('tools.prefer', { tools: ['settle_5', 'settle_3', 'settle_10'] }),
        propose('queued', path('adapt')),
        propose('alternative', path('execute'), copyOf(36, 'alt.just_prepare')),
        set('drivers.add', { drivers: ['challenge'] }),
      ]),
    ],
    reason:
      "The 5-minute settle first, then Adapt (plan the setting). Public variants are MD-4. Urgency is the timeline's; Novelty and Collaboration come from those characteristics.",
  }),
  '37': pattern({
    when: SAVED_PRACTICE,
    layer: 'offer',
    rules: [
      rule(
        all(any(lights('green', 'yellow', 'blue'), amberCalm), is('signals.practice_due', true)),
        [propose('primary', tool('own_practice'), copyOf(37))],
      ),
      rule(
        all(
          any(lights('green', 'yellow', 'blue'), amberCalm),
          not(is('signals.practice_due', true)),
        ),
        [propose('primary', tool('own_practice'))],
      ),
      rule(any(lights('green', 'yellow', 'blue'), amberCalm), [
        remind(15, copyOf(37, 'alt.remind')),
      ]),
      rule(all(any(lights('green', 'yellow', 'blue'), amberCalm), SHARED_SETTING), [
        propose('alternative', path('adapt'), copyOf(37, 'alt.quiet_space')),
      ]),
      rule(UNSETTLED, [
        propose('primary', tool('breathe'), copyOf(37, 'settle_first')),
        propose('alternative', tool('own_practice'), copyOf(37, 'alt.my_practice')),
      ]),
      rule(lights('red'), [set('support.show')]),
      rule(null, [set('drivers.add', { drivers: ['routine'] })]),
    ],
    reason:
      '"It\'s time for your practice" only when it is due (ADR 0007); asked for by need, the same practice without that wording. "Setting does not allow it" read as a shared setting. Amber with distress or Red: Breathe first, the practice the first alternative. Passion needs the user to mark it meaningful (IG-21). "Skip today" is "Not now", never counted.',
  }),
  '38': pattern({
    when: all(
      any(
        containsAny('needs', ['find_stillness']),
        belowHigh('gratitude_contentment_wanting_to_savour'),
        all(felt('social_hangover_masking_fatigue'), lights('blue')),
      ),
      any(lights('green', 'yellow', 'blue'), amberCalm),
    ),
    layer: 'offer',
    rules: [
      rule(null, [
        propose('primary', path('meditate'), copyOf(38)),
        set('tools.prefer', { tools: ['stillness'] }),
        propose('alternative', tool('gratitude_practice'), copyOf(38, 'alt.gratitude')),
      ]),
    ],
    reason:
      '"Calm/content wanting to savour" is the gratitude family at Mild or Moderate. The body-scan opt-in is the Tab 6c Meditate row.',
  }),
  '39': pattern({
    when: containsAny('needs', ['start_or_end_my_day_well']),
    layer: 'offer',
    rules: [
      rule(null, [
        propose('primary', path('meditate'), copyOf(39)),
        set('drivers.add', { drivers: ['routine'] }),
      ]),
      rule(lights('green', 'blue'), [propose('queued', tool('end_of_day'))]),
    ],
    reason:
      'The need starts it; a saved opening or closing practice needs fields IG-21 lists. Opening vs closing (morning or evening) and the stopping demand are deferred (ADR 0007), so one wording key for now. The optional end-of-day Reflect only in Green or Blue.',
  }),
  '40': pattern({
    when: any(
      all(REFLECT_ASKED, lights('amber', 'red')),
      felt('rumination_replay_loop'),
      all(is('recheck.present', true), eq('recheck.previous_pathway', 'reflect'), {
        fact: 'recheck.intensity_change',
        op: 'gt',
        value: 0,
      }),
    ),
    layer: 'guard',
    rules: [
      rule(null, [
        forbid(path('reflect')),
        propose('primary', path('dump'), copyOf(40)),
        propose('alternative', path('regulate'), copyOf(40, 'alt.reset')),
        propose('alternative', path('connect'), copyOf(40, 'alt.talk')),
        set('tools.exclude', { tools: toolsOf('meditate', ['settle_3']) }),
      ]),
      rule(lights('red'), [set('support.show')]),
    ],
    reason:
      '"Reflect requested or due" read as a Reflect feeling or need (Tab 6c). The same-topic count is deferred (ADR 0007, RF-2). Meditate only as the 3-minute settle, as the Tab 2 rumination row.',
  }),
  '41': {
    mapping: 'reference',
    reason: "The same guard as Tab 6c MD-2, mapped there; its CTA is pattern 16's or 19's.",
  },
};
