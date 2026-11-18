// The body map's answers kept with a decision: Full only, for picked signs, in real regions.
import { describe, expect, it } from 'vitest';
import { bodyRegionsOf } from './decisions-v5.service.js';
import type { CheckInV5Body } from './v5.schemas.js';

const base: CheckInV5Body = {
  mode: 'full',
  state: { kind: 'grid', energy: 2, mood: 2 },
  emotions: [],
  body: ['aches_or_pain'],
  bodyRegions: [
    { sign: 'aches_or_pain', regions: ['back', 'shoulders', 'nowhere', 'back'] },
    { sign: 'tension', regions: ['neck'] },
  ],
};

describe('body map answers', () => {
  it('keeps only picked signs and real regions, once each', () => {
    expect(bodyRegionsOf(base)).toEqual([
      { sign: 'aches_or_pain', regions: ['back', 'shoulders'] },
    ]);
  });

  it('keeps nothing from a Quick check-in', () => {
    expect(bodyRegionsOf({ ...base, mode: 'quick' })).toEqual([]);
  });
});
