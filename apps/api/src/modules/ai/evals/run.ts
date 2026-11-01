// `pnpm eval <task|all> [--rules] [--limit N] [--out DIR] [--strict]` (SYSTEM_DESIGN §4.3.8).
// Runs a task's eval set against the model server in AI_BASE_URL (AI_TOKEN, AI_MODEL), the same way
// AiService does: scrubbed text, schema-constrained output, zod, then the task's checks. `--rules`
// scores the rule-based fallbacks instead, with no model: the baseline the model has to beat.
import { mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { Snapshot } from '@figcit/engine';
import { z } from 'zod';
import type { Env } from '../../../common/config/env.js';
import { AiClient, AiUnavailable } from '../ai.client.js';
import { breakDownTask, parseNeed, suggestDrivers, type JsonTask } from '../ai.tasks.js';
import { scrub } from '../text.js';
import {
  anyBanned,
  breakDownWithinCap,
  failedBars,
  pct,
  scoreBreakDown,
  scoreDrivers,
  scoreParseNeed,
  summarise,
  type CaseResult,
  type Outcome,
  type Summary,
} from './score.js';
import { loadSet, SETS, type EvalTask } from './sets.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    rules: { type: 'boolean', default: false },
    limit: { type: 'string' },
    out: { type: 'string', default: 'var/evals' },
    strict: { type: 'boolean', default: false },
  },
});

const env = {
  AI_BASE_URL: process.env['AI_BASE_URL'] || undefined,
  AI_TOKEN: process.env['AI_TOKEN'] || undefined,
  AI_MODEL: process.env['AI_MODEL'] || 'ministral-3-3b-instruct-q4_k_m',
} as Env;
/** A slow CPU still gets an answer to score; speed is judged against the task's own timeout. */
const EVAL_TIMEOUT_MS = Number(process.env['EVAL_TIMEOUT_MS'] ?? 120_000);

const snapshot = JSON.parse(
  readFileSync(
    new URL('../../../../../../packages/engine/fixtures/snapshot.json', import.meta.url),
    'utf8',
  ),
) as Snapshot;

interface Plan<C, I, O> {
  readonly task: JsonTask<I, O>;
  readonly input: (c: C) => I;
  readonly score: (out: O, c: C) => boolean;
  /** The hard rule, judged on whatever the model returned, even when it then failed a check. */
  readonly rule?: (raw: unknown, c: C) => boolean;
}

type Case<T extends EvalTask> = ReturnType<typeof loadSet<T>>['cases'][number];
type AnyPlan = Plan<{ id: string }, unknown, unknown>;
/** Typed per task, then widened so the runner can treat every task alike. */
const plan = <C, I, O>(p: Plan<C, I, O>): AnyPlan => p as unknown as AnyPlan;

const PLANS: Record<EvalTask, AnyPlan> = {
  parseNeed: plan({
    task: parseNeed,
    input: (c: Case<'parseNeed'>) => ({ text: c.text, snapshot }),
    score: scoreParseNeed,
  }),
  suggestDrivers: plan({
    task: suggestDrivers,
    input: (c: Case<'suggestDrivers'>) => ({ title: c.title, kind: c.kind }),
    score: scoreDrivers,
  }),
  breakDownTask: plan({
    task: breakDownTask,
    input: (c: Case<'breakDownTask'>) => ({
      title: c.title,
      kind: c.kind,
      stepCap: c.stepCap,
      strained: c.strained,
    }),
    score: scoreBreakDown,
    rule: (raw, c) => {
      const steps = (raw as { steps?: unknown } | null)?.steps;
      return Array.isArray(steps) ? breakDownWithinCap(steps, c) : true;
    },
  }),
};

function runRules(p: AnyPlan, c: { id: string }): CaseResult {
  const out = p.task.fallback(p.input(c));
  return {
    id: c.id,
    outcome: 'rules',
    correct: p.score(out, c),
    withinRule: p.rule?.(out, c) ?? true,
    banned: anyBanned(out),
    latencyMs: null,
    withinTimeout: null,
    outputTokens: null,
    output: out,
  };
}

const json = (content: string): unknown => {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
};

/** One model call, as AiService makes it: the answer (cleaned when valid) and how it went. */
async function callModel(
  p: AnyPlan,
  input: unknown,
): Promise<{ outcome: Outcome; raw: unknown; outputTokens: number | null }> {
  const { task } = p;
  const schema = task.schema(input);
  try {
    const res = await new AiClient(env).chat({
      system: task.system(input),
      user: scrub(task.text(input), task.maxChars),
      schema: { name: task.name, schema: z.toJSONSchema(schema) },
      temperature: task.temperature,
      maxTokens: task.maxTokens,
      timeoutMs: Math.max(task.timeoutMs, EVAL_TIMEOUT_MS),
    });
    const parsed = schema.safeParse(json(res.content));
    if (!parsed.success)
      return { outcome: 'invalid', raw: json(res.content), outputTokens: res.outputTokens };
    const raw = task.clean?.(parsed.data, input) ?? parsed.data;
    const outcome = task.check(raw, input) ? 'ok' : 'invalid';
    return { outcome, raw, outputTokens: res.outputTokens };
  } catch (error) {
    const timeout = error instanceof AiUnavailable && error.reason === 'timeout';
    return { outcome: timeout ? 'timeout' : 'error', raw: null, outputTokens: null };
  }
}

async function runCase(p: AnyPlan, c: { id: string }): Promise<CaseResult> {
  if (values.rules) return runRules(p, c);
  const started = performance.now();
  const { outcome, raw, outputTokens } = await callModel(p, p.input(c));
  const latencyMs = Math.round(performance.now() - started);
  return {
    id: c.id,
    outcome,
    correct: outcome === 'ok' && p.score(raw, c),
    withinRule: raw === null ? true : (p.rule?.(raw, c) ?? true),
    banned: anyBanned(raw),
    latencyMs,
    withinTimeout: outcome !== 'error' && latencyMs <= p.task.timeoutMs,
    outputTokens,
    output: raw,
  };
}

