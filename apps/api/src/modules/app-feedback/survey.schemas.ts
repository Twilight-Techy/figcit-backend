import { z } from 'zod';

/**
 * The tester survey (owner, 21 Nov 2026): five taps on a 1-5 scale, then an optional comment and
 * an optional testimonial. The app holds the wording; these are the answers' keys.
 */
export const QUESTIONS = ['navigation', 'checkIn', 'fit', 'accuracy', 'overall'] as const;
export const ASKED_AT = ['logout', 'after_use', 'me'] as const;
export const TESTIMONIAL_STATUSES = ['pending', 'approved', 'hidden'] as const;

const score = z.number().int().min(1).max(5);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === '' ? null : s))
    .nullable()
    .optional();

export const surveyAnswersSchema = z
  .object({
    navigation: score.describe('How easy it was to find the way around'),
    checkIn: score.describe('How easy it was to check in'),
    fit: score.describe('How well what to do matched the energy there was'),
    accuracy: score.describe('How accurate that match felt'),
    overall: score.describe('Overall rating, out of 5'),
    comment: optionalText(2000),
    askedAt: z.enum(ASKED_AT),
    appVersion: z.string().trim().min(1).max(40).optional(),
    /** Words for others to read; shown only if `testimonialPublic` and approved by staff. */
    testimonial: optionalText(600),
    testimonialPublic: z.boolean().default(false),
    /** How to sign it, as the person wants (a first name, "a student"); none means anonymous. */
    testimonialName: optionalText(60),
  })
  .strict();
export type SurveyAnswers = z.infer<typeof surveyAnswersSchema>;

export const surveyStateSchema = z.object({
  answered: z.boolean(),
  /** Ask now, after a few check-ins, unless put off with "Not now" (at most twice). */
  dueAfterUse: z.boolean(),
  /** The last answers, to start from when answering again. */
  answers: z
    .object({
      navigation: z.number().int(),
      checkIn: z.number().int(),
      fit: z.number().int(),
      accuracy: z.number().int(),
      overall: z.number().int(),
      comment: z.string().nullable(),
      testimonial: z.string().nullable(),
      testimonialPublic: z.boolean(),
      testimonialName: z.string().nullable(),
    })
    .nullable(),
});
export type SurveyState = z.infer<typeof surveyStateSchema>;

const questionSummary = z.object({
  /** Average of the answers, to one decimal; null with no answers. */
  average: z.number().nullable(),
  /** How many chose 1, 2, 3, 4 and 5. */
  counts: z.array(z.number().int()).length(5),
});

export const surveyResponseSchema = z.object({
  id: z.uuid(),
  navigation: z.number().int(),
  checkIn: z.number().int(),
  fit: z.number().int(),
  accuracy: z.number().int(),
  overall: z.number().int(),
  comment: z.string().nullable(),
  askedAt: z.string(),
  appVersion: z.string().nullable(),
  testimonial: z.string().nullable(),
  testimonialPublic: z.boolean(),
  testimonialName: z.string().nullable(),
  testimonialStatus: z.enum(TESTIMONIAL_STATUSES).nullable(),
  updatedAt: z.iso.datetime(),
});
export type SurveyResponse = z.infer<typeof surveyResponseSchema>;

export const surveySummarySchema = z.object({
  responses: z.number().int(),
  questions: z.object({
    navigation: questionSummary,
    checkIn: questionSummary,
    fit: questionSummary,
    accuracy: questionSummary,
    overall: questionSummary,
  }),
  /** The latest 200, newest first. */
  items: z.array(surveyResponseSchema),
});
export type SurveySummary = z.infer<typeof surveySummarySchema>;

export const testimonialStatusSchema = z.object({ status: z.enum(TESTIMONIAL_STATUSES) }).strict();

export const publicTestimonialsSchema = z.object({
  items: z.array(z.object({ text: z.string(), name: z.string().nullable(), at: z.iso.datetime() })),
});
