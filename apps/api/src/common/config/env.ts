import { z } from 'zod';

// Every environment variable is parsed here once, at start-up (rules 3: boundaries are parsed).
// Append new variables alphabetically within their section (WORKFLOW §3).
const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  // Runtime
  DOCS_ENABLED: bool.optional(), // Swagger UI at /docs; default: on outside production
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65_535).default(3001),
  // URLs
  API_URL: z.url().default('http://localhost:3001'),
  APP_URL: z.url().default('http://localhost:3000'),
  // The staff app's address (E-31, E-35): staff sign-in links open there. Unset: no staff links.
  STAFF_APP_URL: z.url().optional(),
  // Pinged every 14 minutes so a host that sleeps when idle stays up. Unset: no pings.
  KEEP_ALIVE_URL: z.url().optional(),
  // The first Owner of the staff app (E-64), used only while there is none.
  OWNER_EMAIL: z.email().optional(),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  // Database
  DATABASE_URL: z.url(),
  // Auth
  ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  COOKIE_SECURE: bool.optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
  REFRESH_TTL_DAYS: z.coerce.number().int().min(1).default(30),
  STAFF_SESSION_HOURS: z.coerce.number().int().min(1).default(8),
  // Guest spaces (docs/GUEST_SPACE.md): sign-ups are limited per network address and in all, and an
  // optional bot challenge (a siteverify-style check: Turnstile, hCaptcha, reCAPTCHA) is off by default.
  GUEST_BOT_CHALLENGE: bool.default(false),
  GUEST_BOT_SECRET: z.string().optional(),
  GUEST_BOT_VERIFY_URL: z.url().optional(),
  // Confirmation mails one address may be sent in a day, from all guest spaces together.
  GUEST_LINK_MAILS_PER_ADDRESS: z.coerce.number().int().min(1).default(3),
  GUEST_DAILY_CAP: z.coerce.number().int().min(0).default(2000),
  GUEST_SIGNUPS_PER_DAY: z.coerce.number().int().min(1).default(20),
  GUEST_SIGNUPS_PER_HOUR: z.coerce.number().int().min(1).default(5),
  // Encryption (SOPS + age in production; see SYSTEM_DESIGN §9.3)
  MASTER_KEYS: z.string().min(1),
  // Jobs: run them in the API process with no polling, so an idle database can sleep (ADR 0010).
  JOBS_ON_DEMAND: bool.default(false),
  // Email. BREVO_API_KEY sends through Brevo's HTTPS API (port 443), for hosts that block SMTP
  // (Render's free plan, owner's choice 12 Nov 2026); it wins over SMTP_URL when both are set.
  BREVO_API_KEY: z.string().optional(),
  DEV_MAILBOX: bool.default(false),
  MAIL_FROM: z.string().default('FigCit <hello@figcit.co.uk>'),
  SMTP_URL: z.string().optional(),
  // Storage
  S3_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().default('figcit-private'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('eu-west-2'),
  S3_SECRET_KEY: z.string().optional(),
  STORAGE_DIR: z.string().default('var/storage'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  // AI and speech (optional: every call has a fallback). `llama`: our own llama-server
  // (ADR 0009); `openai`: any hosted OpenAI-style API, e.g. Groq at https://api.groq.com/openai.
  AI_PROVIDER: z.enum(['llama', 'openai']).default('llama'),
  AI_BASE_URL: z.url().optional(),
  // Hosted thinking models: how much to think before answering (`none` on Groq's Qwen 3 turns it
  // off, which our short timeouts need). Sent only with AI_PROVIDER=openai.
  AI_REASONING_EFFORT: z.string().max(16).optional(),
  AI_MODEL: z.string().default('ministral-3-3b-instruct-q4_k_m'),
  AI_TOKEN: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().min(100).default(8000),
  ASSIST_DAILY_ALLOWANCE: z.coerce.number().int().min(0).default(10),
  WHISPER_URL: z.url().optional(),
  // `whisper`: our own whisper-server; `openai`: an OpenAI-style /v1/audio/transcriptions at
  // WHISPER_URL, with SPEECH_MODEL and SPEECH_TOKEN (AI_TOKEN when not set).
  SPEECH_PROVIDER: z.enum(['whisper', 'openai']).default('whisper'),
  SPEECH_MODEL: z.string().default('whisper-large-v3-turbo'),
  SPEECH_TOKEN: z.string().optional(),
  // Push
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:hello@figcit.co.uk'),
  // Billing (D-14: provider behind a port; fake until chosen)
  BILLING_PROVIDER: z.enum(['fake', 'stripe']).default('fake'),
  // Prices are shown before VAT; checkout adds it and shows the total before payment.
  VAT_PERCENT: z.coerce.number().min(0).max(100).default(20),
  BILLING_WEBHOOK_SECRET: z.string().default('dev-webhook-secret'),
  // How many proxies in front of the API add to X-Forwarded-For. The address that limits and logs
  // use is the one the nearest of OUR proxies saw, never a value the client sent. 1 fits Heroku,
  // Render and a single Caddy or nginx; 2 when a CDN also sits in front; 0 trusts no header.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
  // Abuse protection
  RATE_LIMIT_ENABLED: bool.default(true),
  // Errors
  SENTRY_DSN: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // An empty value (`AI_BASE_URL=`) means "not set".
  const present = Object.fromEntries(
    Object.entries(source).filter(([, v]) => v !== undefined && v !== ''),
  );
  const result = envSchema.safeParse(present);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export const ENV = Symbol('ENV');
