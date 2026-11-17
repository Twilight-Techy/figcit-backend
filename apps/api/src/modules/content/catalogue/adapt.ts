// The Adapt library (S24, S120–S123, S129): change the conditions, not the person.

export interface AdaptOption {
  readonly code: string;
  readonly label: string;
  readonly detail: string;
}
export interface AdaptKind {
  readonly kind:
    'environment' | 'scope' | 'modality' | 'pace' | 'sequence' | 'instructions' | 'communication';
  readonly title: string;
  readonly summary: string;
  readonly options: readonly AdaptOption[];
}

export const ADAPT_LIBRARY: readonly AdaptKind[] = [
  {
    kind: 'environment',
    title: 'Change the space',
    summary: 'Quieter or less lit space',
    options: [
      { code: 'move_quieter', label: 'Move somewhere quieter', detail: 'Library, empty room, car' },
      {
        code: 'soften_light',
        label: 'Dim or soften the light',
        detail: 'Lower brightness, warm tone',
      },
      { code: 'block_sound', label: 'Block out sound', detail: 'Headphones, white noise' },
      { code: 'clear_space', label: 'Clear a small space', detail: 'Just your desk, not the room' },
      {
        code: 'change_position',
        label: 'Change position',
        detail: 'Stand, sit on the floor, lie down',
      },
      {
        code: 'find_prayer_room',
        label: 'Find a quiet or prayer room',
        detail: 'If one is bookable nearby',
      },
    ],
  },
  {
    kind: 'scope',
    title: 'Make it smaller',
    summary: 'Do less, still count it',
    options: [
      { code: 'first_sentence', label: 'Just the first sentence', detail: '~2 min' },
      { code: 'outline_only', label: 'Only an outline in bullets', detail: '~4 min' },
      { code: 'open_file', label: "Open the file, that's it", detail: '~30 sec' },
      { code: 'smaller_piece', label: 'One smaller piece', detail: 'Pick the easiest part' },
      { code: 'good_enough', label: 'Good enough, not perfect', detail: 'Lower the bar for today' },
    ],
  },
  {
    kind: 'modality',
    title: 'Change how',
    summary: 'Voice instead of typing',
    options: [
      { code: 'speak_it', label: 'Speak it', detail: 'Voice instead of typing' },
      { code: 'handwrite', label: 'Handwrite', detail: 'Paper first, type later' },
      { code: 'visual', label: 'Visual', detail: 'Mind-map or sketch' },
      { code: 'talk_through', label: 'Talk it through', detail: 'Explain it to someone' },
    ],
  },
  {
    kind: 'pace',
    title: 'Change the pace',
    summary: 'Slower blocks with breaks',
    options: [
      { code: 'block_5', label: '5-minute blocks', detail: 'Break after each' },
      { code: 'block_10', label: '10-minute blocks', detail: 'Break after each' },
      { code: 'block_15', label: '15-minute blocks', detail: 'Break after each' },
      { code: 'block_25', label: '25-minute blocks', detail: 'Break after each' },
      { code: 'break_2', label: '2-minute breaks', detail: 'Between blocks' },
      { code: 'break_5', label: '5-minute breaks', detail: 'Between blocks' },
    ],
  },
  {
    kind: 'sequence',
    title: 'Change the order',
    summary: 'Rearrange the steps',
    options: [
      { code: 'easiest_first', label: 'Easiest step first', detail: 'Build a little momentum' },
      { code: 'hardest_first', label: 'Hardest step first', detail: 'Get it out of the way' },
      { code: 'reorder_steps', label: 'Choose my own order', detail: 'Drag the steps' },
    ],
  },
  {
    kind: 'instructions',
    title: 'Simplify the instructions',
    summary: 'Simplify or reframe',
    options: [
      { code: 'one_at_a_time', label: 'One instruction at a time', detail: 'Hide the rest' },
      { code: 'plain_words', label: 'Plain words', detail: 'Shorter sentences' },
      { code: 'example_first', label: 'Show an example first', detail: 'See what done looks like' },
    ],
  },
  {
    kind: 'communication',
    title: 'Change how you communicate',
    summary: 'Written point instead of speaking aloud',
    options: [
      { code: 'written_point', label: 'Written point instead of speaking', detail: 'Chat or note' },
      { code: 'voice_note', label: 'Voice note', detail: 'In your own time' },
      { code: 'comm_card', label: 'Show a communication card', detail: 'No words needed' },
      { code: 'someone_speaks', label: 'Someone speaks with me', detail: 'A trusted person' },
    ],
  },
];

/** Always free: cards to show when speaking is hard (Adapt communication, Help). */
export const COMM_CARDS: readonly { code: string; text: string }[] = [
  { code: 'need_minute', text: 'I need a minute. I am okay, just give me some space.' },
  { code: 'cant_speak', text: "I can't talk right now. I can write or type instead." },
  { code: 'too_loud', text: 'It is too loud for me here. Can we move somewhere quieter?' },
  { code: 'need_written', text: 'Could you write that down for me, please?' },
  { code: 'need_help', text: 'I need help. Please stay with me.' },
  {
    code: 'autistic',
    text: "I'm neurodivergent. I may need more time to process. Please be patient with me.",
  },
];
