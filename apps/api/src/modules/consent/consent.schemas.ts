import { z } from 'zod';

export const NOTICE_VERSION = '0.1';
export const CONSENT_PURPOSES = [
  'wellbeing_data',
  'personalisation',
  'analytics',
  'research',
  'institution_sharing',
] as const;
export type ConsentPurposeCode = (typeof CONSENT_PURPOSES)[number];

export const consentStateSchema = z.object({
  noticeVersion: z.string(),
  purposes: z.array(
    z.object({
      purpose: z.enum(CONSENT_PURPOSES),
      granted: z.boolean(),
      at: z.iso.datetime().nullable(),
    }),
  ),
});
export type ConsentState = z.infer<typeof consentStateSchema>;

export const consentUpdateSchema = z
  .object({
    source: z.enum(['onboarding', 'settings', 'upgrade']).default('settings'),
    choices: z
      .array(z.object({ purpose: z.enum(CONSENT_PURPOSES), granted: z.boolean() }).strict())
      .min(1)
      .max(5),
  })
  .strict();
