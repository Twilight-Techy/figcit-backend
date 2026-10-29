import { z } from 'zod';

export const THEMES = [
  'fig_citrus',
  'quiet_pear',
  'midnight_bergamot',
  'blood_orange_hush',
  'cool_melon',
  'blue_citron',
] as const;

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
  hasPassword: z.boolean(),
  plan: z.enum(['free', 'plus']),
  tenant: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  createdAt: z.iso.datetime(),
  preferences: preferencesSchema,
});
export type MeDto = z.infer<typeof meSchema>;

export const mePatchSchema = z
  .object({
    nickname: z.string().trim().min(1).max(40).nullable(),
    locale: z.string().max(16),
    region: z.string().max(8),
    timezone: z.string().max(64),
    helpWith: z.array(z.string().max(48)).max(12),
    journeySeen: z.boolean(),
    setupDone: z.boolean(),
  })
  .partial()
  .strict();

/** D-02: 18+ confirm themselves; 16–17 only as a member of an institution (joined by code). */
export const ageConfirmationSchema = z.union([
  z.object({ confirmed18: z.literal(true) }).strict(),
  z.object({ under18ViaInstitution: z.literal(true) }).strict(),
]);