interface Report {
  readonly task: EvalTask;
  readonly model: string;
  readonly promptVersion: string;
  readonly set: { version: number; status: string };
  readonly startedAt: string;
  readonly summary: Summary;
  readonly failedBars: string[];
  readonly results: CaseResult[];
}

const slug = (s: string): string => s.replace(/[^a-zA-Z0-9.-]+/g, '_');
const ms = (n: number | null): string => (n === null ? '—' : `${String(n)} ms`);
const delta = (now: number, before: number): string => {
  const d = (now - before) * 100;
  return d === 0 ? '' : ` (${d > 0 ? '+' : ''}${d.toFixed(1)})`;
};

function previous(dir: string, prefix: string, current: string): Report | null {
  const files = readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json') && f !== current)
    .sort();
  const last = files.at(-1);
  return last ? (JSON.parse(readFileSync(join(dir, last), 'utf8')) as Report) : null;
}

function markdown(r: Report, before: Report | null): string {
  const s = r.summary;
  const b = before?.summary;
  const lines = [
    `### ${r.task} · ${r.model} · ${r.promptVersion}`,
    '',
    `Set v${String(r.set.version)} (${r.set.status}), ${String(s.cases)} cases, ${r.startedAt}.` +
      (before ? ` Compared with ${before.startedAt}.` : ''),
    '',
    '| Measure | Result |',
    '| --- | --- |',
    `| Accuracy | ${pct(s.accuracy)}${b ? delta(s.accuracy, b.accuracy) : ''} |`,
    `| Within the hard rule | ${pct(s.withinRule)}${b ? delta(s.withinRule, b.withinRule) : ''} |`,
    `| Banned-phrase hits | ${String(s.bannedHits)} |`,
    `| Fallback rate | ${pct(s.fallbackRate)}${b ? delta(s.fallbackRate, b.fallbackRate) : ''} |`,
    `| Within the task timeout | ${s.withinTimeout === null ? '—' : pct(s.withinTimeout)} |`,
    `| Latency p50 / p95 | ${ms(s.latencyP50)} / ${ms(s.latencyP95)} |`,
    `| Output tokens per second | ${s.tokensPerSecond === null ? '—' : s.tokensPerSecond.toFixed(1)} |`,
    '',
    r.failedBars.length
      ? `**Misses the pass bar:** ${r.failedBars.join('; ')}.`
      : 'Meets the pass bars.',
  ];
  if (before) {
    const was = new Map(before.results.map((x) => [x.id, x.correct]));
    const worse = r.results.filter((x) => was.get(x.id) === true && !x.correct).map((x) => x.id);
    const better = r.results.filter((x) => was.get(x.id) === false && x.correct).map((x) => x.id);
    if (worse.length) lines.push('', `Now wrong: ${worse.join(', ')}.`);
    if (better.length) lines.push('', `Now right: ${better.join(', ')}.`);
  }
  const misses = r.results.filter((x) => !x.correct).slice(0, 15);
  if (misses.length) {
    lines.push('', '<details><summary>First misses</summary>', '');
    for (const m of misses)
      lines.push(`- \`${m.id}\` ${m.outcome}: \`${JSON.stringify(m.output)}\``);
    lines.push('', '</details>');
  }
  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const which = positionals[0] ?? '';
  const tasks = which === 'all' ? (Object.keys(SETS) as EvalTask[]) : [which as EvalTask];
  if (!tasks.every((t) => t in SETS)) {
    console.error(`Usage: pnpm eval <${Object.keys(SETS).join('|')}|all> [--rules] [--limit N]`);
    process.exit(2);
  }
  if (!values.rules && !env.AI_BASE_URL) {
    console.error('Set AI_BASE_URL to a model server, or pass --rules for the rule baseline.');
    process.exit(2);
  }
  const dir = resolve(values.out);
  mkdirSync(dir, { recursive: true });
  const model = values.rules ? 'rules' : env.AI_MODEL;
  let failed = false;
  for (const name of tasks) {
    const set = loadSet(name);
    const cases = set.cases.slice(0, values.limit ? Number(values.limit) : undefined);
    const taskPlan = PLANS[name];
    const results: CaseResult[] = [];
    for (const c of cases) {
      const result = await runCase(taskPlan, c);
      results.push(result);
      process.stderr.write(`${name} ${c.id} ${result.outcome} ${result.correct ? '✓' : '✗'}\n`);
    }
    const startedAt = new Date().toISOString();
    const summary = summarise(results);
    const report: Report = {
      task: name,
      model,
      promptVersion: taskPlan.task.promptVersion,
      set: { version: set.version, status: set.status },
      startedAt,
      summary,
      failedBars: failedBars(name, summary),
      results,
    };
    const prefix = `${name}--${slug(model)}--`;
    const file = `${prefix}${startedAt.replace(/[:.]/g, '-')}.json`;
    const before = previous(dir, prefix, file);
    writeFileSync(join(dir, file), `${JSON.stringify(report, null, 2)}\n`);
    const md = markdown(report, before);
    writeFileSync(join(dir, file.replace(/\.json$/, '.md')), md);
    process.stdout.write(`${md}\n`);
    if (process.env['GITHUB_STEP_SUMMARY'])
      appendFileSync(process.env['GITHUB_STEP_SUMMARY'], `${md}\n`);
    failed ||= report.failedBars.length > 0;
  }
  if (failed && values.strict) process.exit(1);
}

await main();
