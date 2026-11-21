import { z } from 'zod';
import { emailInput } from '../../common/http/email.js';

const email = emailInput();
const password = z.string().min(10, 'Use at least 10 characters').max(200);

export const magicLinkRequestSchema = z
  .object({
    email,
    purpose: z.enum(['sign_in', 'upgrade_from_browse']).default('sign_in'),
    // Which app the link opens: the user app, or the staff app (E-31; STAFF_APP_URL).
    app: z.enum(['user', 'staff']).default('user'),
  })
  .strict();
export const magicLinkVerifySchema = z.union([
  z.object({ token: z.string().min(20).max(200) }).strict(),
  z.object({ email, code: z.string().regex(/^\d{6}$/) }).strict(),
]);
export const passwordSignUpSchema = z.object({ email, password }).strict();
export const passwordSignInSchema = z
  .object({ email, password: z.string().min(1).max(200) })
  .strict();
/** The email a guest space will keep once it is confirmed (docs/GUEST_SPACE.md). */
export const guestLinkSchema = z.object({ email }).strict();
export const forgotSchema = z.object({ email }).strict();
export const resetSchema = z.object({ token: z.string().min(20).max(200), password }).strict();
export const setPasswordSchema = z.object({ password }).strict();
export const refreshSchema = z
  .object({ refreshToken: z.string().min(20).max(200).optional() })
  .strict();
export const mfaCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();

/**
 * A guest space (docs/GUEST_SPACE.md): adults only (the age is asked first, and nothing is made for
 * a child), and the Terms and Privacy are accepted on the notice page. `botToken` is the answer to
 * the bot challenge, when the server asks for one.
 */
export const guestSignUpSchema = z
  .object({
    ageBand: z.literal('18_plus'),
    acceptTerms: z.literal(true),
    botToken: z.string().min(1).max(4096).optional(),
  })
  .strict();

export const sessionSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int(),
  /** Only returned to native clients (`X-Client: native`); browsers get an HttpOnly cookie. */
  refreshToken: z.string().optional(),
  user: z.object({
    id: z.uuid(),
    roles: z.array(z.string()),
    isNew: z.boolean(),
    mfaRequired: z.boolean(),
    /** A guest space: no email, deleted after 30 days. */
    isGuest: z.boolean(),
  }),
});
export type SessionDto = z.infer<typeof sessionSchema>;

export const okSchema = z.object({ ok: z.literal(true) });
export const browseTokenSchema = z.object({ browseToken: z.string(), expiresAt: z.iso.datetime() });
export const mfaEnrolSchema = z.object({ secret: z.string(), otpauthUri: z.string() });
export const sessionsListSchema = z.object({
  sessions: z.array(
    z.object({
      id: z.uuid(),
      deviceLabel: z.string().nullable(),
      current: z.boolean(),
      createdAt: z.iso.datetime(),
      lastUsedAt: z.iso.datetime(),
    }),
  ),
});

/** The sign-in methods that work on this server (SU-2): the app hides the rest. */
export const authMethodsSchema = z.object({
  password: z.boolean(),
  emailCode: z.boolean(),
  google: z.boolean(),
});
