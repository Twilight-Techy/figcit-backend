// Turns the workbook's worked scenarios (Tabs 0, 0b) into engine fixtures: structured input built
// from each row's plain-language columns, plus the expected pattern(s) and (Tab 0b) final light.
// The keyword tables below are the translation; `OVERRIDES` adds what a row states only in prose.
import type {
  ContextInput,
  EmotionInput,
  EngineInput,
  Light,
  PreviousOutcome,
  SensationInput,
  TimelineCode,
  UserSignals,
} from '@figcit/engine';
import { clean } from './csv.js';
import { TAB_FILES, type WorkbookTables } from './workbook.js';

export interface Fixture {
  readonly ref: string;
  readonly source: 'tab0' | 'tab0b';
  readonly input: EngineInput;
  readonly signals: UserSignals;
  readonly expect: {
    readonly patterns: readonly number[];
    readonly light?: Light;
    readonly title: string;
  };
}

type Rule = readonly [RegExp, string];

const EMOTION_RULES: readonly Rule[] = [
  [/immediate risk/i, 'RISK'],
  [/not sure how i feel/i, 'NOT_SURE'],
  [/shutdown|freeze/i, 'numb'],
  [/shame|guilt/i, 'shame'],
  [/grief|loss/i, 'grief'],
  [/social hangover|masking fatigue/i, 'peopled_out'],
  [/task paralysis/i, 'stuck_start'],
  [/sensory overload/i, 'overloaded'],
  [/rejection/i, 'hurt_comment'],
  [/confusion|decision paralysis/i, 'foggy'],
  [/boredom|under-stimulation/i, 'bored'],
  [/hyperfocus/i, 'locked_in'],
  [/distress|overwhelm/i, 'overwhelmed'],
  [/racing|disorganised/i, 'racing_head'],
  [/rumination|replay loop/i, 'going_over'],
  [/anticipatory/i, 'uneasy_ahead'],
  [/anxious/i, 'anxious'],
  [/anger|frustration/i, 'frustrated'],
  [/word-finding|communication difficulty/i, 'lost_for_words'],
  [/loneliness|isolation/i, 'lonely'],
  [/sadness|low mood/i, 'sad'],
  [/restless/i, 'restless'],
  [/disconnected \/ misaligned|misaligned/i, 'not_working'],
  [/disconnected from what matters|spiritual|faith/i, 'want_practice'],
  [/relief|accomplishment/i, 'relieved'],
  [/wanting to make sense/i, 'making_sense'],
  [/gratitude/i, 'grateful'],
  [/stillness/i, 'need_quiet'],
  [/positive activation/i, 'excited'],
  [/calm|content/i, 'calm'],
];

const ENV_RULES: readonly Rule[] = [
  [/exam hall/i, 'exam_hall'],
  [/placement ward|hospital|clinical/i, 'clinical'],
  [/online meeting/i, 'online_meeting'],
  [/seminar|tutorial/i, 'seminar'],
  [/meeting room/i, 'meeting'],
  [/lecture hall/i, 'lecture'],
  [/open-plan/i, 'open_plan'],
  [/lab|workshop|studio/i, 'lab'],
  [/caring|toddler|child/i, 'caring'],
  [/in bed/i, 'in_bed'],
  [/train station|unfamiliar|client site|airport|travel/i, 'travelling'],
  [/tube|bus|train home|carriage|commut/i, 'transit'],
  [/waiting room|gp /i, 'waiting_room'],
  [/party|social event|birthday/i, 'social_event'],
  [/conference|networking|bar \/ restaurant|restaurant/i, 'public'],
  [/cafe|café/i, 'cafe'],
  [/gym|outdoor|park|campus green/i, 'gym_outdoors'],
  [/prayer/i, 'prayer_room'],
  [/place of worship/i, 'worship'],
  [/library|study room|co-working|focus booth|office, early/i, 'library'],
  [/home|halls|flat|own room|bedroom|living room|kitchen/i, 'home'],
  [/office/i, 'work'],
];

