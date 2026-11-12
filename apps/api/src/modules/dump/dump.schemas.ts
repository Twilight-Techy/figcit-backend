import { z } from 'zod';
import { crisisRouteSchema } from '../recommendation/recommendation.schemas.js';
import { TIMELINES } from '../tasks/tasks.schemas.js';

export const BUCKETS = ['ideas', 'notes', 'worries', 'todo'] as const;
const itemText = z.string().trim().min(1).max(2000);

export const dumpCreateSchema = z
  .object({
    id: z.uuid().optional(),
    source: z.enum(['text', 'voice']).default('text'),
    /** One item per line, or pass `items`. */
    text: z.string().max(20_000).optional(),
    items: z
      .array(z.object({ text: itemText, bucket: z.enum(BUCKETS).optional() }).strict())
      .max(200)
      .optional(),
    transcriptionId: z.uuid().optional(),
    origin: z.enum(['online', 'offline']).default('online'),
  })
  .strict()
  .refine((d) => (d.text?.trim().length ?? 0) > 0 || (d.items?.length ?? 0) > 0, {
    message: 'Write something first.',
  });
export type DumpCreate = z.infer<typeof dumpCreateSchema>;

export const itemUpdateSchema = z
  .object({ text: itemText.optional(), bucket: z.enum(BUCKETS).nullable().optional() })
  .strict();
export const itemAddSchema = z
  .object({ text: itemText, bucket: z.enum(BUCKETS).optional() })
  .strict();
export const toTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    kind: z.enum(['study', 'work', 'health', 'social', 'home', 'other']).optional(),
    dueAt: z.iso.datetime().optional(),
    timeline: z.enum(TIMELINES).optional(),
  })
  .strict();

export const dumpItemSchema = z.object({
  id: z.uuid(),
  position: z.number().int(),
  text: z.string(),
  bucket: z.enum(BUCKETS).nullable(),
  suggestedBucket: z.enum(BUCKETS).nullable(),
  movedTo: z.enum(['task', 'draft', 'reflection']).nullable(),
  movedToId: z.uuid().nullable(),
});
export type DumpItemDto = z.infer<typeof dumpItemSchema>;

export const dumpSchema = z.object({
  id: z.uuid(),
  source: z.string(),
  createdAt: z.iso.datetime(),
  sortedAt: z.iso.datetime().nullable(),
  items: z.array(dumpItemSchema),
  counts: z.object({
    ideas: z.number().int(),
    notes: z.number().int(),
    worries: z.number().int(),
    todo: z.number().int(),
    unsorted: z.number().int(),
  }),
});
export type DumpDto = z.infer<typeof dumpSchema>;

export const dumpCreatedSchema = dumpSchema.extend({
  safety: z.boolean(),
  crisisRoutes: z.array(crisisRouteSchema),
});
export const dumpListSchema = z.object({ items: z.array(dumpSchema), next: z.string().nullable() });
export const dumpListQuerySchema = z
  .object({
    after: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
export const movedSchema = z.object({ item: dumpItemSchema, targetId: z.uuid() });
