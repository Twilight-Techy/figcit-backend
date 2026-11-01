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
  // Encryption (SOPS + age in production; see SYSTEM_DESIGN §9.3)
  MASTER_KEYS: z.string().min(1),
  // Email
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
  // AI and speech (self-hosted; optional: every call has a fallback)
  AI_BASE_URL: z.url().optional(),
  AI_MODEL: z.string().default('ministral-3-3b-instruct-q4_k_m'),
  AI_TOKEN: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().min(100).default(8000),
  ASSIST_DAILY_ALLOWANCE: z.coerce.number().int().min(0).default(10),
  WHISPER_URL: z.url().optional(),
  // Push
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:hello@figcit.co.uk'),
  // Billing (D-14: provider behind a port; fake until chosen)
  BILLING_PROVIDER: z.enum(['fake', 'stripe']).default('fake'),
  BILLING_WEBHOOK_SECRET: z.string().default('dev-webhook-secret'),
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
