import { describe, expect, it } from 'vitest';
import { emailInput } from './email.js';

describe('emailInput', () => {
  it('drops spaces around an email and lowercases it before checking it', () => {
    expect(emailInput().parse('  Ana@Example.COM \t')).toBe('ana@example.com');
  });

  it('still refuses what is not an email', () => {
    expect(emailInput().safeParse('ana example.com').success).toBe(false);
    expect(emailInput().safeParse('   ').success).toBe(false);
  });
});
