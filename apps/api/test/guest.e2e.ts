// Guest space (docs/GUEST_SPACE.md): a real account with no email, kept for 30 days at most.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/db/prisma.service.js';
import { bootApi, type Api } from './helpers.js';

let api: Api;
let prisma: PrismaService;

beforeAll(async () => {
  api = await bootApi();
  prisma = api.app.get(PrismaService);
});
afterAll(() => api.close());

describe('the guest columns', () => {
  it('an ordinary account is not a guest and has no expiry', async () => {
    const me = await api.signIn();
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: me.userId },
      select: { isGuest: true, guestExpiresAt: true },
    });
    expect(row).toEqual({ isGuest: false, guestExpiresAt: null });
  });

  it('keeps one row per guest space made, by a keyed address hash and the time', async () => {
    const row = await prisma.guestSignup.create({ data: { addrHash: 'a'.repeat(64) } });
    expect(row.createdAt).toBeInstanceOf(Date);
    await prisma.guestSignup.delete({ where: { id: row.id } });
  });
});

interface GuestSession {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; isGuest: boolean; isNew: boolean };
}
interface Me {
  id: string;
  email: string | null;
  nickname: string | null;
  ageBand: string | null;
  isGuest: boolean;
  guestExpiresAt: string | null;
  detailsDone: boolean;
  tier: string;
}
const ADULT = { ageBand: '18_plus', acceptTerms: true } as const;
const NATIVE = { 'x-client': 'native' };
const DAY = 86_400_000;

const start = (a: Api, body: object = ADULT) =>
  a.req<GuestSession>('POST', '/auth/guest', { body, headers: NATIVE });

describe('POST /v1/auth/guest', () => {
  it('makes an adult guest space: a real account, no email, 30 days, details done', async () => {
    const before = Date.now();
    const res = await start(api);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ isGuest: true, isNew: true });
    expect(res.body.refreshToken).toBeTruthy();
    const me = await api.req<Me>('GET', '/me', { token: res.body.accessToken });
    expect(me.body).toMatchObject({
      id: res.body.user.id,
      email: null,
      nickname: 'Guest',
      ageBand: 'adult',
      isGuest: true,
      detailsDone: true,
      tier: 'free',
    });
    const days = (Date.parse(me.body.guestExpiresAt ?? '') - before) / DAY;
    expect(days).toBeGreaterThan(29.99);
    expect(days).toBeLessThan(30.01);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: res.body.user.id } });
    expect(row.passwordHash).toBeNull();
    expect(row.region).toBe('GB');
    expect(row.dataKeyEnc.length).toBeGreaterThan(0);
  });

  it('records the wellbeing consent and leaves the optional ones off', async () => {
    const res = await start(api);
    const state = await api.req<{ purposes: { purpose: string; granted: boolean }[] }>(
      'GET',
      '/me/consents',
      { token: res.body.accessToken },
    );
    const granted = state.body.purposes.filter((p) => p.granted).map((p) => p.purpose);
    expect(granted).toEqual(['wellbeing_data']);
  });

  it('an ordinary account reads isGuest false and no expiry', async () => {
    const me = await api.signIn();
    const res = await api.req<Me>('GET', '/me', { token: me.token });
    expect(res.body).toMatchObject({ isGuest: false, guestExpiresAt: null });
  });

  it('is only for adults who accepted the Terms, and makes nothing otherwise', async () => {
    const users = await prisma.user.count();
    for (const body of [
      { ageBand: '16_17', acceptTerms: true },
      { ageBand: 'under_16', acceptTerms: true },
      { ageBand: '18_plus', acceptTerms: false },
      { ageBand: '18_plus' },
      {},
    ])
      expect((await start(api, body)).status).toBe(400);
    expect(await prisma.user.count()).toBe(users);
  });

  it('ends its sessions with the space, and refuses to refresh one that has ended', async () => {
    const wide = await bootApi({ REFRESH_TTL_DAYS: '90' });
    try {
      const res = await start(wide);
      const db = wide.app.get(PrismaService);
      const user = await db.user.findUniqueOrThrow({ where: { id: res.body.user.id } });
      const session = await db.session.findFirstOrThrow({ where: { userId: user.id } });
      expect(session.expiresAt.getTime()).toBeLessThanOrEqual(user.guestExpiresAt?.getTime() ?? 0);
      const token = await db.refreshToken.findFirstOrThrow({ where: { sessionId: session.id } });
      expect(token.expiresAt.getTime()).toBeLessThanOrEqual(user.guestExpiresAt?.getTime() ?? 0);
      const ok = await wide.req<GuestSession>('POST', '/auth/refresh', {
        body: { refreshToken: res.body.refreshToken },
        headers: NATIVE,
      });
      expect(ok.status).toBe(200);
      expect(ok.body.user.isGuest).toBe(true);
      await db.user.update({
        where: { id: user.id },
        data: { guestExpiresAt: new Date(Date.now() - 1000) },
      });
      const ended = await wide.req('POST', '/auth/refresh', {
        body: { refreshToken: ok.body.refreshToken },
        headers: NATIVE,
      });
      expect(ended.status).toBe(401);
    } finally {
      await wide.close();
    }
  });
});

