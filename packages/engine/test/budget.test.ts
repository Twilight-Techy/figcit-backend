// Budgets (ENGINEERING_RULES §1.1): engine p95 < 2 ms, safety screen p95 < 1 ms on a 1 KB text.
import { describe, expect, it } from 'vitest';
import { buildSafetyScreen, evaluate, type EngineInput } from '../src/index.js';
import { free, grid, snapshot } from './helpers.js';

const text =
  'I have a presentation later and everything feels like a lot, I cannot get started on any of it today. '.repeat(
    10,
  );
const input: EngineInput = {
  state: grid(3, 2),
  emotions: [
    { code: 'anxious', intensity: 7 },
    { code: 'restless', intensity: 8 },
  ],
  sensations: [{ code: 'heaviness' }],
  context: { environment: 'work', sensitivity: ['sound', 'noise', 'lights', 'crowd'] },
  demand: { timeline: 'T1', traits: ['with_others', 'multi_step'] },
  freeText: [text],
};

function p95(run: () => void, samples = 2000): number {
  for (let i = 0; i < 200; i += 1) run(); // warm up
  const times: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(samples * 0.95)] ?? Infinity;
}

/**
 * The best p95 of up to three rounds. Other packages' tests run beside this one in CI, and their
 * noise only ever adds time: an engine that is really slow fails every round, a busy runner not.
 */
function bestP95(run: () => void, budget: number): number {
  let best = Infinity;
  for (let round = 0; round < 3 && best >= budget; round += 1) best = Math.min(best, p95(run));
  return best;
}

describe('budgets', () => {
  it('evaluate p95 < 2 ms', () => {
    const ms = bestP95(() => evaluate(input, snapshot, free), 2);
    console.info(`evaluate p95 ${ms.toFixed(3)} ms`);
    expect(ms).toBeLessThan(2);
  });
  it('safety screen p95 < 1 ms on 1 KB', () => {
    const screen = buildSafetyScreen(snapshot.safety.phrases, snapshot.safety.exclusions);
    const ms = bestP95(() => screen.check([text]), 1);
    console.info(`safety p95 ${ms.toFixed(3)} ms`);
    expect(ms).toBeLessThan(1);
  });
});
