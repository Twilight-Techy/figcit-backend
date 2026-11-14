import type { RowMapping, TabMapping } from './types.js';
import {
  eq,
  among,
  all,
  not,
  propose,
  CALM_LIGHTS,
  light,
  any,
  noTask,
  sensesFirst,
  unguarded,
  type Step,
} from './v5-terms.js';

// Rules Engine v5.0: each emotion's route by colour (Tab 2's two route columns, made concrete by
// Tab 18's buttons). Checked against Tabs 18, 19 and 20.

/** One emotion's buttons: [primary, alternative] in Green/Yellow/Blue, in Amber, in Red. */
export interface Route {
  readonly calm: readonly [Step, Step];
  readonly amber: readonly [Step, Step];
  readonly red: readonly [Step, Step];
}

export const SHUTDOWN_ROUTE = (calmAlt: Step): Route => ({
  calm: ['@suggest_task', calmAlt],
  amber: ['reg_tap', 'exp_cards'],
  red: ['reg_tap', 'exp_cards'],
});
export const SETTLED_RED: readonly [Step, Step] = ['reg_rest', 'con_contact'];

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
export const IDS: Readonly<Record<string, string>> = {
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
  const by = (lights: string[], [primary, alternative]: readonly [Step, Step], red = false) => [
    {
      when: all(
        eq('feeling.deciding', code),
        light(...lights),
        unguarded,
        ...(primary === '@suggest_task' ? [noTask] : []),
      ),
      then: [propose('primary', primary)],
    },
    // A task (Skip to, One small step) or a sense (pattern 59) takes the second place, except in
    // Red, where reaching someone always does (pattern 7).
    {
      when: all(
        eq('feeling.deciding', code),
        light(...lights),
        unguarded,
        // Clear-headed or Empowered in Yellow keep their own pair beside a task (pattern 55, Tab 20).
        ...(red
          ? []
          : [
              any(
                noTask,
                all(
                  eq('light', 'yellow'),
                  among('feeling.deciding', ['clear_headed', 'empowered']),
                ),
              ),
              not(sensesFirst),
            ]),
      ),
      then: [propose('alternative', alternative)],
    },
  ];
  return {
    mapping: 'interpreted',
    reason:
      "Tab 2's routes for this emotion (Green/Yellow/Blue at home; Amber/Red), as the two buttons Tab 18 gives for them.",
    engine: {
      stage: 'orchestration',
      layer: 'trigger',
      rules: [
        ...by(CALM_LIGHTS, route.calm),
        ...by(['amber'], route.amber),
        ...by(['red'], route.red, true),
      ],
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
