import { z } from 'zod';

// Every environment variable is parsed here once, at start-up (rules 3: boundaries are parsed).
// Append new variables alphabetically within their section (WORKFLOW §3).
const envSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65_535).default(3001),
  // Database
  DATABASE_URL: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
