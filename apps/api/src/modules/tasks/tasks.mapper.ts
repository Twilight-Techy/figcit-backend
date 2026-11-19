import type { Snapshot, TimelineCode } from '@figcit/engine';
import type { Prisma } from '@prisma/client';
import type { UserCipher } from '../../common/crypto/crypto.service.js';
import { timelineFor } from '../../common/time/timeline.js';
import type { TaskDto } from './tasks.schemas.js';

export const TASK_SELECT = {
  id: true,
  titleEnc: true,
  type: true,
  timelineCode: true,
  dueAt: true,
  recurrenceRule: true,
  puttingOff: true,
  nucripceTags: true,
  status: true,
  source: true,
  snoozedUntil: true,
  planSlot: true,
  planDate: true,
  planStart: true,
  planMinutes: true,
  skipCount: true,
  stepMinutes: true,
  breakMinutes: true,
  adaptCodes: true,
  doneAt: true,
  createdAt: true,
  updatedAt: true,
  steps: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      position: true,
      textEnc: true,
      source: true,
      doneAt: true,
      later: true,
      adaptCodes: true,
    },
  },
} satisfies Prisma.TaskSelect;
export type TaskRow = Prisma.TaskGetPayload<{ select: typeof TASK_SELECT }>;

/** The timeline moves as the due date gets closer, so it's worked out on read when there is one. */
export function liveTimeline(
  row: {
    dueAt: Date | null;
    timelineCode: TimelineCode | null;
    recurrenceRule: string | null;
    status: string;
  },
  now: Date,
  timeZone: string,
): TimelineCode | null {
  if (row.dueAt && row.status === 'open') return timelineFor(row.dueAt, now, timeZone);
  if (row.recurrenceRule && !row.timelineCode) return 'TR';
  return row.timelineCode;
}

export function toTaskDto(
  row: TaskRow,
  cipher: UserCipher,
  snapshot: Snapshot,
  now: Date,
  timeZone: string,
): TaskDto {
  const timeline = liveTimeline(row, now, timeZone);
  const meta = snapshot.timelines.find((t) => t.code === timeline);
  return {
    id: row.id,
    title: cipher.dec(row.titleEnc),
    kind: row.type,
    dueAt: row.dueAt?.toISOString() ?? null,
    timeline,
    timelineLabel: meta?.label ?? null,
    stepCap: meta?.stepCap ?? 8,
    recurrenceRule: row.recurrenceRule,
    puttingOff: row.puttingOff,
    drivers: row.nucripceTags,
    status: row.status,
    source: row.source,
    snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
    planSlot: row.planSlot,
    planDate: row.planDate?.toISOString().slice(0, 10) ?? null,
    planStart: row.planStart,
    planMinutes: row.planMinutes,
    skipCount: row.skipCount,
    stepMinutes: row.stepMinutes,
    breakMinutes: row.breakMinutes,
    adaptCodes: row.adaptCodes,
    doneAt: row.doneAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    steps: row.steps.map((s) => ({
      id: s.id,
      position: s.position,
      text: cipher.dec(s.textEnc),
      source: s.source,
      done: s.doneAt !== null,
      later: s.later,
      adaptCodes: s.adaptCodes,
    })),
  };
}
