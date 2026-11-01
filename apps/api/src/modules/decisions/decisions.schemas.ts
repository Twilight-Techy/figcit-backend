import { z } from 'zod';
import { checkInInputSchema } from '../checkin/checkin.schemas.js';

// The engine v2 card and decision record (M5, DESIGN §10, DECISION_LOG E-52).

const target = z.union([
  z.object({ pathway: z.string() }),
  z.object({ tool: z.string() }),
  z.object({ action: z.string() }),
]);

const cardItem = z.object({
  target,
  pathway: z.string().nullable(),
  tool: z.string().nullable().describe('The tool the button opens'),
  advanced: z.boolean().describe('An Advanced (paid) tool; the app labels it'),
  copy: z.string().nullable().describe('Wording key of the CTA or option'),
  tone: z.array(z.string()).describe('Further wording keys, e.g. no blame'),
  from: z.string().describe('The rule that put it on the card'),
});

export const cardV2Schema = z.object({
  kind: z.enum(['card', 'support_screen']),
  band: z.string().nullable(),
  light: z.string().nullable(),
  primary: cardItem.nullable(),
  alternatives: z.array(cardItem).max(2),
  queued: z.array(cardItem),
  visible: z
    .array(cardItem)
    .describe('"Get support now" first, then actions such as "Skip to task"'),
  prompts: z.array(z.string()),
  reminder: z.object({ minutes: z.number().int(), copy: z.string().nullable() }).nullable(),
  supportVisible: z.boolean(),
  drivers: z.array(z.object({ code: z.string(), weight: z.number().int() })),
  stepCap: z.number().int().nullable(),
  minutesCap: z.number().int().nullable(),
  practice: z.array(
    z.object({
      modes: z.array(z.string()),
      maxMinutes: z.number().int().nullable(),
      tools: z.array(z.string()).nullable(),
    }),
  ),
  because: z
    .array(z.object({ fact: z.string(), key: z.string().optional(), value: z.unknown() }))
    .describe('The input the primary\'s rule matched: "Because you said X"'),
});

/** A check-in, as the app sends it (E-39); `recheckOfId` is a previous decision of this user. */
export const decideBodySchema = checkInInputSchema.extend({
  recheckOfId: z.uuid().optional().describe('The decision this check-in re-checks'),
});
export type DecideBody = z.infer<typeof decideBodySchema>;

export const decisionSchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  mode: z.enum(['signed_in', 'browse']),
  ruleset: z.object({ label: z.string(), hash: z.string() }),
  engineVersion: z.string(),
  card: cardV2Schema,
});
export type DecisionDto = z.infer<typeof decisionSchema>;

/** Staff view: the input facts and the full trace, for "what influenced this". */
export const decisionRecordSchema = decisionSchema.extend({
  userId: z.uuid().nullable(),
  input: z.record(z.string(), z.unknown()),
  trace: z.unknown(),
  recheckOfId: z.uuid().nullable(),
  replay: z
    .object({ at: z.iso.datetime(), matches: z.boolean() })
    .nullable()
    .describe('The last replay of this record'),
});
export type DecisionRecordDto = z.infer<typeof decisionRecordSchema>;

export const replayResultSchema = z.object({
  matches: z.boolean(),
  sameCard: z.boolean(),
  sameTrace: z.boolean(),
  engineVersion: z.object({ recorded: z.string(), running: z.string() }),
});
export type ReplayResult = z.infer<typeof replayResultSchema>;

const inputFacts = z.record(z.string(), z.unknown());

export const simulateBodySchema = z
  .object({
    input: inputFacts.describe(
      'Input facts by name, in standard values (the format endpoint lists them)',
    ),
    trace: z.enum(['light', 'full']).default('full'),
  })
  .strict();

export const simulateResultSchema = z.union([
  z.object({ ok: z.literal(true), card: cardV2Schema, trace: z.unknown() }),
  z.object({
    ok: z.literal(false),
    issues: z.array(z.object({ path: z.string(), message: z.string() })),
  }),
]);

export const exploreBodySchema = z
  .object({
    inputs: z
      .array(inputFacts)
      .max(5000)
      .optional()
      .describe('Inputs to run; leave out for the publish sweep'),
  })
  .strict();

export const exploreResultSchema = z.object({
  ran: z.number().int(),
  refused: z.number().int(),
  rules: z.object({
    total: z.number().int(),
    neverFired: z.array(z.string()).describe('Rules ("tab · reference #n") no input fired'),
  }),
  byLight: z.record(z.string(), z.number().int()),
  byPrimary: z.record(z.string(), z.number().int()),
  checks: z.object({
    counts: z.record(z.string(), z.number().int()),
    violations: z.array(
      z.object({ check: z.string(), input: inputFacts, rows: z.array(z.string()) }),
    ),
  }),
});
export type ExploreResult = z.infer<typeof exploreResultSchema>;

/** "Try another" or Adapt on a Browse card (E-53). */
export const anotherBodySchema = z
  .object({
    declinedToolId: z.string().max(48).optional().describe('The tool the user just declined'),
  })
  .strict();

export const decisionListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    before: z.iso
      .datetime()
      .optional()
      .describe("Older than this time (the last item's createdAt)"),
    light: z.enum(['green', 'yellow', 'amber', 'red', 'blue']).optional(),
    mode: z.enum(['signed_in', 'browse']).optional(),
    supportScreen: z.enum(['true', 'false']).optional(),
  })
  .strict();

export const decisionListSchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      createdAt: z.iso.datetime(),
      mode: z.enum(['signed_in', 'browse']),
      light: z.string().nullable(),
      band: z.string().nullable(),
      supportScreen: z.boolean(),
      ruleset: z.string(),
      primary: z.string().nullable().describe("The primary's tool, action or pathway"),
      replayMatches: z.boolean().nullable(),
    }),
  ),
  next: z.string().nullable(),
});
export type DecisionList = z.infer<typeof decisionListSchema>;

export const compareBodySchema = z
  .object({
    against: z.string().describe('The version to compare with (usually the published one)'),
    inputs: z.array(inputFacts).max(5000).optional().describe('Leave out for the publish sweep'),
  })
  .strict();

export const compareResultSchema = z.object({
  ran: z.number().int(),
  changed: z.number().int(),
  examples: z.array(
    z.object({
      input: inputFacts,
      before: z.object({ light: z.string().nullable(), primary: z.string() }),
      after: z.object({ light: z.string().nullable(), primary: z.string() }),
    }),
  ),
});
export type CompareResult = z.infer<typeof compareResultSchema>;
