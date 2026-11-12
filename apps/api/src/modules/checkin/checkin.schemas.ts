import { z } from 'zod';
import { cardSchema } from '../recommendation/recommendation.schemas.js';

const code = z.string().min(1).max(48);
const freeText = z.string().trim().max(2000);

export const stateInputSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('grid'),
      energy: z.number().int().min(1).max(4),
      mood: z.number().int().min(1).max(4),
    })
    .strict(),
  // Quick entry with the state skipped (E-45): the engine treats it as not given (NS-1).
  z.object({ kind: z.literal('not_given') }).strict(),
  z
    .object({
      kind: z.literal('not_sure'),
      answers: z.array(code).max(3).optional(),
      confirmedCell: z
        .string()
        .regex(/^E[1-4]M[1-4]$/)
        .optional(),
    })
    .strict(),
]);

export const demandInputSchema = z
  .object({
    taskId: z.uuid().optional(),
    title: z.string().trim().min(1).max(200).optional(),
    kind: z.enum(['study', 'work', 'health', 'social', 'home', 'other']).optional(),
    dueAt: z.iso.datetime().optional(),
    timeline: z.enum(['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'TX', 'TR']).optional(),
    traits: z.array(code).max(10).optional(),
    puttingOff: z.boolean().optional(),
    confirmedDrivers: z
      .array(
        z.enum([
          'novelty',
          'urgency',
          'challenge',
          'routine',
          'interest',
          'passion',
          'collaboration',
          'exploration',
        ]),
      )
      .max(8)
      .optional(),
    count: z.number().int().min(1).max(10).optional(),
    recurrenceRule: z.string().max(200).optional(),
  })
  .strict();

export const checkInInputSchema = z
  .object({
    id: z.uuid().optional(),
    createdOnDeviceAt: z.iso.datetime().optional(),
    origin: z.enum(['online', 'offline']).default('online'),
    entry: z.enum(['full', 'quick', 'recheck']).default('full'),
    state: stateInputSchema,
    // `null` = not rated: the slider was never moved or intensity was skipped (E-41, E-42).
    emotions: z
      .array(z.object({ code, intensity: z.number().int().min(0).max(10).nullable() }).strict())
      .max(3)
      .default([]),
    ownFeeling: freeText.optional(),
    sensations: z
      .array(
        z
          .object({
            code,
            intensity: z.number().int().min(0).max(10).optional(),
            bodyRegions: z.array(code).max(12).optional(),
          })
          .strict(),
      )
      .max(30)
      .default([]),
    context: z
      .object({
        environment: code.optional(),
        environmentOther: z.string().trim().max(80).optional(),
        social: code.optional(),
        time: code.optional(),
        support: code.optional(),
        // Several can be true at once (E-45); replaces `support` for new clients.
        supports: z.array(code).max(4).optional(),
        sensitivity: z.array(code).max(8).optional(),
        customTagIds: z.array(z.uuid()).max(10).optional(),
      })
      .strict()
      .default({}),
    // What has been happening in the user's life (owner review, 12 Nov 2026): stored, not read by
    // any rule yet. Their own words are encrypted and screened like every free text.
    lifeEvents: z.array(code).max(13).optional(),
    ownLifeEvent: freeText.optional(),
    needs: z.array(code).max(3).default([]),
    ownWords: freeText.optional(),
    parsedNeedCodes: z.array(code).max(3).optional(),
    justSupport: z.boolean().default(false),
    demand: demandInputSchema.optional(),
    intent: z
      .enum(['regulate', 'dump', 'express', 'execute', 'adapt', 'reflect', 'connect', 'meditate'])
      .optional(),
    recheckOfId: z.uuid().optional(),
  })
  .strict();
export type CheckInInput = z.infer<typeof checkInInputSchema>;

export const checkInSummarySchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  cellId: z.string().nullable(),
  energy: z.number().int().nullable(),
  mood: z.number().int().nullable(),
  entry: z.enum(['full', 'quick', 'recheck']),
  light: z.enum(['green', 'yellow', 'amber', 'red', 'blue']).nullable(),
  stateName: z.string().nullable(),
  emotions: z.array(z.object({ code: z.string(), intensity: z.number().int().nullable() })),
});

export const checkInResultSchema = z.object({ checkIn: checkInSummarySchema, card: cardSchema });
export const checkInListSchema = z.object({
  items: z.array(checkInSummarySchema),
  next: z.string().nullable(),
});
export const cursorQuerySchema = z
  .object({
    after: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .strict();
