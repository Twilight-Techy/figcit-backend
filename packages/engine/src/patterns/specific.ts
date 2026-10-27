// Tab 7 patterns 9–41 that fire on a specific family, need, signal or demand trait.
// Order is precedence: the first rule that applies wins (DECISIONS B-07–B-09).
import {
  action,
  communicationDemand,
  has,
  hasDemand,
  hasSupportPathway,
  high,
  isAmberOrRed,
  isRed,
  level,
  needs,
  restless,
  timeline,
  tool,
  trait,
  type Facts,
  type Plan,
} from './facts.js';

export interface Rule {
  readonly id: number;
  readonly when: (f: Facts) => boolean;
  readonly plan: (f: Facts) => Plan;
}

const support = action('support');
const notSupport = (f: Facts): boolean => hasSupportPathway(f);

export const SAFETY_RULES: readonly Rule[] = [
  {
    id: 28,
    when: (f) => f.safety !== null || f.exp.riskOption !== undefined || needs(f, 'urgent_help'),
    plan: (f) => ({
      patterns: [28],
      primary: support,
      alternatives: f.signals.hasTrustedContact
        ? [tool('connect', ['trusted_contact'], 'Call my trusted contact')]
        : [],
      supportVisible: true,
    }),
  },
  {
    id: 30,
    when: (f) => (f.signals.declinesThisSession ?? 0) >= f.cs.source.thresholds.declinesBeforeQuiet,
    plan: () => ({
      patterns: [30],
      primary: action('open_home'),
      alternatives: [
        action('check_in_again', 'Check in later'),
        action('remind_later', 'Remind me tomorrow', 1440),
      ],
    }),
  },
];

const shutdownPlan = (f: Facts, ids: readonly number[]): Plan => ({
  patterns: ids,
  primary: tool('regulate', ['breathe', 'ground']),
  alternatives: [action('quiet_message'), ...(isRed(f) ? [support] : [])],
  supportVisible: notSupport(f),
});

const overloadPlan = (f: Facts, ids: readonly number[]): Plan => {
  const now = timeline(f) === 'T0';
  return {
    patterns: ids,
    primary: tool('regulate', ['step_out', 'sounds', 'breathe'], 'Find a quieter spot'),
    alternatives: [
      tool('adapt', ['adapt_environment'], 'Put headphones on'),
      ...(isRed(f) ? [support] : [action('try_anyway', 'Leave early')]),
    ],
    ...(now && hasDemand(f)
      ? {
          queued: tool('execute', ['smallest_step']),
          title: "Let's turn the volume down, then take one step",
        }
      : {}),
    supportVisible: notSupport(f),
  };
};

/** MD-2 contraindications for Meditate (pattern 41). */
export function meditateGuard(f: Facts): boolean {
  return (
    has(f, 'shutdown') ||
    f.exp.flags.has('shutdown') ||
    f.exp.flags.has('detached') ||
    f.exp.overloadIntensity >= high(f) ||
    f.signals.meditationMakesWorse === true
  );
}

const wantsMeditate = (f: Facts): boolean =>
  f.input.intent === 'meditate' || needs(f, 'find_stillness', 'pray_practice');

export const GUARD_RULES: readonly Rule[] = [
  {
    id: 16,
    when: (f) => has(f, 'shutdown') || f.exp.flags.has('shutdown'),
    plan: (f) => shutdownPlan(f, wantsMeditate(f) ? [41, 16] : [16]),
  },
  {
    id: 19,
    when: (f) => has(f, 'sensory_overload'),
    plan: (f) => overloadPlan(f, wantsMeditate(f) && meditateGuard(f) ? [19, 41] : [19]),
  },
  {
    id: 41,
    when: (f) => wantsMeditate(f) && meditateGuard(f),
    plan: (f) => ({ ...shutdownPlan(f, [41]), alternatives: isRed(f) ? [support] : [] }),
  },
  {
    id: 40,
    when: (f) => has(f, 'rumination'),
    plan: (f) => ruminationPlan(f),
  },
];

export function ruminationPlan(f: Facts): Plan {
  return {
    patterns: [40],
    primary: tool('dump', ['dump_text', 'dump_voice']),
    alternatives: [
      tool('regulate', ['breathe', 'ground'], 'Short reset'),
      tool('connect', ['quick_message', 'trusted_contact'], 'Talk to someone'),
    ],
    supportVisible: notSupport(f),
  };
}

