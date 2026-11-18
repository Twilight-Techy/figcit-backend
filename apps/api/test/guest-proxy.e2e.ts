// The address the limits see is the one our own proxy added, never a value the client sent
// (TRUST_PROXY_HOPS, docs/GUEST_SPACE.md "Deploy").
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/db/prisma.service.js';
import { bootApi } from './helpers.js';
import { ADULT, MANY, NATIVE } from './guest-helpers.js';

/** A request as a proxy forwards it: the client's own (spoofable) value, then the address the proxy saw. */
const via = (spoof: string, seen: string) => ({
  ...NATIVE,
  'x-forwarded-for': `${spoof}, ${seen}`,
});

describe('TRUST_PROXY_HOPS', () => {
  it('guest sign-ups from one address are limited however the client spoofs X-Forwarded-For', async () => {
    const strict = await bootApi({
      ...MANY,
      GUEST_SIGNUPS_PER_HOUR: '2',
      GUEST_SIGNUPS_PER_DAY: '2',
      TRUST_PROXY_HOPS: '1',
    });
    try {
      await strict.app.get(PrismaService).guestSignup.deleteMany();
      const statuses: number[] = [];
      for (let i = 0; i < 6; i += 1)
        statuses.push(
          (
            await strict.req('POST', '/auth/guest', {
              body: ADULT,
              headers: via(`203.0.113.${String(i + 1)}`, '198.51.100.7'),
            })
          ).status,
        );
      expect(statuses).toEqual([201, 201, 429, 429, 429, 429]);
      // Another address, seen by the proxy, is counted on its own.
      const other = await strict.req('POST', '/auth/guest', {
        body: ADULT,
        headers: via('203.0.113.1', '198.51.100.8'),
      });
      expect(other.status).toBe(201);
    } finally {
      await strict.close();
    }
  });

  it('with 0 hops the header is ignored: the address is the connection', async () => {
    const strict = await bootApi({
      ...MANY,
      GUEST_SIGNUPS_PER_HOUR: '2',
      GUEST_SIGNUPS_PER_DAY: '2',
      TRUST_PROXY_HOPS: '0',
    });
    try {
      await strict.app.get(PrismaService).guestSignup.deleteMany();
      const statuses: number[] = [];
      for (let i = 0; i < 4; i += 1)
        statuses.push(
          (
            await strict.req('POST', '/auth/guest', {
              body: ADULT,
              headers: via(`203.0.113.${String(i + 1)}`, `198.51.100.${String(i + 1)}`),
            })
          ).status,
        );
      expect(statuses).toEqual([201, 201, 429, 429]);
    } finally {
      await strict.close();
    }
  });

  it('the route limits (sign-in link) see the same address: a spoofed header does not reset them', async () => {
    const limited = await bootApi({ ...MANY, RATE_LIMIT_ENABLED: 'true' });
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 12; i += 1)
        statuses.push(
          (
            await limited.req('POST', '/auth/magic-link', {
              body: { email: `spoof-${randomUUID()}@example.test` },
              headers: via(`203.0.113.${String(i + 1)}`, '198.51.100.9'),
            })
          ).status,
        );
      expect(statuses.slice(0, 10).every((s) => s === 202)).toBe(true);
      expect(statuses.slice(10)).toEqual([429, 429]);
    } finally {
      await limited.close();
    }
  });
});
