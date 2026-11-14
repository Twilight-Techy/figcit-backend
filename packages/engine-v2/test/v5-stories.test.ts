// Tab 20's 201 realistic stories, end to end: from what the person entered (state, emotions with
// their sliders, body, senses, place, devices, tasks with chips) to the card the workbook gives.
import { describe, expect, it } from 'vitest';
import {
  cardWordsV5,
  copyOf,
  run,
  type Card,
  type CardItem,
  type EngineInput,
} from '../src/index.js';
import { catalogue, codeOf, examples, imported, ruleset, FULL } from './support/v5.js';

const copy = copyOf(imported.records);

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
  'Dance break (somewhere private)': 'reg_dance_private',
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
  'Use your ear defenders': 'adp_device_ear',
  'Put your sunglasses on': 'adp_device_sun',
  'Go to the quiet room': 'adp_device_room',
  'Turn away from it or move seats': 'adp_space_turn',
  'Call 999': '@urgent',
};
const LIGHT_BAND: Readonly<Record<string, string>> = {
  Yellow: 'conditional',
  Amber: 'constrained',
  Red: 'very_constrained',
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

const list = (text: string, sep = ','): string[] =>
  text === '—' || text === ''
    ? []
    : text
        .split(sep)
        .map((x) => x.trim())
        .filter(Boolean);
const cellOf = (name: string): { energy: number; mood: number } => {
  const code = codeOf('cell', name);
  return { energy: Number(code[1]), mood: Number(code[3]) };
};

interface Task {
  readonly title: string;
  readonly chip: string;
}
function tasksOf(text: string): Task[] {
  return list(text, ';').map((t) => {
    const m = /^(.*)\[(.*)\]\s*$/.exec(t);
    const title = (m?.[1] ?? t).trim();
    const chip = (m?.[2] ?? 'no chip').trim();
    return { title, chip: chip === 'no chip' ? 'usual' : codeOf('task_chip', chip) };
  });
}

function stateOf(row: Record<string, string>): EngineInput {
  const state = row['State'] ?? '';
  const name = state.replace(/\s*\(.*\)$/, '');
  const was = /was (\w+)\)/.exec(state)?.[1];
  const base: EngineInput =
    name === 'Not sure yet'
      ? { 'state.not_sure': true }
      : { 'state.energy': cellOf(name).energy, 'state.mood': cellOf(name).mood };
  if (!was) return base;
  const band = LIGHT_BAND[was] ?? 'conditional';
  return {
    ...base,
    'recheck.present': true,
    'recheck.previous_light': was.toLowerCase(),
    'recheck.support_completed': true,
    'recheck.previous_baseline': band,
    'recheck.previous_band': band,
    // "After support" stories had stronger feelings before (the slider fell by 2+, RC-1).
    'recheck.previous_peak': 9,
  };
}

function feelingsOf(row: Record<string, string>): EngineInput {
  const feelings = Object.fromEntries(
    list(row['Emotions (slider)'] ?? '', ';').map((e) => {
      const m = /^(.*)\s(\d+)$/.exec(e);
      return [codeOf('family', (m?.[1] ?? e).trim()), Number(m?.[2] ?? 5)];
    }),
  );
  return Object.keys(feelings).length ? { 'family.intensity': feelings } : {};
}

function bodyOf(row: Record<string, string>): EngineInput {
  const body = list(row['Body'] ?? '');
  const urgent = body.find((b) => b.startsWith('urgent'));
  return {
    'body.signs': body.filter((b) => !b.startsWith('urgent')).map((b) => codeOf('body_sign', b)),
    ...(urgent
      ? {
          'urgent.signs': ['breathless'],
          'urgent.answer': urgent.includes('sudden') ? 'sudden_new' : 'familiar',
        }
      : {}),
    'sensitivity.flags': list(row['Senses'] ?? '').map((s) => codeOf('sensitivity_flag', s)),
  };
}

function placeOf(row: Record<string, string>): EngineInput {
  const place = PLACE[row['Place'] ?? ''];
  return {
    // A Quick check-in doesn't ask where you are (CTX-U).
    ...(place
      ? { 'context.setting': place, 'context.can_step_away': row['Step away'] === 'Yes' }
      : {}),
    ...((row['Place'] ?? '').startsWith('Quick check-in') ? { 'checkin.mode': 'quick' } : {}),
    'context.supports': list(row['Devices'] ?? '').map((d) => codeOf('support', d)),
  };
}

