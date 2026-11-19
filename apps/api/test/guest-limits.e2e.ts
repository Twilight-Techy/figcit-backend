// Guest space limits are a flood guard, never a barrier for ordinary people (docs/GUEST_SPACE.md,
// "Abuse limits"): a lecture hall on one Wi-Fi address, a carrier, an office.
import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/common/db/prisma.service.js';
import { bootApi, type Api } from './helpers.js';
import { ADULT, MANY, NATIVE, start } from './guest-helpers.js';

/** The real defaults: the guest settings are not set at all. */
const DEFAULTS = {
  GUEST_SIGNUPS_PER_HOUR: undefined,
  GUEST_SIGNUPS_PER_DAY: undefined,
  GUEST_DAILY_CAP: undefined,
  GUEST_ALERT_PER_HOUR: undefined,
  GUEST_LINK_MAILS_PER_ADDRESS: undefined,
};

async function inBatches(api: Api, total: number): Promise<number[]> {
  const statuses: number[] = [];
  for (let done = 0; done < total; done += 25) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(25, total - done) }, () => start(api)),
    );
    statuses.push(...batch.map((r) => r.status));
  }
  return statuses;
}

describe('a crowd on one address is never blocked', () => {
  it('300 guest spaces from one address within the hour, with every default, all succeed', async () => {
    const api = await bootApi({ ...MANY, ...DEFAULTS });
    try {
      await api.app.get(PrismaService).guestSignup.deleteMany();
      const statuses = await inBatches(api, 300);
      expect(statuses.every((s) => s === 201)).toBe(true);
    } finally {
      await api.close();
    }
  }, 120_000);

  it('and not by the route limit either: 300 in a minute with the rate limiter on', async () => {
    const api = await bootApi({ ...MANY, ...DEFAULTS, RATE_LIMIT_ENABLED: 'true' });
    try {
      await api.app.get(PrismaService).guestSignup.deleteMany();
      const statuses = await inBatches(api, 300);
      expect(statuses.filter((s) => s !== 201)).toEqual([]);
    } finally {
      await api.close();
    }
  }, 120_000);
});

describe('a real flood still gets 429, calmly, with Retry-After', () => {
  it('above the per-address limit: 429, a human sentence, and how long to wait', async () => {
    const api = await bootApi({
      ...MANY,
      GUEST_SIGNUPS_PER_HOUR: '5',
      GUEST_SIGNUPS_PER_DAY: '50',
    });
    try {
      await api.app.get(PrismaService).guestSignup.deleteMany();
      for (let i = 0; i < 5; i += 1) expect((await start(api)).status).toBe(201);
      const res = await api.req<{ code: string; detail: string }>('POST', '/auth/guest', {
        body: ADULT,
        headers: NATIVE,
      });
      expect(res.status).toBe(429);
      expect(res.body).toMatchObject({
        code: 'rate_limited',
        detail: 'Please wait a few minutes and try again.',
      });
      const wait = Number(res.headers['retry-after']);
      expect(wait).toBeGreaterThan(0);
      expect(wait).toBeLessThanOrEqual(3600);
    } finally {
      await api.close();
    }
  });

  it('the day limit says so too, and waits longer', async () => {
    const api = await bootApi({ ...MANY, GUEST_SIGNUPS_PER_DAY: '3' });
    try {
      await api.app.get(PrismaService).guestSignup.deleteMany();
      for (let i = 0; i < 3; i += 1) expect((await start(api)).status).toBe(201);
      const res = await api.req<{ detail: string }>('POST', '/auth/guest', {
        body: ADULT,
        headers: NATIVE,
      });
      expect(res.status).toBe(429);
      expect(res.body.detail).toBe('Please wait a few minutes and try again.');
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    } finally {
      await api.close();
    }
  });
});

describe('the whole-service daily cap is off unless it is set', () => {
  it('0 never blocks, however many were made; above 0 it still works', async () => {
    const off = await bootApi({ ...MANY, GUEST_DAILY_CAP: '0' });
    try {
      await off.app.get(PrismaService).guestSignup.deleteMany();
      for (let i = 0; i < 4; i += 1) expect((await start(off)).status).toBe(201);
    } finally {
      await off.close();
    }
    const on = await bootApi({ ...MANY, GUEST_DAILY_CAP: '2' });
    try {
      await on.app.get(PrismaService).guestSignup.deleteMany();
      expect((await start(on)).status).toBe(201);
      expect((await start(on)).status).toBe(201);
      const over = await start(on);
      expect(over.status).toBe(503);
    } finally {
      await on.close();
    }
  });

  it('writes a warning, once in a while, when an hour brings more than GUEST_ALERT_PER_HOUR', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    const api = await bootApi({ ...MANY, GUEST_ALERT_PER_HOUR: '3' });
    try {
      await api.app.get(PrismaService).guestSignup.deleteMany();
      for (let i = 0; i < 3; i += 1) await start(api);
      const alerts = (): unknown[][] =>
        warn.mock.calls.filter((c) =>
          JSON.stringify(c).includes('guest spaces made in the last hour'),
        );
      expect(alerts()).toHaveLength(0);
      for (let i = 0; i < 4; i += 1) await start(api);
      // Over the threshold: one warning with the numbers, not one per sign-up.
      expect(alerts()).toHaveLength(1);
      expect(JSON.stringify(alerts()[0])).toMatch(/"lastHour":4/);
      expect(JSON.stringify(alerts()[0])).toMatch(/"threshold":3/);
    } finally {
      warn.mockRestore();
      await api.close();
    }
  });
});
