// The no-task card of Rules Engine v5.0 against every row of Tab 18: its pattern, the main button,
// the alternative beside it, whether Get support now replaces Not now, and the TK-4 suggestion.
// Buttons are compared by the tool or action they open: Tab 17's labels are the words shown
// (LBL-1), and Tab 18 sometimes words the same tool differently (V5.md lists them).
import { describe, expect, it } from 'vitest';
import { run, type Card, type CardItem, type EngineInput } from '../src/index.js';
import { codeOf, examples, report, ruleset, FULL } from './support/v5.js';

/** Tab 18's button words, as the tool or action they open. */
const OPENS: Readonly<Record<string, string>> = {
  Breathe: 'reg_breathe',
  'Ground (5-4-3-2-1, eyes open)': 'reg_ground',
  'Move a little': 'reg_move',
  'Calming sounds': 'reg_sounds',
  Rest: 'reg_rest',
  'Create (draw)': 'reg_create',
  'Dance break': 'reg_dance',
  'Breathe (tap-only)': 'reg_tap',
  'Empty your head': 'dmp_capture',
  'Write it out': 'exp_write',
  'Ask for what I need': 'exp_ask',
  'Smallest next step': 'exe_step',
  'Make sense of today': 'rfl_today',
  'What went well': 'rfl_helped',
  'Call or message someone I trust': 'con_contact',
  'Gratitude practice': 'med_gratitude',
  "Send my 'I need quiet' message": 'exp_cards',
  'Plan something': '@plan_something',
};
/** Tab 10's no-task suggestions, as their wording keys. */
const SUGGESTION: Readonly<Record<string, string>> = {
  'Start the hardest thing on your mind': 'tk4.green.1',
  "One 'Usual' task, like a 10-minute tidy": 'tk4.yellow.1',
  'Reply to one message': 'tk4.yellow.2',
  'Have a drink or snack': 'tk4.amber.1',
  'Rest is the task right now': 'tk4.red.1',
};

const STATE: Readonly<Record<string, EngineInput>> = {
  'Full Flow': { 'state.energy': 3, 'state.mood': 3 },
  'Building Up': { 'state.energy': 2, 'state.mood': 3 },
  'Tender Space': { 'state.energy': 1, 'state.mood': 3 },
  Hibernate: { 'state.energy': 1, 'state.mood': 1 },
  'Not sure yet': { 'state.not_sure': true },
};
const SLIDER: Readonly<Record<string, number>> = {
  Mild: 2,
  Moderate: 5,
  Strong: 7,
  'Very strong': 9,
};
const BODY: Readonly<Record<string, EngineInput>> = {
  None: {},
  '1–2 signs': { 'body.signs': ['tension'] },
  '3+ signs': { 'body.signs': ['tension', 'aches_or_pain', 'heaviness'] },
  'Shutdown sign': { 'body.signs': ['shut_down'] },
  'Urgent sign — familiar': { 'urgent.signs': ['breathless'], 'urgent.answer': 'familiar' },
  'Urgent sign — sudden or new': { 'urgent.signs': ['breathless'], 'urgent.answer': 'sudden_new' },
};

function inputOf(row: Record<string, string>): EngineInput {
  const emotion = row['Deciding emotion'] ?? '';
  const label = emotion === 'Something else' ? 'Something else (type it)' : emotion;
  const feelings =
    emotion === '(none picked)'
      ? {}
      : { 'family.intensity': { [codeOf('family', label)]: SLIDER[row['Strength'] ?? ''] ?? 0 } };
  return { ...STATE[row['State used'] ?? ''], ...feelings, ...BODY[row['Body'] ?? ''] };
}

const opens = (i: CardItem | null | undefined): string =>
  i === null || i === undefined
    ? '-'
    : (i.tool ?? ('action' in i.target ? `@${i.target.action}` : `?${JSON.stringify(i.target)}`));

function shown(card: Card): {
  pattern: string;
  primary: string;
  alternative: string;
  second: string;
  suggestion: string;
} {
  const support = card.supportVisible ? 'Get support now' : 'Not now';
  return {
    pattern: card.pattern ?? '-',
    primary: opens(card.primary),
    alternative: opens(card.alternatives[0]),
    second: card.alternatives.length > 1 ? `extra:${opens(card.alternatives[1])}` : support,
    suggestion: card.suggestion ?? '-',
  };
}

function wanted(row: Record<string, string>) {
  const [alternative = '', second = ''] = (row['Alternatives'] ?? '').split(' · ');
  const primary = row['Primary button'] ?? '';
  return {
    pattern: row['Pattern'] ?? '',
    primary: SUGGESTION[primary] ? '@suggest_task' : (OPENS[primary] ?? `?${primary}`),
    alternative: OPENS[alternative] ?? `?${alternative}`,
    second,
    suggestion:
      row['Suggested task (no task)'] === 'None until a re-check'
        ? '-'
        : (SUGGESTION[row['Suggested task (no task)'] ?? ''] ?? '?'),
  };
}

describe('Rules Engine v5.0: the no-task card (Tab 18)', () => {
  const rows = examples('outcomes');
  const cards = rows
    .filter((r) => !(r['Body'] ?? '').startsWith('Urgent sign — sudden'))
    .map((row) => {
      const result = run(ruleset, { ...FULL, ...inputOf(row) });
      if (!result.ok) throw new Error(JSON.stringify(result.issues));
      return { row, got: shown(result.card), want: wanted(row) };
    });
  const differ = (key: keyof ReturnType<typeof shown>) =>
    cards
      .filter(({ got, want }) => got[key] !== want[key])
      .map(
        ({ row, got, want }) =>
          `#${row['#'] ?? ''} ${row['Final colour'] ?? ''} ${row['Deciding emotion'] ?? ''} ${row['Strength'] ?? ''} ${row['Body'] ?? ''}: ${got[key]} (Tab 18: ${want[key]})`,
      );

  it('maps the card rows with none left invalid', () => {
    expect(report.invalid).toEqual([]);
  });

  for (const key of ['pattern', 'primary', 'alternative', 'second', 'suggestion'] as const)
    it(`gives Tab 18's ${key} for every row`, () => {
      const wrong = differ(key);
      expect(wrong.slice(0, 12), `${String(wrong.length)} rows differ`).toEqual([]);
    });

  it('shows the urgent screen for a sudden urgent sign, with pattern 50', () => {
    const urgent = rows.filter((r) => (r['Body'] ?? '').startsWith('Urgent sign — sudden'));
    for (const row of urgent) {
      const r = run(ruleset, { ...FULL, ...inputOf(row) });
      if (!r.ok) throw new Error('input');
      expect(r.card.kind).toBe('urgent_screen');
      expect(r.card.pattern).toBe('50');
    }
  });

  it("labels every tool button with Tab 17's words only (LBL-1, T-16)", () => {
    for (const { row } of cards.slice(0, 400)) {
      const r = run(ruleset, { ...FULL, ...inputOf(row) });
      if (!r.ok) throw new Error('input');
      for (const item of [r.card.primary, ...r.card.alternatives])
        if (item?.tool) expect(item.label, item.tool).toMatch(/^[^{}]{1,60}$/);
    }
  });
});
