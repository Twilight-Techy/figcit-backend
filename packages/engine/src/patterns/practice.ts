// Tab 7 patterns driven by sensations, needs, routes and practices (9–12, 24, 29, 32–39).
import {
  action,
  communicationDemand,
  has,
  hasDemand,
  hasSupportPathway,
  high,
  isRed,
  level,
  needs,
  practiceDue,
  restless,
  strongTrigger,
  timeline,
  tool,
  trait,
  type Facts,
  type Plan,
} from './facts.js';

import type { Rule } from './specific.js';

const support = action('support');
const notSupport = (f: Facts): boolean => hasSupportPathway(f);

export const SENSATION_RULES: readonly Rule[] = [
  {
    id: 24,
    // Sensation-led: pain leads when no stronger emotion does (Tab 2 "SENSATION-LED").
    when: (f) =>
      f.exp.flags.has('pain') &&
      f.exp.painIntensity >= f.exp.peakNegative &&
      (f.exp.painIntensity >= high(f) || f.exp.peakNegative < f.cs.source.thresholds.moderate),
    plan: (f: Facts): Plan => {
      const rest = f.exp.painIntensity >= high(f) || isRed(f) || !hasDemand(f);
      return {
        patterns: [24],
        primary: rest
          ? tool('regulate', ['rest', 'breathe'], 'Rest for 20 minutes', 20)
          : tool('execute', ['smallest_step'], 'Do the essential part'),
        alternatives: [
          tool('express', ['help_templates', 'rewrite'], 'Ask for an adjustment'),
          tool('adapt', ['adapt_pace', 'adapt_scope'], 'Lighten the load'),
        ],
        supportVisible: notSupport(f),
        ...(rest ? {} : { title: "Let's do the essential part, gently" }),
      };
    },
  },
  {
    id: 29,
    // Not when the task is to stop and sleep: then the tiredness is the point (pattern 39).
    when: (f) =>
      f.exp.flags.has('interoception_unmet') &&
      f.exp.peakNegative < high(f) &&
      !trait(f, 'stopping'),
    plan: () => ({
      patterns: [29],
      primary: tool('regulate', ['body_basics'], "I've sorted it"),
      queued: tool('execute', ['start_task'], 'Pick this back up'),
      alternatives: [
        action('remind_later', 'Remind me in 10 minutes', 10),
        action('skip_to_task', 'Skip'),
      ],
    }),
  },
];

export const ROUTE_RULES: readonly Rule[] = [
  {
    id: 12,
    when: (f) => has(f, 'misaligned') || needs(f, 'change_how'),
    plan: (f) => ({
      patterns:
        f.ctx.sensitivityCount >= f.cs.source.thresholds.cx1Flags &&
        hasDemand(f) &&
        has(f, 'anticipatory')
          ? [12, 13]
          : [12],
      primary: tool(
        'adapt',
        f.ctx.sensitivityCount > 0
          ? ['adapt_environment', 'adapt_format', 'adapt_pace']
          : ['adapt_format', 'adapt_pace', 'adapt_environment'],
        'Adapt this',
      ),
      ...(isRed(f) ? { queued: tool('regulate', ['breathe', 'ground'], 'Brief reset') } : {}),
      alternatives: hasDemand(f) ? [action('try_anyway', 'Keep as is')] : [],
      supportVisible: notSupport(f),
    }),
  },
  {
    id: 10,
    when: (f) => level(f, 'anger') >= high(f) && communicationDemand(f),
    plan: (f) => ({
      patterns: [10],
      primary: tool('express', ['draft', 'rewrite'], 'Draft'),
      alternatives: [
        tool(
          'regulate',
          restless(f) ? ['move', 'breathe'] : ['breathe', 'ground'],
          'Regulate first',
        ),
      ],
      supportVisible: notSupport(f),
      ...(timeline(f) === 'T0'
        ? { title: "Let's get one line down before you say it", button: 'Write one line' }
        : {}),
    }),
  },
  {
    id: 9,
    when: (f) => has(f, 'word_finding') || needs(f, 'find_words', 'ask_help'),
    plan: (f) => ({
      patterns: [9],
      primary: tool('express', ['draft', 'rewrite', 'help_templates'], 'Draft this'),
      alternatives: [
        tool('express', ['simplify'], 'Simplify instead'),
        ...(isRed(f) ? [tool('regulate', ['breathe'], 'Short reset first')] : []),
      ],
      supportVisible: notSupport(f),
    }),
  },
  {
    id: 11,
    when: (f) => (has(f, 'loneliness') && !hasDemand(f)) || needs(f, 'someone_to_talk'),
    plan: (f) => ({
      patterns: [11],
      primary: tool(
        'connect',
        ['quick_message', 'trusted_contact', 'my_groups'],
        level(f, 'loneliness') < 4 ? 'Message someone' : 'Connect',
      ),
      alternatives: [tool('regulate', ['breathe', 'ground'], 'Regulate instead')],
      supportVisible: notSupport(f),
    }),
  },
];

