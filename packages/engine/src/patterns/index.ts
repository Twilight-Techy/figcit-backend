// Stage 7: match Tab 7 patterns in precedence order and return a plan.
import {
  action,
  calmTools,
  distressHigh,
  has,
  hasDemand,
  hasSupportPathway,
  high,
  isAmberOrRed,
  isRed,
  level,
  mildTrigger,
  needs,
  restless,
  strongTrigger,
  timeline,
  tool,
  trait,
  type Facts,
  type Plan,
  type StepSpec,
} from './facts.js';
import { PRACTICE_RULES, ROUTE_RULES, SENSATION_RULES } from './practice.js';
import { FAMILY_RULES, GUARD_RULES, SAFETY_RULES, type Rule } from './specific.js';

export type { Facts, Plan, StepSpec } from './facts.js';
export { meditateGuard, ruminationPlan } from './specific.js';

const support = action('support');
const regulateNow = (f: Facts, label?: string, minutes?: number): StepSpec =>
  tool('regulate', calmTools(f), label, minutes);
const dumpOrRegulate = (f: Facts, label?: string): StepSpec =>
  has(f, 'racing') || needs(f, 'clear_head')
    ? tool('dump', ['dump_text', 'dump_voice'], 'Brain dump')
    : regulateNow(f, label);

const notSureRule: Rule = {
  id: 27,
  when: (f) => !f.state.confirmed,
  plan: (f) => ({
    patterns: [27],
    primary: action('check_in_again', 'Quick body check'),
    alternatives: [
      regulateNow(f, 'A gentle reset'),
      action('check_in_again', 'Pick a state anyway'),
    ],
  }),
};

const intenseNegative = (f: Facts): boolean => f.exp.peakNegative >= high(f);
const anyNegative = (f: Facts): boolean =>
  [...f.exp.families.keys()].some((code) => f.cs.familyByCode.get(code)?.valence === 'negative');
const exploring = (f: Facts): boolean =>
  ['T3', 'T4', 'T5', 'T6'].includes(timeline(f) ?? '') &&
  f.demand.drivers.some((d) => d === 'exploration' || d === 'interest');

const DEMAND_RULES: readonly Rule[] = [
  {
    id: 13,
    when: (f) =>
      hasDemand(f) &&
      f.ctx.sensitivityCount >= f.cs.source.thresholds.cx1Flags &&
      !intenseNegative(f) &&
      (!anyNegative(f) || has(f, 'anticipatory')) &&
      (has(f, 'positive_activation') || has(f, 'anticipatory') || trait(f, 'focus')),
    plan: () => ({
      patterns: [13],
      primary: tool('adapt', ['adapt_environment'], 'Adapt'),
      queued: tool('execute', ['start_task']),
      alternatives: [action('skip_to_task', 'Start task anyway')],
    }),
  },
  {
    id: 15,
    when: (f) => hasDemand(f) && timeline(f) === 'T0' && (intenseNegative(f) || has(f, 'racing')),
    plan: (f) => ({
      patterns: [15],
      primary: has(f, 'racing')
        ? tool('dump', ['dump_voice', 'dump_text'], 'Quick dump', 1)
        : regulateNow(f, 'Shortest reset', 1),
      queued: tool('execute', ['smallest_step']),
      alternatives: [
        action('remind_later', 'I need more time', 15),
        ...(isRed(f) ? [support] : []),
      ],
      supportVisible: hasSupportPathway(f),
    }),
  },
];

function supportOnlyPlan(f: Facts): Plan {
  if (!(strongTrigger(f) || mildTrigger(f))) {
    return {
      patterns: [1],
      primary: action('open_home'),
      alternatives: [
        action('check_in_again'),
        tool('regulate', calmTools(f), 'Explore Regulate anyway'),
      ],
    };
  }
  const red = isRed(f);
  const id = red && distressHigh(f) ? 8 : 6;
  const sad = has(f, 'sadness') || has(f, 'loneliness');
  const primary = dumpOrRegulate(f, restless(f) ? 'Move for 2 minutes' : 'Try a short reset');
  const alternatives: StepSpec[] = [
    has(f, 'racing')
      ? regulateNow(f, 'Short reset instead')
      : tool('dump', ['dump_text', 'dump_voice'], 'Dump instead'),
    tool(
      'connect',
      ['quick_message', 'trusted_contact'],
      sad ? 'Talk to someone' : 'Message someone',
    ),
  ];
  if (red) alternatives.push(support);
  const gentle = !strongTrigger(f);
  return {
    patterns: [id],
    primary,
    alternatives,
    supportVisible: red || hasSupportPathway(f),
    ...(gentle ? { title: restless(f) ? moveTitle(f) : 'Want a quiet reset?' } : {}),
  };
}

/** Tab 0: "move gently" at low energy (E1M4.5 family), plain "move" with energy to spare (E3M1.4). */
const moveTitle = (f: Facts): string =>
  (f.state.cell?.energy ?? 1) >= 3
    ? 'Want to move for 2 minutes?'
    : 'Want to move gently for 2 minutes?';

