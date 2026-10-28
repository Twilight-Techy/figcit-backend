import { z } from 'zod';
import { progressSchema } from '../progress/progress.schemas.js';

export const SECTIONS = [
  'lights',
  'did_it_help',
  'pathways',
  'tasks',
  'reflections',
  'notes',
] as const;

export const shareCreateSchema = z
  .object({
    recipientLabel: z.string().trim().max(80).optional(),
    sections: z.array(z.enum(SECTIONS)).min(1).max(SECTIONS.length),
    rangeDays: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
    expiresInDays: z.number().int().min(1).max(30).default(7),
  })
  .strict();

export const shareSchema = z.object({
  id: z.uuid(),
  recipientLabel: z.string().nullable(),
  sections: z.array(z.string()),
  rangeDays: z.number().int(),
  expiresAt: z.iso.datetime(),
  revoked: z.boolean(),
  viewCount: z.number().int(),
  lastViewedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export const shareCreatedSchema = shareSchema.extend({ token: z.string(), url: z.string() });
export const shareListSchema = z.object({ items: z.array(shareSchema) });
export const sharedViewSchema = z.object({
  sharedBy: z.string(),
  recipientLabel: z.string().nullable(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  sections: z.array(z.string()),
  report: progressSchema.partial(),
});
