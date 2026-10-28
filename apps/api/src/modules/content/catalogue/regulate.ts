// Regulate tool scripts (S15, S96–S98): what each free tool shows, step by step. Always free.

export const BREATHE_PATTERNS = [
  { code: 'in4_out6', label: 'In for 4, out for 6', inhale: 4, hold: 0, exhale: 6, holdAfter: 0 },
  {
    code: 'box',
    label: 'Box: 4 in, 4 hold, 4 out, 4 hold',
    inhale: 4,
    hold: 4,
    exhale: 4,
    holdAfter: 4,
  },
  { code: 'sigh', label: 'Double in, long sigh out', inhale: 3, hold: 1, exhale: 7, holdAfter: 0 },
] as const;

export const GROUND_STEPS = [
  { count: 5, sense: 'see', text: 'Name five things you can see.' },
  {
    count: 4,
    sense: 'touch',
    text: 'Notice four things you can feel. Your feet on the floor counts.',
  },
  { count: 3, sense: 'hear', text: 'Listen for three sounds.' },
  { count: 2, sense: 'smell', text: 'Find two things you can smell, or two smells you like.' },
  { count: 1, sense: 'taste', text: 'Notice one thing you can taste, or take a sip of water.' },
] as const;

export const MOVE_ROUTINES = [
  {
    code: 'desk',
    label: 'At a desk',
    moves: [
      {
        name: 'Shoulder rolls',
        text: 'Roll both shoulders back slowly, 5 times. Seated is fine.',
        seconds: 60,
      },
      {
        name: 'Hand squeeze',
        text: 'Squeeze your hands into fists, then let go. 5 times.',
        seconds: 45,
      },
      {
        name: 'Neck release',
        text: 'Tip one ear towards your shoulder, then the other. Slowly.',
        seconds: 60,
      },
      {
        name: 'Press down',
        text: 'Press your feet into the floor and your hands onto the desk for 10 seconds.',
        seconds: 45,
      },
    ],
  },
  {
    code: 'shake_out',
    label: 'Shake-out',
    moves: [
      { name: 'Shake hands', text: 'Shake out your hands, loose and quick.', seconds: 30 },
      { name: 'Shake arms', text: 'Let your arms join in.', seconds: 30 },
      { name: 'Bounce', text: 'Small bounces on your heels if you can.', seconds: 30 },
      { name: 'Still', text: 'Stop and notice how your body feels now.', seconds: 30 },
    ],
  },
] as const;

export const STEP_OUT_PROMPTS = [
  'Notice the temperature change',
  'Look at something far away',
  'Breathe out longer than in',
] as const;

export const SOUNDS = [
  { code: 'brown_noise', label: 'Brown noise', tier: 'free', file: 'sounds/brown-noise.mp3' },
  { code: 'white_noise', label: 'White noise', tier: 'free', file: 'sounds/white-noise.mp3' },
  { code: 'rain', label: 'Rainfall', tier: 'free', file: 'sounds/rain.mp3' },
  { code: 'river', label: 'River flow', tier: 'free', file: 'sounds/river.mp3' },
  { code: 'birds', label: 'Birds chirping', tier: 'advanced', file: 'sounds/birds.mp3' },
  { code: 'hum', label: 'Hum', tier: 'advanced', file: 'sounds/hum.mp3' },
  { code: 'quiet_timer', label: 'Quiet timer', tier: 'free', file: null },
] as const;

export const WIN_SIZES = ['small', 'medium', 'huge'] as const;
