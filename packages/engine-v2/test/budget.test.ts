// Budgets (ENGINEERING_RULES §1.1): one check-in through the engine, p50 < 0.5 ms, p95 < 2 ms,
// p99 < 5 ms, as for v1. Measured over the all-flows set, so every kind of card is in the sample.
import { describe, expect, it } from 'vitest';
import { flowInputs, run } from '../src/index.js';
import { ruleset } from './support/engine.js';

const inputs = flowInputs(ruleset, { sample: 500 }).inputs;

function percentiles(): { p50: number; p95: number; p99: number } {
  for (const input of inputs.slice(0, 500)) run(ruleset, input); // warm up
  const times = inputs.map((input) => {
    const start = performance.now();
    run(ruleset, input);
    return performance.now() - start;
  });
  times.sort((a, b) => a - b);
  const at = (q: number): number => times[Math.floor(times.length * q)] ?? Infinity;
  return { p50: at(0.5), p95: at(0.95), p99: at(0.99) };
}

describe('budgets', () => {
  it('run: p50 < 0.5 ms, p95 < 2 ms, p99 < 5 ms', () => {
    const { p50, p95, p99 } = percentiles();
    console.info(
      `engine-v2 run p50 ${p50.toFixed(3)} p95 ${p95.toFixed(3)} p99 ${p99.toFixed(3)} ms`,
    );
    expect(p50).toBeLessThan(0.5);
    expect(p95).toBeLessThan(2);
    expect(p99).toBeLessThan(5);
  }, 120_000);
});
