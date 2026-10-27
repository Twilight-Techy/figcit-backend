import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const required = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_PRIVATE_KEY: 'x',
  JWT_PUBLIC_KEY: 'y',
  MASTER_KEYS: '1:abc',
};

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv(required);
    expect(env.PORT).toBe(3001);
    expect(env.STORAGE_DRIVER).toBe('local');
    expect(env.ASSIST_DAILY_ALLOWANCE).toBe(10);
  });

  it('rejects an invalid port', () => {
    expect(() => loadEnv({ ...required, PORT: 'abc' })).toThrow('Invalid environment');
  });

  it('requires the database and keys', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });
});
