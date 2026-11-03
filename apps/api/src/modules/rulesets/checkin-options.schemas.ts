import { z } from 'zod';

// What the check-in screens offer (E-40), as the app and the staff Simulator receive it.

const option = z.object({
  code: z.string(),
  label: z.string(),
  group: z.string().nullable(),
  risk: z.literal(true).optional(),
  needsTask: z.literal(true).optional(),
  level: z.number().int().min(1).max(4).optional(),
  asksStrength: z.enum(['pain', 'overstimulation']).optional(),
});
export const checkInOptionsSchema = z.object({
  version: z.string(),
  hash: z.string(),
  inputs: z.record(z.string(), z.array(option)),
  intensityBands: z.array(
    z.object({
      code: z.string(),
      label: z.string(),
      from: z.number().nullable(),
      to: z.number().nullable(),
    }),
  ),
  cells: z.array(
    z.object({
      id: z.string(),
      energy: z.number().int(),
      mood: z.number().int(),
      name: z.string(),
      icon: z.string(),
      meaning: z.string(),
      band: z.string(),
    }),
  ),
});