export const PRACTICE_RULES: readonly Rule[] = [
  {
    id: 35,
    when: (f) =>
      needs(f, 'speak_up') || (hasDemand(f) && trait(f, 'reflective_work', 'ask_adjustment')),
    plan: (f) => ({
      patterns: [35],
      primary: tool('reflect', ['self_advocacy', 'reflect_checkout'], 'Reflect, then draft'),
      queued: tool('express', ['draft', 'rewrite']),
      alternatives: [tool('express', ['draft', 'rewrite'], 'Draft straight away')],
      supportVisible: notSupport(f),
    }),
  },
  {
    id: 34,
    when: (f) =>
      (needs(f, 'learn_what_works') || f.signals.recurringStruggleConfirmed === true) &&
      f.signals.patternPromptsOff !== true &&
      // Tab 7 pattern 34: Green, Yellow or Blue only.
      (f.recovery || f.band.final === 'available' || f.band.final === 'conditional'),
    plan: () => ({
      patterns: [34],
      primary: tool(
        'reflect',
        ['pattern_review', 'what_helped', 'reflect_checkout'],
        'Look at my pattern',
      ),
      alternatives: [tool('adapt', ['adapt_environment', 'adapt_format'], 'Change the setting')],
    }),
  },
  {
    id: 33,
    when: (f) => has(f, 'relief'),
    plan: (f) => ({
      patterns: [33],
      primary: tool('reflect', ['what_helped', 'reflect_checkout'], 'Reflect'),
      alternatives: [tool('regulate', ['rest'], 'Just rest')],
      ...(f.state.cell && f.state.cell.energy <= 2
        ? { title: 'Rest first — want to note what helped later?' }
        : {}),
    }),
  },
  {
    id: 32,
    when: (f) => has(f, 'make_sense') || needs(f, 'make_sense'),
    plan: () => ({
      patterns: [32],
      primary: tool('reflect', ['reflect_checkout'], 'Reflect'),
      alternatives: [],
    }),
  },
  {
    id: 37,
    when: (f) =>
      has(f, 'spiritual') ||
      needs(f, 'pray_practice', 'feel_connected') ||
      practiceDue(f) !== undefined ||
      trait(f, 'recurring_practice'),
    plan: (f) => practicePlan(f),
  },
  {
    id: 39,
    when: (f) => needs(f, 'start_end_day') || (hasDemand(f) && trait(f, 'stopping', 'start_day')),
    plan: (f: Facts): Plan => {
      const closing = trait(f, 'stopping') || !trait(f, 'start_day');
      const saved = f.signals.savedPractices?.find((p) => (closing ? p.closing : p.opening));
      const label = closing ? 'Closing ritual' : 'Opening ritual';
      return {
        patterns: [39],
        primary: saved
          ? { type: 'action', kind: 'own_practice', label, practiceId: saved.id }
          : tool('meditate', ['stillness', 'settle_3'], label),
        alternatives: [
          closing
            ? action('open_home', 'Just sleep')
            : tool('execute', ['start_task'], 'Just get going'),
        ],
        ...(closing ? {} : { title: 'Want to start the day your way?' }),
        ...(closing && trait(f, 'stopping') ? { queued: undefined } : {}),
      };
    },
  },
  {
    id: 36,
    // With 2+ sensitivity flags the setting comes first (pattern 13).
    when: (f) =>
      has(f, 'anticipatory') &&
      level(f, 'anticipatory') < high(f) &&
      f.ctx.sensitivityCount < f.cs.source.thresholds.cx1Flags &&
      (!hasDemand(f) || ['T0', 'T1', 'T2'].includes(timeline(f) ?? '')),
    plan: (f: Facts): Plan => {
      const publicish = !f.ctx.privateSetting;
      const camera = f.input.context?.environment === 'online_meeting';
      return {
        patterns: [36],
        primary: tool(
          'meditate',
          publicish ? ['settle_3'] : ['settle_5', 'settle_3'],
          publicish ? 'Settle' : '5-minute settle',
          publicish ? 3 : 5,
        ),
        ...(hasDemand(f) ? { queued: tool('execute', ['smallest_step', 'start_task']) } : {}),
        alternatives: [tool('execute', ['start_task'], 'Just prepare')],
        ...(camera
          ? { title: 'Two quiet minutes, camera off, then your first point' }
          : publicish
            ? { title: 'Want a quiet 3-minute settle, then your notes?' }
            : hasDemand(f)
              ? { title: 'Want to settle in before you prepare?' }
              : {}),
      };
    },
  },
  {
    id: 38,
    when: (f) =>
      has(f, 'stillness') || has(f, 'gratitude') || needs(f, 'find_stillness', 'grateful'),
    plan: (f: Facts): Plan => {
      if (restless(f) && !f.ctx.excluded.has('move')) {
        return {
          patterns: [38],
          primary: tool('regulate', ['move'], 'Walk, then settle'),
          queued: tool('meditate', ['walking_practice', 'stillness']),
          alternatives: [tool('meditate', ['stillness'], 'Just be still')],
          title: 'Let some energy out, then settle as you walk?',
        };
      }
      const gratitude = has(f, 'gratitude') || needs(f, 'grateful');
      return {
        patterns: [38],
        primary: gratitude
          ? tool('meditate', ['gratitude_practice'], 'Gratitude practice')
          : tool('meditate', ['stillness', 'settle_3'], 'Start stillness'),
        alternatives: gratitude
          ? [tool('reflect', ['gratitude_note'], 'Note one good thing')]
          : [tool('meditate', ['gratitude_practice'], 'Gratitude practice instead')],
        ...(gratitude ? { title: 'Want to notice what was good today?' } : {}),
      };
    },
  },
];

