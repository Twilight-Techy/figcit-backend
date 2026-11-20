// Rate limits keep bots off; they never get in the way of ordinary people (docs/GUEST_SPACE.md,
// "Abuse limits"). Signed-in requests are counted per user, so one shared address (a lecture hall,
// a school, a carrier) cannot throttle them; anonymous requests are counted per address, generously.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { bootApi, type Api } from './helpers.js';
import { ADULT, MANY, NATIVE } from './guest-helpers.js';

/** The real defaults: the settings are not set at all. */
const DEFAULTS = {
  RATE_LIMIT_ENABLED: 'true',
  RATE_LIMIT_USER_PER_MINUTE: undefined,
  RATE_LIMIT_ADDRESS_PER_MINUTE: undefined,
  RATE_LIMIT_AUTH_REQUEST_PER_MINUTE: undefined,
  RATE_LIMIT_AUTH_ATTEMPT_PER_MINUTE: undefined,
  RATE_LIMIT_BROWSE_PER_MINUTE: undefined,
  TRUST_PROXY_HOPS: '1',
};
const from = (address: string) => ({ ...NATIVE, 'x-forwarded-for': address });
const SHARED = '198.51.100.20';

/** A guest space from one (shared) address: the quickest way to many signed-in users. */
async function person(api: Api, address = SHARED): Promise<string> {
  const res = await api.req<{ accessToken: string }>('POST', '/auth/guest', {
    body: ADULT,
    headers: from(address),
  });
  if (res.status !== 201) throw new Error(`sign-up failed: ${String(res.status)}`);
  return res.body.accessToken;
}

describe('signed-in people on one shared address are not throttled together', () => {
  it('200 different users, 20 requests each, from one address within a minute: none blocked', async () => {
    const api = await bootApi({ ...MANY, ...DEFAULTS });
    try {
      const tokens: string[] = [];
      for (let i = 0; i < 200; i += 25)
        tokens.push(...(await Promise.all(Array.from({ length: 25 }, () => person(api)))));
      const statuses: number[] = [];
      // 4000 requests from ONE address: the old limit of 300 a minute would have stopped it at 300.
      for (let round = 0; round < 20; round += 1) {
        const batch = await Promise.all(
          tokens.map((token) =>
            api.req('GET', '/me', { token, headers: { 'x-forwarded-for': SHARED } }),
          ),
        );
        statuses.push(...batch.map((r) => r.status));
      }
      expect(statuses).toHaveLength(4000);
      expect(statuses.filter((s) => s === 429)).toHaveLength(0);
    } finally {
      await api.close();
    }
  }, 180_000);

  it('a single user hammering still hits their own limit: 429, Retry-After, a calm sentence', async () => {
    const api = await bootApi({ ...MANY, ...DEFAULTS, RATE_LIMIT_USER_PER_MINUTE: '40' });
    try {
      const mine = await person(api);
      const bystander = await person(api);
      const answers: {
        status: number;
        body: { code?: string; detail?: string };
        headers: Record<string, unknown>;
      }[] = [];
      for (let i = 0; i < 60; i += 1)
        answers.push(
          await api.req('GET', '/me', { token: mine, headers: { 'x-forwarded-for': SHARED } }),
        );
      const limited = answers.filter((a) => a.status === 429);
      expect(limited.length).toBeGreaterThan(0);
      expect(answers.slice(0, 20).every((a) => a.status === 200)).toBe(true);
      expect(limited[0]?.body).toMatchObject({
        code: 'rate_limited',
        detail: 'Please wait a few minutes and try again.',
      });
      expect(Number(limited[0]?.headers['retry-after'])).toBeGreaterThan(0);
      // Someone else on the same address is not affected by it.
      const other = await api.req('GET', '/me', {
        token: bystander,
        headers: { 'x-forwarded-for': SHARED },
      });
      expect(other.status).toBe(200);
    } finally {
      await api.close();
    }
  }, 120_000);
});

