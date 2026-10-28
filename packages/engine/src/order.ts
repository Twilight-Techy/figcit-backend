// State-aware task order with a "why now" (FR-M08-02, S20). Pure: the API and the device share it.
import type { Driver, Light, Snapshot, TimelineCode } from './types.js';

export interface OrderableTask {
  readonly id: string;
  readonly timeline: TimelineCode | null;
  readonly drivers: readonly Driver[];
  /** Tab 6 demand characteristics, e.g. done_before, multi_step. */
  readonly traits?: readonly string[];
  readonly stepsLeft: number;
  readonly puttingOff: boolean;
  readonly skipCount: number;
  readonly planSlot?: 'now' | 'later' | 'not_today' | null;
}

export type WhyNowCode =
  | 'due_now'
  | 'due_today'
  | 'overdue_small_step'
  | 'familiar'
  | 'enjoyable'
  | 'quick'
  | 'picked_for_now'
  | 'gentle_start'
  | 'no_rush'
  | 'later';

export interface OrderedTask {
  readonly id: string;
  readonly score: number;
  readonly whyNow: WhyNowCode;
  readonly whyNowText: string;
  /** Under strain: shown, but suggested only if it truly can't wait. */
  readonly onlyIfMust: boolean;
}

export const WHY_NOW_TEXT: Readonly<Record<WhyNowCode, string>> = {
  due_now: 'Due within the hour',
  due_today: 'Due later today',
  overdue_small_step: 'Past its date — one small step counts',
  familiar: "A familiar one — you've done this before",
  enjoyable: 'Something you usually enjoy',
  quick: 'Quick to finish',
  picked_for_now: 'You picked this for now',
  gentle_start: 'A gentle place to start',
  no_rush: 'No rush — when you have room',
  later: 'Saved for later',
};

const STRAINED: ReadonlySet<Light> = new Set(['amber', 'red']);
const EASY: ReadonlySet<Driver> = new Set(['routine', 'interest', 'passion']);
const HEAVY: ReadonlySet<Driver> = new Set(['challenge', 'novelty']);

function urgencyOf(snapshot: Snapshot, code: TimelineCode | null): number {
  if (!code) return 0;
  if (code === 'TX') return 0.9;
  return snapshot.timelines.find((t) => t.code === code)?.urgency ?? 0;
}

function driverScore(t: OrderableTask, gentle: boolean): number {
  let score = 0;
  for (const d of t.drivers) {
    if (EASY.has(d)) score += gentle ? 15 : 6;
    if (HEAVY.has(d)) score += gentle ? -15 : 8;
  }
  if (t.traits?.includes('done_before')) score += gentle ? 10 : 3;
  if (t.traits?.includes('multi_step') && gentle) score -= 8;
  return score;
}

const SLOT_SCORE = { now: 50, later: 0, not_today: -80 } as const;

function scoreOf(t: OrderableTask, light: Light, snapshot: Snapshot): number {
  const strained = STRAINED.has(light);
  const gentle = strained || light === 'blue';
  let score = urgencyOf(snapshot, t.timeline) * (strained ? 40 : 60);
  score += t.planSlot ? SLOT_SCORE[t.planSlot] : 0;
  score += driverScore(t, gentle);
  if (t.stepsLeft > 0 && t.stepsLeft <= 2) score += gentle ? 12 : 5;
  // Something put off many times is offered gently, not pushed to the top.
  score -= Math.min(t.skipCount, 5) * (gentle ? 3 : 1);
  return Math.round(score * 10) / 10;
}

function whyNowOf(t: OrderableTask, light: Light): WhyNowCode {
  const gentle = STRAINED.has(light) || light === 'blue';
  if (t.planSlot === 'not_today') return 'later';
  if (t.timeline === 'T0') return 'due_now';
  if (t.timeline === 'TX') return 'overdue_small_step';
  if (t.planSlot === 'now') return 'picked_for_now';
  if (t.timeline === 'T1') return 'due_today';
  if (t.stepsLeft > 0 && t.stepsLeft <= 2) return 'quick';
  if (t.drivers.includes('routine') || t.traits?.includes('done_before')) return 'familiar';
  if (t.drivers.includes('interest') || t.drivers.includes('passion')) return 'enjoyable';
  return gentle ? 'gentle_start' : 'no_rush';
}

/** Orders open tasks for the current light. Ties keep the caller's order (stable). */
export function orderTasks(
  tasks: readonly OrderableTask[],
  light: Light,
  snapshot: Snapshot,
): OrderedTask[] {
  const strained = STRAINED.has(light);
  return tasks
    .map((t, i) => ({ t, i, score: scoreOf(t, light, snapshot) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(({ t, score }) => {
      const whyNow = whyNowOf(t, light);
      return {
        id: t.id,
        score,
        whyNow,
        whyNowText: WHY_NOW_TEXT[whyNow],
        onlyIfMust: strained && t.drivers.some((d) => HEAVY.has(d)) && t.timeline !== 'T0',
      };
    });
}
