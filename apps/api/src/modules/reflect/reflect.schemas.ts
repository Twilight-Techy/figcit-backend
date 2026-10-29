import { z } from 'zod';
import { crisisRouteSchema } from '../recommendation/recommendation.schemas.js';

const topic = z.string().regex(/^[a-z0-9_]{1,48}$/);

export const reflectionCreateSchema = z
  .object({
    id: z.uuid().optional(),
    variant: z.string().min(1).max(32),
    sessionId: z.uuid().optional(),
    /** "Reflect on this" from a dump item (S103). */
    dumpItemId: z.uuid().optional(),
    answers: z
      .array(
        z
          .object({
            promptId: z.string().max(48),
            chips: z.array(z.string().max(60)).max(6).default([]),
            text: z.string().trim().max(2000).optional(),
          })
          .strict(),
      )
      .max(3),
    takeaway: z.string().trim().max(300).optional(),
    topicTag: topic.optional(),
    saved: z.boolean().default(true),
    savedForLater: z.boolean().default(false),
    winSize: z.enum(['small', 'medium', 'huge']).optional(),
    origin: z.enum(['online', 'offline']).default('online'),
  })
  .strict();
export type ReflectionCreate = z.infer<typeof reflectionCreateSchema>;

export const reflectionUpdateSchema = z
  .object({
    saved: z.boolean().optional(),
    savedForLater: z.boolean().optional(),
    takeaway: z.string().trim().max(300).nullable().optional(),
  })
  .strict();

export const answerSchema = z.object({
  promptId: z.string(),
  prompt: z.string(),
  chips: z.array(z.string()),
  text: z.string().nullable(),
});
export const reflectionSchema = z.object({
  id: z.uuid(),
  variant: z.string(),
  kind: z.enum(['prompts', 'journal', 'win']),
  title: z.string(),
  answers: z.array(answerSchema),
  takeaway: z.string().nullable(),
  topicTag: z.string().nullable(),
  winSize: z.string().nullable(),
  saved: z.boolean(),
  savedForLater: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type ReflectionDto = z.infer<typeof reflectionSchema>;
export const reflectionCreatedSchema = reflectionSchema.extend({
  safety: z.boolean(),
  crisisRoutes: z.array(crisisRouteSchema),
});

export const listQuerySchema = z
  .object({
    kind: z.enum(['all', 'prompts', 'journal', 'win', 'later']).default('all'),
    after: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .strict();
export const listSchema = z.object({
  items: z.array(reflectionSchema),
  next: z.string().nullable(),
});

export const gateQuerySchema = z
  .object({ variant: z.string().max(32).optional(), topicTag: topic.optional() })
  .strict();
export const gateSchema = z.object({
  allowed: z.boolean(),
  /** ok · save_for_later (Amber, S156) · regulate_first (Red) · rumination (RF-2, S157) · not_here (formal setting) · advanced */
  reason: z.enum(['ok', 'save_for_later', 'regulate_first', 'rumination', 'not_here', 'advanced']),
  rule: z.string().nullable(),
  light: z.enum(['green', 'yellow', 'amber', 'red', 'blue']),
  alternatives: z.array(
    z.object({ pathway: z.string(), toolId: z.string(), label: z.string(), href: z.string() }),
  ),
});
export type Gate = z.infer<typeof gateSchema>;

export const variantsSchema = z.object({
  items: z.array(
    z.object({
      code: z.string(),
      toolId: z.string(),
      title: z.string(),
      subtitle: z.string(),
      minutes: z.number().int(),
      kind: z.string(),
      tier: z.string(),
      locked: z.boolean(),
      prompts: z.array(z.object({ id: z.string(), text: z.string(), chips: z.array(z.string()) })),
    }),
  ),
});

export const patternsSchema = z.object({
  promptsOn: z.boolean(),
  whatHelps: z.array(
    z.object({
      toolId: z.string(),
      name: z.string(),
      pathway: z.string(),
      helped: z.number().int(),
      sessions: z.number().int(),
    }),
  ),
  cards: z.array(z.object({ code: z.string(), text: z.string(), evidence: z.string() })),
  saved: z.array(z.object({ id: z.uuid(), takeaway: z.string(), createdAt: z.iso.datetime() })),
  /** Pattern 34: a struggle that keeps coming up, to ask about (null when there's nothing to ask). */
  struggle: z
    .object({
      family: z.string(),
      label: z.string(),
      count: z.number().int(),
      confirmed: z.boolean(),
    })
    .nullable(),
});
export const struggleAnswerSchema = z
  .object({
    family: z.string().max(32),
    answer: z.enum(['confirmed', 'not_now', 'never']),
  })
  .strict();
export const monthQuerySchema = z
  .object({
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional(),
  })
  .strict();
export const monthlySchema = z.object({
  month: z.string(),
  checkIns: z.number().int(),
  sessions: z.number().int(),
  stepsDone: z.number().int(),
  mostUsed: z.array(
    z.object({
      pathway: z.string(),
      toolId: z.string(),
      name: z.string(),
      count: z.number().int(),
    }),
  ),
  carryForward: z.string().nullable(),
  wins: z.array(z.object({ text: z.string(), size: z.string().nullable() })),
  harderDays: z.array(
    z.object({
      weekday: z.number().int(),
      averageMood: z.number().nullable(),
      checkIns: z.number().int(),
    }),
  ),
});
