import type { RuleRecordDraft } from '../ruleset/types.js';
import { cellText } from './catalogue.js';

// Rules Engine v5.0's card wording (docs/engine-v2/V5.md): the headlines (Tab 11), the no-task
// suggestions (Tab 10), and the reason's sentences and phrases (RT-1 to RT-4), written the way
// Tab 20's stories show them. All of it is the copy table, so it can be changed without a release.

/** [key, text, source, mapping]. */
export type CopyRow = readonly [string, string, string, 'exact' | 'interpreted'];

type Slug = (label: string) => string;

const rows = (records: readonly RuleRecordDraft[], tab: string, section?: string) =>
  records.filter(
    (r) =>
      r.tab === tab &&
      r.role === 'rule' &&
      (section === undefined || (r.section ?? '').startsWith(section)),
  );
const text = (r: RuleRecordDraft, header: string): string =>
  cellText(r.columns, header).replace(/\s+/g, ' ').trim();

/**
 * Where Tab 20's stories show another headline than Tab 11's: pattern 4 is said as 48's ("Want a
 * 2-minute reset?"), and 54's Tab 11 headline is its task line (TK-2), so it opens like 2.
 */
const STORY_HEADLINES: Readonly<Record<string, string>> = {
  '4': 'Want a 2-minute reset?',
  '54': 'Ready to start?',
};

/** Tab 11's headlines, by pattern; "(normal …)" and "(uses …)" rows have none of their own. */
function headlines(records: readonly RuleRecordDraft[]): CopyRow[] {
  return rows(records, 'card_patterns')
    .filter((r) => text(r, 'Headline') !== '' && !text(r, 'Headline').startsWith('('))
    .map((r) => {
      const story = STORY_HEADLINES[r.sourceRef];
      return [
        `card.p${r.sourceRef}.headline`,
        story ?? text(r, 'Headline'),
        story
          ? `card_patterns · ${r.sourceRef}; stories (Tab 20)`
          : `card_patterns · ${r.sourceRef}`,
        story ? 'interpreted' : 'exact',
      ];
    });
}

/** Tab 10's no-task suggestions: `tk4.<colour>.<n>`, n from 1 in the row's order. */
function suggestions(records: readonly RuleRecordDraft[]): CopyRow[] {
  return rows(records, 'time_demand', 'v5.0 — No-task suggestions').flatMap((r) =>
    text(r, 'Suggestions when there is no task (TK-4)')
      .split(' · ')
      .map((s, i): CopyRow => [
        `tk4.${r.sourceRef.toLowerCase()}.${String(i + 1)}`,
        s.trim(),
        `time_demand · ${r.sourceRef}`,
        'exact',
      ]),
  );
}

/**
 * "Teary or sad" is "teary", "Let down or cheated" "let down", Something else "what you described"
 * (Tab 20); the rest lower case.
 */
function feelings(records: readonly RuleRecordDraft[], slug: Slug): CopyRow[] {
  return rows(records, 'feelings', 'The 20 emotions').map((r) => {
    const label = text(r, 'Emotion');
    const phrase =
      r.sourceRef === 'EM00' ? 'what you described' : label.toLowerCase().replace(/ or .*$/, '');
    return [`feeling.${slug(label)}`, phrase, `feelings · ${r.sourceRef}`, 'interpreted'];
  });
}

/** Body signs as the reason says them: "with a racing heart and tension" (Tab 20). */
const BODY_PHRASES: Readonly<Record<string, string>> = {
  'Racing heart': 'a racing heart',
  'Knot in my stomach': 'a knot in your stomach',
  'Shut down (body)': 'shut down',
};
function bodySigns(records: readonly RuleRecordDraft[], slug: Slug): CopyRow[] {
  return rows(records, 'body_senses', 'Body tab').map((r) => {
    const label = text(r, 'Body sign');
    return [
      `body.${slug(label)}`,
      BODY_PHRASES[label] ?? label.toLowerCase(),
      `body_senses · ${r.sourceRef}`,
      'interpreted',
    ];
  });
}

/** What the reason says about an overload sense (pattern 59) or a body need (the last line, Tab 3). */
const SENSE_SENTENCES: Readonly<Record<string, string>> = {
  SN01: "It's too loud — we'll start with that.",
  SN02: "It's too bright — we'll start with that.",
  SN03: "It's too busy or crowded — we'll start with that.",
  SN04: 'First, hungry or thirsty: have a drink or snack.',
  SN05: "Clothes or touch bothering you — we'll start with that.",
  // Tab 20 has "It's smells"; the words are corrected here (V5.md).
  SN06: "Smells are bothering you — we'll start with that.",
  SN07: 'First, too hot or too cold: have a drink or snack.',
};
function senses(records: readonly RuleRecordDraft[], slug: Slug): CopyRow[] {
  return rows(records, 'body_senses', 'Senses tab').flatMap((r): CopyRow[] => {
    const sentence = SENSE_SENTENCES[r.sourceRef];
    return sentence
      ? [
          [
            `sense.${slug(text(r, 'Sense'))}`,
            sentence,
            `body_senses · ${r.sourceRef}`,
            'interpreted',
          ],
        ]
      : [];
  });
}

