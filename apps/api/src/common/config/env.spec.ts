import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('applies defaults', () => {
    expect(loadEnv({})).toEqual({ NODE_ENV: 'development', PORT: 3001 });
  });

  it('rejects an invalid port', () => {
    expect(() => loadEnv({ PORT: 'abc' })).toThrow('Invalid environment');
  });
});