export const FAMILY_RULES: readonly Rule[] = [
  {
    id: 18,
    // Overdue, or due now in a safety-critical setting (Tab 7 pattern 18).
    when: (f) =>
      has(f, 'shame') &&
      (timeline(f) === 'TX' || (timeline(f) === 'T0' && f.ctx.settingClass === 'clinical')),
    plan: (f: Facts): Plan => {
      const safetyCritical = timeline(f) === 'T0' || f.ctx.settingClass === 'clinical';
      return {
        patterns: [18],
        primary: tool(
          'express',
          safetyCritical ? ['script', 'help_templates'] : ['help_templates', 'rewrite'],
          safetyCritical ? 'Use the script' : 'Draft the message',
        ),
        queued: tool('execute', ['smallest_step']),
        alternatives: [tool('regulate', ['breathe', 'ground'], 'Short reset first')],
        supportVisible: notSupport(f),
        ...(safetyCritical ? { title: "Let's say it clearly and get it done" } : {}),
      };
    },
  },
  {
    id: 25,
    when: (f) => has(f, 'grief'),
    plan: (f: Facts): Plan => {
      const strong = level(f, 'grief') >= high(f);
      const lighten = hasDemand(f) && !strong;
      const own = f.signals.savedPractices?.find((p) => p.helpsWhenStruggling);
      return {
        patterns: own ? [25, 37] : [25],
        primary: lighten
          ? tool('adapt', ['adapt_scope', 'adapt_pace'], 'Adapt this')
          : tool('connect', ['quick_message', 'trusted_contact'], 'Reach out to someone'),
        alternatives: [
          lighten
            ? tool('connect', ['quick_message', 'trusted_contact'], 'Reach out')
            : tool('regulate', ['rest', 'breathe']),
          ...(own
            ? [
                {
                  type: 'action',
                  kind: 'own_practice',
                  label: own.name,
                  practiceId: own.id,
                } as const,
              ]
            : []),
          ...(strong ? [support] : []),
        ],
        supportVisible: strong || notSupport(f),
        ...(lighten ? { title: "Would it help to lighten today's load?" } : {}),
      };
    },
  },
  {
    id: 23,
    when: (f) =>
      has(f, 'social_hangover') ||
      needs(f, 'recover_event') ||
      (f.exp.flags.has('masking') && !hasDemand(f)),
    plan: () => ({
      patterns: [23],
      primary: tool('regulate', ['rest', 'sounds', 'breathe'], 'Quiet reset'),
      alternatives: [
        tool('meditate', ['stillness', 'settle_3'], 'Quiet stillness instead'),
        action('remind_later', 'Do it later', 60),
      ],
    }),
  },
  {
    id: 26,
    when: (f) => has(f, 'rejection'),
    plan: (f: Facts): Plan => {
      if (timeline(f) === 'T0') {
        return {
          patterns: [26],
          primary: tool('regulate', ['breathe', 'ground'], '60-second reset', 1),
          alternatives: [tool('express', ['comm_cards', 'rewrite'], 'Type it in the chat')],
          title:
            f.input.context?.environment === 'online_meeting'
              ? 'Take a breath — camera off for a minute is fine'
              : 'Take a breath — one minute is fine',
          supportVisible: notSupport(f),
        };
      }
      const reply = hasDemand(f) && (communicationDemand(f) || trait(f, 'with_others'));
      return {
        patterns: [26],
        primary: reply
          ? tool('express', ['draft', 'rewrite'], 'Draft')
          : tool('dump', ['dump_text', 'dump_voice']),
        alternatives: reply
          ? [
              tool('dump', ['dump_text'], 'Brain dump first'),
              tool('regulate', ['breathe'], 'Short reset first'),
            ]
          : [
              tool('express', ['draft', 'rewrite'], 'Draft a reply'),
              tool('connect', ['quick_message', 'trusted_contact'], 'Talk to someone'),
            ],
        supportVisible: notSupport(f),
        ...(reply ? { title: "Let's draft it — you choose if and when to send" } : {}),
      };
    },
  },
  {
    id: 17,
    when: (f) =>
      hasDemand(f) && (has(f, 'task_paralysis') || needs(f, 'get_started') || f.demand.puttingOff),
    plan: (f: Facts): Plan => {
      const exam = f.ctx.settingClass === 'exam';
      return {
        patterns: [17],
        primary: tool(
          'execute',
          ['ai_body_double', 'two_minute_start'],
          exam ? 'Write one line' : 'Start with me',
          2,
        ),
        alternatives: [
          tool('execute', ['breakdown_plus', 'breakdown'], 'Break it down more'),
          ...(isAmberOrRed(f)
            ? [tool('regulate', ['breathe', 'ground'], 'Short reset first')]
            : []),
        ],
        supportVisible: notSupport(f),
        ...(exam ? { title: "Let's just write one line" } : {}),
      };
    },
  },
  {
    id: 22,
    when: (f) =>
      hasDemand(f) && (has(f, 'confusion') || needs(f, 'decide_first') || f.demand.count >= 2),
    plan: (f) => ({
      patterns: [22],
      primary: tool('execute', ['pick_one'], 'Sort my list'),
      alternatives: [tool('dump', ['dump_text', 'dump_voice'], 'Dump it all first')],
      supportVisible: notSupport(f),
    }),
  },
  {
    id: 20,
    when: (f) => has(f, 'hyperfocus') || (needs(f, 'stop_switch') && !has(f, 'calm')),
    plan: () => ({
      patterns: [20],
      primary: tool('regulate', ['body_basics', 'rest'], 'Take a 5-minute break', 5),
      queued: tool('execute', ['start_task'], 'Pick it back up'),
      alternatives: [
        action('remind_later', 'Remind me in 20 minutes', 20),
        action('skip_to_task', 'Keep going'),
      ],
    }),
  },
  {
    id: 21,
    when: (f) => has(f, 'boredom') && hasDemand(f),
    plan: (f) => ({
      patterns: [21],
      primary:
        restless(f) && !f.ctx.excluded.has('move')
          ? tool('regulate', ['move'], 'Add a boost')
          : tool('adapt', ['adapt_format', 'adapt_environment'], 'Add a boost'),
      queued: tool('execute', ['start_task']),
      alternatives: [action('skip_to_task', 'Just start')],
    }),
  },
];
