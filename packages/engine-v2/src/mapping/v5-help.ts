import type { Condition, Effect, EngineRule } from '../format/types.js';
import type { RowMapping, TabMapping } from './types.js';
import {
  all,
  among,
  any,
  eq,
  hasTask,
  is,
  light,
  noTask,
  not,
  propose,
  need,
  set,
  CALM_LIGHTS,
  type Step,
} from './v5-terms.js';

// Rules Engine v5.0: the Help menu (Tab 7), the Reflect and Meditate gates (Tab 12), the card
// rules SEQ-1, SEQ-2 and P42 (Tab 11), and the safety rows of Tab 6 that v3.3 already ran.
// A picked support card sets the pathway unless a gate blocks it; then the card says why in one
// line (SEQ-2). Checked in test/v5-help.test.ts (Tab 21 T-02, T-08, T-18, T-25).

const ref = (reason: string): RowMapping => ({ mapping: 'reference', reason });
const rules = (
  reason: string,
  list: readonly EngineRule[],
  {
    mapping = 'interpreted',
    layer,
  }: { mapping?: 'exact' | 'interpreted'; layer?: 'safety' | 'guard' | 'band' } = {},
): RowMapping => ({
  mapping,
  reason,
  engine: { stage: 'orchestration', ...(layer ? { layer } : {}), rules: [...list] },
});
const pattern = (n: string): Effect => set('pattern.set', { pattern: n });

/** RF-1, Tab 7: a difficult feeling at Strong or above (peak intensity, 7-10). */
const peakStrong: Condition = { fact: 'peak.negative', op: 'gte', value: { band: 'strong' } };
/** MD-1 (b): "no difficult feeling at Moderate+". */
const peakModerate: Condition = { fact: 'peak.negative', op: 'gte', value: { band: 'moderate' } };
/** MD-2: shutdown (no-words mode), meditation makes them feel worse, or an overload sense. */
const meditationGuard: Condition = any(
  is('mode.no_words', true),
  is('prefs.meditation_worse', true),
  {
    fact: 'sensitivity.flags',
    op: 'contains_any',
    value: [
      'too_loud',
      'too_bright',
      'too_busy_or_crowded',
      'clothes_or_touch_bothering_me',
      'smells',
    ],
  },
);

/** RF-1 as Tab 7 reads it for 'Help me make sense of things': Amber, Red, or a strong feeling. */
const reflectBlocked: Condition = any(light('amber', 'red'), peakStrong);

/** Meditate's guided tools: never the lead under MD-1 or MD-2; the user's own practice may be. */
const GUIDED = ['med_still', 'med_settle', 'med_gratitude', 'med_walk', 'med_bodyscan'];
const noGuidedLead: Effect[] = GUIDED.map((tool) =>
  set('forbid', { slot: 'primary', target: { tool } }),
);

/** When each card is not shown (Tab 7 "Shown in"; RF-1; MD-1, MD-2). */
const HIDDEN: Readonly<Record<string, Condition | null>> = {
  hc_1: null,
  hc_2: null,
  hc_3: light('red'),
  // Amber is "one small routine step": shown, and the task is cut to one small step (TK-3).
  hc_4: light('red'),
  // In Red, message cards stay inside Get support now.
  hc_5: light('red'),
  hc_6: reflectBlocked,
  hc_7: any(light('red'), all(light('amber'), peakModerate), meditationGuard),
  hc_8: null,
};

/** Each card's route when picked: the pathway, and the pattern whose headline it takes (Tab 11). */
const CARDS: Readonly<Record<string, { pathway: string; pattern: string | null }>> = {
  hc_1: { pathway: 'regulate', pattern: '48' },
  hc_2: { pathway: 'dump', pattern: '47' },
  hc_3: { pathway: 'adapt', pattern: '13' },
  hc_4: { pathway: 'execute', pattern: null },
  hc_5: { pathway: 'express', pattern: '9' },
  hc_6: { pathway: 'reflect', pattern: '32' },
  hc_7: { pathway: 'meditate', pattern: '38' },
  hc_8: { pathway: 'connect', pattern: '11' },
};

