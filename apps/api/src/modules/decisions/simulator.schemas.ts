import { z } from 'zod';
import { checkInInputSchema } from '../checkin/checkin.schemas.js';
import { cardSchema } from '../recommendation/recommendation.schemas.js';
import { cardV2Schema } from './decisions.schemas.js';

// The staff check-in Simulator (E-61): a check-in as the app sends it, through a version, with
// every step shown. Nothing is stored and no safety event is made.

const inputFacts = z.record(z.string(), z.unknown());

/** Who is checking in: Browse (no account) or a signed-in user's plan. */
export const SIM_ACCOUNTS = ['browse', 'free', 'plus', 'institution'] as const;

/**
 * The account signals a new user starts with, which the Advanced panel can change (the server
 * reads them from the account, E-52). Keys are the engine's fact names.
 */
export const simSignalsSchema = z
  .object({
    'signals.declines_session': z.number().int().min(0).max(20),
    'signals.safety_event_recently': z.boolean(),
    'signals.in_session': z.boolean(),
    'signals.advanced_dismissed': z.boolean(),
    'signals.recovery_window_open': z.boolean(),
    'signals.practice_due': z.boolean(),
    'signals.recurring_struggle': z.boolean(),
    'signals.practice_helps': z.boolean(),
    'prefs.meditation_worse': z.boolean(),
    'prefs.body_scan_opt_in': z.boolean(),
    'signals.days_very_constrained': z.number().int().min(0).max(30),
  })
  .partial()
  .strict();

export const simulateCheckInBodySchema = z
  .object({
    checkIn: checkInInputSchema.describe('The check-in exactly as the app sends it'),
    account: z.enum(SIM_ACCOUNTS).default('free'),
    signals: simSignalsSchema
      .default({})
      .describe("Changes to a new user's signals (signed in only; Browse has none)"),
    recheckOf: z
      .object({
        input: inputFacts.describe('The engine input of the check-in being re-checked'),
        supportCompleted: z.boolean().optional(),
      })
      .strict()
      .optional()
      .describe('A re-check: the earlier run, on the same version'),
    declined: z
      .array(z.string().max(48))
      .max(10)
      .default([])
      .describe('Tools declined with "Try another", in order'),
    facts: inputFacts
      .optional()
      .describe('Engine input edited by hand: replaces what the check-in gives'),
    now: z.iso
      .datetime()
      .optional()
      .describe('The time to work a due date into a timeline at (default: now)'),
  })
  .strict();
export type SimulateCheckInBody = z.infer<typeof simulateCheckInBodySchema>;

const answerRef = z.object({ input: z.string(), code: z.string().optional() });

const contribution = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('value'), from: answerRef, fact: z.string(), value: z.unknown() }),
  z.object({
    kind: z.literal('rating'),
    from: answerRef,
    fact: z.string(),
    key: z.string(),
    value: z.number().nullable(),
  }),
  z.object({ kind: z.literal('member'), from: answerRef, fact: z.string(), value: z.string() }),
]);

export const UNUSED_WHY = [
  'maps_to_nothing',
  'not_read',
  'not_offered',
  'not_a_value',
  'support_only',
  'no_fact',
  'risk_check',
  'task_order',
  'suggestion_only',
] as const;

export const SERVER_SOURCES = [
  'account',
  'new_user',
  'advanced',
  'recheck',
  'risk_check',
  'try_another',
] as const;

export const simulateCheckInResultSchema = z.object({
  version: z.object({ label: z.string(), status: z.string() }),
  checkIn: inputFacts.describe('The check-in as the server read it, defaults filled in'),
  contributions: z
    .array(contribution)
    .describe('Each piece of engine input and the answer it came from, in check-in order'),
  unused: z
    .array(z.object({ from: answerRef, why: z.enum(UNUSED_WHY), gap: z.string().optional() }))
    .describe('Answers that give the engine nothing, and why'),
  server: z
    .array(z.object({ fact: z.string(), value: z.unknown(), source: z.enum(SERVER_SOURCES) }))
    .describe('What the server adds: the plan, the signals, the re-check, the risk check'),
  timeline: z
    .object({ code: z.string(), from: z.enum(['picked', 'due_date']) })
    .nullable()
    .describe("The task's timeline, and whether it was picked or worked out from the due date"),
  risk: z.object({
    checked: z.array(z.object({ input: z.string(), matched: z.boolean() })),
    category: z.string().nullable(),
  }),
  input: inputFacts.describe('The engine input, as the engine gets it'),
  handEdited: z.boolean().describe('The input was edited by hand: the app could not send it'),
  outcome: z.union([
    z.object({
      ok: z.literal(true),
      card: cardV2Schema,
      trace: z.unknown().describe('The full trace'),
      shown: cardSchema.describe('The card as the app receives it'),
    }),
    z.object({
      ok: z.literal(false),
      issues: z.array(z.object({ path: z.string(), message: z.string() })),
    }),
  ]),
});
export type SimulateCheckInResult = z.infer<typeof simulateCheckInResultSchema>;

// Saved scenarios (E-61): shared by the staff who use the Simulator; saving and deleting one
// is on the rules audit chain; each run keeps the version it ran on and the card it gave.

const ANSWERS_MAX = 32_000;

export const scenarioBodySchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    answers: z
      .record(z.string(), z.unknown())
      .refine((a) => JSON.stringify(a).length <= ANSWERS_MAX, 'The answers are too large.')
      .describe("The Simulator's answers, to show its screens as they were"),
    request: simulateCheckInBodySchema.describe('What the scenario runs'),
  })
  .strict();
export type ScenarioBody = z.infer<typeof scenarioBodySchema>;

export const scenarioDeleteSchema = z
  .object({ reason: z.string().trim().min(3).max(500) })
  .strict();

export const scenarioRunBodySchema = z
  .object({ label: z.string().max(40).describe('The version to run it on') })
  .strict();

const scenarioOutcome = z
  .object({
    ok: z.boolean().describe('False when the engine refused the input'),
    light: z.string().nullable(),
    band: z.string().nullable(),
    kind: z.string().nullable().describe('card or support_screen'),
    primary: z.object({ label: z.string(), tool: z.string().nullable() }).nullable(),
    alternatives: z.array(z.string()),
    handEdited: z.boolean(),
  })
  .describe('The card the run gave: codes and labels only');
export type ScenarioOutcome = z.infer<typeof scenarioOutcome>;

export const scenarioRunSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  ranAt: z.iso.datetime(),
  ranBy: z.uuid(),
  outcome: scenarioOutcome,
});

export const scenarioSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.iso.datetime(),
  createdBy: z.uuid(),
  lastRun: scenarioRunSchema.nullable(),
});
export const scenarioListSchema = z.object({ items: z.array(scenarioSummarySchema) });

export const scenarioSchema = scenarioSummarySchema.extend({
  answers: z.record(z.string(), z.unknown()),
  request: z.record(z.string(), z.unknown()).describe('What the scenario runs'),
  runs: z.array(scenarioRunSchema).describe('Newest first, the last 100'),
});
export type ScenarioDto = z.infer<typeof scenarioSchema>;

export const scenarioRunResultSchema = z.object({
  run: scenarioRunSchema,
  result: simulateCheckInResultSchema,
});
