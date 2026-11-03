// `pnpm eval:load [--levels 1,2,4,8,16] [--seconds 120]`: how many AI calls one model server
// handles (issue #110). At each concurrency level, that many callers send parseNeed,
// suggestDrivers and breakDownTask calls back to back for a fixed time. They use the eval sets'
// inputs. Each call is judged against its task's production timeout: one that runs over counts
// as a fallback, as the user would see it. Calls are waited out rather than cut off, because a
// proxy in front of the server (Modal's, for one) may not pass on the disconnect, and then the
// server keeps working on calls nobody waits for. That makes the result a lower bound: llama-server
// cancels a call when its caller disconnects directly.
// Reports throughput, p50/p95 and the share answered in time.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import type { Snapshot } from '@figcit/engine';
import { z } from 'zod';
import type { Env } from '../../../common/config/env.js';
import { AiClient, AiUnavailable } from '../ai.client.js';
import {
  breakDownTask,
  parseNeed,
  suggestDrivers,
  type DecisionTask,
  type JsonTask,
} from '../ai.tasks.js';
import { scrub } from '../text.js';
import { percentile } from './score.js';
import { loadSet } from './sets.js';

const { values } = parseArgs({
  options: {
    levels: { type: 'string', default: '1,2,4,8,16' },
    seconds: { type: 'string', default: '120' },
  },
});
const env = {
  AI_BASE_URL: process.env['AI_BASE_URL'] || undefined,
  AI_TOKEN: process.env['AI_TOKEN'] || undefined,
  AI_MODEL: process.env['AI_MODEL'] || 'ministral-3-3b-instruct-q4_k_m',
} as Env;
if (!env.AI_BASE_URL) {
  console.error('Set AI_BASE_URL to the model server.');
  process.exit(2);
}

const WAIT_MS = 120_000;

const snapshot = JSON.parse(
  readFileSync(
    new URL('../../../../../../packages/engine/fixtures/snapshot.json', import.meta.url),
    'utf8',
  ),
) as Snapshot;

interface Call {
  readonly task: JsonTask<unknown, unknown> | DecisionTask<unknown, unknown>;
  readonly input: unknown;
}
const widen = <I, O>(task: JsonTask<I, O> | DecisionTask<I, O>, input: I): Call => ({
  task: task as unknown as Call['task'],
  input,
});

/** The mix: "in your own words" is the most common call, then task cards and breakdowns. */
const ordered: Call[] = [
  ...loadSet('parseNeed').cases.map((c) => widen(parseNeed, { text: c.text, snapshot })),
  ...loadSet('parseNeed')
    .cases.slice(0, 40)
    .map((c) => widen(parseNeed, { text: c.text, snapshot })),
  ...loadSet('suggestDrivers').cases.map((c) =>
    widen(suggestDrivers, { title: c.title, kind: c.kind }),
  ),
  ...loadSet('breakDownTask').cases.map((c) =>
    widen(breakDownTask, {
      title: c.title,
      kind: c.kind,
      stepCap: c.stepCap,
      strained: c.strained,
    }),
  ),
];

/** Spread the tasks through the run (a fixed stride, so every run sends the same sequence). */
const calls: Call[] = ordered.map((_, i) => ordered[(i * 7919) % ordered.length] as Call);

interface Sample {
  readonly task: string;
  readonly ms: number;
  readonly ok: boolean;
}

async function once({ task, input }: Call): Promise<Sample> {
  const started = performance.now();
  let ok = false;
  if ('labels' in task) {
    try {
      const p = await new AiClient(env).decide({
        system: task.system(input),
        user: scrub(task.text(input), task.maxChars),
        labels: task.labels(input),
        timeoutMs: WAIT_MS,
      });
      ok = task.check(task.decode(p, input), input);
    } catch (error) {
      if (!(error instanceof AiUnavailable)) throw error;
    }
    const ms = Math.round(performance.now() - started);
    return { task: task.name, ms, ok: ok && ms <= task.timeoutMs };
  }
  const schema = task.schema(input);
  try {
    const res = await new AiClient(env).chat({
      system: task.system(input),
      user: scrub(task.text(input), task.maxChars),
      schema: { name: task.name, schema: z.toJSONSchema(schema) },
      temperature: task.temperature,
      maxTokens: task.maxTokens,
      timeoutMs: WAIT_MS,
    });
    const parsed = schema.safeParse(JSON.parse(res.content));
    ok = parsed.success && task.check(task.clean?.(parsed.data, input) ?? parsed.data, input);
  } catch (error) {
    if (!(error instanceof AiUnavailable || error instanceof SyntaxError)) throw error;
  }
  const ms = Math.round(performance.now() - started);
  return { task: task.name, ms, ok: ok && ms <= task.timeoutMs };
}

async function level(callers: number, seconds: number): Promise<Sample[]> {
  const until = Date.now() + seconds * 1000;
  const samples: Sample[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: callers }, async () => {
      while (Date.now() < until) {
        const call = calls[next++ % calls.length];
        if (call) samples.push(await once(call));
      }
    }),
  );
  return samples;
}

const seconds = Number(values.seconds);
console.log(
  `| Callers | Calls/min | p50 | p95 | Answered in time | parseNeed p95 | breakDownTask p95 |`,
);
console.log('| --- | --- | --- | --- | --- | --- | --- |');
for (const callers of values.levels.split(',').map(Number)) {
  const s = await level(callers, seconds);
  const ms = s.map((x) => x.ms);
  const p95 = (task: string): string =>
    `${String(
      percentile(
        s.filter((x) => x.task === task).map((x) => x.ms),
        95,
      ) ?? '—',
    )} ms`;
  console.log(
    `| ${String(callers)} | ${((s.length / seconds) * 60).toFixed(0)} | ${String(percentile(ms, 50))} ms | ${String(percentile(ms, 95))} ms | ${((s.filter((x) => x.ok).length / s.length) * 100).toFixed(1)}% | ${p95('parseNeed')} | ${p95('breakDownTask')} |`,
  );
}