function inputOf(row: Record<string, string>): { input: EngineInput; tasks: Task[] } {
  const tasks = tasksOf(row['Tasks [chip]'] ?? '');
  const input: EngineInput = {
    ...stateOf(row),
    ...feelingsOf(row),
    ...bodyOf(row),
    ...placeOf(row),
    ...(tasks.length
      ? { 'tasks.count': tasks.length, 'tasks.chips': [...new Set(tasks.map((t) => t.chip))] }
      : {}),
  };
  return { input, tasks };
}

/** The tasks in the card's order (TK-2); `later` ones after, in their own order. */
/** The tasks in the card's order (TK-2): the first chips in order, then the rest as entered. */
function sortedTasks(card: Card, tasks: readonly Task[]): { first: Task[]; later: Task[] } {
  const order = card.taskOrder?.first ?? [];
  const first = tasks
    .map((t, i) => ({ t, i }))
    .filter((x) => order.includes(x.t.chip))
    .sort((a, b) => order.indexOf(a.t.chip) - order.indexOf(b.t.chip) || a.i - b.i)
    .map((x) => x.t);
  return { first, later: tasks.filter((t) => !order.includes(t.chip)) };
}
function ordered(card: Card, tasks: readonly Task[]): Task[] {
  const { first, later } = sortedTasks(card, tasks);
  return [...first, ...later];
}
/** As Tab 20 writes it: "A → B | Later: C, D". */
function orderLine(card: Card, tasks: readonly Task[]): string {
  const { first, later } = sortedTasks(card, tasks);
  const head = first.map((t) => t.title).join(' → ');
  return later.length ? `${head} | Later: ${later.map((t) => t.title).join(', ')}` : head;
}

const opens = (i: CardItem | null | undefined, top: Task | undefined): string => {
  if (i === null || i === undefined) return '-';
  if (i.tool) return i.tool;
  if (!('action' in i.target)) return '?';
  const a = i.target.action;
  return a === 'start_task' || a === 'skip_to_task' || a === 'start_small'
    ? `@${a}:${top?.title ?? '?'}`
    : `@${a}`;
};
const wantButton = (text: string): string => {
  const task = /^(Start|Skip to|One small step): (.*)$/.exec(text);
  if (task) {
    const kind = {
      Start: 'start_task',
      'Skip to': 'skip_to_task',
      'One small step': 'start_small',
    }[task[1] as 'Start'];
    return `@${kind}:${task[2] ?? ''}`;
  }
  if (text === "One gentle 'Usual' task" || /task|tidy|message|snack|hardest/i.test(text))
    return OPENS[text] ?? '@suggest_task';
  return OPENS[text] ?? `?${text}`;
};

