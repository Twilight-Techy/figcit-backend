import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, codeAt, newSecret, verifyCode } from './totp.js';

describe('TOTP', () => {
  it('matches the RFC 6238 SHA-1 test vector', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    // T = 59 s → step 1 → 94287082 (8 digits); the 6-digit code is the last six digits.
    expect(codeAt(secret, 1)).toBe('287082');
  });
  it('round-trips base32', () => {
    const bytes = Buffer.from([0, 1, 2, 250, 255]);
    expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true);
  });
  it('accepts the current and adjacent windows only', () => {
    const secret = newSecret();
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    expect(verifyCode(secret, codeAt(secret, step), now)).toBe(step);
    expect(verifyCode(secret, codeAt(secret, step - 1), now)).toBe(step - 1);
    expect(verifyCode(secret, codeAt(secret, step + 5), now)).toBeNull();
  });
});
