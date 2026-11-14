// Same feeling, different place (Tab 19, 320 rows): the place and "Can you step away?" change the
// buttons, never the colour; headphones unlock calming sounds. Each emotion at Moderate (slider 5),
// in a Yellow state (Building Up) and, lowered, in Amber; Red rows are the strong ones.
import { describe, expect, it } from 'vitest';
import { run, type CardItem, type EngineInput } from '../src/index.js';
import { codeOf, examples, ruleset, FULL } from './support/v5.js';

const OPENS: Readonly<Record<string, string>> = {
  Breathe: 'reg_breathe',
  'Breathe (discreet)': 'reg_breathe_discreet',
  'Breathe (silent, eyes open)': 'reg_breathe_silent',
  'Breathe (tap-only)': 'reg_tap',
  'Ground (5-4-3-2-1, eyes open)': 'reg_ground',
  'Move a little': 'reg_move',
  'Stretch at my desk': 'reg_move_desk',
  'Walk it off': 'reg_move_walk',
  'Calming sounds': 'reg_sounds',
  'Calming sounds (headphones)': 'reg_sounds',
  'Comfort (kind words on screen)': 'reg_comfort',
  Rest: 'reg_rest',
  'Pause for 2 minutes': 'reg_rest_pause',
  'Create (draw)': 'reg_create',
  'Dance break': 'reg_dance',
  'Empty your head': 'dmp_capture',
  'Empty your head (text)': 'dmp_capture_text',
  'Write it out': 'exp_write',
  'Notes for my appointment': 'exp_appt',
  'Ask for what I need': 'exp_ask',
  'Smallest next step': 'exe_step',
  'Make sense of today': 'rfl_today',
  'What went well': 'rfl_helped',
  'Save it to reflect on later': '@save_for_later',
  'Call or message someone I trust': 'con_contact',
  'Message someone I trust': 'con_contact',
  'Gratitude practice': 'med_gratitude',
  "Send my 'I need quiet' message": 'exp_cards',
  'Plan something': '@plan_something',
  "One 'Usual' task, like a 10-minute tidy": '@suggest_task',
  'Reply to one message': '@suggest_task',
  'Have a drink or snack': '@suggest_task',
  'Start the hardest thing on your mind': '@suggest_task',
};
const PLACE: Readonly<Record<string, string>> = {
  Home: 'home',
  'Work or placement': 'work_or_placement',
  'Class or lecture': 'class_or_lecture',
  'Out and about (street, shop, bus or train)': 'out_and_about',
  'Exam, interview or assessment': 'exam_interview_or_assessment',
  'Appointment or meeting (e.g. Jobcentre, GP, review)': 'appointment_or_meeting',
  'Library or quiet study space': 'library_or_quiet_study_space',
  'Somewhere else': 'somewhere_else',
};
/** Tab 19: each emotion's first 8 rows start in Building Up (Yellow), the next 8 in Tender Space (Amber). */
const BUILDING_UP: EngineInput = { 'state.energy': 2, 'state.mood': 3 };
const TENDER_SPACE: EngineInput = { 'state.energy': 1, 'state.mood': 3 };

const opens = (i: CardItem | null | undefined): string =>
  i === null || i === undefined
    ? '-'
    : (i.tool ?? ('action' in i.target ? `@${i.target.action}` : '?'));

function inputOf(row: Record<string, string>, headphones: boolean): EngineInput {
  const emotion = row['Emotion'] ?? '';
  const label = emotion === 'Something else' ? 'Something else (type it)' : emotion;
  const start = (Number(row['#'] ?? '1') - 1) % 16 < 8 ? BUILDING_UP : TENDER_SPACE;
  return {
    ...start,
    'family.intensity': { [codeOf('family', label)]: 5 },
    'context.setting': PLACE[row['Place'] ?? ''] ?? '?',
    'context.can_step_away': row['Can step away'] === 'Yes',
    ...(headphones ? { 'context.supports': ['headphones_or_earbuds'] } : {}),
  };
}

describe('Rules Engine v5.0: route by place (Tab 19)', () => {
  const rows = examples('place_routes');
  const results = rows.map((row) => {
    const plain = run(ruleset, { ...FULL, ...inputOf(row, false) });
    const withHeadphones = run(ruleset, { ...FULL, ...inputOf(row, true) });
    if (!plain.ok || !withHeadphones.ok) throw new Error(JSON.stringify(row));
    return { row, card: plain.card, headphones: withHeadphones.card };
  });
  const list = (
    want: (r: Record<string, string>) => string,
    got: (r: (typeof results)[number]) => string,
  ) =>
    results
      .filter((r) => want(r.row) !== got(r))
      .map(
        (r) =>
          `#${r.row['#'] ?? ''} ${r.row['Emotion'] ?? ''} ${r.row['Colour'] ?? ''} ${r.row['Place'] ?? ''}: ${got(r)} (Tab 19: ${want(r.row)})`,
      );

  it('keeps the colour Tab 19 gives', () => {
    const wrong = list(
      (r) => (r['Colour'] ?? '').toLowerCase(),
      (r) => String(r.card.light),
    );
    expect(wrong.slice(0, 10), `${String(wrong.length)} rows differ`).toEqual([]);
  });

  it('gives the pattern Tab 19 gives', () => {
    const wrong = list(
      (r) => r['Pattern'] ?? '',
      (r) => r.card.pattern ?? '-',
    );
    expect(wrong.slice(0, 10), `${String(wrong.length)} rows differ`).toEqual([]);
  });

  it('gives the main button for the place', () => {
    const wrong = list(
      (r) => OPENS[r['Primary button'] ?? ''] ?? `?${r['Primary button'] ?? ''}`,
      (r) => opens(r.card.primary),
    );
    expect(wrong.slice(0, 10), `${String(wrong.length)} rows differ`).toEqual([]);
  });

  it('gives the alternative for the place, or none in an exam', () => {
    const wrong = list(
      (r) => {
        const first = (r['Alternatives'] ?? '').split(' · ')[0] ?? '';
        return first === 'Not now' || first === 'Get support now'
          ? '-'
          : (OPENS[first] ?? `?${first}`);
      },
      (r) => opens(r.card.alternatives[0]),
    );
    expect(wrong.slice(0, 10), `${String(wrong.length)} rows differ`).toEqual([]);
  });

  it('with headphones, unlocks calming sounds (DV-R, T-04)', () => {
    const wrong = list(
      (r) => OPENS[r['Primary with headphones'] ?? ''] ?? `?${r['Primary with headphones'] ?? ''}`,
      (r) => opens(r.headphones.primary),
    );
    expect(wrong.slice(0, 10), `${String(wrong.length)} rows differ`).toEqual([]);
  });
});
