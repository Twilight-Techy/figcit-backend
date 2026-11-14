import type { Comparison, Condition, Effect, EngineRule, Target } from '../format/types.js';
import type { RowMapping, TabMapping } from './types.js';

// Rules Engine v5.0: the no-task card. Each emotion's route by colour (Tab 2's two route columns,
// made concrete by Tab 18's buttons), the patterns that override them (Tab 11: 16, 50, 51) and the
// defaults when no emotion is picked (6, 8, 53), and the no-task suggestion (Tab 10, TK-4).
// Checked against Tab 18's pattern, primary and alternatives (test/v5-card.test.ts).

const eq = (fact: string, value: string): Comparison => ({ fact, op: 'eq', value });
const among = (fact: string, value: readonly string[]): Comparison => ({ fact, op: 'in', value });
const is = (fact: string, value: boolean): Comparison => ({ fact, op: 'is', value });
const atLeast = (fact: string, band: string): Comparison => ({
  fact,
  op: 'gte',
  value: { band },
});
const all = (...c: Condition[]): Condition => ({ all: c });
const not = (c: Condition): Condition => ({ not: c });
const set = (kind: string, params: Record<string, unknown> = {}): Effect => ({ kind, ...params });

type Step = string; // a tool code, or `@action`
const target = (step: Step): Target =>
  step.startsWith('@') ? ({ action: step.slice(1) } as Target) : { tool: step };
const propose = (slot: 'primary' | 'alternative', step: Step): Effect =>
  set('propose', { slot, target: target(step) });
const need = (slot: 'primary' | 'alternative', step: Step): Effect =>
  set('require', { slot, target: target(step) });

const CALM_LIGHTS = ['green', 'yellow', 'blue'];
const light = (...l: string[]): Comparison => among('light', l);
const familiarUrgent: Condition = all(
  { fact: 'urgent.signs', op: 'not_empty' },
  eq('urgent.answer', 'familiar'),
);
/** No guard leads the card: not no-words (16), not a familiar urgent sign (51). */
const unguarded: Condition = all(is('mode.no_words', false), not(familiarUrgent));

/** One emotion's buttons: [primary, alternative] in Green/Yellow/Blue, in Amber, in Red. */
interface Route {
  readonly calm: readonly [Step, Step];
  readonly amber: readonly [Step, Step];
  readonly red: readonly [Step, Step];
}

const SHUTDOWN_ROUTE = (calmAlt: Step): Route => ({
  calm: ['@suggest_task', calmAlt],
  amber: ['reg_tap', 'exp_cards'],
  red: ['reg_tap', 'exp_cards'],
});
const SETTLED_RED: readonly [Step, Step] = ['reg_rest', 'con_contact'];

/**
 * Tab 2's routes, by emotion code (the catalogue's). Tab 2 says the pathway and tool in prose
 * ("Regulate → Breathe or Ground, then Execute → Smallest next step"); Tab 18 gives each one as two
 * buttons, which these follow. In Red the alternative is to reach someone (Tab 8, Connect "Primary
 * with Get support now"), and Get support now is always shown there (the colours row).
 */
