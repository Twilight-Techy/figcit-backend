import { z } from 'zod';

// The Rules Engine v5.0 check-in and card (docs/engine-v2/V5.md). Codes are the published
// version's check-in options (GET /v1/rulesets/current/check-in-options); free text (Something
// else, task titles) passes the safety check and never reaches the engine.

const code = z.string().regex(/^[a-z0-9_]{1,48}$/);

const checkInV5Base = z.object({
  mode: z.enum(['quick', 'full']).describe('Quick asks no body, senses or place (CTX-U)'),
  state: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('grid'),
      energy: z.number().int().min(1).max(4),
      mood: z.number().int().min(1).max(4),
    }),
    z.object({ kind: z.literal('not_sure') }),
  ]),
  emotions: z
    .array(z.object({ code, level: z.number().int().min(1).max(10).describe('The slider') }))
    .max(2)
    .describe('Up to two emotions (Tab 2)'),
  somethingElse: z
    .object({
      text: z.string().trim().min(1).max(30).describe('Checked for safety, then dropped (SE-1)'),
      group: z
        .enum(['charged', 'low', 'shutdown', 'settled'])
        .optional()
        .describe('The one tap: wound up, low, switched off, okay; skipped stays Unsorted'),
    })
    .optional(),
  body: z.array(code).max(14).optional(),
  urgent: z
    .object({ signs: z.array(code).min(1).max(5), answer: z.enum(['sudden_new', 'familiar']) })
    .optional()
    .describe("'Something feels wrong' and 'Is this sudden or new for you?' (SF-4)"),
  senses: z.array(code).max(8).optional(),
  place: z.object({ code, canStepAway: z.boolean() }).optional(),
  devices: z.array(code).max(6).optional(),
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120).describe('Shown on the card, never to the engine'),
        chip: code.optional().describe('No chip is Usual (TK-1)'),
      }),
    )
    .max(20)
    .optional(),
  helpCard: code.optional().describe('The Help menu pick (Tab 7)'),
  recheckOfId: z.uuid().optional().describe('The decision this check-in re-checks'),
});

/** The rules between answers: each emotion once, and Something else's own words go with its emotion. */
export const checkInV5Schema = checkInV5Base
  .superRefine((b, ctx) => {
    const seen = new Set<string>();
    b.emotions.forEach((e, i) => {
      if (seen.has(e.code))
        ctx.addIssue({
          code: 'custom',
          path: ['emotions', i, 'code'],
          message: `Emotion ${e.code} is there twice. Pick each feeling once.`,
        });
      seen.add(e.code);
    });
    if (b.somethingElse && !seen.has('something_else'))
      ctx.addIssue({
        code: 'custom',
        path: ['somethingElse'],
        message: 'Your own words go with the "Something else" feeling. Pick that feeling too.',
      });
  })
  .meta({
    examples: [
      {
        mode: 'full',
        state: { kind: 'grid', energy: 2, mood: 3 },
        emotions: [{ code: 'anxious', level: 6 }],
        body: ['tension'],
        place: { code: 'home', canStepAway: true },
      },
    ],
  });

export type CheckInV5Body = z.infer<typeof checkInV5Schema>;

const words = z.object({ key: z.string(), text: z.string() });

const itemV5 = z.object({
  kind: z.enum(['tool', 'action', 'pathway']),
  /** The tool the button opens, the action, or the pathway. */
  code: z.string(),
  pathway: z.string().nullable(),
  label: z.string().describe("Tab 17's user_label, or the action's words (LBL-1)"),
  description: z.string().nullable().describe("Tab 17's user_description"),
  plan: z.enum(['prime', 'premium']).nullable().describe('A paid tool: the app shows the lock'),
});

const menuCard = z.object({ code: z.string(), label: z.string(), hint: z.string().nullable() });

