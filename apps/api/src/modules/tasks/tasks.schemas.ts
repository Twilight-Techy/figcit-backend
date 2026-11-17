import { z } from 'zod';
import { queryBool } from '../../common/http/query.js';

export const TIMELINES = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'TX', 'TR'] as const;
export const KINDS = ['study', 'work', 'health', 'social', 'home', 'other'] as const;
const DRIVER = z.enum([
  'novelty',
  'urgency',
  'challenge',
  'routine',
  'interest',
  'passion',
  'collaboration',
  'exploration',
]);
const title = z.string().trim().min(1).max(200);
const stepText = z.string().trim().min(1).max(200);
/** An Adapt library option code (content `adapt.library`); the app shows its label. */
const adaptCodes = z.array(z.string().regex(/^[a-z0-9_]{1,40}$/)).max(12);
/** Pace from Adapt: minutes per step and break between steps (S123). */
const paceMinutes = z.number().int().min(1).max(60);

export const taskCreateSchema = z
  .object({
    id: z.uuid().optional(),
    title,
    kind: z.enum(KINDS).optional(),
    dueAt: z.iso.datetime().optional(),
    timeline: z.enum(TIMELINES).optional(),
    recurrenceRule: z.string().max(200).optional(),
    puttingOff: z.boolean().default(false),
    drivers: z.array(DRIVER).max(8).default([]),
    steps: z.array(stepText).max(20).default([]),
    source: z.enum(['manual', 'dump', 'express']).default('manual'),
    planSlot: z.enum(['now', 'later', 'not_today']).optional(),
    clientUpdatedAt: z.iso.datetime().optional(),
  })
  .strict();
export type TaskCreate = z.infer<typeof taskCreateSchema>;

export const taskUpdateSchema = z
  .object({
    title: title.optional(),
    kind: z.enum(KINDS).nullable().optional(),
    dueAt: z.iso.datetime().nullable().optional(),
    timeline: z.enum(TIMELINES).nullable().optional(),
    recurrenceRule: z.string().max(200).nullable().optional(),
    puttingOff: z.boolean().optional(),
    drivers: z.array(DRIVER).max(8).optional(),
    status: z.enum(['open', 'done', 'dropped']).optional(),
    snoozedUntil: z.iso.datetime().nullable().optional(),
    planSlot: z.enum(['now', 'later', 'not_today']).nullable().optional(),
    planDate: z.iso.date().nullable().optional(),
    skipped: z.boolean().optional(),
    stepMinutes: paceMinutes.nullable().optional(),
    breakMinutes: paceMinutes.nullable().optional(),
    adaptCodes: adaptCodes.optional(),
    clientUpdatedAt: z.iso.datetime().optional(),
  })
  .strict();
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;

export const stepsPutSchema = z
  .object({
    steps: z
      .array(
        z
          .object({
            id: z.uuid().optional(),
            text: stepText,
            done: z.boolean().default(false),
            source: z.enum(['user', 'template', 'ai']).default('user'),
            later: z.boolean().default(false),
            adaptCodes: adaptCodes.default([]),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

export const breakDownRequestSchema = z
  .object({ save: z.boolean().default(true), replace: z.boolean().default(false) })
  .strict();

export const stepSchema = z.object({
  id: z.uuid(),
  position: z.number().int(),
  text: z.string(),
  source: z.string(),
  done: z.boolean(),
  later: z.boolean().describe('Set aside by "Cut it down"; Focus leaves it for later'),
  adaptCodes: z.array(z.string()).describe('Adapt library codes: a smaller or different way'),
});
export const taskSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  kind: z.string().nullable(),
  dueAt: z.iso.datetime().nullable(),
  timeline: z.enum(TIMELINES).nullable(),
  timelineLabel: z.string().nullable(),
  stepCap: z.number().int(),
  recurrenceRule: z.string().nullable(),
  puttingOff: z.boolean(),
  drivers: z.array(z.string()),
  status: z.enum(['open', 'done', 'dropped']),
  source: z.string(),
  snoozedUntil: z.iso.datetime().nullable(),
  planSlot: z.enum(['now', 'later', 'not_today']).nullable(),
  planDate: z.iso.date().nullable(),
  skipCount: z.number().int(),
  stepMinutes: z.number().int().nullable().describe("Adapt's pace: minutes per step"),
  breakMinutes: z.number().int().nullable().describe("Adapt's pace: break between steps"),
  adaptCodes: z.array(z.string()).describe('Adapt library codes for where and how'),
  doneAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  steps: z.array(stepSchema),
});
export type TaskDto = z.infer<typeof taskSchema>;

export const taskListQuerySchema = z
  .object({
    status: z.enum(['open', 'done', 'dropped', 'all']).default('open'),
    includeSnoozed: queryBool.default(false),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();
export const taskListSchema = z.object({ items: z.array(taskSchema) });
export const orderedSchema = z.object({
  light: z.enum(['green', 'yellow', 'amber', 'red', 'blue']),
  lightKnown: z.boolean(),
  items: z.array(
    taskSchema.extend({ whyNow: z.string(), whyNowText: z.string(), onlyIfMust: z.boolean() }),
  ),
});
/**
 * Browse orders its tasks on the server (E-59): the app keeps the tasks on the phone and sends only
 * what ordering reads. Titles and steps never leave the phone.
 */
export const orderInputSchema = z
  .object({
    light: z.enum(['green', 'yellow', 'amber', 'red', 'blue']),
    tasks: z
      .array(
        z
          .object({
            id: z.uuid(),
            timeline: z.enum(TIMELINES).nullable(),
            drivers: z.array(DRIVER).max(8),
            stepsLeft: z.number().int().min(0).max(200),
            puttingOff: z.boolean(),
            skipCount: z.number().int().min(0).max(1000),
            planSlot: z.enum(['now', 'later', 'not_today']).nullable(),
          })
          .strict(),
      )
      .max(200),
  })
  .strict();
export const orderResultSchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      whyNow: z.string(),
      whyNowText: z.string(),
      onlyIfMust: z.boolean(),
    }),
  ),
});

export const breakDownResponseSchema = z.object({
  steps: z.array(z.object({ text: z.string(), minutes: z.number().int() })),
  estimatedDemand: z.enum(['low', 'moderate', 'heavy']),
  source: z.enum(['ai', 'fallback']),
  saved: z.boolean(),
  task: taskSchema,
});