export const ROUTES: Readonly<Record<string, Route>> = {
  angry: {
    calm: ['reg_dance', 'exp_write'],
    amber: ['reg_breathe', 'reg_move'],
    red: ['reg_breathe', 'con_contact'],
  },
  frustrated: {
    calm: ['reg_move', 'exe_step'],
    amber: ['reg_breathe', 'dmp_capture'],
    red: ['reg_breathe', 'con_contact'],
  },
  anxious: {
    calm: ['reg_breathe', 'exe_step'],
    amber: ['reg_ground', 'reg_breathe'],
    red: ['reg_ground', 'con_contact'],
  },
  overwhelmed: {
    calm: ['dmp_capture', 'exe_step'],
    amber: ['reg_breathe', 'dmp_capture'],
    red: ['reg_breathe', 'con_contact'],
  },
  let_down_or_cheated: {
    calm: ['exp_write', 'con_contact'],
    amber: ['reg_breathe', 'con_contact'],
    red: ['reg_breathe', 'con_contact'],
  },
  all_over_the_place: {
    calm: ['reg_ground', 'dmp_capture'],
    amber: ['reg_ground', 'reg_breathe'],
    red: ['reg_ground', 'con_contact'],
  },
  teary_or_sad: {
    calm: ['reg_sounds', 'con_contact'],
    amber: ['reg_sounds', 'con_contact'],
    red: ['reg_sounds', 'con_contact'],
  },
  disappointed: {
    calm: ['rfl_today', 'exe_step'],
    amber: ['reg_sounds', 'reg_rest'],
    red: ['reg_sounds', 'con_contact'],
  },
  lonely: {
    calm: ['con_contact', 'reg_sounds'],
    amber: ['con_contact', 'reg_sounds'],
    red: ['con_contact', 'reg_sounds'],
  },
  unmotivated: {
    calm: ['exe_step', 'reg_move'],
    amber: ['reg_rest', 'exe_step'],
    red: ['reg_rest', 'con_contact'],
  },
  bored: {
    calm: ['reg_create', 'exe_step'],
    amber: ['reg_create', 'reg_rest'],
    red: ['reg_rest', 'con_contact'],
  },
  // FE-5: Reflect only in Green/Yellow, as "What went well"; Tab 17 has no such tool, so What
  // helped (RFL-HELPED) is read as it (for the founder: V5.md).
  not_good_enough: {
    calm: ['rfl_helped', 'con_contact'],
    amber: ['con_contact', 'reg_sounds'],
    red: ['con_contact', 'reg_sounds'],
  },
  numb: SHUTDOWN_ROUTE('reg_ground'),
  frozen: SHUTDOWN_ROUTE('reg_tap'),
  shut_down: SHUTDOWN_ROUTE('reg_tap'),
  calm: {
    calm: ['@suggest_task', '@plan_something'],
    amber: ['reg_rest', 'exe_step'],
    red: SETTLED_RED,
  },
  happy: {
    calm: ['@suggest_task', 'con_contact'],
    amber: ['reg_rest', 'exe_step'],
    red: SETTLED_RED,
  },
  grateful: {
    calm: ['@suggest_task', 'med_gratitude'],
    amber: ['med_gratitude', 'reg_rest'],
    red: SETTLED_RED,
  },
  clear_headed: {
    calm: ['exe_step', 'exp_ask'],
    amber: ['exe_step', 'reg_rest'],
    red: SETTLED_RED,
  },
  empowered: { calm: ['exp_ask', 'exe_step'], amber: ['exp_write', 'reg_rest'], red: SETTLED_RED },
  // SE-1: Something else, its group question skipped, is treated as Low (pattern 52).
  something_else: {
    calm: ['reg_breathe', 'con_contact'],
    amber: ['reg_breathe', 'con_contact'],
    red: ['reg_breathe', 'con_contact'],
  },
};

/** Tab 2's emotion IDs, by code (the rows these rules sit on). */
const IDS: Readonly<Record<string, string>> = {
  angry: 'EM01',
  frustrated: 'EM02',
  anxious: 'EM03',
  overwhelmed: 'EM04',
  let_down_or_cheated: 'EM05',
  all_over_the_place: 'EM06',
  teary_or_sad: 'EM07',
  disappointed: 'EM08',
  lonely: 'EM09',
  unmotivated: 'EM10',
  bored: 'EM11',
  not_good_enough: 'EM12',
  numb: 'EM13',
  frozen: 'EM14',
  shut_down: 'EM15',
  calm: 'EM16',
  happy: 'EM17',
  grateful: 'EM18',
  clear_headed: 'EM19',
  empowered: 'EM20',
  something_else: 'EM00',
};

function routeRow(code: string, route: Route): RowMapping {
  const by = (lights: string[], [primary, alternative]: readonly [Step, Step]) => ({
    when: all(eq('feeling.deciding', code), light(...lights), unguarded),
    then: [propose('primary', primary), propose('alternative', alternative)],
  });
  return {
    mapping: 'interpreted',
    reason:
      "Tab 2's routes for this emotion (Green/Yellow/Blue at home; Amber/Red), as the two buttons Tab 18 gives for them.",
    engine: {
      stage: 'orchestration',
      layer: 'trigger',
      rules: [by(CALM_LIGHTS, route.calm), by(['amber'], route.amber), by(['red'], route.red)],
    },
  };
}

/** Tab 2's emotion rows: each one's route. The other Tab 2 tables are values (the catalogue). */
export const FEELINGS: TabMapping = {
  all: {
    mapping: 'reference',
    reason:
      'A value the catalogue holds (levels, groups), or a rule run from Tab 6 (FE-3, FE-5, SE-1).',
  },
  rows: Object.fromEntries(
    Object.entries(ROUTES).map(([code, route]) => [IDS[code] ?? code, routeRow(code, route)]),
  ),
};

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

const noFeeling: Comparison = { fact: 'feeling.deciding', op: 'absent' };

const unpleasant: Comparison = among('feeling.deciding_group', ['charged', 'low', 'shutdown']);
const strong = atLeast('feeling.deciding_level', 'strong');
const decides = (...codes: string[]): Comparison => among('feeling.deciding', codes);
const movingHard = all(decides('angry', 'frustrated'), strong);

/**
 * Tab 11's patterns for a check-in with no task (Tab 18's column). The conditions don't overlap,
 * so no ranking decides between them; the guards (16, 51) also lead the buttons.
 */
