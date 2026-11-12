import { z } from 'zod';
import { crisisRouteSchema } from '../recommendation/recommendation.schemas.js';

export const parseNeedRequestSchema = z
  .object({ text: z.string().trim().min(1).max(500) })
  .strict();
export const suggestDriversRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    kind: z.enum(['study', 'work', 'health', 'social', 'home', 'other']).optional(),
  })
  .strict();

const meta = { source: z.enum(['ai', 'fallback']), limited: z.boolean() };
export const safetyBlockSchema = z.object({
  safety: z.literal(true),
  crisisRoutes: z.array(crisisRouteSchema),
});

const parsedNeedSchema = z.object({
  safety: z.literal(false),
  needs: z.array(z.string()),
  heard: z.array(
    z.object({ label: z.string(), kind: z.enum(['feeling', 'setting', 'task', 'need']) }),
  ),
  task: z.object({ title: z.string(), type: z.string() }).nullable(),
  supportOnly: z.boolean(),
  ...meta,
});
const suggestedDriversSchema = z.object({
  safety: z.literal(false),
  drivers: z.array(z.string()),
  demandCharacteristics: z.array(z.string()),
  ...meta,
});
export const parseNeedResponseSchema = z.union([parsedNeedSchema, safetyBlockSchema]);
export const suggestDriversResponseSchema = z.union([suggestedDriversSchema, safetyBlockSchema]);

// The staff Simulator's AI steps (E-61): the same tasks, without a user's limits or a safety
// event; `real` refuses instead of falling back when the model can't be reached.
export const aiStatusSchema = z.object({
  configured: z.boolean().describe('A model server is set (AI_BASE_URL)'),
  circuitOpen: z.boolean().describe('Calls are paused after repeated failures'),
  model: z.string().nullable(),
});
const real = z
  .boolean()
  .default(false)
  .describe('Only the model: refuse when it is not ready, instead of the fallback');
export const tryParseNeedRequestSchema = parseNeedRequestSchema.extend({ real });
export const trySuggestDriversRequestSchema = suggestDriversRequestSchema.extend({ real });
const stoppedSchema = z.object({
  safety: z.literal(true),
  category: z.string().nullable().describe('The risk check matched: the app goes to Help'),
});
export const tryParseNeedResponseSchema = z.union([parsedNeedSchema, stoppedSchema]);
export const trySuggestDriversResponseSchema = z.union([suggestedDriversSchema, stoppedSchema]);

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
