import { z } from 'zod';

export const PATHWAY_CODES = [
  'regulate',
  'dump',
  'express',
  'execute',
  'adapt',
  'reflect',
  'connect',
  'meditate',
] as const;
export const ACTION_KINDS = [
  'pathway',
  'support',
  'skip_to_task',
  'try_anyway',
  'save_for_later',
  'remind_later',
  'check_in_again',
  'open_home',
  'own_practice',
  'quiet_message',
] as const;

export const actionSchema = z.object({
  kind: z.enum(ACTION_KINDS),
  label: z.string(),
  pathway: z.enum(PATHWAY_CODES).optional(),
  toolId: z.string().optional(),
  advanced: z.boolean().optional(),
  minutes: z.number().int().optional(),
  practiceId: z.string().optional(),
  /** Where the app should go for this action. */
  href: z.string(),
});
export type ActionDto = z.infer<typeof actionSchema>;

export const crisisRouteSchema = z.object({
  id: z.string(),
  label: z.string(),
  detail: z.string(),
  href: z.string(),
  kind: z.enum(['call', 'text', 'link']),
});

export const cardSchema = z.object({
  id: z.uuid(),
  checkInId: z.uuid(),
  createdAt: z.iso.datetime(),
  light: z.enum(['green', 'yellow', 'amber', 'red', 'blue']),
  lightLabel: z.string(),
  lightHex: z.string(),
  lightIcon: z.string(),
  state: z.object({
    cellId: z.string(),
    name: z.string(),
    icon: z.string(),
    meaning: z.string(),
    confirmed: z.boolean(),
  }),
  title: z.string(),
  rationale: z.string(),
  primary: actionSchema,
  alternatives: z.array(actionSchema).max(2),
  queuedStep: actionSchema.nullable(),
  supportVisible: z.boolean(),
  notNow: z.boolean(),
  safetyTriggered: z.boolean(),
  crisisRoutes: z.array(crisisRouteSchema),
  patterns: z.array(z.number().int()),
  timeline: z.object({ code: z.string(), stepCap: z.number().int() }).nullable(),
  taskId: z.uuid().nullable(),
  origin: z.enum(['online', 'offline']),
});
export type CardDto = z.infer<typeof cardSchema>;

export const actionRequestSchema = z
  .object({
    action: z.enum(['start', 'try_another', 'not_now', 'correct', 'get_support', 'why']),
    toolId: z.string().max(48).optional(),
    reason: z.string().max(48).optional(),
  })
  .strict();

export const actionResultSchema = z.object({
  ok: z.literal(true),
  card: cardSchema.nullable(),
  quietUntil: z.iso.datetime().nullable(),
});

export const whySchema = z.object({
  reasons: z.array(z.object({ code: z.string(), text: z.string() })),
  modifiers: z.array(z.object({ rule: z.string(), text: z.string() })),
  gates: z.array(z.object({ rule: z.string(), effect: z.string(), text: z.string() })),
  versions: z.object({ engine: z.string(), snapshot: z.string() }),
});

export const adaptRequestSchema = z
  .object({
    adaptations: z
      .array(
        z
          .object({
            kind: z.enum([
              'environment',
              'scope',
              'modality',
              'pace',
              'sequence',
              'instructions',
              'communication',
            ]),
            detailCode: z.string().max(64),
          })
          .strict(),
      )
      .min(1)
      .max(5),
    save: z.boolean().default(false),
  })
  .strict();
