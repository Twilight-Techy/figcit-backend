// Scoring for the AI eval sets (SYSTEM_DESIGN §4.3.8). Pure: no model, no clock, no files.
import { hasBanned } from '../text.js';
import type { BreakDownOutput, DriversOutput } from '../ai.tasks.js';
import type { ParsedNeed } from '../fallbacks/parse-need.js';
import type { BreakDownCase, DriversCase, ParseNeedCase } from './sets.js';

/** How one case went: `ai` is the model's checked answer; `fallback` is what the user would see instead. */
export type Outcome = 'ok' | 'invalid' | 'timeout' | 'error' | 'rules';

export interface CaseResult {
  readonly id: string;
  readonly outcome: Outcome;
  readonly correct: boolean;
  /** Task-specific hard rule (step cap for breakDownTask); true where the task has none. */
  readonly withinRule: boolean;
  readonly banned: boolean;
  readonly latencyMs: number | null;
  readonly withinTimeout: boolean | null;
  readonly outputTokens: number | null;
  readonly output: unknown;
}

export interface Summary {
  readonly cases: number;
  readonly accuracy: number;
  readonly withinRule: number;
  readonly bannedHits: number;
  readonly fallbackRate: number;
  readonly withinTimeout: number | null;
  readonly latencyP50: number | null;
  readonly latencyP95: number | null;
  readonly tokensPerSecond: number | null;
}

/** Pass bars before a task is switched on (SYSTEM_DESIGN §4.3.8). */
export interface Bars {
  readonly accuracy?: number;
  readonly withinRule?: number;
}

export const BARS: Record<string, Bars> = {
  parseNeed: { accuracy: 0.85 },
  suggestDrivers: {},
  breakDownTask: { withinRule: 1 },
};
const BANNED_HITS = 0;
const WITHIN_TIMEOUT = 0.95;

const texts = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : Array.isArray(value)
      ? value.flatMap(texts)
      : value && typeof value === 'object'
        ? Object.values(value).flatMap(texts)
        : [];

export const anyBanned = (output: unknown): boolean => texts(output).some(hasBanned);

/** Correct when the first need is one the set accepts. */
export function scoreParseNeed(out: ParsedNeed, c: ParseNeedCase): boolean {
  const top = out.needs[0];
  return top !== undefined && c.needs.includes(top);
}

/** Correct when every driver is one the set accepts, and none are given only when none fit. */
export function scoreDrivers(out: DriversOutput, c: DriversCase): boolean {
  if (out.drivers.length === 0) return c.drivers.length === 0;
  return out.drivers.every((d) => c.drivers.includes(d));
}

/** The step cap is a hard rule; a strained person only gets steps of five minutes or less. */
export function breakDownWithinCap(steps: readonly unknown[], c: BreakDownCase): boolean {
  return steps.length >= 1 && steps.length <= c.stepCap;
}

export function scoreBreakDown(out: BreakDownOutput, c: BreakDownCase): boolean {
  return (
    breakDownWithinCap(out.steps, c) &&
    (!c.strained || out.steps.every((s) => s.minutes <= 5)) &&
    out.steps.every((s) => !/\band then\b/i.test(s.text))
  );
}

export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? null;
}

const rate = (results: readonly CaseResult[], f: (r: CaseResult) => boolean): number =>
  results.length === 0 ? 0 : results.filter(f).length / results.length;

export function summarise(results: readonly CaseResult[]): Summary {
  const called = results.filter((r) => r.latencyMs !== null);
  const latencies = called.map((r) => r.latencyMs ?? 0);
  const tokens = called.reduce((n, r) => n + (r.outputTokens ?? 0), 0);
  const seconds = latencies.reduce((n, l) => n + l, 0) / 1000;
  return {
    cases: results.length,
    accuracy: rate(results, (r) => r.correct),
    withinRule: rate(results, (r) => r.withinRule),
    bannedHits: results.filter((r) => r.banned).length,
    fallbackRate: rate(results, (r) => r.outcome !== 'ok' && r.outcome !== 'rules'),
    withinTimeout: called.length ? rate(called, (r) => r.withinTimeout === true) : null,
    latencyP50: percentile(latencies, 50),
    latencyP95: percentile(latencies, 95),
    tokensPerSecond: called.length && seconds > 0 ? tokens / seconds : null,
  };
}

/** The pass bars this summary misses (empty when it passes). Speed bars only apply to model runs. */
export function failedBars(task: string, s: Summary): string[] {
  const bars = BARS[task] ?? {};
  const failed: string[] = [];
  if (bars.accuracy !== undefined && s.accuracy < bars.accuracy)
    failed.push(`accuracy ${pct(s.accuracy)} < ${pct(bars.accuracy)}`);
  if (bars.withinRule !== undefined && s.withinRule < bars.withinRule)
    failed.push(`within rule ${pct(s.withinRule)} < ${pct(bars.withinRule)}`);
  if (s.bannedHits > BANNED_HITS) failed.push(`banned phrases ${String(s.bannedHits)}`);
  if (s.withinTimeout !== null && s.withinTimeout < WITHIN_TIMEOUT)
    failed.push(`within timeout ${pct(s.withinTimeout)} < ${pct(WITHIN_TIMEOUT)}`);
  return failed;
}

export const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;
