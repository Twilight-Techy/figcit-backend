import type { Condition, Effect } from '../format/types.js';
import { toolCode } from '../format/seed-v5.js';
import type { RowMapping, TabMapping } from './types.js';
import { all, among, any, is, light, not, set, strong, unpleasant } from './v5-terms.js';

// Rules Engine v5.0: plans (Tab 9) and each tool's plan (Tab 17's Plan column). A tool's tier is
// its row's rule, so moving a tool between plans is a rule edit (ENT-9). The entitlement rules
// then keep the card within the user's plan (ENT-1) and never upsell under strain (ENT-3, ENT-11).
// Checked in test/v5-plans.test.ts (Tab 21 T-19, T-20).

const ref = (reason: string): RowMapping => ({ mapping: 'reference', reason });
const rule = (
  when: Condition | null,
  then: readonly Effect[],
  reason: string,
  mapping: 'exact' | 'interpreted' = 'exact',
): RowMapping => ({
  mapping,
  reason,
  engine: { stage: 'entitlements', rules: [{ when, then: [...then] }] },
});
const tier = (name: string, tools: readonly string[]): Effect =>
  set('tools.tier', { tier: name, tools });

/** Tab 17's Plan column, for the tools that are not free ("Free (limited) / Prime" is free). */
export const TOOL_PLANS: Readonly<Record<string, 'prime' | 'premium'>> = {
  'REG-SOUNDS+': 'prime',
  'REG-MOVE+': 'prime',
  'REG-SLEEP': 'premium',
  'DMP-SUGGEST': 'prime',
  'EXP-TONE': 'prime',
  // The owner's call (18 Nov 2026): Draft it for me is free; Make it simpler is Prime.
  'EXP-SIMPLIFY': 'prime',
  'EXP-SCRIPT': 'premium',
  'EXE-REMIND': 'prime',
  'EXE-BODYDOUBLE': 'prime',
  'EXE-CAL': 'premium',
  'ADP-PASSPORT': 'premium',
  'RFL-HELPED': 'prime',
  'RFL-ASK': 'premium',
  'CON-BUDDY': 'prime',
  'MED-WALK': 'prime',
  'MED-BODYSCAN': 'premium',
  'REG-DANCE-S': 'prime',
  'REG-WIND': 'prime',
  'REG-BODY': 'premium',
  // "Prime (with patterns: Premium)": the request itself is Prime.
  'EXP-ASK': 'prime',
  'EXP-APPT': 'prime',
  'RTW-FIT': 'premium',
};

/**
 * Each paid tool's free version, which leads on a plan without it (ENT-1, T-20): the free tool of
 * the same pathway that does the nearest thing. Read from the labels, for the founder to confirm.
 */
export const FREE_VERSIONS: Readonly<Record<string, string>> = {
  'REG-SOUNDS+': 'reg_sounds',
  'REG-MOVE+': 'reg_move',
  'REG-SLEEP': 'reg_rest',
  'REG-DANCE-S': 'reg_dance',
  'REG-WIND': 'reg_rest',
  'REG-BODY': 'reg_move',
  'DMP-SUGGEST': 'dmp_sort',
  'EXP-TONE': 'exp_write',
  'EXP-SIMPLIFY': 'exp_write',
  'EXP-SCRIPT': 'exp_write',
  'EXP-ASK': 'exp_write',
  'EXP-APPT': 'exp_write',
  'EXE-REMIND': 'exe_step',
  'EXE-BODYDOUBLE': 'exe_focus',
  'EXE-CAL': 'exe_step',
  'ADP-PASSPORT': 'adp_how',
  'RFL-HELPED': 'rfl_today',
  'RFL-ASK': 'rfl_today',
  'CON-BUDDY': 'con_contact',
  'MED-WALK': 'med_settle',
  'MED-BODYSCAN': 'med_settle',
  'RTW-FIT': 'rtw_load',
};

/** Tab 17's rows: a paid tool is of its tier and of `paid` (either plan); a free one of neither. */
export const LABELS: TabMapping = {
  rows: Object.fromEntries(
    Object.entries(TOOL_PLANS).map(([id, plan]): [string, RowMapping] => [
      id,
      rule(
        null,
        [
          tier(plan, [toolCode(id)]),
          tier('paid', [toolCode(id)]),
          ...(FREE_VERSIONS[id]
            ? [set('tools.fallback', { tool: toolCode(id), free: FREE_VERSIONS[id] })]
            : []),
        ],
        `Plan: ${plan === 'prime' ? 'Prime' : 'Premium'} (Tab 17). Its free version (${FREE_VERSIONS[id] ?? 'none'}) leads on a plan without it.`,
        'interpreted',
      ),
    ]),
  ),
  all: ref('Free on every plan (Tab 17 Plan: Free), or a label or copy row; the app shows it.'),
};