const SOCIAL_RULES: readonly Rule[] = [
  [/^alone/i, 'alone'],
  [/colleague|team|manager|client|nurse|clinician|supervisor/i, 'colleagues'],
  [/peers|classmates|coursemates|students|cohort|candidates/i, 'classmates'],
  [/strangers|crowd|people|passing|twenty|large group/i, 'strangers'],
  [/flatmate|family|toddler|children|sibling/i, 'family'],
  [/friend/i, 'friends'],
];

const TRAIT_RULES: readonly Rule[] = [
  [
    /repl|email|message|respond|answer|tell |draft|say|speak|point|contribute|explain|handover|hand off|report a/i,
    'communication',
  ],
  [
    /first time|brand-new|new training|new experiment|new to me|new feature|start my business/i,
    'first_time',
  ],
  [
    /routine|weekly|done it many times|regular|workflow|filing|invoice|admin|inbox|timesheet/i,
    'done_before',
  ],
  [/dissertation|research|read|explore|topic|question|field/i, 'research'],
  [/group|team|meeting|present|pitch|client|friends|networking|colleague|seminar/i, 'with_others'],
  [
    /present|essay|design|debug|experiment|coding|analysis|project|proposal|plan|application|prototype/i,
    'multi_step',
  ],
  [/enjoy|hobby|for fun/i, 'enjoy'],
  [/reflective log/i, 'reflective_work'],
  [/adjustment/i, 'ask_adjustment'],
  [/stop working|get to sleep|wind down/i, 'stopping'],
  [/get ready for a day/i, 'start_day'],
  [/prayer|devotion/i, 'recurring_practice'],
  [/interview|appointment|exam/i, 'event_prep'],
  [/focus|deep work|notes|untangle|sprint/i, 'focus'],
  [/deadline|due|overdue|late|before handover/i, 'consequence'],
];

const MULTIPLE =
  /three deadlines|two emails|four requests|six goals|five small|dinner, homework|from four ideas|laundry/i;

function matchAll(text: string, rules: readonly Rule[], limit = 3): string[] {
  const out: string[] = [];
  for (const [re, code] of rules) if (re.test(text) && !out.includes(code)) out.push(code);
  return out.slice(0, limit);
}

function firstMatch(text: string, rules: readonly Rule[]): string | undefined {
  return rules.find(([re]) => re.test(text))?.[1];
}

function intensityOf(text: string): number {
  const peak = /peak (\d+)/i.exec(text)?.[1];
  if (peak) return Number(peak);
  if (/very high/i.test(text)) return 9;
  if (/high/i.test(text)) return 7;
  if (/moderate/i.test(text)) return 5;
  if (/mild/i.test(text)) return 2;
  return 5;
}

function sensationsOf(text: string, intensity: number, painLed: boolean): SensationInput[] {
  // Only the Interoception segment counts for body-basics tags ("cold hands" is not "too cold").
  const intero = /interoception:([^|]*)/i.exec(text)?.[1] ?? '';
  const out: SensationInput[] = [];
  if (painLed) out.push({ code: 'sharp_pain', intensity });
  const interoRules: readonly [RegExp, string][] = [
    [/haven.t eaten|hungry|skipped (lunch|dinner)/i, 'hungry'],
    [/thirsty|drunk/i, 'thirsty'],
    [/slept 4 hours|sleepy/i, 'tired_wired'],
    [/\bcold\b/i, 'too_cold'],
  ];
  for (const [re, code] of interoRules)
    if (
      re.test(intero) ||
      (code !== 'too_cold' && re.test(text) && /skipped|hungry|thirsty/i.test(text))
    )
      out.push({ code });
  if (/non-verbal|words won.t come|words not coming/i.test(text))
    out.push({ code: 'cant_speak_aloud' });
  if (/detached|unreal/i.test(text)) out.push({ code: 'detached' });
  return out;
}

function flagsOf(text: string): string[] {
  const names: readonly [RegExp, string][] = [
    [/sound/i, 'sound'],
    [/noise/i, 'noise'],
    [/lights/i, 'lights'],
    [/crowd/i, 'crowd'],
    [/smell/i, 'smell'],
    [/temperature/i, 'temperature'],
    [/touch/i, 'touch'],
    [/visual clutter/i, 'visual_clutter'],
  ];
  return names.filter(([re]) => re.test(text)).map(([, code]) => code);
}

