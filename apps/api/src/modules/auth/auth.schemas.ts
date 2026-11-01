import { z } from 'zod';

const email = z
  .email()
  .max(254)
  .transform((e) => e.trim().toLowerCase());
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
export const forgotSchema = z.object({ email }).strict();
export const resetSchema = z.object({ token: z.string().min(20).max(200), password }).strict();
export const setPasswordSchema = z.object({ password }).strict();
export const refreshSchema = z
  .object({ refreshToken: z.string().min(20).max(200).optional() })
  .strict();
export const mfaCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();

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
