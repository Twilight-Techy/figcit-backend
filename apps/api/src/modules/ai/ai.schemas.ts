import { z } from 'zod';
import { crisisRouteSchema } from '../recommendation/recommendation.schemas.js';

export const parseNeedRequestSchema = z
  .object({ text: z.string().trim().min(1).max(500) })
  .strict();
export const suggestDriversRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    kind: z.enum(['study', 'work', 'health', 'social', 'home']).optional(),
  })
  .strict();

const meta = { source: z.enum(['ai', 'fallback']), limited: z.boolean() };
export const safetyBlockSchema = z.object({
  safety: z.literal(true),
  crisisRoutes: z.array(crisisRouteSchema),
});

export const parseNeedResponseSchema = z.union([
  z.object({
    safety: z.literal(false),
    needs: z.array(z.string()),
    heard: z.array(
      z.object({ label: z.string(), kind: z.enum(['feeling', 'setting', 'task', 'need']) }),
    ),
    task: z.object({ title: z.string(), type: z.string() }).nullable(),
    supportOnly: z.boolean(),
    ...meta,
  }),
  safetyBlockSchema,
]);
export const suggestDriversResponseSchema = z.union([
  z.object({
    safety: z.literal(false),
    drivers: z.array(z.string()),
    demandCharacteristics: z.array(z.string()),
    ...meta,
  }),
  safetyBlockSchema,
]);

export const mapFeelingRequestSchema = z
  .object({ text: z.string().trim().min(1).max(500) })
  .strict();
export const mapFeelingResponseSchema = z.union([
  z.object({
    safety: z.literal(false),
    matches: z.array(z.object({ code: z.string(), label: z.string(), confidence: z.number() })),
    /** Chips matched with confidence 0.7 or more: shown selected, still the user's to change. */
    selected: z.array(z.string()),
    /** Below 0.7: "Is it more like X or Y?" with these chips (null when nothing to ask). */
    ask: z
      .object({ options: z.array(z.object({ code: z.string(), label: z.string() })) })
      .nullable(),
    ...meta,
  }),
  safetyBlockSchema,
]);
export const splitTasksRequestSchema = z
  .object({ text: z.string().trim().min(1).max(300) })
  .strict();
export const splitTasksResponseSchema = z.union([
  z.object({ safety: z.literal(false), tasks: z.array(z.string()), ...meta }),
  safetyBlockSchema,
]);
