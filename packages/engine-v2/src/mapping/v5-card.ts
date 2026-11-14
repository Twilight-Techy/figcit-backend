import type { Comparison, Condition, Effect, EngineRule } from '../format/types.js';
import type { RowMapping, TabMapping } from './types.js';
import { MORE_PATTERNS } from './v5-patterns-more.js';
import { PATTERN_49 } from './v5-places.js';
import {
  eq,
  among,
  is,
  all,
  not,
  set,
  propose,
  need,
  CALM_LIGHTS,
  light,
  any,
  noTask,
  hasTask,
  EXAM,
  sensesFirst,
  familiarUrgent,
  unguarded,
  noFeeling,
  oneTask,
  manyTasks,
  yellowAsk,
  difficult,
  decides,
  movingHard,
  type Step,
} from './v5-terms.js';

// Rules Engine v5.0: the card's patterns (Tab 11) that override the emotion routes (16, 49, 50, 51,
// 59), the defaults with no emotion (6, 8, 53), and the patterns with a task (2, 4, 5, 7, 54).
// Checked against Tabs 18, 19 and 20 (test/v5-*.test.ts).

const reference = (reason: string): RowMapping => ({ mapping: 'reference', reason });
interface PatternRow {
  readonly then?: readonly Effect[];
  readonly layer?: 'safety' | 'guard' | 'trigger' | 'default';
  readonly reason?: string;
}
const pattern = (
  n: string,
  when: Condition,
  {
    then = [],
    layer = 'default',
    reason = 'Its pattern, read from the When column; the card buttons come from the emotion routes.',
  }: PatternRow = {},
): RowMapping => ({
  mapping: 'interpreted',
  reason,
  engine: {
    stage: 'orchestration',
    layer,
    rules: [{ when, then: [set('pattern.set', { pattern: n }), ...then] }],
  },
});

/**
 * Tab 11's patterns for a check-in with no task (Tab 18's column). The conditions don't overlap,
 * so no ranking decides between them; the guards (16, 51) also lead the buttons.
 */
export const CARD_PATTERNS: TabMapping = {
  rows: {
    ...MORE_PATTERNS,
    '6': pattern(
      '6',
      all(light('amber'), unguarded, noTask, not(decides('something_else', 'bored'))),
      {
        reason:
          'Amber, no task: Regulate, Dump or Connect. With no emotion: Breathe, then Rest (Tab 18).',
      },
    ),
    '8': pattern('8', all(light('red'), unguarded, noTask), {
      reason:
        'Red, no task: Regulate, Dump or Connect, support visible. With no emotion: Breathe, then reach someone (Tab 18).',
    }),
    '16': pattern('16', is('mode.no_words', true), {
      layer: 'guard',
      reason:
        "Shutdown: tap-only Breathe, then the 'I need quiet' message (Tab 17 Quick message cards); in an exam, its silent Breathe instead (Tab 19).",
    }),
    '48': pattern(
      '48',
      all(
        light(...CALM_LIGHTS),
        unguarded,
        noTask,
        among('feeling.deciding_group', ['charged', 'low']),
        not(decides('bored')),
        not(movingHard),
      ),
      { layer: 'trigger' },
    ),
    '49': PATTERN_49,
    '50': reference('Run from SF-4 (Tab 6): the urgent screen.'),
    '51': pattern('51', all(familiarUrgent, is('mode.no_words', false)), {
      then: [need('primary', 'reg_breathe'), propose('alternative', 'con_contact')],
      layer: 'guard',
      reason: 'A familiar urgent sign: help the body settle first, Breathe, then reach someone.',
    }),
    '52': pattern('52', all(decides('something_else'), not(light('red')), unguarded, noTask), {
      layer: 'trigger',
    }),
    '53': pattern(
      '53',
      all(
        light(...CALM_LIGHTS),
        unguarded,
        noTask,
        not(among('feeling.deciding_group', ['charged', 'low', 'unsorted'])),
        not(decides('clear_headed', 'empowered')),
      ),
      {
        then: [propose('primary', '@suggest_task')],
        reason:
          'No task in Green/Yellow/Blue: the TK-4 suggestion; with no emotion, Plan something beside it (P1-A).',
      },
    ),
    '55': pattern(
      '55',
      all(
        light(...CALM_LIGHTS),
        unguarded,
        decides('clear_headed', 'empowered'),
        any(noTask, eq('light', 'yellow')),
      ),
      {
        layer: 'trigger',
        reason:
          'Clear-headed or Empowered: with a task too in Yellow (Tab 20); in Green and Blue a task leads (2, 54).',
      },
    ),
    '56': pattern('56', all(decides('bored'), not(light('red')), unguarded), {
      layer: 'trigger',
    }),
    '57': pattern('57', all(light(...CALM_LIGHTS), unguarded, noTask, movingHard), {
      layer: 'trigger',
    }),
    // ---- with a task (Tab 11; Tab 20) ----
    '2': pattern(
      '2',
      all(light(...CALM_LIGHTS), unguarded, oneTask, not(difficult), not(yellowAsk)),
      {
        reason: 'Green/Blue/Yellow, no difficult feeling, one task: straight to it.',
      },
    ),
    '54': pattern(
      '54',
      all(light(...CALM_LIGHTS), unguarded, manyTasks, not(difficult), not(yellowAsk)),
      {
        reason: 'Several tasks, sorted by the colour (TK-2): the top one first.',
      },
    ),
    '4': pattern(
      '4',
      all(light(...CALM_LIGHTS), unguarded, hasTask, difficult, not(decides('bored'))),
      {
        layer: 'trigger',
        reason:
          "A difficult feeling with a task: the emotion's reset first, the task beside it (Skip to).",
      },
    ),
    '5': pattern('5', all(light('amber'), unguarded, hasTask), {
      then: [propose('alternative', '@start_small')],
      layer: 'trigger',
      reason: 'Amber with a task: reduce the load first, then one small step of the task.',
    }),
    '7': pattern('7', all(light('red'), unguarded, hasTask), {
      layer: 'trigger',
      reason:
        'Red with a task: care first; the task waits for a re-check (tasks kept, not suggested).',
    }),
    '59': pattern('59', all(sensesFirst, unguarded, not(eq('context.setting', EXAM))), {
      then: [set('alternatives.limit', { max: 1 })],
      layer: 'guard',
      reason:
        'Senses ticked: what is around you first, with a device if one helps (BS-2); the emotion or task is beside it.',
    }),
  },
};

