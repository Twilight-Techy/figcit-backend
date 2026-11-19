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

describe('the guest space limits are generous by default (docs/GUEST_SPACE.md)', () => {
  const env = loadEnv({ ...required });

  it('a flood guard per address, not a limit a class of students or a carrier would meet', () => {
    expect(env.GUEST_SIGNUPS_PER_HOUR).toBe(600);
    expect(env.GUEST_SIGNUPS_PER_DAY).toBe(3000);
  });

  it('has no daily cap on the whole service (0 is off), and an alert instead', () => {
    expect(env.GUEST_DAILY_CAP).toBe(0);
    expect(env.GUEST_ALERT_PER_HOUR).toBeGreaterThan(0);
  });

  it('allows 5 confirmation mails a day to one address, the bot challenge is off, and one proxy hop', () => {
    expect(env.GUEST_LINK_MAILS_PER_ADDRESS).toBe(5);
    expect(env.GUEST_BOT_CHALLENGE).toBe(false);
    expect(env.TRUST_PROXY_HOPS).toBe(1);
  });

  it('every one can be set', () => {
    const set = loadEnv({
      ...required,
      GUEST_SIGNUPS_PER_HOUR: '50',
      GUEST_SIGNUPS_PER_DAY: '80',
      GUEST_DAILY_CAP: '5000',
      GUEST_ALERT_PER_HOUR: '0',
      GUEST_LINK_MAILS_PER_ADDRESS: '9',
    });
    expect(set).toMatchObject({
      GUEST_SIGNUPS_PER_HOUR: 50,
      GUEST_SIGNUPS_PER_DAY: 80,
      GUEST_DAILY_CAP: 5000,
      GUEST_ALERT_PER_HOUR: 0,
      GUEST_LINK_MAILS_PER_ADDRESS: 9,
    });
  });
});
