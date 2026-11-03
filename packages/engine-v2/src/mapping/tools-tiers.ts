import type { Condition, Effect } from '../format/types.js';
import { all, any, is, lights, mapped, not, rule, set, toolsOf } from './dsl.js';
import type { RowMapping, TabMapping } from './types.js';

// Tab 6d (free and Advanced tools), read for the engine (M3, E-50). The section A rows say which
// tools are Advanced and which are the safety floor, as rules (E-49: the tier is the row's rule,
// so an ENT-9 tier change is a rule edit). ENT-1, ENT-3 and the Amber and Red card rows then limit
// the tiers on the card. Everything runs at the entitlement filter (Tab 8 step 10b), section A
// first, so the tiers are known when the limits apply.

const tier = (name: 'advanced' | 'floor', tools: readonly string[]): Effect =>
  set('tools.tier', { tier: name, tools });
const ref = (reason: string): RowMapping => ({ mapping: 'reference', reason });

/**
 * A section A row: its Advanced tools and its safety floor (every other tool of it is free), and
 * which Advanced tool is the fuller version of which free one, where the row names it so ("Advanced
 * Movement" for Move; E-62).
 */
function pathwayRow(m: {
  readonly advanced: readonly string[];
  readonly floor: readonly string[];
  readonly versions?: Readonly<Record<string, string>>;
  readonly reason: string;
}): RowMapping {
  const effects = [
    tier('advanced', m.advanced),
    ...(m.floor.length > 0 ? [tier('floor', m.floor)] : []),
    ...Object.entries(m.versions ?? {}).map(([tool, version]) =>
      set('tools.version', { tool, version }),
    ),
  ];
  return mapped({ stage: 'entitlements', rules: [rule(null, effects)], reason: m.reason });
}

const TIERS = 'Tool codes as in the catalogue (E-49).';

const PATHWAYS: NonNullable<TabMapping['rows']> = {
  Regulate: pathwayRow({
    advanced: toolsOf('regulate', ['breathe', 'ground', 'move', 'sounds', 'step_out', 'rest']),
    floor: ['breathe', 'ground', 'move', 'sounds', 'step_out', 'rest'],
    versions: { sounds: 'sounds_plus', move: 'movement_plus' },
    reason: `Every free Regulate tool is the floor. "Advanced Sounds" and "Advanced Movement" are the fuller versions of Sounds and Move (E-62). "Discreet public variants" and "tap-only mode" are ways the free tools run, not tools. ${TIERS}`,
  }),
  Express: pathwayRow({
    advanced: toolsOf('express', ['simplify_rewrite', 'comm_cards', 'help_templates']),
    floor: ['comm_cards', 'help_templates'],
    reason: `The floor is the cards and help templates ("no one is charged to say they need help"). Daily allowances are billing, not the engine. ${TIERS}`,
  }),
  Execute: pathwayRow({
    advanced: toolsOf('execute', [
      'task_list',
      'smallest_step',
      'breakdown',
      'pick_one',
      'focus_timer',
    ]),
    floor: ['smallest_step'],
    versions: { breakdown: 'full_breakdown' },
    reason: `The full breakdown is the fuller version of the basic breakdown (E-62). The floor is the smallest step; "the timeline cap always free" is Tab 4's step cap, a rule. ${TIERS}`,
  }),
  Dump: pathwayRow({
    advanced: toolsOf('dump', ['dump_text', 'dump_voice', 'dump_sort', 'dump_to_task']),
    floor: ['dump_text', 'dump_voice'],
    versions: { dump_voice: 'long_voice', dump_sort: 'ai_sort', dump_to_task: 'one_tap_convert' },
    reason: `Longer voice notes, AI sorting and one-tap convert are the fuller versions of voice capture, manual sorting and moving an item by hand (E-62). The floor is text and voice capture; the voice time allowance is billing. ${TIERS}`,
  }),
  Adapt: pathwayRow({
    advanced: toolsOf('adapt', ['adaptation_library', 'stop_points', 'rerun']),
    floor: ['adaptation_library', 'stop_points'],
    reason: `As written. ${TIERS}`,
  }),
  Reflect: pathwayRow({
    advanced: toolsOf('reflect', [
      'reflect_checkout',
      'gratitude_note',
      'end_of_day',
      'my_patterns',
    ]),
    floor: [],
    reason: `No floor: "Reflect is never needed in Amber or Red" (RF-1 keeps it out there); the gates apply in both tiers. ${TIERS}`,
  }),
  Connect: pathwayRow({
    advanced: [
      ...toolsOf('connect', ['trusted_contact', 'quick_message', 'async_message', 'groups']),
      'body_double_rooms',
    ],
    floor: ['trusted_contact', 'quick_message'],
    reason: `As written; the human body-double rooms are Execute's tool, shared, so Advanced here too. ${TIERS}`,
  }),
  'Meditate · Rituals · Prayer': pathwayRow({
    advanced: toolsOf('meditate', [
      'stillness',
      'settle_3',
      'settle_5',
      'gratitude_practice',
      'own_practice',
      'in_worship',
    ]),
    floor: ['settle_3', 'own_practice'],
    reason: `The floor is the short eyes-open settle and the user's own practices ("nobody pays to keep their own faith practice"). Eyes-open versions are a way tools run. ${TIERS}`,
  }),
};