describe('limits on making guest spaces', () => {
  it('limits one address per hour', async () => {
    const strict = await bootApi({ GUEST_SIGNUPS_PER_HOUR: '2' });
    try {
      await strict.app.get(PrismaService).guestSignup.deleteMany();
      expect((await start(strict)).status).toBe(201);
      expect((await start(strict)).status).toBe(201);
      const third = await start(strict);
      expect(third.status).toBe(429);
      expect(third.body).toMatchObject({ code: 'rate_limited' });
    } finally {
      await strict.close();
    }
  });

  it('limits one address per day, and the whole service per day', async () => {
    const strict = await bootApi({ GUEST_SIGNUPS_PER_HOUR: '99', GUEST_SIGNUPS_PER_DAY: '1' });
    try {
      await strict.app.get(PrismaService).guestSignup.deleteMany();
      expect((await start(strict)).status).toBe(201);
      expect((await start(strict)).status).toBe(429);
    } finally {
      await strict.close();
    }
    const capped = await bootApi({
      GUEST_SIGNUPS_PER_HOUR: '99',
      GUEST_SIGNUPS_PER_DAY: '99',
      GUEST_DAILY_CAP: '1',
    });
    try {
      await capped.app.get(PrismaService).guestSignup.deleteMany();
      expect((await start(capped)).status).toBe(201);
      const over = await start(capped);
      expect(over.status).toBe(503);
      expect(over.body).toMatchObject({ code: 'guest_unavailable' });
    } finally {
      await capped.close();
    }
  });

  it('keeps no address: only a keyed hash, in the counter', async () => {
    await prisma.guestSignup.deleteMany();
    await start(api);
    const rows = await prisma.guestSignup.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.addrHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]?.addrHash).not.toContain('127.0.0.1');
  });

  it('asks for a bot challenge only when it is switched on', async () => {
    await prisma.guestSignup.deleteMany();
    expect((await start(api)).status).toBe(201);
    const asking = await bootApi({
      GUEST_BOT_CHALLENGE: 'true',
      GUEST_BOT_VERIFY_URL: undefined,
      GUEST_BOT_SECRET: undefined,
    });
    try {
      // On, but not configured: refused, never waved through.
      expect((await start(asking)).status).toBe(501);
    } finally {
      await asking.close();
    }
  });

  it('checks the answer with the challenge service when it is on', async () => {
    // A stand-in siteverify service: "good" passes, anything else fails.
    const verify = createServer((req, res) => {
      let body = '';
      req.on('data', (c: Buffer) => (body += c.toString()));
      req.on('end', () => {
        const ok = new URLSearchParams(body).get('response') === 'good';
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ success: ok }));
      });
    });
    await new Promise<void>((done) => verify.listen(0, '127.0.0.1', done));
    const port = (verify.address() as AddressInfo).port;
    const asking = await bootApi({
      GUEST_BOT_CHALLENGE: 'true',
      GUEST_BOT_VERIFY_URL: `http://127.0.0.1:${String(port)}/`,
      GUEST_BOT_SECRET: 'test-secret',
    });
    try {
      await asking.app.get(PrismaService).guestSignup.deleteMany();
      expect((await start(asking)).status).toBe(400);
      expect((await start(asking, { ...ADULT, botToken: 'bad' })).status).toBe(400);
      expect((await start(asking, { ...ADULT, botToken: 'good' })).status).toBe(201);
    } finally {
      await asking.close();
      verify.close();
    }
  });
});
