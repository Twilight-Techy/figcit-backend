import { describe, expect, it } from 'vitest';
import { summarise } from './survey.service.js';

describe('summarise', () => {
  it('gives the average to one decimal and how many chose each answer', () => {
    expect(summarise([5, 4, 4, 1])).toEqual({ average: 3.5, counts: [1, 0, 0, 2, 1] });
    expect(summarise([2, 3, 3])).toEqual({ average: 2.7, counts: [0, 1, 2, 0, 0] });
  });

  it('has no average with no answers', () => {
    expect(summarise([])).toEqual({ average: null, counts: [0, 0, 0, 0, 0] });
  });
});