export const CARD_PATTERNS: TabMapping = {
  rows: {
    '6': pattern('6', all(light('amber'), unguarded, not(decides('something_else', 'bored'))), {
      reason:
        'Amber, no task: Regulate, Dump or Connect. With no emotion: Breathe, then Rest (Tab 18).',
    }),
    '8': pattern('8', all(light('red'), unguarded), {
      reason:
        'Red, no task: Regulate, Dump or Connect, support visible. With no emotion: Breathe, then reach someone (Tab 18).',
    }),
    '16': pattern('16', is('mode.no_words', true), {
      then: [need('primary', 'reg_tap'), propose('alternative', 'exp_cards')],
      layer: 'guard',
      reason:
        "Shutdown: tap-only Breathe, then the 'I need quiet' message (Tab 17 Quick message cards).",
    }),
    '48': pattern(
      '48',
      all(
        light(...CALM_LIGHTS),
        unguarded,
        among('feeling.deciding_group', ['charged', 'low']),
        not(decides('bored')),
        not(movingHard),
      ),
      { layer: 'trigger' },
    ),
    '50': reference('Run from SF-4 (Tab 6): the urgent screen.'),
    '51': pattern('51', all(familiarUrgent, is('mode.no_words', false)), {
      then: [need('primary', 'reg_breathe'), propose('alternative', 'con_contact')],
      layer: 'guard',
      reason: 'A familiar urgent sign: help the body settle first, Breathe, then reach someone.',
    }),
    '52': pattern('52', all(decides('something_else'), not(light('red')), unguarded), {
      layer: 'trigger',
    }),
    '53': pattern(
      '53',
      all(
        light(...CALM_LIGHTS),
        unguarded,
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
      all(light(...CALM_LIGHTS), unguarded, decides('clear_headed', 'empowered')),
      { layer: 'trigger' },
    ),
    '56': pattern('56', all(decides('bored'), not(light('red')), unguarded), { layer: 'trigger' }),
    '57': pattern('57', all(light(...CALM_LIGHTS), unguarded, movingHard), { layer: 'trigger' }),
  },
};

// P1-A: with no emotion picked, "Plan something" sits beside the suggestion; an emotion brings
// its own alternative (its route).
// The same for Amber (6: Breathe, then Rest) and Red (8: Breathe, then reach someone).
const withNoFeeling = (n: string, lights: readonly string[], steps: readonly Step[]): void => {
  const row = CARD_PATTERNS.rows?.[n];
  if (row?.mapping === 'interpreted')
    (row.engine.rules as EngineRule[]).push({
      when: all(light(...lights), unguarded, noFeeling),
      then: steps.map((step, i) =>
        propose(i === 0 && steps.length > 1 ? 'primary' : 'alternative', step),
      ),
    });
};
withNoFeeling('53', CALM_LIGHTS, ['@plan_something']);
withNoFeeling('6', ['amber'], ['reg_breathe', 'reg_rest']);
withNoFeeling('8', ['red'], ['reg_breathe', 'con_contact']);

/** Tab 10's no-task suggestions (TK-4): the first of the colour's list, Yellow's second with a difficult feeling. */
export const SUGGESTIONS: TabMapping = {
  sections: {
    'v5.0 — No-task suggestions': {
      ...Object.fromEntries(
        ['Green', 'Amber', 'Red', 'Blue'].map((c): [string, RowMapping] => [
          c,
          {
            mapping: 'interpreted',
            reason: `${c}: the list's first suggestion (Tab 18).`,
            engine: {
              stage: 'orchestration',
              rules: [
                {
                  // No-words mode suggests nothing until a re-check, except Red's rest (Tab 18).
                  when:
                    c === 'Red'
                      ? eq('light', 'red')
                      : all(eq('light', c.toLowerCase()), is('mode.no_words', false)),
                  then: [set('suggestion.set', { copy: `tk4.${c.toLowerCase()}.1` })],
                },
              ],
            },
          },
        ]),
      ),
      Yellow: {
        mapping: 'interpreted',
        reason:
          "Yellow: 'One Usual task' with no difficult feeling; 'Reply to one message' with one (Tab 18).",
        engine: {
          stage: 'orchestration',
          rules: [
            {
              when: all(
                eq('light', 'yellow'),
                is('mode.no_words', false),
                not(unpleasant),
                not(decides('something_else')),
              ),
              then: [set('suggestion.set', { copy: 'tk4.yellow.1' })],
            },
            {
              when: all(eq('light', 'yellow'), is('mode.no_words', false), {
                any: [unpleasant, decides('something_else')],
              }),
              then: [set('suggestion.set', { copy: 'tk4.yellow.2' })],
            },
          ],
        },
      },
    },
  },
};