/** What the check-in screens show as the person goes (Tab 13: the colour inline, the menu). */
export const previewV5Schema = z.object({
  kind: z.enum(['card', 'support_screen', 'urgent_screen']),
  light: z.string().nullable(),
  lowered: z.boolean().describe('The colour went down (FE-1, FE-2, BS-1, SF-4)'),
  noWords: z.boolean().describe('No-words mode (FE-2, BS-3): tap-only, eyes open'),
  reason: z.string().describe('One plain sentence (RT-4)'),
  menu: z.object({ cards: z.array(menuCard), more: z.array(menuCard) }),
  dropped: z.array(
    z.object({
      input: z.string(),
      code: z.string(),
      why: z.enum(['not_offered', 'locked', 'not_asked', 'too_many']),
    }),
  ),
});

export const cardV5Schema = z.object({
  kind: z.enum(['card', 'support_screen', 'urgent_screen']),
  light: z.string().nullable(),
  pattern: z.string().nullable(),
  noWords: z.boolean(),
  headline: z.string(),
  reason: z.string(),
  taskLine: z.string().nullable(),
  primary: itemV5.nullable(),
  alternatives: z.array(itemV5).max(2),
  supportVisible: z.boolean().describe('Get support now; otherwise the app shows Not now'),
  suggestion: words.nullable().describe('With no task, a task that fits (TK-4)'),
  prompts: z.array(words).describe("e.g. 'Not at home? Tell us where you are' (P42)"),
  tasks: z
    .object({ first: z.array(z.string()), later: z.array(z.string()) })
    .nullable()
    .describe('The task titles in the order to show them (TK-2)'),
  helpSwap: z
    .object({ card: z.string(), reason: z.string() })
    .nullable()
    .describe('The card picked was blocked; why, in one line (SEQ-2)'),
});

export const decisionV5Schema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  ruleset: z.object({ label: z.string(), hash: z.string() }),
  engineVersion: z.string(),
  card: cardV5Schema,
  menu: previewV5Schema.shape.menu,
  dropped: previewV5Schema.shape.dropped,
});
export type DecisionV5Dto = z.infer<typeof decisionV5Schema>;
export type PreviewV5Dto = z.infer<typeof previewV5Schema>;
export type CardV5Dto = z.infer<typeof cardV5Schema>;

/** RW-5: My fit summary (Premium): capacity against the kinds of task, over 2 to 4 weeks. */
export const fitSummarySchema = z.object({
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  checkIns: z.number().int().describe('v5.0 check-ins in the period'),
  lights: z
    .array(
      z.object({
        light: z.string(),
        checkIns: z.number().int(),
        chips: z
          .array(z.object({ chip: z.string(), label: z.string(), checkIns: z.number().int() }))
          .describe('The kinds of task brought to these check-ins, most first'),
      }),
    )
    .describe('In light order: green, yellow, blue, amber, red'),
});
export type FitSummaryDto = z.infer<typeof fitSummarySchema>;

/** The staff Simulator's v5.0 check-in: as the app sends it, with the account it stands for. */
export const simulateV5BodySchema = z.object({
  checkIn: checkInV5Base.omit({ recheckOfId: true }),
  plan: z
    .enum(['free', 'prime', 'premium', 'organisation_seat'])
    .default('free')
    .describe('The plan the account is on (Tab 9)'),
  lifeNow: z.array(z.string().max(48)).max(10).default([]).describe('Life right now (ME-4)'),
  returnToWork: z.boolean().default(false).describe('Me: back to work, study or training (RW-1)'),
});
export type SimulateV5Body = z.infer<typeof simulateV5BodySchema>;

export const simulateV5ResultSchema = z.object({
  version: z.object({ label: z.string(), status: z.string() }),
  /** The engine input the check-in and the account give. */
  input: z.record(z.string(), z.unknown()),
  dropped: previewV5Schema.shape.dropped,
  risk: z.object({ matched: z.boolean() }).describe('The free text through the safety check'),
  card: cardV5Schema.nullable(),
  menu: previewV5Schema.shape.menu,
  /** The rules that fired, by workbook reference ("feelings · EM03"), in run order. */
  fired: z.array(z.string()),
  issues: z.array(z.object({ path: z.string(), message: z.string() })),
});
export type SimulateV5Result = z.infer<typeof simulateV5ResultSchema>;
