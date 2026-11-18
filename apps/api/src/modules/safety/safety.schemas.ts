import { z } from 'zod';
import { crisisRouteSchema } from '../recommendation/recommendation.schemas.js';

const text = z.string().trim().max(1000);

export const safetyEventInputSchema = z
  .object({
    sourceModule: z.string().min(1).max(32),
    trigger: z.enum(['button', 'phrase', 'option']),
    ruleId: z.string().max(32).optional(),
    category: z.string().max(32).optional(),
    routeChosen: z.string().max(32).optional(),
    origin: z.enum(['online', 'offline']).default('online'),
  })
  .strict();

/** Browse: screen text kept on the phone with the server's phrase rules (E-59). Not stored. */
export const screenInputSchema = z
  .object({
    // Every screen that takes typed text: the ones whose own write doesn't screen it call this.
    sourceModule: z.enum([
      'dump',
      'reflect',
      'express',
      'connect',
      'checkin',
      'tasks',
      'practices',
      'institution',
      'reminders',
    ]),
    texts: z.array(z.string().max(5000)).min(1).max(50),
  })
  .strict();
export const screenResultSchema = z.object({
  safety: z.boolean().describe('A risk phrase matched: show the crisis routes'),
  category: z.string().nullable(),
});

export const routesQuerySchema = z.object({ region: z.string().length(2).optional() }).strict();
export const routesSchema = z.object({ region: z.string(), routes: z.array(crisisRouteSchema) });

export const supportPlanInputSchema = z
  .object({
    preferredRoutes: z.array(z.string().max(32)).max(10).optional(),
    signs: text.nullable().optional(),
    whatHelps: text.nullable().optional(),
    whatToAvoid: text.nullable().optional(),
    messages: z.array(z.string().trim().min(1).max(500)).max(5).optional(),
    clientUpdatedAt: z.iso.datetime().optional(),
  })
  .strict();
export type SupportPlanInput = z.infer<typeof supportPlanInputSchema>;

export const supportPlanSchema = z.object({
  preferredRoutes: z.array(z.string()),
  signs: z.string().nullable(),
  whatHelps: z.string().nullable(),
  whatToAvoid: z.string().nullable(),
  messages: z.array(z.string()),
  updatedAt: z.iso.datetime().nullable(),
});
export type SupportPlanDto = z.infer<typeof supportPlanSchema>;

const CONTACT_WHEN = z.enum(['connect', 'sos']);

export const contactInputSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1).max(80),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[\d ()-]{6,20}$/)
      .nullable()
      .optional(),
    email: z.email().max(254).nullable().optional(),
    relationship: z.string().max(32).nullable().optional(),
    contactWhen: z.array(CONTACT_WHEN).min(1).max(2).default(['connect']),
    consentConfirmed: z.boolean().default(false),
    position: z.number().int().min(0).max(50).optional(),
  })
  .strict()
  .refine((c) => c.phone || c.email, { message: 'Add a phone number or an email.' });
export const contactUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[\d ()-]{6,20}$/)
      .nullable()
      .optional(),
    email: z.email().max(254).nullable().optional(),
    relationship: z.string().max(32).nullable().optional(),
    contactWhen: z.array(CONTACT_WHEN).min(1).max(2).optional(),
    consentConfirmed: z.boolean().optional(),
    position: z.number().int().min(0).max(50).optional(),
  })
  .strict();
export type ContactInput = z.infer<typeof contactInputSchema>;
export type ContactUpdate = z.infer<typeof contactUpdateSchema>;

export const contactSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  relationship: z.string().nullable(),
  contactWhen: z.array(z.string()),
  consentConfirmed: z.boolean(),
  position: z.number().int(),
});
export type ContactDto = z.infer<typeof contactSchema>;
export const contactListSchema = z.object({ items: z.array(contactSchema) });
