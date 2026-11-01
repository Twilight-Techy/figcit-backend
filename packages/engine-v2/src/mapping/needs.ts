import type { Condition, Effect, Target } from '../format/types.js';
import type { RowMapping, TabMapping } from './types.js';

// Tab 6b (need → intervention route), read for the engine (M3, E-49). A need proposes its route in
// the "feeling, sensation or need" layer; the band rows and guards still decide what is allowed.
// Rows run at orchestration (Tab 8 step 10) because "lights where offered" needs the final light.

const set = (kind: string, params: Record<string, unknown> = {}): Effect => ({ kind, ...params });
const propose = (slot: string, target: Target, copy?: string): Effect =>
  set('propose', { slot, target, ...(copy ? { copy } : {}) });
const path = (pathway: string): Target => ({ pathway });
const tool = (code: string): Target => ({ tool: code });
const wants = (need: string): Condition => ({ fact: 'needs', op: 'contains', value: need });
const lit = (...lights: string[]): Condition => ({ fact: 'light', op: 'in', value: lights });
const and = (...c: Condition[]): Condition => ({ all: c });
const or = (...c: Condition[]): Condition => ({ any: c });
const mildOrModerate: Condition = or(
  { fact: 'peak.negative', op: 'absent' },
  { fact: 'peak.negative', op: 'lt', value: { band: 'high' } },
);

interface Branch {
  readonly when?: Condition;
  readonly then: readonly Effect[];
}

/** A need row: one or more branches, each further gated by its own condition. */
function need(
  code: string,
  branches: readonly Branch[],
  reason: string,
  mapping: 'exact' | 'interpreted' = 'interpreted',
): RowMapping {
  return {
    mapping,
    reason,
    engine: {
      stage: 'orchestration',
      layer: 'trigger',
      rules: branches.map((b) => ({
        when: b.when ? and(wants(code), b.when) : wants(code),
        then: b.then,
      })),
    },
  };
}

const NOT_RED = lit('green', 'yellow', 'amber', 'blue');
const CALM_LIGHTS = lit('green', 'yellow', 'blue');

