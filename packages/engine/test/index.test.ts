import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION, assertNever } from '../src/index.js';

describe('@figcit/engine', () => {
  it('exposes its version', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('assertNever throws for an unhandled case', () => {
    expect(() => assertNever('X' as never)).toThrow('Unhandled case: X');
  });
});