/** Tab 9's safety floor: the free tools that work in every light (ENT-1), with their variants. */
const FLOORS: Readonly<Record<string, readonly string[]>> = {
  Regulate: [
    'reg_breathe',
    'reg_ground',
    'reg_move',
    'reg_sounds',
    'reg_stepout',
    'reg_rest',
    'reg_tap',
    'reg_comfort',
    'reg_breathe_discreet',
    'reg_breathe_silent',
    'reg_move_desk',
    'reg_move_walk',
    'reg_rest_pause',
  ],
  Dump: ['dmp_capture', 'dmp_capture_text'],
  Express: ['exp_cards'],
  Execute: ['exe_step'],
  Adapt: [
    'adp_space',
    'adp_smaller',
    'adp_how',
    'adp_pace',
    'adp_order',
    'adp_device',
    'adp_device_ear',
    'adp_device_sun',
    'adp_device_room',
    'adp_space_turn',
  ],
  Connect: ['con_contact', 'con_call'],
  'Meditate · Rituals · Prayer': ['med_settle', 'med_own'],
};

/** The plans that include every tool: Premium, an organisation seat (ENT-7, ENT-14), the pilot. */
const EVERYTHING = ['premium', 'organisation_seat', 'pilot'];
const onFree: Condition = not(among('signals.plan', ['prime', ...EVERYTHING]));
const onPrime: Condition = among('signals.plan', ['prime']);
/** ENT-3 "under strain": Amber, Red, a difficult feeling at High+, a safety event, a session. */
const STRAIN: Condition = any(
  light('amber', 'red'),
  all(unpleasant, strong),
  is('signals.safety_event_recently', true),
  is('signals.in_session', true),
);
const atMost = (name: string, max: number, slot?: string): Effect =>
  set('tier.limit', { tier: name, max, ...(slot ? { slot } : {}) });

const ENTITLEMENTS: Readonly<Record<string, RowMapping>> = {
  'ENT-1': {
    mapping: 'exact',
    reason:
      'The primary is always something the plan opens: Free never a paid tool, Prime never a Premium one. Every pathway has free tools (the floor rows).',
    engine: {
      stage: 'entitlements',
      rules: [
        { when: onFree, then: [atMost('paid', 0, 'primary')] },
        { when: onPrime, then: [atMost('premium', 0, 'primary')] },
      ],
    },
  },
  'ENT-2': ref('Never paid: no rule gates the check-in, the card, Help/SOS or the message cards.'),
  'ENT-3': {
    mapping: 'interpreted',
    reason:
      'No upselling under strain (Amber, Red, a difficult feeling at Strong or above, a recent safety event, during a session): no tool the plan lacks. "Recently" and "during a session" are what the app sends.',
    engine: {
      stage: 'entitlements',
      rules: [
        { when: all(onFree, STRAIN), then: [atMost('paid', 0)] },
        { when: all(onPrime, STRAIN), then: [atMost('premium', 0)] },
      ],
    },
  },
  'ENT-4': ref(
    "The user's own practice (MED-OWN) is free and in the floor; guided content is paid.",
  ),
  'ENT-5': ref('Entitlements run after every gate and only take tools away.'),
  'ENT-6': ref('A lapsed plan keeps its data: records and billing, not the engine.'),
  'ENT-7': ref('An organisation seat is a plan with everything (ENT-1).'),
  'ENT-8': ref('Pricing and checkout: billing, not the engine.'),
  'ENT-9': ref("Moving a tool between plans is an edit of its Tab 17 row's rule."),
  'ENT-10': ref('Prices are configuration (billing).'),
  'ENT-11': {
    mapping: 'exact',
    reason:
      'Not under strain (Green, Yellow at Mild or Moderate, Blue): at most one tool the plan lacks, never the primary (ENT-1); the app labels it Prime or Premium.',
    engine: {
      stage: 'entitlements',
      rules: [
        { when: all(onFree, not(STRAIN)), then: [atMost('paid', 1)] },
        { when: all(onPrime, not(STRAIN)), then: [atMost('premium', 1)] },
      ],
    },
  },
  'ENT-12': ref('Locked options in the check-in: the app (the option lists say each plan).'),
  'ENT-13': ref('The always-free options: the app and the option lists; no rule locks them.'),
  'ENT-14': ref('An organisation seat is a plan with everything (ENT-1).'),
};

export const PLANS: TabMapping = {
  rows: {
    ...Object.fromEntries(
      Object.entries(FLOORS).map(([pathway, tools]): [string, RowMapping] => [
        pathway,
        rule(
          null,
          [tier('floor', tools)],
          'The Safety floor column, as tool codes (Tab 17), with their quieter versions (Tab 19).',
          'interpreted',
        ),
      ]),
    ),
    Reflect: ref(
      'No floor tool: the rumination guard and safety screening (Tab 12) apply on every plan.',
    ),
    ...ENTITLEMENTS,
  },
  all: ref('What each plan includes or can select: billing and the app (the option lists).'),
};
