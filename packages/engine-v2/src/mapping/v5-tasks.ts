import type { RowMapping, TabMapping } from './types.js';
import {
  eq,
  is,
  all,
  not,
  set,
  noTask,
  hasTask,
  notExam,
  unpleasant,
  decides,
} from './v5-terms.js';

// Rules Engine v5.0, Tab 10: the order tasks are shown in (TK-2) and the no-task suggestion (TK-4).

/** Tab 10's task order by colour (TK-2), by chip; Amber's and Blue's last ones wait (Later). */
const ORDER: Readonly<Record<string, readonly [readonly string[], readonly string[]]>> = {
  Green: [
    ['hard', 'new', 'can_t_wait', 'matters_to_me', 'try_out', 'with_others', 'enjoy', 'usual'],
    [],
  ],
  Yellow: [
    ['can_t_wait', 'usual', 'enjoy', 'try_out', 'matters_to_me', 'with_others', 'hard', 'new'],
    [],
  ],
  Amber: [
    ['can_t_wait', 'usual', 'enjoy'],
    ['matters_to_me', 'try_out', 'with_others', 'hard', 'new'],
  ],
  // Care first: the list is kept but not suggested (TK-3: a Can't-wait item may be handed on).
  Red: [
    [],
    ['can_t_wait', 'usual', 'enjoy', 'try_out', 'matters_to_me', 'with_others', 'hard', 'new'],
  ],
  Blue: [
    ['usual', 'enjoy', 'can_t_wait', 'try_out', 'matters_to_me', 'with_others'],
    ['hard', 'new'],
  ],
};

export const TASK_ORDER: Readonly<Record<string, RowMapping>> = Object.fromEntries(
  Object.entries(ORDER).map(([colour, [first, later]]): [string, RowMapping] => [
    colour,
    {
      mapping: 'exact',
      reason: `${colour}: tasks in the order the row gives, by chip.`,
      engine: {
        stage: 'orchestration',
        rules: [
          {
            when: all(eq('light', colour.toLowerCase()), hasTask),
            then: [set('tasks.order', { first, later })],
          },
        ],
      },
    },
  ]),
);

/** Tab 10's no-task suggestions (TK-4): the first of the colour's list, Yellow's second with a difficult feeling. */
export const SUGGESTIONS: TabMapping = {
  all: {
    mapping: 'reference',
    reason:
      'Timelines, drivers, demand types and chips are values or app rules; the task order and suggestions below run.',
  },
  sections: {
    'v5.0 — Task order by colour': TASK_ORDER,
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
                      ? all(eq('light', 'red'), noTask, notExam)
                      : all(
                          eq('light', c.toLowerCase()),
                          is('mode.no_words', false),
                          noTask,
                          notExam,
                        ),
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
                noTask,
                notExam,
                not(unpleasant),
                not(decides('something_else')),
              ),
              then: [set('suggestion.set', { copy: 'tk4.yellow.1' })],
            },
            {
              when: all(eq('light', 'yellow'), is('mode.no_words', false), noTask, notExam, {
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
