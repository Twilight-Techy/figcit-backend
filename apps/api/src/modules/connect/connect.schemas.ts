import { z } from 'zod';
import { crisisRouteSchema } from '../recommendation/recommendation.schemas.js';
import { contactSchema } from '../safety/safety.schemas.js';

export const composeSchema = z
  .object({
    contactId: z.uuid().optional(),
    starterCode: z.string().max(48).optional(),
    text: z.string().trim().min(1).max(1000).optional(),
    save: z.boolean().default(false),
  })
  .strict()
  .refine((c) => c.starterCode || c.text, { message: 'Pick a starter or write your own.' });

export const linksSchema = z.object({
  sms: z.string().nullable(),
  whatsapp: z.string().nullable(),
  email: z.string().nullable(),
  share: z.string(),
});
export const composedSchema = z.union([
  z.object({
    safety: z.literal(false),
    text: z.string(),
    contactName: z.string().nullable(),
    links: linksSchema,
    savedStarterId: z.uuid().nullable(),
  }),
  z.object({ safety: z.literal(true), crisisRoutes: z.array(crisisRouteSchema) }),
]);

export const starterSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: z.string(),
  own: z.boolean(),
  contactId: z.uuid().nullable(),
});
export const groupInputSchema = z
  .object({
    kind: z.enum(['community', 'faith', 'support', 'other']).default('community'),
    name: z.string().trim().min(1).max(80),
    link: z.url().max(500).optional(),
  })
  .strict();
export const groupSchema = z.object({
  id: z.uuid(),
  kind: z.string(),
  name: z.string(),
  link: z.string().nullable(),
});
export const connectHomeSchema = z.object({
  contacts: z.array(contactSchema),
  starters: z.array(starterSchema),
  groups: z.array(groupSchema),
  /** Advanced social spaces need a moderated service that isn't live yet (BLOCKERS X-03). */
  rooms: z.object({ available: z.boolean(), note: z.string() }),
});
