// Reflect prompt sets: exactly three prompts, chips or own words, stop at any point (RF-3; S42, S132–S134).

export interface ReflectPrompt {
  readonly id: string;
  readonly text: string;
  readonly chips: readonly string[];
}
export interface ReflectVariant {
  readonly code: string;
  readonly toolId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly minutes: number;
  readonly kind: 'prompts' | 'journal' | 'win';
  readonly tier: 'free' | 'advanced';
  readonly prompts: readonly ReflectPrompt[];
}

export const REFLECT_VARIANTS: readonly ReflectVariant[] = [
  {
    code: 'make_sense',
    toolId: 'reflect_checkout',
    title: 'Make sense of today',
    subtitle: 'Three prompts. Stop anytime.',
    minutes: 3,
    kind: 'prompts',
    tier: 'free',
    prompts: [
      {
        id: 'what_happened',
        text: 'What happened?',
        chips: ['A meeting', 'A conversation', 'Work or study', 'At home', 'Something else'],
      },
      {
        id: 'what_helped',
        text: 'What helped, even a little?',
        chips: ['Taking a break', 'Talking to someone', 'Writing it down', 'Moving', 'Nothing yet'],
      },
      {
        id: 'take_forward',
        text: 'One thing to take forward',
        chips: ['Ask earlier', 'Smaller steps', 'Rest first', 'Say no sooner', 'Keep doing this'],
      },
    ],
  },
  {
    code: 'end_of_day',
    toolId: 'end_of_day',
    title: 'Close the day',
    subtitle: 'A gentle look back, then let it rest.',
    minutes: 3,
    kind: 'prompts',
    tier: 'free',
    prompts: [
      {
        id: 'took_energy',
        text: 'What took energy today?',
        chips: ['A call', 'Travel', 'People', 'Noise', 'A task'],
      },
      {
        id: 'gave_back',
        text: 'What gave a little back?',
        chips: [
          'A walk',
          'Someone I talked to',
          'Rest',
          'Finishing something',
          'Music',
          "Nothing much, and that's okay",
        ],
      },
      {
        id: 'into_tomorrow',
        text: 'One thing to take into tomorrow',
        chips: ['Start small', 'Ask for help', 'Plan a break', 'Leave it for now'],
      },
    ],
  },
  {
    code: 'gratitude',
    toolId: 'gratitude_note',
    title: 'Gratitude note',
    subtitle: 'Small things count.',
    minutes: 2,
    kind: 'prompts',
    tier: 'free',
    prompts: [
      {
        id: 'small_good',
        text: 'One small good thing from today',
        chips: ['A warm drink', 'A kind message', 'Quiet time', 'Sunlight', 'Food I liked'],
      },
      {
        id: 'someone',
        text: 'Someone or something that made it easier',
        chips: ['A friend', 'Family', 'A pet', 'A place', 'Myself'],
      },
      {
        id: 'notice',
        text: 'What would you like to notice again?',
        chips: ['This feeling', 'This place', 'This person', 'This time of day'],
      },
    ],
  },
  {
    code: 'what_helped',
    toolId: 'what_helped',
    title: 'What helped',
    subtitle: 'Notice what worked, so it is easier to find next time.',
    minutes: 3,
    kind: 'prompts',
    tier: 'advanced',
    prompts: [
      {
        id: 'situation',
        text: 'When was it hard?',
        chips: ['Mornings', 'Before a deadline', 'After people', 'Busy places'],
      },
      {
        id: 'tool',
        text: 'What helped most?',
        chips: ['Breathe', 'Ground', 'Dump', 'Smaller steps', 'Headphones', 'Talking to someone'],
      },
      {
        id: 'reuse',
        text: 'When could you try it again?',
        chips: ['Next time it happens', 'Before it starts', 'Every morning', 'Not sure yet'],
      },
    ],
  },
  {
    code: 'self_advocacy',
    toolId: 'self_advocacy',
    title: 'Prepare to ask',
    subtitle: 'Get clear on what you need before you ask for it.',
    minutes: 8,
    kind: 'prompts',
    tier: 'advanced',
    prompts: [
      {
        id: 'need',
        text: 'What do you need?',
        chips: [
          'More time',
          'A quieter space',
          'Written instructions',
          'Fewer meetings',
          'A break',
        ],
      },
      {
        id: 'why',
        text: 'Why would it help?',
        chips: ['I focus better', 'Less overwhelm', 'I can show my best work', 'I can stay well'],
      },
      {
        id: 'ask_how',
        text: 'How would you like to ask?',
        chips: ['Email', 'In person', 'With a script', 'Someone with me'],
      },
    ],
  },
  {
    code: 'journal',
    toolId: 'reflect_checkout',
    title: 'Journal',
    subtitle: 'Write anything. Only you see it.',
    minutes: 3,
    kind: 'journal',
    tier: 'free',
    prompts: [{ id: 'entry', text: "What's on your mind?", chips: [] }],
  },
  {
    code: 'win',
    toolId: 'gratitude_note',
    title: 'Name a win',
    subtitle: 'Any size counts. Getting out of bed counts.',
    minutes: 1,
    kind: 'win',
    tier: 'free',
    prompts: [
      {
        id: 'win',
        text: 'What went okay?',
        chips: [
          'Ate a proper meal',
          'Asked for help',
          'Took a break',
          'Finished a step',
          'Went outside',
          'Rested without guilt',
        ],
      },
    ],
  },
];
