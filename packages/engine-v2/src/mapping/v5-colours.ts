import type { Comparison, Condition, Effect } from '../format/types.js';
import type { RowMapping, TabMapping } from './types.js';

// Rules Engine v5.0: the colour (Tab 1 capacity, Tab 6 colours and the rules that change them,
// Tab 3's body rules), read for the engine. Founder decisions of 11 Nov 2026: feelings, their
// strength and the body lower the colour one step at most; place and devices never change it.
// Checked against every row of Tab 18 (test/v5-outcomes.test.ts).

const eq = (fact: string, value: string): Comparison => ({ fact, op: 'eq', value });
const among = (fact: string, value: readonly string[]): Comparison => ({ fact, op: 'in', value });
const is = (fact: string, value: boolean): Comparison => ({ fact, op: 'is', value });
const atLeast = (fact: string, band: string): Comparison => ({
  fact,
  op: 'gte',
  value: { band },
});
const contains = (fact: string, value: string): Comparison => ({ fact, op: 'contains', value });
const all = (...c: Condition[]): Condition => ({ all: c });
const any = (...c: Condition[]): Condition => ({ any: c });
const set = (kind: string, params: Record<string, unknown> = {}): Effect => ({ kind, ...params });
const lower: Effect = set('band.lower', { steps: 1 });

const reference = (reason: string): RowMapping => ({ mapping: 'reference', reason });

/** Tab 1: each state's baseline band ("Baseline band (internal)"). */
const BASELINE: Readonly<Record<string, string>> = {
  E1M1: 'very_constrained',
  E1M2: 'very_constrained',
  E1M3: 'constrained',
  E1M4: 'constrained',
  E2M1: 'constrained',
  E2M2: 'conditional',
  E2M3: 'conditional',
  E2M4: 'available',
  E3M1: 'conditional',
  E3M2: 'conditional',
  E3M3: 'available',
  E3M4: 'available',
  E4M1: 'conditional',
  E4M2: 'conditional',
  E4M3: 'conditional',
  E4M4: 'available',
};

export const CAPACITY: TabMapping = {
  rows: {
    ...Object.fromEntries(
      Object.entries(BASELINE).map(([cell, band]): [string, RowMapping] => [
        cell,
        {
          mapping: 'exact',
          reason: `BL-0: ${cell}'s baseline band, as the row says.`,
          engine: {
            stage: 'state',
            rules: [{ when: eq('state.cell', cell), then: [set('band.set', { to: band })] }],
          },
        },
      ]),
    ),
    'Not sure': reference('NS-1 (Tab 6) sets the band for Not sure.'),
  },
};

/** Tab 6, Colours: each band's light. Recovery's Blue is an overlay the RC rules give. */
export const COLOURS: TabMapping = {
  rows: {
    ...Object.fromEntries(
      [
        ['Available', 'available', 'green'],
        ['Conditional', 'conditional', 'yellow'],
        ['Constrained', 'constrained', 'amber'],
        ['Very Constrained', 'very_constrained', 'red'],
      ].map(([row = '', band = '', light = '']): [string, RowMapping] => [
        row,
        {
          mapping: 'exact',
          reason: `${row} shows ${light}.`,
          engine: {
            stage: 'capacity_fit',
            rules: [{ when: eq('band.final', band), then: [set('light.set', { light })] }],
          },
        },
      ]),
    ),
    Recovery: reference('Blue is an overlay the recovery rules (RC-1..5) give, not a band.'),
  },
};

/** The unpleasant groups FE-1 names ("Charged, Low, or Unsorted"). */
const UNPLEASANT = ['charged', 'low', 'unsorted'];