const FEATURES: NonNullable<TabMapping['rows']> = {
  'Onboarding, check-in, experience, context, need, demand': ref('All free: no rule gates them.'),
  'Engine and Recommendation Card': ref(
    'Same rules for every user; "one labelled Advanced alternative in Green, Yellow or Blue" is the Green, Yellow and Blue rows (E-62) within ENT-3.',
  ),
  'Help/SOS, safety override, Support Plan': ref(
    'Always free (ENT-2); nothing in the engine charges.',
  ),
  'Feedback, re-check, Blue Recovery, basic personalisation': ref('Free; no rule gates them.'),
  'Progress (S33)': ref('A product screen, outside the engine.'),
  'Report & Sharing (S34)': ref('A product screen, outside the engine.'),
  'Accessibility settings, consent, export, delete': ref(
    'Always free (ENT-2); outside the engine.',
  ),
};

/** The plans that include Advanced tools: Plus (and its concession) and an institution licence. */
const ENTITLED: Condition = { fact: 'signals.plan', op: 'in', value: ['plus', 'institution'] };
/** ENT-3 "under strain", plus a dismissed Advanced alternative, which is remembered. */
const NO_UPSELL: Condition = any(
  lights('amber', 'red'),
  { fact: 'peak.negative', op: 'gte', value: { band: 'high' } },
  is('signals.safety_event_recently', true),
  is('signals.in_session', true),
  is('signals.advanced_dismissed', true),
);
const advancedAtMost = (max: number, slot?: string): Effect =>
  set('tier.limit', { tier: 'advanced', max, ...(slot ? { slot } : {}) });