function lightOf(text: string): Light | undefined {
  if (/safety override|red\b/i.test(text)) return 'red';
  if (/blue/i.test(text)) return 'blue';
  if (/amber/i.test(text)) return 'amber';
  if (/yellow|conditional/i.test(text)) return 'yellow';
  if (/green/i.test(text)) return 'green';
  return undefined;
}

function patternsOf(text: string): number[] {
  return (text.match(/\d+(?:\.\d+)?/g) ?? [])
    .map(Number)
    .filter((n) => n >= 1 && n <= 41 && Number.isInteger(n));
}

/** Prose-only facts, keyed by scenario ref. */
const OVERRIDES: Readonly<
  Record<string, { input?: Partial<EngineInput>; signals?: Partial<UserSignals> }>
> = {
  'RF.3': { signals: { recurringStruggleConfirmed: true } },
  // Tab 9 (the founder's unit test) says the context is "Work", not a public setting.
  'E3M2.1': {
    input: { context: { environment: 'work', sensitivity: ['sound', 'noise', 'lights', 'crowd'] } },
  },
  'RF.7': { input: { needs: ['make_sense'] } },
  'MD.3': {
    signals: {
      savedPractices: [
        {
          id: 'p-midday',
          name: 'midday prayer',
          type: 'prayer',
          helpsWhenStruggling: false,
          isTransition: false,
          dueNow: true,
        },
      ],
    },
  },
  'MD.4': {
    signals: {
      savedPractices: [
        {
          id: 'p-evening',
          name: 'evening devotion',
          type: 'prayer',
          helpsWhenStruggling: true,
          isTransition: false,
          dueNow: true,
        },
      ],
    },
  },
  'MD.5': {
    signals: {
      savedPractices: [
        {
          id: 'p-remember',
          name: 'remembrance prayer',
          type: 'prayer',
          helpsWhenStruggling: true,
          isTransition: false,
          dueNow: false,
        },
      ],
    },
  },
  'MD.6': { input: { needs: ['find_stillness'] } },
  'MD.9': {
    signals: {
      savedPractices: [
        {
          id: 'p-morning',
          name: 'morning ritual',
          type: 'ritual',
          helpsWhenStruggling: false,
          isTransition: false,
          dueNow: false,
          opening: true,
        },
      ],
    },
  },
  'GD.1': { input: { intent: 'meditate' } },
  'GD.2': {
    signals: {
      savedPractices: [
        {
          id: 'p-still',
          name: 'stillness',
          type: 'meditation',
          helpsWhenStruggling: true,
          isTransition: false,
          dueNow: false,
        },
      ],
    },
  },
  'RISK.1': { input: { freeText: ["what's the point, I feel like a burden to everyone"] } },
};

function recheckOf(
  stateText: string,
  emotionText: string,
  modsText: string,
): { prev: PreviousOutcome; cell: string } | undefined {
  const cells = /(E[1-4]M[1-4])\s*->\s*(E[1-4]M[1-4])/.exec(stateText);
  if (!cells?.[1] || !cells[2]) return undefined;
  const nums = (emotionText.match(/\((\d+)\)/g) ?? []).map((m) => Number(m.replace(/\D/g, '')));
  const from = nums[0] ?? 7;
  const prevLight = /red\s*->/i.test(modsText)
    ? 'red'
    : /amber\s*->/i.test(modsText)
      ? 'amber'
      : 'yellow';
  const finalBand =
    prevLight === 'red'
      ? 'very_constrained'
      : prevLight === 'amber'
        ? 'constrained'
        : 'conditional';
  const unchanged = /unchanged/i.test(emotionText);
  return {
    cell: cells[2],
    prev: {
      cellId: cells[1],
      finalBand,
      light: prevLight,
      peakIntensity: from,
      supportCompleted: true,
      safetyTriggered: false,
      ...(unchanged ? { pathway: 'regulate', toolId: 'breathe', helped: 'not_really' } : {}),
    },
  };
}