const isRoutine = (f: Facts): boolean => f.demand.drivers.includes('routine');
/** Tab 0 E1M2.6: a mild feeling and a familiar, routine task stay on "start with the familiar bit". */
const redRoutineOnly = (f: Facts): boolean =>
  isRed(f) &&
  mildTrigger(f) &&
  !strongTrigger(f) &&
  !needs(f, 'rest') &&
  // Only a purely familiar task (every driver Routine); anything novel, imposed or multi-step
  // stays deferred (Tab 10).
  f.demand.drivers.length > 0 &&
  f.demand.drivers.every((d) => d === 'routine');
/** Mild (0–3) negative feelings in Amber/Red: Routine only, reset as the alternative (pattern 3). */
const mildOnlyStrained = (f: Facts): boolean =>
  isAmberOrRed(f) &&
  f.exp.peakNegative < f.cs.source.thresholds.moderate &&
  !restless(f) &&
  !needs(f, 'feel_calmer');
const openBand = (f: Facts): boolean =>
  f.band.final === 'available' || f.band.final === 'conditional';

// Band-driven patterns when there is a demand, in precedence order (Tab 7 patterns 2–7, 14, 15).
const DEMAND_FALLBACK: readonly Rule[] = [
  {
    // Red defers demand (Tab 10): care first; at T0 the reset is shortened, never skipped.
    id: 15,
    when: (f) => isRed(f) && timeline(f) === 'T0' && !intenseNegative(f),
    plan: (f) => ({
      patterns: [15],
      primary: regulateNow(f, 'Shortest reset', 1),
      queued: tool('execute', ['smallest_step']),
      alternatives: [action('remind_later', 'I need more time', 15)],
      supportVisible: true,
    }),
  },
  {
    id: 7,
    when: (f) =>
      isRed(f) &&
      !redRoutineOnly(f) &&
      ((intenseNegative(f) && !has(f, 'racing')) || !strongTrigger(f)),
    plan: (f) => ({
      patterns: [7],
      primary: regulateNow(f, 'Regulate now'),
      alternatives: [support, tool('dump', ['dump_text'], 'Dump instead')],
      supportVisible: true,
    }),
  },
  {
    id: 5,
    when: (f) => strongTrigger(f),
    plan: (f) => ({
      patterns: [5],
      primary: dumpOrRegulate(f, 'Try a short reset'),
      queued: tool('execute', ['breakdown', 'smallest_step']),
      alternatives: [
        action('try_anyway', "I'll try the task anyway"),
        ...(isRed(f) ? [support] : []),
      ],
      supportVisible: hasSupportPathway(f),
    }),
  },
  {
    id: 4,
    when: (f) => mildTrigger(f) && !mildOnlyStrained(f),
    plan: (f) => ({
      patterns: [4],
      primary: regulateNow(f, restless(f) ? 'Move for 2 minutes' : 'Short reset', 2),
      queued: tool('execute', ['start_task']),
      alternatives: [action('skip_to_task')],
      ...(restless(f) ? { title: 'Want to move for 2 minutes first?' } : {}),
    }),
  },
  {
    id: 14,
    when: (f) => exploring(f) && openBand(f),
    plan: () => ({
      patterns: [14],
      primary: tool('execute', ['focus_timer', 'start_task'], 'Explore', 10),
      alternatives: [action('save_for_later')],
    }),
  },
  {
    id: 2,
    when: (f) => f.band.final === 'available' || (f.band.final === 'conditional' && !isRoutine(f)),
    plan: () => ({
      patterns: [2],
      primary: tool('execute', ['start_task']),
      alternatives: [tool('execute', ['breakdown'], 'Break it down first')],
    }),
  },
];

function demandPlan(f: Facts): Plan {
  for (const rule of DEMAND_FALLBACK) if (rule.when(f)) return rule.plan(f);
  return {
    patterns: [3],
    primary: tool('execute', ['smallest_step', 'start_task'], 'Start small'),
    alternatives: [regulateNow(f, 'Add a short reset first')],
  };
}

const ORDER: readonly (readonly Rule[])[] = [
  SAFETY_RULES,
  GUARD_RULES,
  FAMILY_RULES,
  SENSATION_RULES,
  ROUTE_RULES,
  PRACTICE_RULES,
  DEMAND_RULES,
];

/** Runs the rules in order; falls back to the band-driven patterns 1–8 and 27. */
export function matchPattern(f: Facts): Plan {
  for (const group of ORDER) {
    for (const rule of group) {
      if (rule.when(f)) return rule.plan(f);
    }
    // The Not sure prompt comes straight after the safety and guard rules.
    if (group === GUARD_RULES && notSureRule.when(f) && !hasSpecificTrigger(f))
      return notSureRule.plan(f);
  }
  return hasDemand(f) ? demandPlan(f) : supportOnlyPlan(f);
}

/** A named family or need that should lead even when the state is unconfirmed. */
function hasSpecificTrigger(f: Facts): boolean {
  return level(f, 'grief') >= 0 || f.needs.needs.some((n) => n.pattern !== undefined);
}
