import { z } from 'zod';
import { graphemes } from '../../common/text/graphemes.js';

export const THEMES = [
  'fig_citrus',
  'quiet_pear',
  'midnight_bergamot',
  'blood_orange_hush',
  'cool_melon',
  'blue_citron',
] as const;

/** A UK nation (sets the Help/SOS lines, SU-5), or a two-letter country code outside the UK. */
export const REGION_RE = /^(GB-(ENG|WLS|SCT|NIR)|GB|[A-Z]{2})$/;

/** The nickname column is VARCHAR(120): 120 code points, which a few long emoji can reach in 30 characters. */
export const NAME_MAX_CODE_POINTS = 120;

/**
 * A name or nickname in any script (SU-6): 1–30 characters, counted as the user sees them, and at
 * most 120 code points, which is what the column holds (an emoji family is one character but seven
 * code points).
 */
const nameSchema = z
  .string()
  .trim()
  .superRefine((v, ctx) => {
    const n = graphemes(v).length;
    if (n < 1 || n > 30) ctx.addIssue({ code: 'custom', message: 'Use 1 to 30 characters.' });
    else if (Array.from(v).length > NAME_MAX_CODE_POINTS)
      ctx.addIssue({
        code: 'custom',
        message: 'That name is too long. Use fewer emoji, or shorten it.',
      });
  });

export const preferencesSchema = z.object({
  textSize: z.number().int().min(0).max(3),
  theme: z.enum(THEMES),
  followSystemTheme: z.boolean(),
  highContrast: z.boolean(),
  reduceMotion: z.boolean(),
  sound: z.boolean(),
  haptics: z.boolean(),
  dyslexicFont: z.boolean(),
  lowStimulation: z.boolean(),
  notificationStyle: z.enum(['gentle', 'standard', 'silent']),
  quietHoursStart: z.number().int().min(0).max(1439).nullable(),
  quietHoursEnd: z.number().int().min(0).max(1439).nullable(),
  inWorship: z.boolean(),
  inWorshipUntil: z.iso.datetime().nullable(),
  taskNudgesPerDay: z.number().int().min(0).max(10),
  notifyCategories: z.array(z.enum(['checkin', 'tasks', 'practices', 'recheck', 'reflect'])).max(5),
  patternPrompts: z.boolean(),
  personalisation: z.boolean(),
});
export type PreferencesDto = z.infer<typeof preferencesSchema>;

/** Partial update; `clientUpdatedAt` drives last-write-wins per field (SYSTEM_DESIGN §8). */
export const preferencesPatchSchema = preferencesSchema
  .partial()
  .extend({ clientUpdatedAt: z.iso.datetime().optional() })
  .strict();

export const meSchema = z.object({
  id: z.uuid(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  nickname: z.string().nullable(),
  roles: z.array(z.string()),
  ageConfirmed: z.boolean(),
  ageBand: z.enum(['adult', 'minor_institution']).nullable(),
  locale: z.string(),
  region: z.string(),
  timezone: z.string(),
  helpWith: z.array(z.string()),
  journeySeen: z.boolean(),
  setupDone: z.boolean(),
  /** Your details (S04a) are done: a name, the age rule passed, and Terms and Privacy accepted. */
  detailsDone: z.boolean(),
  productUpdates: z.boolean(),
  hasPassword: z.boolean(),
  /** @deprecated Use `tier`: any paid plan reads as `plus` here. */
  plan: z.enum(['free', 'plus']),
  /** Free, Prime or Premium (organisation seats and the pilot are Premium). */
  tier: z.enum(['free', 'prime', 'premium']),
  tenant: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  createdAt: z.iso.datetime(),
  preferences: preferencesSchema,
});
export type MeDto = z.infer<typeof meSchema>;

export const mePatchSchema = z
  .object({
    nickname: nameSchema.nullable(),
    locale: z.string().max(16),
    region: z.string().regex(REGION_RE),
    timezone: z.string().max(64),
    helpWith: z.array(z.string().max(48)).max(12),
    journeySeen: z.boolean(),
    setupDone: z.boolean(),
  })
  .partial()
  .strict();

/** Your details (S04a): the four sign-up answers besides the email (SU-4, SU-5, SU-6, SU-8). */
export const detailsSchema = z
  .object({
    nickname: nameSchema,
    ageBand: z.enum(['18_plus', '16_17', 'under_16']),
    region: z.string().regex(REGION_RE),
    acceptTerms: z.literal(true),
    productUpdates: z.boolean().default(false),
  })
  .strict();

/**
 * What the age rule decided (one rule for the whole UK): `ok` carries on; `needs_institution`
 * (16 or 17, not in a college or university yet) joins with an institution code first;
 * `not_available` (under 16) has had its account erased.
 */
export const detailsResultSchema = z.object({
  outcome: z.enum(['ok', 'needs_institution', 'not_available']),
  me: meSchema.nullable(),
});

/** D-02: 18+ confirm themselves; 16–17 only as a member of an institution (joined by code). */
export const ageConfirmationSchema = z.union([
  z.object({ confirmed18: z.literal(true) }).strict(),
  z.object({ under18ViaInstitution: z.literal(true) }).strict(),
]);
