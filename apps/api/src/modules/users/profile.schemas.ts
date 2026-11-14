import { z } from 'zod';

/** What fills most of the week (ME-2). */
export const WEEK_FILLS = [
  'studying',
  'working',
  'looking_for_work',
  'training',
  'caring',
  'other',
] as const;

export const STUDY_LEVELS = [
  'school',
  'college',
  'undergraduate',
  'postgraduate',
  'apprenticeship',
  'other',
] as const;

/**
 * Life right now (ME-3): everyday circumstances only. No health or harm options: abuse, neglect,
 * accident or injury, physical and mental health are not asked. Never changes the colour (LE-0).
 */
export const LIFE_NOW = [
  'losing_someone',
  'big_change',
  'money',
  'work_study_pressure',
  'between',
  'caring',
  'alone',
  'stuck',
  'treated_unfairly',
  'prefer_not',
] as const;

const short = (max: number) => z.string().trim().max(max);

/** Everything beyond the four sign-up answers: optional, private by default (ME-6). */
export const profileSchema = z.object({
  pronouns: short(30).nullable(),
  weekFills: z.array(z.enum(WEEK_FILLS)).max(WEEK_FILLS.length),
  studyLevel: z.enum(STUDY_LEVELS).nullable(),
  jobField: short(60).nullable(),
  /** Help or devices often carried: shown first on Where you are, never pre-ticked (ME-2). */
  carries: z.array(z.string().max(48)).max(12),
  lifeNow: z.array(z.enum(LIFE_NOW)).max(LIFE_NOW.length),
  /** "Getting back to work, study or training" (Return to work). */
  returnToWork: z.boolean(),
});
export type ProfileDto = z.infer<typeof profileSchema>;

export const profilePatchSchema = profileSchema
  .partial()
  .strict()
  // "Prefer not to say" stands alone.
  .refine((p) => !p.lifeNow?.includes('prefer_not') || p.lifeNow.length === 1, {
    message: '"Prefer not to say" goes on its own.',
    path: ['lifeNow'],
  });

export const profileViewSchema = profileSchema.extend({
  /**
   * Whether Home may show "Make FigCit more yours" (ME-1): after the first completed check-in,
   * back 7 days after a dismissal, at most 3 times, never after a safety event. The app also
   * keeps it off in Amber, Red and Blue.
   */
  promptDue: z.boolean(),
});
export type ProfileView = z.infer<typeof profileViewSchema>;