function emotionsOf(
  emotionText: string,
  intensity: number,
  codes: readonly string[],
  isRecheck: boolean,
): EmotionInput[] {
  // Tab 9 / E3M2.1: "Anxious + Restless", peak 8.
  if (/\+/.test(emotionText) && /restless/i.test(emotionText)) {
    return [
      { code: 'anxious', intensity: 7 },
      { code: 'restless', intensity: 8 },
    ];
  }
  const level = isRecheck ? intensityOf(emotionText.split(' to ').pop() ?? '') : intensity;
  return codes
    .filter((e) => e !== 'RISK' && e !== 'NOT_SURE')
    .map((code) => ({ code, intensity: level }));
}

function demandOf(c: (i: number) => string): EngineInput['demand'] {
  if (!/^yes/i.test(c(14))) return undefined;
  const want = c(15);
  return {
    timeline: (/\b(T[0-6]|TX|TR)\b/.exec(c(16))?.[1] ?? 'T6') as TimelineCode,
    traits: matchAll(want, TRAIT_RULES, 10),
    puttingOff: /put off|putting off/i.test(want),
    count: MULTIPLE.test(want) ? 3 : 1,
    title: want,
  };
}

function stateOf(cellText: string, codes: readonly string[]): EngineInput['state'] {
  const cell = /E([1-4])M([1-4])/.exec(cellText);
  if (!cell || codes.includes('NOT_SURE')) return { kind: 'not_sure' };
  return { kind: 'grid', energy: Number(cell[1]), mood: Number(cell[2]) };
}

function contextOf(c: (i: number) => string): ContextInput {
  const environment = firstMatch(c(9), ENV_RULES);
  const social = firstMatch(c(10), SOCIAL_RULES);
  return {
    ...(environment ? { environment } : {}),
    ...(social ? { social } : {}),
    sensitivity: flagsOf(c(13)),
  };
}

function rowToFixture(r: readonly string[], source: Fixture['source']): Fixture | undefined {
  const c = (i: number): string => clean(r[i]);
  const ref = c(0);
  const patterns = patternsOf(c(1));
  if (!ref || patterns.length === 0) return undefined;
  const emotionText = c(6);
  const intensity = intensityOf(c(7));
  const codes = matchAll(emotionText, EMOTION_RULES);
  const recheck = recheckOf(c(2), emotionText, c(23));
  const demand = demandOf(c);
  const input: EngineInput = {
    state: stateOf(recheck?.cell ?? c(2), codes),
    emotions: emotionsOf(emotionText, intensity, codes, recheck !== undefined),
    sensations: sensationsOf(c(8), intensity, /sensation-led \(body: pain\)/i.test(emotionText)),
    context: contextOf(c),
    ...(demand ? { demand } : {}),
    ...(codes.includes('RISK') ? { freeText: ['I feel hopeless'] } : {}),
    ...(recheck ? { recheckOf: recheck.prev } : {}),
    ...(OVERRIDES[ref]?.input ?? {}),
  };
  const signals: UserSignals = {
    plan: 'free',
    hasTrustedContact: true,
    ...(/declined 3/i.test(emotionText) ? { declinesThisSession: 3 } : {}),
    ...(OVERRIDES[ref]?.signals ?? {}),
  };
  const light = source === 'tab0b' ? lightOf(c(24)) : undefined;
  return {
    ref,
    source,
    input,
    signals,
    expect: { patterns, ...(light ? { light } : {}), title: c(20) },
  };
}

export function buildFixtures(tables: WorkbookTables): Fixture[] {
  const fixtures: Fixture[] = [];
  for (const [file, source] of [
    [TAB_FILES.simplified, 'tab0'],
    [TAB_FILES.extended, 'tab0b'],
  ] as const) {
    for (const row of tables.raw.get(file) ?? []) {
      if (!/^(E[1-4]M[1-4]\.\d+|NS\.\d|RISK\.\d|REC\.\d|RF\.\d|MD\.\d+|GD\.\d)/.test(clean(row[0])))
        continue;
      const fixture = rowToFixture(row, source);
      if (fixture) fixtures.push(fixture);
    }
  }
  return fixtures;
}