describe('anonymous requests are counted per address, generously, and cannot pretend to be someone', () => {
  it('3000 a minute by default, a different address has its own count', async () => {
    const api = await bootApi({ ...MANY, ...DEFAULTS, RATE_LIMIT_ADDRESS_PER_MINUTE: '60' });
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 70; i += 1)
        statuses.push(
          (await api.req('GET', '/auth/methods', { headers: from('198.51.100.30') })).status,
        );
      expect(statuses.slice(0, 60).every((s) => s === 200)).toBe(true);
      expect(statuses.slice(60).every((s) => s === 429)).toBe(true);
      expect(
        (await api.req('GET', '/auth/methods', { headers: from('198.51.100.31') })).status,
      ).toBe(200);
    } finally {
      await api.close();
    }
  });

  it('a made-up or expired token does not get a count of its own', async () => {
    const api = await bootApi({ ...MANY, ...DEFAULTS, RATE_LIMIT_ADDRESS_PER_MINUTE: '30' });
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 40; i += 1)
        statuses.push(
          (
            await api.req('GET', '/auth/methods', {
              token: `forged.${randomUUID()}.token`,
              headers: from('198.51.100.40'),
            })
          ).status,
        );
      expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    } finally {
      await api.close();
    }
  });

  it('the default for an address is 3000 a minute', async () => {
    const { loadEnv } = await import('../src/common/config/env.js');
    const env = loadEnv({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      JWT_PRIVATE_KEY: 'x',
      JWT_PUBLIC_KEY: 'y',
      MASTER_KEYS: '1:abc',
    });
    expect(env).toMatchObject({
      RATE_LIMIT_USER_PER_MINUTE: 300,
      RATE_LIMIT_ADDRESS_PER_MINUTE: 3000,
      RATE_LIMIT_AUTH_REQUEST_PER_MINUTE: 60,
      RATE_LIMIT_AUTH_ATTEMPT_PER_MINUTE: 120,
      RATE_LIMIT_BROWSE_PER_MINUTE: 300,
    });
  });
});

describe('the sign-in routes: a crowd on one address gets through, a flood does not', () => {
  const asks = (
    api: Api,
    r: { path: string; body: (i: number) => object; n: number; address: string },
  ) =>
    Promise.all(
      Array.from({ length: r.n }, (_, i) =>
        api.req<{ code?: string }>('POST', r.path, {
          body: r.body(i),
          headers: from(r.address),
        }),
      ),
    );

  it('50 people asking for a sign-in link from one address in a minute are all answered (was 10)', async () => {
    const api = await bootApi({ ...MANY, ...DEFAULTS });
    try {
      const res = await asks(api, {
        path: '/auth/magic-link',
        body: () => ({ email: `crowd-${randomUUID()}@example.test` }),
        n: 50,
        address: '198.51.100.50',
      });
      expect(res.every((r) => r.status === 202)).toBe(true);
    } finally {
      await api.close();
    }
  });

  it('a flood of sign-in links from one address is still stopped, calmly', async () => {
    const api = await bootApi({ ...MANY, ...DEFAULTS, RATE_LIMIT_AUTH_REQUEST_PER_MINUTE: '20' });
    try {
      const res = await asks(api, {
        path: '/auth/magic-link',
        body: () => ({ email: `flood-${randomUUID()}@example.test` }),
        n: 30,
        address: '198.51.100.51',
      });
      const limited = res.filter((r) => r.status === 429);
      expect(limited.length).toBeGreaterThanOrEqual(10);
      expect(limited[0]?.body.code).toBe('rate_limited');
      expect(Number(limited[0]?.headers['retry-after'])).toBeGreaterThan(0);
    } finally {
      await api.close();
    }
  });

  it('the Browse token: 100 people from one address are all given one (was 10)', async () => {
    const api = await bootApi({ ...MANY, ...DEFAULTS });
    try {
      const res = await asks(api, {
        path: '/auth/browse',
        body: () => ({}),
        n: 100,
        address: '198.51.100.52',
      });
      expect(res.every((r) => r.status === 201)).toBe(true);
    } finally {
      await api.close();
    }
  });

  it('password sign-in and sign-up: 60 from one address in a minute are answered, not blocked', async () => {
    const api = await bootApi({ ...MANY, ...DEFAULTS });
    try {
      const wrong = await asks(api, {
        path: '/auth/password/sign-in',
        body: () => ({ email: `nobody-${randomUUID()}@example.test`, password: 'whatever it is' }),
        n: 60,
        address: '198.51.100.53',
      });
      expect(wrong.every((r) => r.status === 401)).toBe(true);
    } finally {
      await api.close();
    }
  });

  it('the code to verify a link: 100 tries from one address are answered, not blocked', async () => {
    const api = await bootApi({ ...MANY, ...DEFAULTS });
    try {
      const res = await asks(api, {
        path: '/auth/magic-link/verify',
        body: (i) => ({ email: `v${String(i)}-${randomUUID()}@example.test`, code: '123456' }),
        n: 100,
        address: '198.51.100.54',
      });
      expect(res.every((r) => r.status === 401)).toBe(true);
    } finally {
      await api.close();
    }
  });
});