const ENTITLEMENTS: NonNullable<TabMapping['rows']> = {
  'ENT-1': mapped({
    stage: 'entitlements',
    rules: [rule(not(ENTITLED), [advancedAtMost(0, 'primary')])],
    reason:
      '"Something the user can open with their plan": without Plus or an institution licence (or with no account) the primary is never Advanced. That every pathway has free tools for every light is the section A rows.',
  }),
  'ENT-2': ref(
    'Never paid: none of these is gated by any rule, and the engine runs the same for every plan.',
  ),
  'ENT-3': mapped({
    stage: 'entitlements',
    rules: [
      rule(all(not(ENTITLED), NO_UPSELL), [advancedAtMost(0)]),
      rule(all(not(ENTITLED), not(NO_UPSELL)), [advancedAtMost(1)]),
    ],
    reason:
      'Read as the upselling rule it is named for: it governs Advanced tools shown to a user whose plan lacks them (for a Plus user they are ordinary tools, and Amber and Red are the card rows below). Under strain (Amber, Red, a harder feeling at High+, a recent safety event, during a session) none; otherwise at most one, never primary (ENT-1). The app labels it "Advanced" and shows the upgrade only when tapped. A dismissed one stays dismissed. "During a session" and "recently" are not defined yet (IG-21).',
  }),
  'ENT-4': ref(
    "Holds by the Meditate row: the user's own practices are free and the floor; only the guided library is Advanced. Belief data is never read (MD-3).",
  ),
  'ENT-5': ref(
    "Structural: entitlements run after every gate, and tier limits only take away; no rule can unlock what a gate blocked (requirements can't be overruled).",
  ),
  'ENT-6': ref('Lapsed subscriptions keep data: records and billing (M5), not the engine.'),
  'ENT-7': ref(
    'An institution licence counts as a plan with Advanced (ENT-1); data access is records policy.',
  ),
  'ENT-8': ref('Pricing and purchase rules: billing, not the engine.'),
  'ENT-9': ref(
    "Tier changes are edits to the section A rows' rules; the approvals (PO, Safety Reviewer) are the rule-change workflow (E-20, TODO).",
  ),
};

const floorCard = (light: string, extra: readonly Effect[] = []): RowMapping =>
  mapped({
    stage: 'entitlements',
    rules: [
      rule(lights(light), [
        set('tier.require', { tier: 'floor', slot: 'primary' }),
        advancedAtMost(0),
        ...extra,
      ]),
    ],
    reason: `The primary is a safety-floor tool and no Advanced alternative, on every plan.${extra.length ? ' "Get support now" as the Red band row also requires.' : ''}`,
    mapping: 'exact',
  });

/**
 * A calm card (Green, Yellow, Blue): a plan that has Advanced tools gets the fuller version of a
 * suggested tool ("the best-fit tool the user's plan includes"); and, not under strain, one
 * Advanced tool is offered beside the suggestion ("Advanced alternative? Yes, at most one,
 * labelled"). ENT-1 and ENT-3 still bind: without the plan it is never the primary, never more
 * than one, never under strain. The Owner's reading, 3 Nov 2026 (E-62).
 */
const calmCard = (light: string, reason: string): RowMapping =>
  mapped({
    stage: 'entitlements',
    rules: [
      rule(all(lights(light), ENTITLED), [set('tools.upgrade', { tier: 'advanced' })]),
      rule(all(lights(light), not(NO_UPSELL)), [set('tier.offer', { tier: 'advanced' })]),
    ],
    reason: `${reason} The best fit is the fuller version where Tab 6d names one; the offered tool is one of a new kind first (E-62).`,
  });

const CARD: NonNullable<TabMapping['rows']> = {
  'Green (Available)': calmCard(
    'green',
    'ENT-1 (a primary the plan includes) and ENT-3 (one labelled Advanced alternative).',
  ),
  'Yellow (Conditional)': calmCard(
    'yellow',
    'ENT-1 and ENT-3; "only at Mild/Moderate" is ENT-3\'s High+ condition, which keeps the offer away.',
  ),
  'Blue (Recovery)': calmCard(
    'blue',
    'ENT-1 and ENT-3; the "gentle step" is the Blue rules (RC-2).',
  ),
  'Amber (Constrained)': floorCard('amber'),
  'Red (Very Constrained)': floorCard('red', [set('support.show')]),
};

const PLANS: NonNullable<TabMapping['rows']> = {
  Free: ref('The plan value "free" (also no account); prices are not the engine\'s.'),
  'NUCCESS Plus (individual)': ref('The plan value "plus"; prices are not the engine\'s.'),
  'Plus concession': ref('Same as Plus: the plan value "plus"; eligibility is billing.'),
  'Institution licence': ref('The plan value "institution"; the dashboard is outside the engine.'),
};

export const TOOLS_TIERS: TabMapping = {
  rows: { ...PATHWAYS, ...FEATURES, ...ENTITLEMENTS, ...CARD, ...PLANS },
};
