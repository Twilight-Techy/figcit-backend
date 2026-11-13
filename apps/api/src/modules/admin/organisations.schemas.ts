import { z } from 'zod';

/** Who pays for people's places (Developer Brief, Organisation seats). */
export const ORG_KINDS = [
  'university',
  'college',
  'school',
  'employer',
  'jobcentre',
  'programme',
  'other',
] as const;

/** An organisation code gives one of these: a Premium seat, or the six-week free pilot. */
export const ORG_PLANS = ['org_seat', 'pilot'] as const;

const codeSchema = z.object({
  code: z.string(),
  uses: z.number().int(),
  maxUses: z.number().int().nullable(),
  expiresAt: z.iso.datetime().nullable(),
});

export const organisationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: z.string(),
  plan: z.enum(ORG_PLANS),
  /** People with an active place: what the organisation is invoiced for, by hand at launch. */
  seatsUsed: z.number().int(),
  codes: z.array(codeSchema),
  createdAt: z.iso.datetime(),
});
export type OrganisationDto = z.infer<typeof organisationSchema>;

export const organisationsSchema = z.object({ items: z.array(organisationSchema) });

export const newOrganisationSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    kind: z.enum(ORG_KINDS),
    plan: z.enum(ORG_PLANS).default('org_seat'),
    anonymityFloor: z.number().int().min(5).max(50).default(10),
  })
  .strict();

export const newCodeSchema = z
  .object({
    maxUses: z.number().int().min(1).max(100_000).optional(),
    days: z.number().int().min(1).max(730).default(365),
  })
  .strict();

export const issuedCodeSchema = codeSchema;