/** 'More needs': the card each is shown with, and its first and second steps (Tab 7 Route). */
const MORE: Readonly<Record<string, { like: string; steps: readonly Step[] }>> = {
  rest_without_guilt: { like: 'hc_1', steps: ['reg_rest'] },
  get_started: { like: 'hc_4', steps: ['exe_step'] },
  break_it_into_steps: { like: 'hc_4', steps: ['exe_break'] },
  decide_what_matters_now: { like: 'hc_2', steps: ['dmp_capture', 'exe_pick'] },
  stop_or_switch: { like: 'hc_3', steps: ['adp_order', 'exe_step'] },
  ask_for_help_or_an_adjustment: { like: 'hc_5', steps: ['exp_ask', 'con_contact'] },
  prepare_for_an_event: { like: 'hc_3', steps: ['adp_how', 'exe_step'] },
  recover_after_an_event: { like: 'hc_1', steps: ['reg_rest', 'rfl_today'] },
  learn_what_works_for_me: { like: 'hc_6', steps: ['rfl_helped'] },
  prepare_to_speak_up_for_myself: { like: 'hc_6', steps: ['rfl_ask', 'exp_ask'] },
  find_stillness: { like: 'hc_7', steps: ['med_still', 'med_gratitude'] },
  // "Own practice any time the user starts it" (Tab 7 HC-7; ENT-4): never hidden.
  pray_or_do_my_practice: { like: 'hc_1', steps: ['med_own', 'adp_space'] },
  start_or_end_my_day_well: { like: 'hc_7', steps: ['med_own', 'rfl_close'] },
  feel_connected_to_something_bigger: { like: 'hc_7', steps: ['med_gratitude', 'con_contact'] },
};

const picked = (card: string): Condition => eq('help.card', card);
const pickedAny = (cards: readonly string[]): Condition => among('help.card', cards);
const cardsLike = (hc: string): string[] => [
  hc,
  ...Object.entries(MORE)
    .filter(([, m]) => m.like === hc)
    .map(([code]) => code),
];

/** SEQ-1: Green, Yellow or Blue without a difficult feeling at Strong+: ask "Which first?". */
const askWhichFirst: Condition = all(light(...CALM_LIGHTS), not(peakStrong), hasTask);

/** The rules of one support card: hidden, picked when shown, and picked when blocked (SEQ-2). */
function cardRules(hc: string): EngineRule[] {
  const hidden = HIDDEN[hc] ?? null;
  const shown = hidden ? not(hidden) : null;
  const { pathway, pattern: n } = CARDS[hc] ?? { pathway: '', pattern: null };
  const target: Step = hc === 'hc_4' ? '@start_task' : `~${pathway}`;
  const list: EngineRule[] = [];
  if (hidden)
    list.push({ when: hidden, then: cardsLike(hc).map((card) => set('menu.hide', { card })) });
  const whenShown = (c: Condition | null): Condition =>
    all(picked(hc), ...(shown ? [shown] : []), ...(c ? [c] : []));
  // SEQ-2: the card sets the pathway; in Green, Yellow or Blue its pattern gives the headline.
  if (hc === 'hc_4') {
    list.push(
      { when: whenShown(hasTask), then: [need('primary', '@start_task')] },
      { when: whenShown(noTask), then: [need('primary', '@plan_something'), pattern('46')] },
    );
  } else {
    list.push({ when: whenShown(null), then: [need('primary', target)] });
    if (n) list.push({ when: whenShown(all(light(...CALM_LIGHTS), noTask)), then: [pattern(n)] });
    // SEQ-1, pattern 43: "Which would you like first?" [the support card] [the task].
    list.push({
      when: whenShown(askWhichFirst),
      then: [
        pattern('43'),
        propose('alternative', '@start_task'),
        set('alternatives.limit', { max: 1 }),
      ],
    });
  }
  if (hidden)
    list.push({
      when: all(picked(hc), hidden),
      then: [set('help.swap', { card: hc, copy: `help.swap.${hc}` })],
    });
  return list;
}

/** The safe swaps of a blocked card: the rumination guard (40) and the meditation guard (41). */
const GUARDS: Readonly<Record<string, readonly EngineRule[]>> = {
  hc_6: [
    {
      when: all(pickedAny(cardsLike('hc_6')), reflectBlocked),
      then: [pattern('40'), need('primary', 'dmp_capture'), propose('alternative', 'reg_breathe')],
    },
  ],
  hc_7: [
    {
      when: all(pickedAny(cardsLike('hc_7')), meditationGuard, is('mode.no_words', false)),
      then: [pattern('41'), need('primary', 'reg_ground')],
    },
    // MD-1 (c): Amber with distress: Regulate first, the user's own practice beside it.
    {
      when: all(pickedAny(cardsLike('hc_7')), light('amber'), peakModerate, not(meditationGuard)),
      then: [need('primary', '~regulate'), propose('alternative', 'med_own')],
    },
  ],
};

