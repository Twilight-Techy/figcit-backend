import { z } from 'zod';
import { queryBool } from '../../common/http/query.js';
import { crisisRouteSchema } from '../recommendation/recommendation.schemas.js';

export const MODES = ['draft', 'simplify', 'rewrite', 'structure', 'script', 'record'] as const;
export const AUDIENCES = [
  'manager',
  'teacher',
  'tutor',
  'colleague',
  'friend',
  'family',
  'partner',
  'doctor',
  'other',
] as const;
const body = z.string().max(5000);

export const draftCreateSchema = z
  .object({
    id: z.uuid().optional(),
    title: z.string().trim().max(120).optional(),
    purpose: z.string().trim().max(200).optional(),
    audience: z.enum(AUDIENCES).optional(),
    mode: z.enum(MODES).default('draft'),
    body: body.default(''),
    sourceType: z.enum(['dump_item', 'reflection', 'recommendation']).optional(),
    sourceId: z.uuid().optional(),
  })
  .strict();
export type DraftCreate = z.infer<typeof draftCreateSchema>;

export const draftUpdateSchema = z
  .object({
    title: z.string().trim().max(120).nullable().optional(),
    purpose: z.string().trim().max(200).nullable().optional(),
    audience: z.enum(AUDIENCES).nullable().optional(),
    mode: z.enum(MODES).optional(),
    body: body.optional(),
    archived: z.boolean().optional(),
    clientUpdatedAt: z.iso.datetime().optional(),
  })
  .strict();
export type DraftUpdate = z.infer<typeof draftUpdateSchema>;

export const assistRequestSchema = z
  .object({
    mode: z.enum(['simplify', 'rewrite', 'draft', 'structure', 'script']),
    level: z.enum(['gentle', 'clear', 'shortest']).default('clear'),
    /** Defaults to the draft's latest text. */
    text: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();
export type AssistRequest = z.infer<typeof assistRequestSchema>;

export const changesSchema = z.object({
  wordsBefore: z.number().int(),
  wordsAfter: z.number().int(),
  removedPhrases: z.number().int(),
  summary: z.string(),
});

export const versionSchema = z.object({
  id: z.uuid(),
  mode: z.enum(MODES),
  aiUsed: z.boolean(),
  aiTask: z.string().nullable(),
  changes: changesSchema.nullable(),
  createdAt: z.iso.datetime(),
});

export const draftSchema = z.object({
  id: z.uuid(),
  title: z.string().nullable(),
  purpose: z.string().nullable(),
  audience: z.string().nullable(),
  mode: z.enum(MODES),
  body: z.string(),
  sourceType: z.string().nullable(),
  sourceId: z.uuid().nullable(),
  archived: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  versions: z.array(versionSchema),
});
export type DraftDto = z.infer<typeof draftSchema>;

export const draftListSchema = z.object({ items: z.array(draftSchema.omit({ versions: true })) });
export const draftListQuerySchema = z.object({ archived: queryBool.default(false) }).strict();

export const assistResultSchema = z.union([
  z.object({
    safety: z.literal(false),
    mode: z.string(),
    text: z.string(),
    sections: z.array(z.object({ role: z.string(), text: z.string() })).optional(),
    lines: z.array(z.object({ cue: z.string(), text: z.string() })).optional(),
    changes: changesSchema.nullable(),
    source: z.enum(['ai', 'fallback']),
    replaced: z.boolean(),
    limited: z.boolean(),
    versionId: z.uuid(),
  }),
  z.object({ safety: z.literal(true), crisisRoutes: z.array(crisisRouteSchema) }),
]);
export type AssistResult = z.infer<typeof assistResultSchema>;