/** Where you are, as the reason names it (Tab 20). Home says nothing. */
const PLACE_PHRASES: Readonly<Record<string, string>> = {
  PL2: "You're at work or on placement",
  PL3: "You're in class",
  PL4: "You're out and about",
  PL6: "You're at an appointment",
  PL7: "You're in a quiet study space",
  PL8: "You're somewhere else",
};
function places(records: readonly RuleRecordDraft[], slug: Slug): CopyRow[] {
  return rows(records, 'places').flatMap((r): CopyRow[] => {
    const phrase = PLACE_PHRASES[r.sourceRef];
    return phrase
      ? [[`place.${slug(text(r, 'Place'))}`, phrase, `places · ${r.sourceRef}`, 'interpreted']]
      : [];
  });
}

/** The reason's sentences (RT-4's template, as Tab 20 words them) and the task card line (TK-2, TK-3). */
const SENTENCES: readonly CopyRow[] = [
  ['reason.state', "You're in {state}", 'card_rules · RT-4', 'exact'],
  ['state.not_sure', 'Not sure yet', 'capacity (Tab 1)', 'exact'],
  ['reason.feeling', 'feeling {feeling} ({strength})', 'card_rules · RT-4', 'exact'],
  ['reason.and', 'and {feeling}', 'stories (Tab 20)', 'interpreted'],
  ['reason.with', 'with {body}', 'card_rules · RT-4', 'exact'],
  [
    'reason.stronger',
    "Feeling this strongly makes things harder, so you're in {colour} for now.",
    'stories (Tab 20)',
    'interpreted',
  ],
  [
    'reason.switched_off',
    "You seem switched off, so we'll keep it simple.",
    'stories (Tab 20)',
    'interpreted',
  ],
  [
    'reason.discreet',
    "{place}, so we've picked something discreet.",
    'stories (Tab 20)',
    'interpreted',
  ],
  [
    'reason.audio',
    '{place} with headphones, so audio tools are open to you.',
    'card_rules · RT-4 (headphones help)',
    'interpreted',
  ],
  [
    'reason.silent',
    "You can't step away, so this one is silent.",
    'stories (Tab 20)',
    'interpreted',
  ],
  [
    'reason.urgent',
    'You told us this is sudden or new. Please get urgent help now.',
    'stories (Tab 20); SF-4',
    'interpreted',
  ],
  ['card.headline.low', "Let's start gently.", 'stories (Tab 20)', 'interpreted'],
  ['card.p42.link', 'Not at home? Tell us where you are', 'card_rules · P42; CTX-U', 'exact'],
  // SEQ-2's one line when a gate blocks the card picked (wording for clinical sign-off).
  [
    'help.swap.hc_3',
    "Right now let's take care of you first; we can sort what's around you after.",
    'card_rules · SEQ-2',
    'interpreted',
  ],
  [
    'help.swap.hc_4',
    "Right now let's take care of you first; your task will keep.",
    'card_rules · SEQ-2',
    'interpreted',
  ],
  [
    'help.swap.hc_5',
    "Right now let's take care of you first; Get support now has message cards if you need words.",
    'card_rules · SEQ-2',
    'interpreted',
  ],
  [
    'help.swap.hc_6',
    "Making sense of it can wait until you feel steadier, so let's empty your head first.",
    'gates · RF-1; pattern 40',
    'interpreted',
  ],
  [
    'help.swap.hc_7',
    "Let's settle your body first, eyes open; your own practice is still here.",
    'gates · MD-1, MD-2; pattern 41',
    'interpreted',
  ],
  ['tasks.line', "We've put {chips} first today.", 'time_demand · TK-2', 'exact'],
  ['tasks.small', "'{task}' is cut to one small step.", 'time_demand · TK-3', 'interpreted'],
  ['tasks.red', 'Tasks kept, not suggested now.', 'time_demand · Red', 'interpreted'],
  [
    'tasks.red_cant_wait',
    "'{task}' can't wait: offer 'Ask someone to help' or 'Move the deadline'.",
    'time_demand · TK-3',
    'interpreted',
  ],
  ['strength.mild', 'mild', 'feelings · I1', 'exact'],
  ['strength.moderate', 'moderate', 'feelings · I2', 'exact'],
  ['strength.strong', 'strong', 'feelings · I3', 'exact'],
  ['strength.very_strong', 'very strong', 'feelings · I4', 'exact'],
  ...(['green', 'yellow', 'amber', 'red', 'blue'] as const).map((c): CopyRow => [
    `colour.${c}`,
    c,
    'colours (Tab 6)',
    'exact',
  ]),
];

/** Every wording row v5.0 gives. */
export function v5CopyRows(records: readonly RuleRecordDraft[], slug: Slug): CopyRow[] {
  return [
    ...headlines(records),
    ...suggestions(records),
    ...feelings(records, slug),
    ...bodySigns(records, slug),
    ...senses(records, slug),
    ...places(records, slug),
    ...SENTENCES,
  ];
}
