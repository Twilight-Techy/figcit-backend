// Every colour outcome of Rules Engine v5.0 (Tab 18, 2,550 rows): the starting state, the deciding
// emotion at each strength, and each body class give the final colour and no-words mode the
// workbook gives. At home, able to step away, no devices, no task (Tab 18's own assumptions).
import { describe, expect, it } from 'vitest';
import { run, type EngineInput } from '../src/index.js';
import { catalogue, codeOf, examples, report, ruleset } from './support/v5.js';

const STATE: Readonly<Record<string, EngineInput>> = {
  'Full Flow': { 'state.energy': 3, 'state.mood': 3 },
  'Building Up': { 'state.energy': 2, 'state.mood': 3 },
  'Tender Space': { 'state.energy': 1, 'state.mood': 3 },
  Hibernate: { 'state.energy': 1, 'state.mood': 1 },
  'Not sure yet': { 'state.not_sure': true },
};
/** A slider value inside each strength's range (Tab 2: Mild 1-3, Moderate 4-6 ...). */
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
const LIGHT: Readonly<Record<string, string>> = {
  green: 'Green',
  yellow: 'Yellow',
  amber: 'Amber',
  red: 'Red',
};

function inputOf(row: Record<string, string>): EngineInput {
  const emotion = row['Deciding emotion'] ?? '';
  const feelings =
    emotion === '(none picked)'
      ? {}
      : {
          'family.intensity': {
            [codeOf('family', emotion === 'Something else' ? 'Something else (type it)' : emotion)]:
              SLIDER[row['Strength'] ?? ''] ?? 0,
          },
        };
  return { ...STATE[row['State used'] ?? ''], ...feelings, ...BODY[row['Body'] ?? ''] };
}

function outcome(row: Record<string, string>): { colour: string; noWords: string } {
  const result = run(ruleset, inputOf(row));
  if (!result.ok) throw new Error(`row ${row['#'] ?? ''}: ${JSON.stringify(result.issues)}`);
  const { card } = result;
  return {
    colour: card.kind !== 'card' ? '—' : (LIGHT[card.light ?? ''] ?? String(card.light)),
    noWords: card.noWords ? 'Yes' : 'No',
  };
}

describe('Rules Engine v5.0: every colour outcome (Tab 18)', () => {
  const rows = examples('outcomes');

  it('maps the colour rules with no row left invalid', () => {
    expect(report.invalid).toEqual([]);
    expect(catalogue.get('family')?.length).toBe(21);
    expect(rows.length).toBe(2550);
  });

  it('gives the final colour Tab 18 gives, for all 2,550 rows', () => {
    const wrong = rows.flatMap((row) => {
      const got = outcome(row).colour;
      return got === row['Final colour']
        ? []
        : [
            `#${row['#'] ?? ''} ${row['State used'] ?? ''} · ${row['Deciding emotion'] ?? ''} ${row['Strength'] ?? ''} · ${row['Body'] ?? ''}: ${got}, Tab 18 says ${row['Final colour'] ?? ''}`,
          ];
    });
    expect(wrong.slice(0, 15), `${String(wrong.length)} rows differ`).toEqual([]);
  });

  it('switches on no-words mode where Tab 18 does', () => {
    const wrong = rows.flatMap((row) => {
      const got = outcome(row).noWords;
      return got === row['No-words mode']
        ? []
        : [
            `#${row['#'] ?? ''} ${row['Deciding emotion'] ?? ''} ${row['Strength'] ?? ''} · ${row['Body'] ?? ''}: ${got}, Tab 18 says ${row['No-words mode'] ?? ''}`,
          ];
    });
    expect(wrong.slice(0, 15), `${String(wrong.length)} rows differ`).toEqual([]);
  });
});

describe('Rules Engine v5.0: the colour tests of Tab 21', () => {
  const card = (input: EngineInput) => {
    const r = run(ruleset, { 'state.energy': 3, 'state.mood': 3, ...input });
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    return r.card;
  };

  it('T-03: strong overwhelm lowers the colour one step', () => {
    expect(card({ 'family.intensity': { overwhelmed: 8 } }).light).toBe('yellow');
  });

  it('T-30: calm keeps Green', () => {
    expect(card({ 'family.intensity': { calm: 6 } }).light).toBe('green');
  });

  it('T-31: a tie goes to the unpleasant emotion', () => {
    expect(card({ 'family.intensity': { anxious: 8, happy: 8 } }).light).toBe('yellow');
  });

  it('a settled emotion with the higher slider decides (FE-3)', () => {
    expect(card({ 'family.intensity': { anxious: 7, happy: 9 } }).light).toBe('green');
  });

  it('T-32: strong anger and three body signs lower it only one step in total', () => {
    expect(
      card({
        'family.intensity': { angry: 9 },
        'body.signs': ['tension', 'aches_or_pain', 'heaviness'],
      }).light,
    ).toBe('yellow');
  });

  it('T-34: an urgent sign that is sudden or new is the urgent screen and nothing else', () => {
    const c = card({ 'urgent.signs': ['breathless'], 'urgent.answer': 'sudden_new' });
    expect(c.kind).toBe('urgent_screen');
    expect(c.light).toBeNull();
  });

  it('T-41: shut down at 5 is no-words mode, one step lower', () => {
    const c = card({ 'family.intensity': { shut_down: 5 } });
    expect(c.noWords).toBe(true);
    expect(c.light).toBe('yellow');
  });

  it('never goes below Red', () => {
    expect(
      card({ 'state.energy': 1, 'state.mood': 1, 'family.intensity': { angry: 9 } }).light,
    ).toBe('red');
  });
});