export const COLOUR_RULES: TabMapping = {
  rows: {
    'BL-0': reference('Each Tab 1 row sets its own baseline band.'),
    'NS-1': {
      mapping: 'exact',
      reason: "'Not sure' is Yellow (Conditional) until a state is confirmed.",
      engine: {
        stage: 'state',
        rules: [
          { when: is('state.not_sure', true), then: [set('band.set', { to: 'conditional' })] },
        ],
      },
    },
    'FE-1': {
      mapping: 'exact',
      reason:
        'The deciding emotion (FE-3) is in an unpleasant group at Strong (7-8) or Very strong (9-10): one step lower.',
      engine: {
        stage: 'capacity_fit',
        rules: [
          {
            when: all(
              among('feeling.deciding_group', UNPLEASANT),
              atLeast('feeling.deciding_level', 'strong'),
            ),
            then: [lower],
          },
        ],
      },
    },
    'FE-2': {
      mapping: 'exact',
      reason:
        'The deciding emotion is in the Shutdown group at Moderate (4) or above: one step lower and no-words mode.',
      engine: {
        stage: 'capacity_fit',
        rules: [
          {
            when: all(
              eq('feeling.deciding_group', 'shutdown'),
              atLeast('feeling.deciding_level', 'moderate'),
            ),
            then: [lower, set('mode.no_words')],
          },
        ],
      },
    },
    'FE-3': reference(
      'The engine works out the deciding emotion (feeling.deciding): the higher slider, a tie to the lower group Order in the catalogue.',
    ),
    'FE-0': reference('Settled emotions, and unpleasant ones at Mild or Moderate, change nothing.'),
    'BS-1': {
      mapping: 'exact',
      reason:
        'A Shutdown body sign, or 3+ signs (the other groups are Pain & discomfort, Tension & restless, Heavy & tired): one step lower.',
      engine: {
        stage: 'capacity_fit',
        rules: [
          {
            when: any(contains('body.groups', 'shutdown'), {
              fact: 'body.count',
              op: 'gte',
              value: 3,
            }),
            then: [lower],
          },
        ],
      },
    },
    'CAP-1': {
      mapping: 'exact',
      reason:
        'FE-1, FE-2, BS-1 and SF-4 (familiar) together lower the colour one step at most; Red is the lowest band anyway.',
      engine: {
        stage: 'capacity_fit',
        rules: [{ when: null, then: [set('band.limit_drop', { steps: 1 })] }],
      },
    },
    'CX-R': reference('Place, "Can you step away?" and pressures never change the colour.'),
    'DV-R': reference('Help or devices never change the colour.'),
    'CTX-0': reference('How the app asks Where you are; nothing for the engine.'),
    'DEM-0': reference('A task never changes the colour.'),
    'LE-0': reference('Life right now never changes the colour.'),
    'SF-4': {
      mapping: 'exact',
      reason:
        'An urgent body sign: "sudden or new" is the urgent screen (pattern 50); "familiar when overwhelmed" continues one step lower (within CAP-1).',
      engine: {
        stage: 'safety',
        layer: 'safety',
        rules: [
          {
            when: all({ fact: 'urgent.signs', op: 'not_empty' }, eq('urgent.answer', 'sudden_new')),
            then: [set('stop'), set('support.show')],
          },
          {
            stage: 'capacity_fit',
            when: all({ fact: 'urgent.signs', op: 'not_empty' }, eq('urgent.answer', 'familiar')),
            then: [lower],
          },
        ],
      },
    },
  },
};

/** Tab 3's body rules: BS-1 is in Tab 6; BS-3 switches on no-words mode. */
export const BODY_RULES: TabMapping = {
  // Body signs, urgent signs and senses are values (the catalogue); what they change is in Tab 6.
  all: {
    mapping: 'reference',
    reason: 'A value the catalogue holds; the rules that read it are in Tab 6 and below.',
  },
  rows: {
    'BS-1': reference('Run from Tab 6 (the same rule).'),
    'BS-3': {
      mapping: 'exact',
      reason: 'Shut down (body) switches on no-words mode (pattern 16).',
      engine: {
        stage: 'capacity_fit',
        rules: [{ when: contains('body.signs', 'shut_down'), then: [set('mode.no_words')] }],
      },
    },
  },
};
