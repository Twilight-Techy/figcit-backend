import { z } from 'zod';

export const rangeQuerySchema = z
  .object({
    range: z.coerce
      .number()
      .int()
      .refine((n) => [7, 30, 90].includes(n), 'Use 7, 30 or 90.')
      .default(30),
  })
  .strict();

export const daySchema = z.object({
  date: z.iso.date(),
  checkIns: z.number().int(),
  light: z.enum(['green', 'yellow', 'amber', 'red', 'blue']).nullable(),
  averageMood: z.number().nullable(),
  averageEnergy: z.number().nullable(),
});
export const helpedSchema = z.object({
  toolId: z.string(),
  name: z.string(),
  pathway: z.string(),
  sessions: z.number().int(),
  helped: z.number().int(),
  aBit: z.number().int(),
  notReally: z.number().int(),
});

export const progressSchema = z.object({
  rangeDays: z.number().int(),
  from: z.iso.date(),
  to: z.iso.date(),
  checkIns: z.number().int(),
  days: z.array(daySchema),
  lights: z.object({
    green: z.number().int(),
    yellow: z.number().int(),
    amber: z.number().int(),
    red: z.number().int(),
    blue: z.number().int(),
  }),
  pathways: z.array(
    z.object({ pathway: z.string(), sessions: z.number().int(), minutes: z.number().int() }),
  ),
  didItHelp: z.array(helpedSchema),
  tasks: z.object({ done: z.number().int(), stepsDone: z.number().int(), open: z.number().int() }),
  reflections: z.object({ count: z.number().int(), wins: z.number().int() }),
  /** Plain-words observations, never scores or streaks. */
  notes: z.array(z.string()),
});
export type ProgressDto = z.infer<typeof progressSchema>;