// P1-A: with no emotion picked, "Plan something" sits beside the suggestion; an emotion brings
// its own alternative (its route).
// The same for Amber (6: Breathe, then Rest) and Red (8: Breathe, then reach someone).
const withNoFeeling = (n: string, lights: readonly string[], steps: readonly Step[]): void => {
  const row = CARD_PATTERNS.rows?.[n];
  const task = ['5', '7'].includes(n) ? hasTask : noTask;
  if (row?.mapping === 'interpreted')
    (row.engine.rules as EngineRule[]).push({
      when: all(light(...lights), unguarded, noFeeling, task),
      then: steps.map((step, i) =>
        propose(i === 0 && steps.length > 1 ? 'primary' : 'alternative', step),
      ),
    });
};
withNoFeeling('53', CALM_LIGHTS, ['@plan_something']);
const p16 = CARD_PATTERNS.rows?.['16'];
if (p16?.mapping === 'interpreted')
  (p16.engine.rules as EngineRule[]).push({
    when: all(
      is('mode.no_words', true),
      not(eq('context.setting', 'exam_interview_or_assessment')),
    ),
    then: [need('primary', 'reg_tap'), propose('alternative', 'exp_cards')],
  });
withNoFeeling('6', ['amber'], ['reg_breathe', 'reg_rest']);
withNoFeeling('8', ['red'], ['reg_breathe', 'con_contact']);
withNoFeeling('7', ['red'], ['reg_breathe', 'con_contact']);
withNoFeeling('5', ['amber'], ['reg_breathe']);

// A difficult feeling (Bored too) with a task in Green, Yellow or Blue: the task beside it (4, 56).
const p4 = CARD_PATTERNS.rows?.['4'];
if (p4?.mapping === 'interpreted')
  (p4.engine.rules as EngineRule[]).push({
    when: all(light(...CALM_LIGHTS), unguarded, hasTask, difficult, not(sensesFirst)),
    then: [propose('alternative', '@skip_to_task')],
  });

// Patterns 2 and 54: the top task first; beside it the smallest step, or Ask for what I need when
// Empowered (Tab 20).
const p2 = CARD_PATTERNS.rows?.['2'];
if (p2?.mapping === 'interpreted')
  (p2.engine.rules as EngineRule[]).push(
    {
      when: all(
        light(...CALM_LIGHTS),
        unguarded,
        hasTask,
        not(difficult),
        not(sensesFirst),
        not(yellowAsk),
      ),
      then: [need('primary', '@start_task')],
    },
    {
      when: all(
        light(...CALM_LIGHTS),
        unguarded,
        hasTask,
        not(difficult),
        decides('empowered'),
        not(yellowAsk),
      ),
      then: [propose('alternative', 'exp_ask')],
    },
    {
      when: all(
        light(...CALM_LIGHTS),
        unguarded,
        hasTask,
        not(difficult),
        not(decides('empowered')),
      ),
      then: [propose('alternative', 'exe_step')],
    },
  );

// Pattern 59: the device that helps with the sense ticked, else a small change of place (Tab 20).
const loudOrBusy: Comparison = {
  fact: 'sensitivity.flags',
  op: 'contains_any',
  value: ['too_loud', 'too_busy_or_crowded'],
};
const has = (device: string): Comparison => ({
  fact: 'context.supports',
  op: 'contains',
  value: device,
});
const DEVICE_STEPS: readonly (readonly [Condition, string])[] = [
  [all(loudOrBusy, has('ear_defenders_or_loop_earplugs')), 'adp_device_ear'],
  [all(loudOrBusy, has('quiet_room_i_can_use')), 'adp_device_room'],
  [
    all(
      { fact: 'sensitivity.flags', op: 'contains', value: 'too_bright' },
      has('sunglasses_or_tinted_glasses'),
    ),
    'adp_device_sun',
  ],
];
const p59 = CARD_PATTERNS.rows?.['59'];
if (p59?.mapping === 'interpreted')
  (p59.engine.rules as EngineRule[]).push(
    ...DEVICE_STEPS.map(([when, tool]) => ({
      when: all(sensesFirst, unguarded, not(eq('context.setting', EXAM)), when),
      then: [need('primary', tool)],
    })),
    {
      when: all(
        sensesFirst,
        unguarded,
        not(eq('context.setting', EXAM)),
        ...DEVICE_STEPS.map(([when]) => not(when)),
      ),
      then: [need('primary', 'adp_space_turn')],
    },
  );