describe('what protects accounts is unchanged', () => {
  it('5 wrong passwords lock the account for 15 minutes, with Retry-After and a human sentence', async () => {
    const api = await bootApi({ ...MANY, ...DEFAULTS });
    try {
      const email = `lock-${randomUUID()}@example.test`;
      await api.req('POST', '/auth/password/sign-up', {
        body: { email, password: 'a long enough pass phrase' },
        headers: from('198.51.100.60'),
      });
      const codes: number[] = [];
      let last: { body: { detail?: string }; headers: Record<string, unknown> } | undefined;
      for (let i = 0; i < 7; i += 1) {
        const r = await api.req<{ detail?: string }>('POST', '/auth/password/sign-in', {
          body: { email, password: `wrong password ${String(i)}` },
          headers: from('198.51.100.60'),
        });
        codes.push(r.status);
        last = r;
      }
      expect(codes.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
      expect(codes.slice(5)).toEqual([429, 429]);
      expect(last?.body.detail).toMatch(/15 minutes/);
      const wait = Number(last?.headers['retry-after']);
      expect(wait).toBeGreaterThan(60);
      expect(wait).toBeLessThanOrEqual(900);
    } finally {
      await api.close();
    }
  });

  it('5 sign-in links to one email in 15 minutes, then 429 with Retry-After', async () => {
    const api = await bootApi({ ...MANY, ...DEFAULTS });
    try {
      const email = `five-${randomUUID()}@example.test`;
      const statuses: number[] = [];
      let last: { headers: Record<string, unknown>; body: { detail?: string } } | undefined;
      for (let i = 0; i < 6; i += 1) {
        const r = await api.req<{ detail?: string }>('POST', '/auth/magic-link', {
          body: { email },
          headers: from('198.51.100.61'),
        });
        statuses.push(r.status);
        last = r;
      }
      expect(statuses).toEqual([202, 202, 202, 202, 202, 429]);
      expect(last?.body.detail).toBe('Please wait a few minutes and try again.');
      expect(Number(last?.headers['retry-after'])).toBeGreaterThan(0);
    } finally {
      await api.close();
    }
  });

  it('5 wrong codes on one link, then "request a new link", with Retry-After', async () => {
    const api = await bootApi({ ...MANY, ...DEFAULTS });
    try {
      const email = `code-${randomUUID()}@example.test`;
      await api.req('POST', '/auth/magic-link', {
        body: { email },
        headers: from('198.51.100.62'),
      });
      const statuses: number[] = [];
      let last: { headers: Record<string, unknown> } | undefined;
      for (let i = 0; i < 7; i += 1) {
        const r = await api.req('POST', '/auth/magic-link/verify', {
          body: { email, code: '000000' },
          headers: from('198.51.100.62'),
        });
        statuses.push(r.status);
        last = r;
      }
      expect(statuses).toEqual([401, 401, 401, 401, 401, 429, 429]);
      expect(Number(last?.headers['retry-after'])).toBeGreaterThan(0);
    } finally {
      await api.close();
    }
  });
});
