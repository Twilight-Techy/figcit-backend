import type { Comparison, Condition, Effect, Target } from '../format/types.js';
import type { RowMapping, TabMapping } from './types.js';

// Rules Engine v5.0: where you are (Tab 4) and what you have with you (Tab 5) choose the tools,
// never the colour (CX-R, DV-R). Away from home, unless the person can step away, a tool is shown
// as its quieter version; Tab 19 gives each swap, which these follow (test/v5-places.test.ts).

const eq = (fact: string, value: string): Comparison => ({ fact, op: 'eq', value });
const is = (fact: string, value: boolean): Comparison => ({ fact, op: 'is', value });
const all = (...c: Condition[]): Condition => ({ all: c });
const set = (kind: string, params: Record<string, unknown> = {}): Effect => ({ kind, ...params });
const to = (step: string): Target =>
  step.startsWith('@') ? ({ action: step.slice(1) } as Target) : { tool: step };
const swap = (from: string, step: string): Effect => set('tools.swap', { from, to: to(step) });

/** Away from home and unable to step away (Tab 4: "Ask"; Tab 19's rows are all "No"). */
const at = (place: string): Condition =>
  all(eq('context.setting', place), is('context.can_step_away', false));
const withoutHeadphones: Comparison = {
  fact: 'context.supports',
  op: 'not_contains',
  value: 'headphones_or_earbuds',
};

/** Discreet everywhere away from home (Tab 4 "Discreet by default"; Tab 19). */
const DISCREET: readonly [string, string][] = [
  ['reg_breathe', 'reg_breathe_discreet'],
  ['dmp_capture', 'dmp_capture_text'],
  ['reg_rest', 'reg_rest_pause'],
];
/** Reflect waits until later where a person can't stop to reflect (Tab 19). */
const LATER: readonly [string, string][] = [
  ['rfl_today', '@save_for_later'],
  ['rfl_helped', '@save_for_later'],
];
/** Movement and dance by place: at a desk, on the move, or Ground where you sit still. */
const moveTo = (step: string): [string, string][] => [
  ['reg_dance', step],
  ['reg_move', step],
];

function place(
  ref: string,
  code: string,
  swaps: readonly (readonly [string, string])[],
  reason: string,
): [string, RowMapping] {
  return [
    ref,
    {
      mapping: 'interpreted',
      reason,
      engine: {
        stage: 'context',
        rules: [
          { when: at(code), then: swaps.map(([from, step]) => swap(from, step)) },
          // Calming sounds out loud need headphones (DV-H); without them, Comfort on screen.
          { when: all(at(code), withoutHeadphones), then: [swap('reg_sounds', 'reg_comfort')] },
        ],
      },
    },
  ];
}

export const PLACES: TabMapping = {
  rows: Object.fromEntries([
    [
      'PL1',
      {
        mapping: 'reference',
        reason: 'Home: everything, out loud, eyes closed, Move, Dance and calls (no swap).',
      } as RowMapping,
    ],
    place(
      'PL2',
      'work_or_placement',
      [...DISCREET, ...LATER, ...moveTo('reg_move_desk')],
      'Work: discreet tools; Move is a stretch at the desk; Reflect later.',
    ),
    place(
      'PL3',
      'class_or_lecture',
      [...DISCREET, ...LATER, ...moveTo('reg_ground')],
      'Class: silent, eyes-open tools; no Move or Dance (Ground); Dump by text; Reflect later.',
    ),
    place(
      'PL4',
      'out_and_about',
      [...DISCREET, ...LATER, ...moveTo('reg_move_walk')],
      'Out and about: discreet; walk it off when walking; sounds only with headphones.',
    ),
    [
      'PL5',
      {
        mapping: 'reference',
        reason: 'Exam: only silent, eyes-open Regulate; pattern 49 (Tab 11) runs it.',
      } as RowMapping,
    ],
    place(
      'PL6',
      'appointment_or_meeting',
      [
        ...DISCREET,
        ...LATER,
        ...moveTo('reg_ground'),
        ['reg_create', 'reg_ground'],
        ['exp_write', 'exp_appt'],
        ['exp_ask', 'exp_appt'],
      ],
      'Appointment: discreet Regulate; Express is Notes for my appointment; no calls, Move or Dance.',
    ),
    place(
      'PL7',
      'library_or_quiet_study_space',
      [...DISCREET, ...moveTo('reg_ground')],
      'Library: silent tools; Dump by text; no Dance (Ground); Reflect stays (Tab 19).',
    ),
    place(
      'PL8',
      'somewhere_else',
      [...DISCREET, ...LATER, ...moveTo('reg_ground')],
      'Somewhere else: discreet by default; no out-loud or eyes-closed unless they can step away.',
    ),
  ]),
};

/** Tab 5's devices: what they unlock is in the place rows and the senses rules (BS-2, P59). */
export const DEVICES: TabMapping = {
  all: {
    mapping: 'reference',
    reason:
      'A value the catalogue holds (support); the rules that read it are the place rows (headphones) and BS-2.',
  },
};

/**
 * Pattern 49: can't step away (an exam, interview or assessment): only the silent, eyes-open
 * Breathe, nothing beside it (Tab 19).
 */
export const PATTERN_49: RowMapping = {
  mapping: 'interpreted',
  reason:
    "Tab 4 PL5 (exam, can't step away): only silent, eyes-open Regulate; Tab 19 shows it in every colour.",
  engine: {
    stage: 'orchestration',
    layer: 'guard',
    rules: [
      {
        when: eq('context.setting', 'exam_interview_or_assessment'),
        then: [
          set('require', { slot: 'primary', target: { tool: 'reg_breathe_silent' } }),
          set('alternatives.limit', { max: 0 }),
        ],
      },
      // No-words mode keeps its own headline there (pattern 16, Tab 19).
      {
        when: all(
          eq('context.setting', 'exam_interview_or_assessment'),
          is('mode.no_words', false),
        ),
        then: [set('pattern.set', { pattern: '49' })],
      },
    ],
  },
};
