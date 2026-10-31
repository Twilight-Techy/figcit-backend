// Whether a due reminder may be pushed now, or goes to the inbox instead (SYSTEM_DESIGN §10, MD-5, S48).
import { localParts } from '../../common/time/timeline.js';

export type Category = 'checkin' | 'tasks' | 'practices' | 'recheck' | 'custom';
export type Decision =
  | 'sent'
  | 'held_quiet_hours'
  | 'held_in_worship'
  | 'held_cap'
  | 'held_category'
  | 'held_style'
  | 'held_capacity';

export interface PolicyInput {
  readonly now: Date;
  readonly timeZone: string;
  readonly category: Category;
  readonly style: 'gentle' | 'standard' | 'silent' | 'off';
  readonly categories: readonly string[];
  readonly quietStart: number | null;
  readonly quietEnd: number | null;
  readonly inWorship: boolean;
  readonly inWorshipUntil: Date | null;
  /** Task nudges already pushed today in the user's time zone. */
  readonly taskNudgesToday: number;
  /** The latest light, when the user checked in recently. */
  readonly light: string | null;
}

export const TASK_NUDGE_CAP = 2;
/** Defaults from CONFLICTS (DECISIONS B-13): 21:00–08:00. */
export const DEFAULT_QUIET = { start: 21 * 60, end: 8 * 60 } as const;

export function inQuietHours(minutes: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

const CATEGORY_PREF: Readonly<Record<Category, string>> = {
  checkin: 'checkin',
  tasks: 'tasks',
  practices: 'practices',
  recheck: 'recheck',
  custom: 'tasks',
};

export function decide(p: PolicyInput): Decision {
  if (p.style === 'off') return 'held_style';
  if (p.category !== 'custom' && !p.categories.includes(CATEGORY_PREF[p.category]))
    return 'held_category';
  if (p.inWorship && (!p.inWorshipUntil || p.inWorshipUntil > p.now)) return 'held_in_worship';
  const local = localParts(p.now, p.timeZone).minutes;
  if (inQuietHours(local, p.quietStart ?? DEFAULT_QUIET.start, p.quietEnd ?? DEFAULT_QUIET.end))
    return 'held_quiet_hours';
  // Capacity tuning: after an Amber or Red check-in, no task nudges; practices and re-checks still go.
  if (p.category === 'tasks' && (p.light === 'amber' || p.light === 'red')) return 'held_capacity';
  if (p.category === 'tasks' && p.taskNudgesToday >= TASK_NUDGE_CAP) return 'held_cap';
  return 'sent';
}

/** Payloads never carry personal text (SYSTEM_DESIGN §10). */
export const PUSH_TEXT: Readonly<Record<Category, { title: string; body: string; url: string }>> = {
  checkin: {
    title: 'FigCit',
    body: 'A gentle check-in is here when you want it.',
    url: '/check-in/',
  },
  tasks: { title: 'FigCit', body: 'A gentle reminder is waiting.', url: '/tasks/' },
  practices: { title: 'FigCit', body: 'Your practice time is coming up.', url: '/meditate/' },
  recheck: {
    title: 'FigCit',
    body: 'Want to check how you are now?',
    url: '/check-in/?recheck=1',
  },
  custom: { title: 'FigCit', body: 'A gentle reminder is waiting.', url: '/inbox/' },
};
