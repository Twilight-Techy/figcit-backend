import { z } from 'zod';

const TYPES = ['ritual', 'prayer', 'recitation', 'meditation', 'other'] as const;
const RULE = z
  .string()
  .max(200)
  .regex(
    /^FREQ=(DAILY|WEEKLY)(;[A-Z]+=[A-Z0-9,]+)*$/,
    'Use FREQ=DAILY or FREQ=WEEKLY with BYDAY, BYHOUR, BYMINUTE.',
  );

export const practiceCreateSchema = z
  .object({
    id: z.uuid().optional(),
    type: z.enum(TYPES),
    name: z.string().trim().min(1).max(80),
    content: z.string().trim().max(5000).optional(),
    link: z.url().max(500).optional(),
    audioFileId: z.uuid().optional(),
    scheduleRule: RULE.optional(),
    reminderStyle: z.enum(['gentle', 'silent', 'none']).default('gentle'),
    minutes: z.number().int().min(1).max(120).optional(),
    helpsWhenStruggling: z.boolean().default(false),
    makesMeWorse: z.boolean().default(false),
    isTransitionRitual: z.boolean().default(false),
  })
  .strict();
export type PracticeCreate = z.infer<typeof practiceCreateSchema>;

export const practiceUpdateSchema = z
  .object({
    type: z.enum(TYPES).optional(),
    name: z.string().trim().min(1).max(80).optional(),
    content: z.string().trim().max(5000).nullable().optional(),
    link: z.url().max(500).nullable().optional(),
    audioFileId: z.uuid().nullable().optional(),
    scheduleRule: RULE.nullable().optional(),
    reminderStyle: z.enum(['gentle', 'silent', 'none']).optional(),
    minutes: z.number().int().min(1).max(120).nullable().optional(),
    helpsWhenStruggling: z.boolean().optional(),
    makesMeWorse: z.boolean().optional(),
    isTransitionRitual: z.boolean().optional(),
    position: z.number().int().min(0).max(100).optional(),
    clientUpdatedAt: z.iso.datetime().optional(),
  })
  .strict();
export type PracticeUpdate = z.infer<typeof practiceUpdateSchema>;

export const practiceSchema = z.object({
  id: z.uuid(),
  type: z.enum(TYPES),
  name: z.string(),
  content: z.string().nullable(),
  link: z.string().nullable(),
  audioFileId: z.uuid().nullable(),
  scheduleRule: z.string().nullable(),
  nextAt: z.iso.datetime().nullable(),
  reminderStyle: z.string(),
  minutes: z.number().int().nullable(),
  helpsWhenStruggling: z.boolean(),
  makesMeWorse: z.boolean(),
  isTransitionRitual: z.boolean(),
  position: z.number().int(),
});
export type PracticeDto = z.infer<typeof practiceSchema>;
export const practiceListSchema = z.object({ items: z.array(practiceSchema) });
