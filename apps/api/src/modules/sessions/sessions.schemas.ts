import { z } from 'zod';
import { PATHWAY_CODES } from '../recommendation/recommendation.schemas.js';

export const OUTCOMES = ['helped', 'a_bit', 'not_really', 'skipped'] as const;

export const sessionStartSchema = z
  .object({
    id: z.uuid().optional(),
    recommendationId: z.uuid().optional(),
    pathway: z.enum(PATHWAY_CODES),
    toolId: z.string().min(1).max(48),
    taskId: z.uuid().optional(),
    practiceId: z.uuid().optional(),
    startedAt: z.iso.datetime().optional(),
    eyesOpen: z.boolean().optional(),
    contextPublic: z.boolean().optional(),
    origin: z.enum(['online', 'offline']).default('online'),
  })
  .strict();
export type SessionStart = z.infer<typeof sessionStartSchema>;

export const sessionUpdateSchema = z
  .object({
    endedAt: z.iso.datetime().optional(),
    lengthSeconds: z.number().int().min(0).max(86_400).optional(),
    completed: z.boolean().optional(),
    stoppedEarly: z.boolean().optional(),
    currentStepId: z.uuid().nullable().optional(),
    remainingSeconds: z.number().int().min(0).max(86_400).nullable().optional(),
    paused: z.boolean().optional(),
  })
  .strict();
export type SessionUpdate = z.infer<typeof sessionUpdateSchema>;

export const feedbackInputSchema = z
  .object({
    outcome: z.enum(OUTCOMES),
    helpful: z.number().int().min(1).max(5).optional(),
    effort: z.number().int().min(1).max(5).optional(),
  })
  .strict();

export const feedbackSchema = z.object({
  id: z.uuid(),
  outcome: z.enum(OUTCOMES),
  helpful: z.number().int().nullable(),
  effort: z.number().int().nullable(),
  recheckCheckInId: z.uuid().nullable(),
  recheckRule: z.string().nullable(),
  recoveryEndsAt: z.iso.datetime().nullable(),
  /** Whether the app should offer a re-check (Yellow, Amber or Red before the session). */
  offerRecheck: z.boolean(),
});

export const sessionSchema = z.object({
  id: z.uuid(),
  recommendationId: z.uuid().nullable(),
  pathway: z.enum(PATHWAY_CODES),
  toolId: z.string(),
  taskId: z.uuid().nullable(),
  practiceId: z.uuid().nullable(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  lengthSeconds: z.number().int().nullable(),
  completed: z.boolean(),
  stoppedEarly: z.boolean(),
  currentStepId: z.uuid().nullable(),
  remainingSeconds: z.number().int().nullable(),
  pausedAt: z.iso.datetime().nullable(),
  feedback: feedbackSchema.nullable(),
});
export type SessionDto = z.infer<typeof sessionSchema>;

export const sessionListQuerySchema = z
  .object({
    pathway: z.enum(PATHWAY_CODES).optional(),
    after: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .strict();
export const sessionListSchema = z.object({
  items: z.array(sessionSchema),
  next: z.string().nullable(),
});