/** 'More needs': its steps lead, unless its card is blocked here. */
const moreRules = (code: string, m: (typeof MORE)[string]): EngineRule[] => {
  const hidden = HIDDEN[m.like] ?? null;
  const when = hidden ? all(picked(code), not(hidden)) : picked(code);
  const [first, second] = m.steps;
  return first
    ? [
        {
          when,
          then: [need('primary', first), ...(second ? [propose('alternative', second)] : [])],
        },
        ...(hidden
          ? [
              {
                when: all(picked(code), hidden),
                then: [set('help.swap', { card: code, copy: `help.swap.${m.like}` })],
              },
            ]
          : []),
      ]
    : [];
};

/** 'More needs' rows by their label (the code is the label's slug). */
const MORE_LABELS: Readonly<Record<string, string>> = {
  rest_without_guilt: 'Rest without guilt',
  get_started: 'Get started',
  break_it_into_steps: 'Break it into steps',
  decide_what_matters_now: 'Decide what matters now',
  stop_or_switch: 'Stop or switch',
  ask_for_help_or_an_adjustment: 'Ask for help or an adjustment',
  prepare_for_an_event: 'Prepare for an event',
  recover_after_an_event: 'Recover after an event',
  learn_what_works_for_me: 'Learn what works for me',
  prepare_to_speak_up_for_myself: 'Prepare to speak up for myself',
  find_stillness: 'Find stillness',
  pray_or_do_my_practice: 'Pray or do my practice',
  start_or_end_my_day_well: 'Start or end my day well',
  feel_connected_to_something_bigger: 'Feel connected to something bigger',
};

/**
 * The menu's order, on HC-1's row: Tab 7's Red menu, and ME-4's Life right now order (Tab 15's
 * rows are reference rows; only 'Losing someone' is given an order there).
 */
const MENU_ORDER: readonly EngineRule[] = [
  // Red: Help me calm down, Too much in my head, I want to talk to someone (then Get support now).
  { when: light('red'), then: [set('menu.first', { cards: ['hc_1', 'hc_2', 'hc_8'] })] },
  {
    when: { fact: 'life.now', op: 'contains', value: 'losing_someone' },
    then: [set('menu.first', { cards: ['hc_6', 'hc_8', 'hc_7'] })],
  },
];

