// Deterministic building blocks for the persona seed: same data every run.
import type { CheckInInput } from '../../../src/modules/checkin/checkin.schemas.js';

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(r: () => number, xs: readonly T[]): T =>
  xs[Math.floor(r() * xs.length)] as T;

type Body = Omit<
  CheckInInput,
  'origin' | 'entry' | 'justSupport' | 'emotions' | 'sensations' | 'context' | 'needs'
> &
  Partial<CheckInInput>;

/** Check-ins that between them reach every light and most patterns (Tabs 0/0b). */
export const CHECKINS = {
  green: {
    state: { kind: 'grid', energy: 4, mood: 4 },
    emotions: [{ code: 'focused', intensity: 6 }],
    context: { environment: 'home', social: 'alone', time: 'no_rush' },
    needs: ['get_started'],
    demand: { title: 'Plan the week', kind: 'work', timeline: 'T2', traits: ['multi_step'] },
  },
  calm: {
    state: { kind: 'grid', energy: 3, mood: 4 },
    emotions: [{ code: 'calm', intensity: 5 }],
    context: { environment: 'home', social: 'alone' },
    needs: ['find_stillness'],
  },
  yellow: {
    state: { kind: 'grid', energy: 3, mood: 3 },
    emotions: [{ code: 'tired', intensity: 4 }],
    context: { environment: 'work', social: 'colleagues', time: 'some_time' },
    needs: ['break_down'],
    demand: {
      title: 'Reply to the client email',
      kind: 'work',
      timeline: 'T1',
      traits: ['communication'],
    },
  },
  amber: {
    state: { kind: 'grid', energy: 2, mood: 2 },
    emotions: [{ code: 'overwhelmed', intensity: 6 }],
    context: {
      // A formal setting with two flags, so CX-1 lowers the band (was v1's invented "open plan").
      environment: 'meeting',
      social: 'colleagues',
      time: 'limited',
      sensitivity: ['noise', 'crowd'],
    },
    needs: ['clear_head'],
  },
  amberDemand: {
    state: { kind: 'grid', energy: 2, mood: 1 },
    emotions: [{ code: 'anxious', intensity: 7 }],
    context: { environment: 'school', social: 'classmates', time: 'limited' },
    needs: ['get_started'],
    demand: {
      title: 'Essay draft due tomorrow',
      kind: 'study',
      timeline: 'T2',
      traits: ['multi_step', 'consequence'],
      puttingOff: true,
    },
  },
  red: {
    state: { kind: 'grid', energy: 1, mood: 1 },
    emotions: [{ code: 'numb', intensity: 8 }],
    context: { environment: 'in_bed', social: 'alone' },
    needs: ['rest'],
  },
  racing: {
    state: { kind: 'grid', energy: 4, mood: 1 },
    sensations: [{ code: 'racing_thoughts', intensity: 8 }],
    context: { environment: 'home', social: 'family' },
    needs: ['clear_head'],
  },
  words: {
    state: { kind: 'grid', energy: 3, mood: 2 },
    emotions: [{ code: 'frustrated', intensity: 6 }],
    context: { environment: 'home', social: 'alone' },
    needs: ['find_words'],
    demand: {
      title: 'Ask my manager for an adjustment',
      kind: 'work',
      timeline: 'T3',
      traits: ['communication', 'ask_adjustment'],
    },
  },
  lonely: {
    state: { kind: 'grid', energy: 2, mood: 2 },
    emotions: [{ code: 'lonely', intensity: 6 }],
    context: { environment: 'home', social: 'alone' },
    needs: ['someone_to_talk'],
  },
  grief: {
    state: { kind: 'grid', energy: 2, mood: 2 },
    emotions: [{ code: 'grief', intensity: 6 }],
    context: { environment: 'home', social: 'alone' },
    needs: ['feel_calmer'],
  },
  sensory: {
    state: { kind: 'grid', energy: 3, mood: 2 },
    sensations: [
      { code: 'overstimulated', intensity: 7 },
      { code: 'loud_sound', intensity: 7 },
      { code: 'bright_lights', intensity: 6 },
    ],
    context: {
      environment: 'mall',
      social: 'strangers',
      sensitivity: ['sound', 'lights', 'crowd'],
    },
    needs: ['feel_calmer'],
  },
  peopled: {
    state: { kind: 'grid', energy: 1, mood: 3 },
    sensations: [{ code: 'masking_heavily', intensity: 6 }],
    context: { environment: 'home', social: 'alone' },
    needs: ['recover_event'],
  },
  stuck: {
    state: { kind: 'grid', energy: 2, mood: 3 },
    emotions: [{ code: 'frustrated', intensity: 6 }],
    context: { environment: 'school', social: 'strangers' },
    needs: ['get_started'],
    demand: { title: 'Revise chapter 4', kind: 'study', timeline: 'T3', traits: ['focus'] },
  },
  notSure: { state: { kind: 'not_sure', answers: [] } },
  quick: { entry: 'quick', state: { kind: 'grid', energy: 3, mood: 3 }, needs: ['feel_calmer'] },
} satisfies Record<string, Body>;

export type CheckInKey = keyof typeof CHECKINS;

export const HARD_DAY: readonly CheckInKey[] = [
  'amber',
  'amberDemand',
  'red',
  'racing',
  'sensory',
  'lonely',
  'grief',
  'words',
];
export const OK_DAY: readonly CheckInKey[] = [
  'green',
  'calm',
  'yellow',
  'stuck',
  'peopled',
  'words',
  'quick',
];

export const TASKS = [
  { title: 'Submit the timesheet', kind: 'work', drivers: ['routine'], timeline: 'T1' },
  { title: 'Book a GP appointment', kind: 'health', drivers: [], timeline: 'T3' },
  {
    title: 'Write the project proposal',
    kind: 'work',
    drivers: ['challenge', 'passion'],
    timeline: 'T2',
  },
  { title: 'Weekly shop', kind: 'home', drivers: ['routine'], timeline: 'T2' },
  { title: "Reply to Sam's message", kind: 'social', drivers: ['collaboration'], timeline: 'T0' },
  {
    title: 'Read the new research paper',
    kind: 'study',
    drivers: ['interest', 'exploration'],
    timeline: 'T4',
  },
  { title: 'Renew the bus pass', kind: 'home', drivers: [], timeline: 'TX' },
] as const;

export const DUMP_TEXT =
  'Call the dentist about Thursday\nWhat if the meeting goes badly\nMaybe repaint the hallway green\nThe printer code is 4412\nBuy oat milk\nRemember to send the slides to Priya';