export const NEEDS: TabMapping = {
  rows: {
    'Feel calmer / reduce overwhelm': need(
      'feel_calmer_reduce_overwhelm',
      [{ then: [propose('primary', path('regulate'))] }],
      'Regulate, in every light.',
      'exact',
    ),
    'Clear my head': need(
      'clear_my_head',
      [{ then: [propose('primary', path('dump')), propose('queued', tool('dump_sort'))] }],
      'Dump, then the optional sort. Nothing turns into a task by itself.',
    ),
    'Find the words': need(
      'find_the_words',
      [
        { when: NOT_RED, then: [propose('primary', path('express'))] },
        {
          when: lit('red'),
          then: [propose('primary', path('regulate')), propose('queued', path('express'))],
        },
      ],
      'Express; "Regulate first in Red". "Collaboration, if for someone else" needs an input no screen collects yet.',
    ),
    'Get started': need(
      'get_started',
      [
        {
          when: NOT_RED,
          then: [
            propose('primary', tool('smallest_step'), 'card.execute.two_minute_start'),
            propose('alternative', tool('ai_body_double')),
          ],
        },
      ],
      'Execute: the 2-minute start, with the body double offered. Not in Red (not listed); in Amber the band keeps it to Routine.',
    ),
    'Break it into steps': need(
      'break_it_into_steps',
      [{ when: NOT_RED, then: [propose('primary', tool('breakdown'))] }],
      'Execute breakdown, capped by the timeline (Tab 4). Not in Red; Amber keeps it to Routine.',
    ),
    'Decide what matters now': need(
      'decide_what_matters_now',
      [
        {
          when: NOT_RED,
          then: [propose('primary', path('dump')), propose('queued', tool('pick_one'))],
        },
      ],
      'Dump, then pick ONE of three (pattern 22). All lights except Red.',
    ),
    'Change how or where I do it': need(
      'change_how_or_where_i_do_it',
      [{ then: [propose('primary', path('adapt'))] }],
      'Adapt. "NUCRIPCE recalculated after Adapt" is the re-run Adapt offers.',
      'exact',
    ),
    'Be with someone': need(
      'be_with_someone',
      [
        {
          when: {
            not: { fact: 'families', op: 'contains', value: 'social_hangover_masking_fatigue' },
          },
          then: [propose('primary', path('connect'))],
        },
      ],
      'Connect, except with a social hangover. "Text/async when Crowd is flagged" is the Crowd row (Tab 3a).',
    ),
    'Stop or switch': need(
      'stop_or_switch',
      [
        { then: [propose('primary', path('adapt'))] },
        {
          when: { fact: 'demand.present', op: 'is', value: true },
          then: [propose('queued', path('execute'))],
        },
      ],
      'Adapt (pace), then the next task if there is one. Using a saved ritual for the transition is deferred (ADR 0004).',
    ),
    'Rest without guilt': need(
      'rest_without_guilt',
      [{ then: [propose('primary', tool('rest'), 'card.rest.no_guilt')] }],
      'Regulate (Recovery): rest is the task, with no guilt language.',
    ),
    'Ask for help or an adjustment': need(
      'ask_for_help_or_an_adjustment',
      [
        {
          then: [
            propose('primary', path('express')),
            propose('alternative', path('connect')),
            set('drivers.add', { drivers: ['collaboration'] }),
          ],
        },
      ],
      'Express (draft) with Connect; Collaboration.',
    ),
    'Prepare for an event': need(
      'prepare_for_an_event',
      [
        {
          when: CALM_LIGHTS,
          then: [propose('primary', path('adapt')), propose('queued', path('execute'))],
        },
      ],
      'Adapt (plan the setting), then Execute; Green, Yellow and Blue (ADR 0004 consequences).',
    ),
    'Recover after an event': need(
      'recover_after_an_event',
      [
        { then: [propose('primary', tool('rest'))] },
        {
          when: lit('blue'),
          then: [propose('alternative', path('reflect')), propose('alternative', path('meditate'))],
        },
      ],
      'Regulate (Recovery); Reflect or Meditate offered only in Blue.',
    ),
    'Make sense of today': need(
      'make_sense_of_today',
      [
        {
          when: or(lit('green', 'blue'), and(lit('yellow'), mildOrModerate)),
          then: [propose('primary', path('reflect'))],
        },
        {
          when: or(lit('amber'), and(lit('yellow'), { not: mildOrModerate })),
          then: [
            propose('primary', path('regulate')),
            propose('visible', { action: 'save_for_later' }),
          ],
        },
        {
          when: lit('red'),
          then: [propose('primary', path('regulate')), propose('alternative', path('dump'))],
        },
      ],
      'Reflect in Green and Blue, and in Yellow at Mild/Moderate. Amber: save for later (Yellow at High read the same). Red: Regulate or Dump instead. Rumination is pattern 40.',
    ),
    'Get urgent help': {
      mapping: 'exact',
      reason: 'Safety override (pattern 28), in any light; never an ordinary route.',
      engine: {
        stage: 'safety',
        layer: 'safety',
        rules: [{ when: wants('get_urgent_help'), then: [set('stop'), set('support.show')] }],
      },
    },
    'Learn what works for me': need(
      'learn_what_works_for_me',
      [
        {
          when: CALM_LIGHTS,
          then: [
            propose('primary', path('reflect'), 'card.reflect.pattern_review'),
            set('tools.prefer', { tools: ['pattern_review', 'my_patterns'] }),
          ],
        },
      ],
      'Reflect (pattern review) in Green, Yellow and Blue; the advanced review if entitled, else My Patterns.',
    ),
    'Prepare to speak up for myself': need(
      'prepare_to_speak_up_for_myself',
      [
        {
          when: CALM_LIGHTS,
          then: [
            propose('primary', path('reflect')),
            propose('queued', path('express')),
            propose('alternative', path('connect')),
            set('drivers.add', { drivers: ['collaboration'] }),
          ],
        },
      ],
      'Reflect, then Express (draft), Connect optional; Collaboration. Green, Yellow and Blue.',
    ),
    'Find stillness': need(
      'find_stillness',
      [
        {
          when: NOT_RED,
          then: [
            propose('primary', path('meditate')),
            set('tools.prefer', { tools: ['stillness', 'settle_3'] }),
          ],
        },
        { when: lit('red'), then: [propose('primary', tool('breathe'))] },
      ],
      'Meditate (stillness or a short settle); in Red, Breathe instead.',
    ),
    'Pray or do my practice': need(
      'pray_or_do_my_practice',
      [
        {
          when: or(CALM_LIGHTS, and(lit('amber'), mildOrModerate)),
          then: [propose('primary', tool('own_practice')), propose('alternative', path('adapt'))],
        },
        {
          when: or(lit('red'), and(lit('amber'), { not: mildOrModerate })),
          then: [propose('alternative', tool('own_practice'))],
        },
      ],
      'The user\'s own practice: primary in Green, Yellow, Blue, or Amber "when calm" (read as no harder feeling at High); otherwise offered as an alternative, never pushed. Adapt finds a suitable space.',
    ),
    'Start or end my day well': need(
      'start_or_end_my_day_well',
      [
        {
          when: CALM_LIGHTS,
          then: [
            propose('primary', path('meditate')),
            propose('alternative', tool('end_of_day')),
            set('drivers.add', { drivers: ['routine'] }),
          ],
        },
      ],
      'Meditate (opening or closing ritual), the end-of-day close optional; Routine. Morning vs evening is deferred (ADR 0004).',
    ),
    'Feel connected to something bigger': need(
      'feel_connected_to_something_bigger',
      [
        {
          when: NOT_RED,
          then: [
            propose('primary', path('meditate')),
            propose('alternative', tool('groups')),
            set('drivers.add', { drivers: ['passion'] }),
          ],
        },
        { when: lit('red'), then: [propose('primary', path('connect')), set('support.show')] },
      ],
      'Meditate (values or faith practice) with Connect (community or faith group); Passion. Red: Connect and Get support now.',
    ),
  },
};