export const HELP_MENU: TabMapping = {
  rows: {
    ...Object.fromEntries(
      Object.keys(CARDS).map((hc): [string, RowMapping] => [
        hc.replace('hc_', 'HC-'),
        rules(
          "Its 'Shown in' as the lights (and gates) it is hidden in; picked, it sets the pathway (SEQ-2), with its pattern's headline in Green, Yellow or Blue; with a task there, 'Which first?' (SEQ-1, 43).",
          [...cardRules(hc), ...(GUARDS[hc] ?? []), ...(hc === 'hc_1' ? MENU_ORDER : [])],
          { layer: 'band' },
        ),
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(MORE).map(([code, m]): [string, RowMapping] => [
        MORE_LABELS[code] ?? code,
        rules(
          `Its route (Tab 7), shown and blocked with ${m.like.replace('hc_', 'HC-')}${code === 'pray_or_do_my_practice' ? ' (never: the own practice any time, ENT-4)' : ''}.`,
          moreRules(code, m),
          { layer: 'band' },
        ),
      ]),
    ),
    // On the safety layer, like SF-1: a row with no layer ranks below every other, so the band's
    // default pattern (53) won over this one and the card got the generic headline.
    'I need help now': rules(
      'The safety override (pattern 28): Help/SOS, nothing else.',
      [
        {
          when: picked('i_need_help_now'),
          then: [set('stop'), set('support.show'), pattern('28')],
        },
      ],
      { layer: 'safety' },
    ),
  },
};

/** Tab 12: Reflect and Meditate gates for any card, picked or not. */
export const GATES: TabMapping = {
  rows: {
    'RF-1': {
      mapping: 'interpreted',
      reason:
        "No Reflect in Amber or Red. The peak-intensity clause hides 'Help me make sense of things' (Tab 7); on the card FE-5 and Tab 18 keep 'What went well' for a strong 'Not good enough' in Yellow, so it is not applied there.",
      engine: {
        stage: 'orchestration',
        layer: 'guard',
        rules: [
          {
            when: light('amber', 'red'),
            then: [set('forbid', { target: { pathway: 'reflect' } })],
          },
        ],
      },
    },
    'RF-2': {
      mapping: 'interpreted',
      reason:
        'Blocked when the re-check after Reflect is worse. "That topic for 7 days" and "3+ times in 7 days" need reflection topics, which the app does not keep yet (as v3.3, ADR 0007).',
      engine: {
        stage: 'orchestration',
        layer: 'guard',
        rules: [
          {
            when: all(is('recheck.present', true), eq('recheck.previous_pathway', 'reflect'), {
              fact: 'recheck.intensity_change',
              op: 'gt',
              value: 0,
            }),
            then: [set('forbid', { target: { pathway: 'reflect' } })],
          },
        ],
      },
    },
    'RF-3': ref('How a Reflect session runs: the tool, not the engine.'),
    'RF-4': ref('Saved reflections are private and deletable: the records.'),
    'RF-5': ref('Free text passes the safety check (SF-1): the API before the engine.'),
    'MD-1': {
      mapping: 'interpreted',
      reason:
        "Guided Meditate never leads in Red, nor in Amber with a difficult feeling at Moderate or above (then Regulate first, the own practice beside it: the Help menu row). The user's own practice may, when they start it (Tab 7).",
      engine: {
        stage: 'orchestration',
        layer: 'guard',
        rules: [
          {
            when: any(light('red'), all(light('amber'), peakModerate)),
            then: noGuidedLead,
          },
        ],
      },
    },
    'MD-2': {
      mapping: 'interpreted',
      reason:
        "Shutdown (no-words mode), 'meditation makes me feel worse' or an overload sense (v5.0 has no overload level): no body scan, guided Meditate never leads (pattern 41).",
      engine: {
        stage: 'orchestration',
        layer: 'guard',
        rules: [
          {
            when: meditationGuard,
            then: [...noGuidedLead, set('tools.exclude', { tools: ['med_bodyscan'] })],
          },
        ],
      },
    },
    'MD-3': ref(
      'Content comes from My Practices or the neutral library; profile fields never select it.',
    ),
    'MD-4': {
      mapping: 'interpreted',
      reason: 'Away from home: silent, eyes open, headphones, 3 minutes or less.',
      engine: {
        stage: 'orchestration',
        rules: [
          {
            when: { fact: 'context.setting', op: 'not_in', value: ['home'] },
            then: [
              set('practice.limit', {
                modes: ['eyes_open', 'silent', 'headphones'],
                max_minutes: 3,
              }),
            ],
          },
        ],
      },
    },
    'MD-5': ref('Reminders respect quiet hours, no streaks: the reminder job.'),
    'MD-6': ref(
      'Get support now is never hidden: no rule can forbid it (the support rows show it).',
    ),
  },
};

/** Tab 11's card rules. */
export const CARD_RULES: TabMapping = {
  rows: {
    'LBL-1': ref("Each tool button carries Tab 17's user_label and user_description (the card)."),
    'RT-1': ref('The reason (cardWordsV5, from the copy table).'),
    'RT-2': ref('The reason (cardWordsV5, from the copy table).'),
    'RT-3': ref('The reason (cardWordsV5, from the copy table).'),
    'RT-4': ref('The reason (cardWordsV5, from the copy table).'),
    'P1-A': ref(
      "Pattern 1's card is pattern 53 in v5.0: Tab 18 and T-30 give a Green check-in with no task 53, with Plan something beside the suggestion when no emotion is picked. T-01 still describes pattern 1.",
    ),
    'ALT-1': ref(
      "Alternatives fit the light: v5.0's routes (Tab 2) never offer Regulate as a Green extra, and ENT-11 limits paid tools.",
    ),
    'SEQ-1': ref(
      'Run on the Help menu rows (Tab 7): pattern 43 in Green, Yellow and Blue; support first otherwise.',
    ),
    'SEQ-2': ref(
      'Run on the Help menu rows (Tab 7): the card sets the pathway, a blocked one says why.',
    ),
    P42: rules(
      "Quick check-in (CTX-U): discreet tools first, as away from home, and the link 'Not at home? Tell us where you are'.",
      [
        {
          when: eq('checkin.mode', 'quick'),
          then: [
            set('tools.swap', { from: 'reg_breathe', to: { tool: 'reg_breathe_discreet' } }),
            set('tools.swap', { from: 'dmp_capture', to: { tool: 'dmp_capture_text' } }),
            set('tools.swap', { from: 'reg_rest', to: { tool: 'reg_rest_pause' } }),
            set('copy.use', { slot: 'visible', key: 'card.p42.link' }),
          ],
        },
      ],
    ),
    P43: ref('Run on the Help menu rows (Tab 7, SEQ-1).'),
    P44: ref(
      'Help from the Life right now line opens Help/SOS (SF-3): the app; nothing is stored.',
    ),
    P45: ref('Retired in v5.0 (DV-R).'),
  },
};
