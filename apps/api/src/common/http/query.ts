import { z } from 'zod';

/** A boolean query parameter: "true"/"1" or "false"/"0" (z.coerce.boolean would read "false" as true). */
export const queryBool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');
