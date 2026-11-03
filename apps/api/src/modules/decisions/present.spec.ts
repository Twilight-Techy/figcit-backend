import { describe, expect, it } from 'vitest';
import { lowerFirst } from './present.js';

describe('a label inside a sentence', () => {
  it('starts lower case, but keeps an acronym and the word I as written', () => {
    expect(lowerFirst('Start the reset')).toBe('start the reset');
    expect(lowerFirst('AI body double')).toBe('AI body double');
    expect(lowerFirst("I'll try the task anyway")).toBe("I'll try the task anyway");
    expect(lowerFirst('Ignore it')).toBe('ignore it');
    expect(lowerFirst('')).toBe('');
  });
});
