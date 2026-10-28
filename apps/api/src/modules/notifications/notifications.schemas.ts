import { z } from 'zod';

export const SUBJECTS = ['checkin', 'task', 'practice', 'recheck', 'custom'] as const;
const RULE = z
  .string()
  .max(200)
  .regex(/^FREQ=(DAILY|WEEKLY)(;[A-Z]+=[A-Z0-9,]+)*$/);

export const pushSubscribeSchema = z
  .object({
    endpoint: z.url().max(1000),
    keys: z
      .object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) })
      .strict(),
    userAgent: z.string().max(200).optional(),
  })
  .strict();
export const pushSubscriptionSchema = z.object({ id: z.uuid(), createdAt: z.iso.datetime() });
export const vapidSchema = z.object({ publicKey: z.string().nullable() });

export const reminderCreateSchema = z
  .object({
    id: z.uuid().optional(),
    subjectType: z.enum(SUBJECTS),
    subjectId: z.uuid().optional(),
    label: z.string().trim().max(120).optional(),
    at: z.iso.datetime().optional(),
    /** Minutes from now (the card's "remind me later"). */
    inMinutes: z
      .number()
      .int()
      .min(1)
      .max(7 * 24 * 60)
      .optional(),
    rrule: RULE.optional(),
    style: z.enum(['gentle', 'standard', 'silent']).default('gentle'),
  })
  .strict()
  .refine((r) => r.at || r.inMinutes || r.rrule, { message: 'Choose when.' });
export type ReminderCreate = z.infer<typeof reminderCreateSchema>;

export const reminderUpdateSchema = z
  .object({
    label: z.string().trim().max(120).nullable().optional(),
    at: z.iso.datetime().nullable().optional(),
    rrule: RULE.nullable().optional(),
    style: z.enum(['gentle', 'standard', 'silent']).optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const reminderSchema = z.object({
  id: z.uuid(),
  subjectType: z.enum(SUBJECTS),
  subjectId: z.uuid().nullable(),
  label: z.string().nullable(),
  at: z.iso.datetime().nullable(),
  rrule: z.string().nullable(),
  style: z.string(),
  active: z.boolean(),
  nextRunAt: z.iso.datetime().nullable(),
  lastSentAt: z.iso.datetime().nullable(),
});
export type ReminderDto = z.infer<typeof reminderSchema>;
export const reminderListSchema = z.object({ items: z.array(reminderSchema) });

export const inboxItemSchema = z.object({
  id: z.uuid(),
  kind: z.string(),
  refType: z.string().nullable(),
  refId: z.uuid().nullable(),
  title: z.string(),
  body: z.string(),
  href: z.string(),
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export const inboxSchema = z.object({ items: z.array(inboxItemSchema), unread: z.number().int() });
