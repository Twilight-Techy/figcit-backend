import { describe, expect, it } from 'vitest';
import { graphemes } from './graphemes.js';

describe('graphemes', () => {
  it('counts what a person sees, in any script', () => {
    expect(graphemes('Ada')).toHaveLength(3);
    expect(graphemes('👋🏽')).toHaveLength(1);
    expect(graphemes('é')).toHaveLength(1);
  });
});
