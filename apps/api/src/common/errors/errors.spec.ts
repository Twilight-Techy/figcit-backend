import { describe, expect, it } from 'vitest';
import { NotEntitled } from './errors.js';

describe('NotEntitled', () => {
  it('names the plans that have the feature, not the old Plus (B-10)', () => {
    const e = new NotEntitled('The monthly summary');
    expect(e.status).toBe(402);
    expect(e.detail).toBe('The monthly summary is part of Prime and Premium.');
    expect(new NotEntitled('My fit summary', 'Premium').detail).toBe(
      'My fit summary is part of Premium.',
    );
  });
});
