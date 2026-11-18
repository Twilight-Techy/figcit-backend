import { describe, expect, it } from 'vitest';
import { graphemes } from '../../common/text/graphemes.js';
import { firstName } from './google.service.js';

describe('firstName (SU-6)', () => {
  it("takes Google's first name, trimmed", () => {
    expect(firstName('  Torera ')).toBe('Torera');
  });
  it('keeps to 30 characters as the user sees them', () => {
    expect(graphemes(firstName('é'.repeat(40)) ?? '')).toHaveLength(30);
  });
  it('keeps to the 120 code points the column holds, by whole characters (B-08)', () => {
    const family = '👨‍👩‍👧‍👦'; // one character, seven code points
    const name = firstName(family.repeat(30)) ?? '';
    expect(Array.from(name).length).toBeLessThanOrEqual(120);
    expect(graphemes(name).every((g) => g === family)).toBe(true);
    expect(graphemes(name)).toHaveLength(17);
  });
  it('is nothing when Google gives nothing', () => {
    expect(firstName(undefined)).toBeNull();
    expect(firstName('   ')).toBeNull();
  });
});
