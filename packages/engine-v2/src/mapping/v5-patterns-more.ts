import type { RowMapping } from './types.js';
import { all, is, light, need, propose, set, CALM_LIGHTS, unguarded } from './v5-terms.js';

// Rules Engine v5.0: Tab 11's patterns that v5.0's own cards (Tabs 18-20) don't reach. Three run
// on signals the app already sends (30, 34, 37); the Help menu rows set 9, 11, 13, 28, 32, 38, 40,
// 41, 43, 46 and 47; the rest describe moments v5.0's check-in doesn't ask about, so they are
// kept as wording (their headlines are in the copy table) and run nothing.

const ref = (reason: string): RowMapping => ({ mapping: 'reference', reason });
const HELP = (card: string): RowMapping =>
  ref(`Set by the Help menu row ${card} (Tab 7): its headline when that card leads.`);
const NOT_ASKED = (what: string): RowMapping =>
  ref(
    `v5.0's check-in doesn't ask about ${what}, so no input reaches it; Tab 2's routes decide the card. Kept for its wording.`,
  );

export const MORE_PATTERNS: Readonly<Record<string, RowMapping>> = {
  '1': ref(
    'P1-A: in v5.0 this card is pattern 53 (Tab 18; T-30), with Plan something beside the suggestion when no emotion is picked.',
  ),
  '3': NOT_ASKED('whether a task is familiar'),
  '9': HELP('HC-5'),
  '10': NOT_ASKED('a message to send'),
  '11': HELP('HC-8'),
  '12': ref(
    "'This way isn't working' is the app's re-run of the card (Adapt), not a check-in answer.",
  ),
  '13': HELP('HC-3'),
  '14': NOT_ASKED('an exploring task without urgency (the Try out chip sorts by TK-2)'),
  '15': NOT_ASKED("a task's due time (tasks sort by their chip, TK-2)"),
  '17': NOT_ASKED('task paralysis'),
  '18': NOT_ASKED('shame with an overdue task'),
  '19': ref('Senses ticked are pattern 59 in v5.0 (Tab 20); senses have no level.'),
  '20': NOT_ASKED('hyperfocus'),
  '21': NOT_ASKED('boredom with a task (Bored is pattern 56)'),
  '22': ref('Several tasks are sorted by the colour (TK-2, pattern 54).'),
  '23': NOT_ASKED('social hangover'),
  '24': NOT_ASKED('a pain flare (body signs lower the colour, BS-1)'),
  '25': ref("Grief is ME-4's 'Losing someone' order of the Help menu (Tab 7 rows)."),
  '26': NOT_ASKED('rejection (Let down or cheated has its route)'),
  '27': ref("Not sure is NS-1 (Yellow); Tab 20's Not sure story is pattern 53."),
  '28': HELP('I need help now, and SF-1 (Tab 6)'),
  '29': ref("Body needs are the card's last line (the reason, Tab 3 senses)."),
  '30': {
    mapping: 'interpreted',
    reason:
      '3+ suggestions declined this session: stop suggesting; Home, nothing beside it (signals.declines_session).',
    engine: {
      stage: 'orchestration',
      layer: 'guard',
      rules: [
        {
          when: { fact: 'signals.declines_session', op: 'gte', value: 3 },
          then: [
            set('pattern.set', { pattern: '30' }),
            need('primary', '@open_home'),
            set('alternatives.limit', { max: 0 }),
          ],
        },
      ],
    },
  },
  '31': ref('Recovery is Blue (RC-1..5); the queued task is cut to small steps by TK-3.'),
  '32': HELP('HC-6'),
  '33': NOT_ASKED('the end of a demanding day'),
  '34': {
    mapping: 'interpreted',
    reason:
      'A recurring struggle the user confirmed (signals.recurring_struggle), in Green, Yellow or Blue: look at the pattern (What helped).',
    engine: {
      stage: 'orchestration',
      layer: 'trigger',
      rules: [
        {
          when: all(is('signals.recurring_struggle', true), light(...CALM_LIGHTS), unguarded),
          then: [set('pattern.set', { pattern: '34' }), propose('primary', 'rfl_helped')],
        },
      ],
    },
  },
  '35': NOT_ASKED('preparing to speak up (the More need Prepare to speak up for myself opens it)'),
  '36': NOT_ASKED('unease before an event (the More need Prepare for an event opens Adapt)'),
  '37': {
    mapping: 'interpreted',
    reason:
      "A saved practice is due (signals.practice_due): the user's own practice, in any light (Tab 7 HC-7; MD-1 allows the own practice).",
    engine: {
      stage: 'orchestration',
      layer: 'trigger',
      rules: [
        {
          when: all(is('signals.practice_due', true), unguarded),
          then: [set('pattern.set', { pattern: '37' }), need('primary', 'med_own')],
        },
      ],
    },
  },
  '38': HELP('HC-7'),
  '39': NOT_ASKED('the start or end of the day (the More need Start or end my day well opens it)'),
  '40': HELP('HC-6 when RF-1 blocks it'),
  '41': HELP('HC-7 when MD-1 or MD-2 blocks it'),
  '42': ref('Run as the card rule P42 (Tab 11 card rules).'),
  '43': HELP('HC-1 to HC-8 with a task (SEQ-1)'),
  '44': ref('Help from the Life right now line: the app opens Help/SOS (SF-3).'),
  '45': ref('Retired in v5.0 (DV-R).'),
  '46': HELP('HC-4 with no task'),
  '47': HELP('HC-2'),
  '58': NOT_ASKED('the time of day'),
  '60': NOT_ASKED("Return to work (Me, RW-1); the morning load check is the app's"),
};
