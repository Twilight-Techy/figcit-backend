import { z } from 'zod';

export const KINDS = ['broken', 'confusing', 'idea'] as const;
export const STATUSES = ['new', 'seen', 'done'] as const;

const text = z.string().trim().min(1).max(2000);
const short = (max: number) => z.string().trim().min(1).max(max).optional();

/** From the app's "Send feedback": the app fills in where the person was and on what. */
export const appFeedbackSchema = z
  .object({
    kind: z.enum(KINDS),
    text,
    screen: short(200),
    appVersion: short(40),
    device: short(200),
    screenshotId: z.uuid().optional(),
  })
  .strict();
export type AppFeedbackInput = z.infer<typeof appFeedbackSchema>;

/** From the website's tester feedback form, sent by the website's server. */
export const websiteFeedbackSchema = z
  .object({
    kind: z.enum(KINDS),
    text,
    page: short(200),
    name: short(100),
    email: z.email().max(254).optional(),
  })
  .strict();
export type WebsiteFeedbackInput = z.infer<typeof websiteFeedbackSchema>;

export const sentSchema = z.object({ id: z.uuid() });

export const feedbackItemSchema = z.object({
  id: z.uuid(),
  source: z.enum(['app', 'website']),
  kind: z.enum(KINDS),
  text: z.string(),
  screen: z.string().nullable(),
  appVersion: z.string().nullable(),
  device: z.string().nullable(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  /** A short-lived link to the screenshot, if one was sent. */
  screenshotUrl: z.string().nullable(),
  /** Whether it came from a signed-in account (the account itself isn't shown). */
  signedIn: z.boolean(),
  status: z.enum(STATUSES),
  createdAt: z.iso.datetime(),
});
export type FeedbackItem = z.infer<typeof feedbackItemSchema>;
export const feedbackListSchema = z.object({ items: z.array(feedbackItemSchema) });
export const feedbackQuerySchema = z.object({ status: z.enum(STATUSES).optional() }).strict();
export const statusSchema = z.object({ status: z.enum(STATUSES) }).strict();
