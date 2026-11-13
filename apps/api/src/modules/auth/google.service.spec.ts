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
  it('is nothing when Google gives nothing', () => {
    expect(firstName(undefined)).toBeNull();
    expect(firstName('   ')).toBeNull();
  });
});
