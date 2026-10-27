// Step templates per kind of task (breakDownTask fallback, shown at once; S19, S21, S127).

export interface Step {
  readonly text: string;
  readonly minutes: number;
}

const TEMPLATES: readonly (readonly [RegExp, readonly Step[]])[] = [
  [
    /\b(email|message|reply|text|letter)\b/,
    [
      { text: 'Open a new draft', minutes: 1 },
      { text: 'Write one line saying what you need', minutes: 3 },
      { text: 'Add one line of context', minutes: 3 },
      { text: 'Read it once out loud', minutes: 2 },
      { text: 'Send it, or save it for later', minutes: 1 },
    ],
  ],
  [
    /\b(call|ring|phone)\b/,
    [
      { text: 'Find the number', minutes: 2 },
      { text: 'Write down the one thing you need to say', minutes: 3 },
      { text: 'Choose a quiet spot', minutes: 2 },
      { text: 'Make the call', minutes: 10 },
      { text: 'Note what was agreed', minutes: 2 },
    ],
  ],
  [
    /\b(essay|report|assignment|dissertation|coursework|write|writing)\b/,
    [
      { text: 'Open the document and the brief', minutes: 2 },
      { text: 'Write the title and three headings', minutes: 5 },
      { text: 'Jot two bullet points under the first heading', minutes: 5 },
      { text: 'Turn those bullets into rough sentences', minutes: 15 },
      { text: 'Do the next heading the same way', minutes: 20 },
      { text: 'Read it through once and fix only what jumps out', minutes: 15 },
      { text: 'Add references or sources', minutes: 15 },
      { text: 'Save and submit', minutes: 5 },
    ],
  ],
  [
    /\b(revis|exam|study|read|lecture|test)\b/,
    [
      { text: 'Get your notes or the reading open', minutes: 2 },
      { text: 'Pick one topic only', minutes: 2 },
      { text: 'Read for ten minutes', minutes: 10 },
      { text: 'Write three things you remember', minutes: 5 },
      { text: 'Check them against your notes', minutes: 5 },
      { text: 'Take a short break, then pick the next topic', minutes: 5 },
    ],
  ],
  [
    /\b(clean|tidy|laundry|dishes|wash|hoover|vacuum)\b/,
    [
      { text: 'Put on something to listen to', minutes: 1 },
      { text: 'Clear one surface', minutes: 5 },
      { text: 'Put away five things', minutes: 5 },
      { text: 'Do the next small area', minutes: 10 },
      { text: 'Stop and look at what you did', minutes: 1 },
    ],
  ],
  [
    /\b(presentation|slides|talk|speech)\b/,
    [
      { text: 'Write the one message you want people to remember', minutes: 5 },
      { text: 'List three points that support it', minutes: 5 },
      { text: 'Make one slide per point', minutes: 20 },
      { text: 'Add a title and a closing slide', minutes: 10 },
      { text: 'Say it out loud once', minutes: 10 },
    ],
  ],
  [
    /\b(appointment|doctor|gp|dentist|form|application|apply)\b/,
    [
      { text: 'Find what you need (details, number, link)', minutes: 3 },
      { text: 'Write down your questions or answers', minutes: 5 },
      { text: 'Fill in or book the first part', minutes: 10 },
      { text: 'Finish the rest', minutes: 10 },
      { text: 'Put the date in your calendar', minutes: 2 },
    ],
  ],
];

const GENERIC: readonly Step[] = [
  { text: 'Get what you need in front of you', minutes: 2 },
  { text: 'Do the smallest first part', minutes: 5 },
  { text: 'Do the next part', minutes: 10 },
  { text: 'Check what is left', minutes: 2 },
  { text: 'Finish or plan the rest', minutes: 10 },
];

/** Template steps within the timeline's step cap; under Amber or Red only the smallest steps. */
export function breakDownByRules(
  title: string,
  stepCap: number,
  strained: boolean,
): { steps: Step[]; estimatedDemand: 'low' | 'moderate' | 'heavy' } {
  const t = title.toLowerCase();
  const template = TEMPLATES.find(([re]) => re.test(t))?.[1] ?? GENERIC;
  const cap = Math.max(1, Math.min(stepCap, strained ? 3 : stepCap));
  const steps = template
    .slice(0, cap)
    .map((s) => (strained ? { ...s, minutes: Math.min(s.minutes, 5) } : s));
  const total = template.reduce((n, s) => n + s.minutes, 0);
  return {
    steps: [...steps],
    estimatedDemand: total <= 15 ? 'low' : total <= 45 ? 'moderate' : 'heavy',
  };
}