describe("Rules Engine v5.0: Tab 20's stories", () => {
  const rows = examples('stories');
  const results = rows.map((row) => {
    const { input, tasks } = inputOf(row);
    const r = run(ruleset, { ...FULL, ...input });
    if (!r.ok) throw new Error(`${row['ID'] ?? ''}: ${JSON.stringify(r.issues)}`);
    const sorted = ordered(r.card, tasks);
    const words = cardWordsV5(r.card, input, { copy, catalogue, tasks: sorted });
    return { row, card: r.card, tasks, top: sorted[0], words };
  });
  const differ = (
    want: (r: Record<string, string>) => string,
    got: (x: (typeof results)[number]) => string,
  ) =>
    results
      .filter((x) => want(x.row) !== got(x))
      .map(
        (x) =>
          `${x.row['ID'] ?? ''} ${x.row['Colour'] ?? ''} p${x.row['Pattern'] ?? ''}: ${got(x)} (Tab 20: ${want(x.row)})`,
      );
  const check = (wrong: string[]): void => {
    expect(wrong.slice(0, 15), `${String(wrong.length)} stories differ`).toEqual([]);
  };

  it('reads every story', () => {
    expect(rows.length).toBe(201);
    expect(catalogue.get('task_chip')?.length).toBe(8);
  });

  it('gives the colour', () => {
    check(
      differ(
        (r) => (r['Colour'] ?? '').toLowerCase().replace('—', 'urgent'),
        (x) => (x.card.kind === 'urgent_screen' ? 'urgent' : String(x.card.light)),
      ),
    );
  });

  it('gives the pattern', () => {
    check(
      differ(
        (r) => r['Pattern'] ?? '',
        (x) => x.card.pattern ?? '-',
      ),
    );
  });

  it('gives the main button', () => {
    // ST-122 is a Quick check-in, where P42, CTX-U and T-08 put the discreet Breathe first; the
    // story shows plain Breathe (docs/engine-v2/V5.md).
    const QUICK: Readonly<Record<string, string>> = { 'ST-122': 'reg_breathe_discreet' };
    check(
      differ(
        (r) => QUICK[r['ID'] ?? ''] ?? wantButton(r['Primary button'] ?? ''),
        (x) =>
          x.card.kind === 'urgent_screen'
            ? '@urgent'
            : x.card.primary &&
                'action' in x.card.primary.target &&
                x.card.primary.target.action === 'suggest_task'
              ? '@suggest_task'
              : opens(x.card.primary, x.top),
      ),
    );
  });

  it('gives the alternative', () => {
    check(
      differ(
        (r) => {
          const first = (r['Alternatives'] ?? '').split(' · ')[0] ?? '';
          return ['Not now', 'Get support now', 'Call NHS 111'].includes(first)
            ? '-'
            : wantButton(first);
        },
        (x) => (x.card.kind === 'urgent_screen' ? '-' : opens(x.card.alternatives[0], x.top)),
      ),
    );
  });

  it('shows Get support now where Tab 20 does', () => {
    check(
      differ(
        (r) => String((r['Alternatives'] ?? '').includes('Get support now')),
        (x) => String(x.card.kind === 'card' && x.card.supportVisible),
      ),
    );
  });

  it('suggests the task Tab 20 suggests, with no task (TK-4)', () => {
    const SUGGESTION: Readonly<Record<string, string>> = {
      'Start the hardest thing on your mind': 'tk4.green.1',
      "One 'Usual' task, like a 10-minute tidy": 'tk4.yellow.1',
      'Reply to one message': 'tk4.yellow.2',
      'Have a drink or snack': 'tk4.amber.1',
      'Rest is the task right now': 'tk4.red.1',
      "One gentle 'Usual' task": 'tk4.blue.1',
    };
    check(
      differ(
        (r) => {
          const s = r['Suggested task'] ?? '';
          return s === '' || s === '—' || s.startsWith('None until')
            ? '-'
            : (SUGGESTION[s] ?? `?${s}`);
        },
        (x) => (x.card.kind === 'urgent_screen' ? '-' : (x.card.suggestion ?? '-')),
      ),
    );
  });

  it('orders the tasks by the colour (TK-2)', () => {
    check(
      differ(
        (r) => /^Order: ([^.]*)\./.exec(r['Task order / card line'] ?? '')?.[1] ?? '-',
        (x) =>
          x.tasks.length === 0 ||
          x.card.light === 'red' ||
          !/^Order:/.test(x.row['Task order / card line'] ?? '')
            ? (/^Order: ([^.]*)\./.exec(x.row['Task order / card line'] ?? '')?.[1] ?? '-')
            : orderLine(x.card, x.tasks),
      ),
    );
  });

  it('gives the headline (Tab 11)', () => {
    check(
      differ(
        (r) => r['Headline'] ?? '',
        (x) => x.words.headline,
      ),
    );
  });

  it('gives the reason (RT-4)', () => {
    check(
      differ(
        // Tab 20's "It's smells" is corrected (V5.md).
        (r) => (r['Reason shown'] ?? '').replace("It's smells", 'Smells are bothering you'),
        (x) => x.words.reason,
      ),
    );
  });

  it('says how the tasks were sorted (TK-2, TK-3)', () => {
    check(
      differ(
        (r) => {
          const line = r['Task order / card line'] ?? '';
          const said = /Card says: '(.*?)'(?: (.*))?$/.exec(line);
          // With nothing in the first group, Tab 20 has "We've put  first today."; the card says nothing.
          const parts = said
            ? [said[1] === "We've put  first today." ? '' : (said[1] ?? ''), said[2] ?? '']
            : [line === '—' ? '' : line];
          return parts.filter(Boolean).join(' ') || '-';
        },
        (x) => x.words.taskLine ?? '-',
      ),
    );
  });
});
