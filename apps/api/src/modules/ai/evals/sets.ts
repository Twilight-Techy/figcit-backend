// The eval sets: synthetic examples, never real user text (SYSTEM_DESIGN §4.3.8). Parsed with zod,
// so a typo in a set fails the run instead of skewing it.
import { readFileSync } from 'node:fs';
import { z } from 'zod';

const id = z.string().regex(/^[a-z]{2}-\d{3}$/);
const kind = z.enum(['study', 'work', 'health', 'social', 'home', 'other']).optional();

const parseNeedCase = z.object({
  id,
  text: z.string().min(1).max(500),
  /** Need codes accepted as the first need; more than one when the sentence honestly fits both. */
  needs: z.array(z.string()).min(1),
});
const driversCase = z.object({
  id,
  title: z.string().min(1).max(200),
  kind,
  /** Drivers that fit; an empty list means none should be suggested. */
  drivers: z.array(
    z.enum([
      'novelty',
      'challenge',
      'routine',
      'interest',
      'passion',
      'collaboration',
      'exploration',
    ]),
  ),
});
const breakDownCase = z.object({
  id,
  title: z.string().min(1).max(200),
  kind,
  stepCap: z.number().int().min(1).max(10),
  strained: z.boolean(),
});

const feelingCase = z.object({
  id,
  text: z.string().min(1).max(500),
  /** Feeling chips the words describe; the first match and every confident match must be one. */
  emotions: z.array(z.string()).min(1),
});
const splitCase = z.object({
  id,
  text: z.string().min(1).max(300),
  /** Accepted task counts; two when the sentence honestly reads either way. */
  counts: z.array(z.number().int().min(1).max(5)).min(1),
});
const dumpCase = z.object({
  id,
  items: z
    .array(
      z.object({
        id: z.string(),
        text: z.string().min(1),
        bucket: z.enum(['ideas', 'notes', 'worries', 'todo']),
      }),
    )
    .min(1),
});
const expressCase = z.object({
  id,
  text: z.string().min(1).max(2000),
  level: z.enum(['gentle', 'clear', 'shortest']),
  purpose: z.string().optional(),
});

export type ParseNeedCase = z.infer<typeof parseNeedCase>;
export type FeelingCase = z.infer<typeof feelingCase>;
export type SplitCase = z.infer<typeof splitCase>;
export type DumpCase = z.infer<typeof dumpCase>;
export type ExpressCase = z.infer<typeof expressCase>;
export type DriversCase = z.infer<typeof driversCase>;
export type BreakDownCase = z.infer<typeof breakDownCase>;

const set = <T extends z.ZodType>(item: T) =>
  z.object({
    version: z.number().int(),
    status: z.enum(['draft', 'reviewed']),
    cases: z.array(item),
  });

export const SETS = {
  parseNeed: { file: 'parse-need.json', schema: set(parseNeedCase) },
  suggestDrivers: { file: 'suggest-drivers.json', schema: set(driversCase) },
  breakDownTask: { file: 'break-down-task.json', schema: set(breakDownCase) },
  mapFeeling: { file: 'map-feeling.json', schema: set(feelingCase) },
  splitTasks: { file: 'split-tasks.json', schema: set(splitCase) },
  sortDump: { file: 'sort-dump.json', schema: set(dumpCase) },
  simplify: { file: 'simplify.json', schema: set(expressCase) },
  rewrite: { file: 'rewrite.json', schema: set(expressCase) },
  draft: { file: 'draft.json', schema: set(expressCase) },
  structure: { file: 'structure.json', schema: set(expressCase) },
  script: { file: 'script.json', schema: set(expressCase) },
} as const;

export type EvalTask = keyof typeof SETS;

export function loadSet<T extends EvalTask>(task: T): z.infer<(typeof SETS)[T]['schema']> {
  const { file, schema } = SETS[task];
  const raw: unknown = JSON.parse(readFileSync(new URL(`./sets/${file}`, import.meta.url), 'utf8'));
  const parsed = schema.parse(raw) as z.infer<(typeof SETS)[T]['schema']>;
  const ids = parsed.cases.map((c) => c.id);
  if (new Set(ids).size !== ids.length) throw new Error(`${file}: duplicate case ids`);
  return parsed;
}
