import { describe, expect, it } from 'vitest';
import { labelProbabilities } from './ai.client.js';

describe('decision scoring', () => {
  it('renormalises the label probabilities and ignores other tokens', () => {
    const p = labelProbabilities(
      [
        { token: 'B', logprob: Math.log(0.6) },
        { token: '**', logprob: Math.log(0.3) },
        { token: ' A', logprob: Math.log(0.1) },
      ],
      ['A', 'B', 'C'],
    );
    expect(p['A']).toBeCloseTo(0.1 / 0.7);
    expect(p['B']).toBeCloseTo(0.6 / 0.7);
    expect(p['C']).toBe(0);
  });

  it('gives every label 0 when none of them appear', () => {
    expect(labelProbabilities([{ token: 'Hello', logprob: 0 }], ['A', 'B'])).toEqual({
      A: 0,
      B: 0,
    });
  });
});
