// The eval sets: synthetic examples, never real user text (SYSTEM_DESIGN §4.3.8). Parsed with zod,
// so a typo in a set fails the run instead of skewing it.
import { readFileSync } from 'node:fs';
import { z } from 'zod';

const id = z.string().regex(/^[a-z]{2}-\d{3}$/);
const kind = z.enum(['study', 'work', 'health', 'social', 'home']).optional();

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

export type ParseNeedCase = z.infer<typeof parseNeedCase>;
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
