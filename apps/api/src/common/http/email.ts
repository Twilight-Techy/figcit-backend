import { z } from 'zod';

/**
 * An email address as people type it: spaces around it are dropped and it is lowercased before it
 * is checked, so " Ana@Example.com " is accepted as "ana@example.com". The string `.email()` check
 * (not `z.email()`) is what lets the trim run first and keeps `format: email` in the API docs.
 */
// eslint-disable-next-line @typescript-eslint/no-deprecated -- see above: z.email() checks before trimming.
export const emailInput = (): z.ZodString => z.string().trim().toLowerCase().email().max(254);