function practicePlan(f: Facts): Plan {
  const due = practiceDue(f) ?? f.signals.savedPractices?.[0];
  const ownStep = due
    ? ({ type: 'action', kind: 'own_practice', label: due.name, practiceId: due.id } as const)
    : tool('meditate', ['own_practice', 'stillness'], 'My practice');
  const distressed =
    isRed(f) ||
    (f.band.final === 'constrained' && f.exp.peakNegative >= f.cs.source.thresholds.moderate);
  if (distressed) {
    return {
      patterns: [37],
      primary: tool('regulate', ['breathe', 'ground'], 'Breathe'),
      alternatives: [ownStep, ...(isRed(f) ? [support] : [])],
      title: "Let's settle your body first",
      supportVisible: notSupport(f),
    };
  }
  const placeOk = f.ctx.privateSetting || f.ctx.settingClass === 'prayer_room';
  return {
    patterns: [37],
    primary: ownStep,
    alternatives: [
      ...(placeOk ? [] : [tool('adapt', ['adapt_environment'], 'Find a quiet space')]),
      action('remind_later', 'Remind me in 15 minutes', 15),
      ...(has(f, 'spiritual') && !due ? [tool('connect', ['my_groups'], 'My community')] : []),
    ],
    title: due ? `It's time for your ${due.name}` : 'Want some time with what matters to you?',
  };
}

export function strongSupport(f: Facts): boolean {
  return strongTrigger(f);
}
