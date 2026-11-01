// The card's "because" sentence reads naturally at every intensity (backend TODO T-18: it said
// "you're feeling very high low").
import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/index.js';
import { free, grid, snapshot } from './helpers.js';

const why = (code: string, intensity: number): string =>
  evaluate({ state: grid(3, 3), emotions: [{ code, intensity }] }, snapshot, free).rationale.text;

describe('the rationale sentence', () => {
  it('puts an intensity word before the feeling that reads as English', () => {
    expect(why('sad', 10)).toContain("you're feeling very strong sadness");
    expect(why('sad', 7)).toContain("you're feeling strong sadness");
    expect(why('anxious', 5)).toContain("you're feeling moderate anxiety");
    expect(why('frustrated', 2)).toContain("you're feeling mild frustration");
  });

  it('never shows a band name inside the sentence', () => {
    for (const code of ['sad', 'anxious', 'frustrated', 'overwhelmed'])
      for (const n of [1, 5, 7, 9])
        expect(why(code, n)).not.toMatch(/very high|feeling high|feeling very_high/);
  });
});
