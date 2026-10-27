import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  decryptField,
  encryptField,
  masterKeyVersionOf,
  newDataKey,
  parseMasterKeys,
  unwrapDataKey,
  wrapDataKey,
} from './envelope.js';

const k1 = randomBytes(32).toString('base64');
const k2 = randomBytes(32).toString('base64');

describe('envelope encryption', () => {
  it('round-trips a field under a wrapped data key', () => {
    const ring = parseMasterKeys(`1:${k1}`);
    const dataKey = newDataKey();
    const wrapped = wrapDataKey(ring, dataKey);
    const blob = encryptField(unwrapDataKey(ring, wrapped), 'user-1', 'I feel overwhelmed 😮‍💨');
    expect(decryptField(dataKey, 'user-1', blob)).toBe('I feel overwhelmed 😮‍💨');
  });

  it('refuses ciphertext moved to another owner', () => {
    const dataKey = newDataKey();
    const blob = encryptField(dataKey, 'user-1', 'secret');
    expect(() => decryptField(dataKey, 'user-2', blob)).toThrow();
  });

  it('wraps with the newest master key and still unwraps old ones', () => {
    const old = parseMasterKeys(`1:${k1}`);
    const rotated = parseMasterKeys(`1:${k1},2:${k2}`);
    const dataKey = newDataKey();
    const wrappedOld = wrapDataKey(old, dataKey);
    expect(masterKeyVersionOf(wrappedOld)).toBe(1);
    expect(unwrapDataKey(rotated, wrappedOld).equals(dataKey)).toBe(true);
    expect(masterKeyVersionOf(wrapDataKey(rotated, dataKey))).toBe(2);
  });

  it('rejects malformed key config', () => {
    expect(() => parseMasterKeys('1:short')).toThrow();
    expect(() => parseMasterKeys('')).toThrow();
  });
});
