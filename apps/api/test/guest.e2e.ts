// Guest space (docs/GUEST_SPACE.md): a real account with no email, kept for 30 days at most.
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/db/prisma.service.js';
import { SessionsService } from '../src/modules/auth/sessions.service.js';
import { PrivacyService } from '../src/modules/privacy/privacy.service.js';
import { bootApi, type Api } from './helpers.js';

let api: Api;
let prisma: PrismaService;

beforeAll(async () => {
  // Every test here makes guests from one address: the per-address limits are tested on their own.
  api = await bootApi({ GUEST_SIGNUPS_PER_HOUR: '1000', GUEST_SIGNUPS_PER_DAY: '1000' });
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

describe('what needs an account (B1)', () => {
  const ID = '01a1deb2-0a2d-7ff3-af2a-c0766852cb26';
  const ROUTES: readonly [string, string][] = [
    ['POST', '/billing/checkout'],
    ['POST', '/billing/fake/complete'],
    ['POST', '/billing/cancel'],
    ['POST', '/institutions/join'],
    ['POST', '/me/institution/outreach'],
    ['POST', '/shares'],
    ['POST', `/drafts/${ID}/assist`],
    ['POST', '/files/uploads'],
    ['POST', `/files/${ID}/complete`],
    ['POST', '/speech/uploads'],
    ['POST', '/speech/transcriptions'],
    ['POST', '/ai/parse-need'],
    ['POST', '/ai/suggest-drivers'],
    ['POST', '/ai/map-feeling'],
    ['POST', '/ai/split-tasks'],
  ];

  it.each(ROUTES)('%s %s refuses a guest space with account_required', async (method, url) => {
    const guest = await start(api);
    const res = await api.req<{ code: string; detail: string }>(method as 'POST', url, {
      token: guest.body.accessToken,
      body: {},
    });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      code: 'account_required',
      detail: 'Create an account to use this.',
    });
  });

  it.each(ROUTES)('%s %s is not refused for an account', async (method, url) => {
    const me = await api.signIn();
    const res = await api.req<{ code?: string }>(method as 'POST', url, {
      token: me.token,
      body: {},
    });
    expect(res.body.code).not.toBe('account_required');
  });

  it('leaves everything else to a guest: plans, tasks, dumps, progress, support', async () => {
    const guest = await start(api);
    const token = guest.body.accessToken;
    expect((await api.req('GET', '/plans', { token })).status).toBe(200);
    expect((await api.req('GET', '/me/entitlements', { token })).status).toBe(200);
    expect((await api.req('POST', '/tasks', { token, body: { title: 'Wash up' } })).status).toBe(
      201,
    );
    expect((await api.req('GET', '/progress?range=7', { token })).status).toBe(200);
    expect((await api.req('GET', '/me/consents', { token })).status).toBe(200);
  });
});

describe('what a guest space may keep (B2)', () => {
  it('keeps up to 20 open tasks; finished ones make room; an account has no such limit', async () => {
    const guest = await start(api);
    const token = guest.body.accessToken;
    const ids: string[] = [];
    for (let i = 0; i < 20; i += 1) {
      const res = await api.req<{ id: string }>('POST', '/tasks', {
        token,
        body: { title: `Task ${String(i)}` },
      });
      expect(res.status).toBe(201);
      ids.push(res.body.id);
    }
    const over = await api.req<{ code: string; detail: string }>('POST', '/tasks', {
      token,
      body: { title: 'One too many' },
    });
    expect(over.status).toBe(403);
    expect(over.body.code).toBe('guest_limit');
    expect(over.body.detail).toContain('20 open tasks');
    // Finishing one makes room.
    const done = await api.req('PATCH', `/tasks/${ids[0] ?? ''}`, {
      token,
      body: { status: 'done' },
    });
    expect(done.status).toBe(200);
    expect((await api.req('POST', '/tasks', { token, body: { title: 'Room again' } })).status).toBe(
      201,
    );
    // The same client id twice is the same task, not a 21st.
    const again = await api.req('POST', '/tasks', {
      token,
      body: { id: ids[1], title: 'Task 1' },
    });
    expect(again.status).toBe(201);
  });

  it('keeps up to 50 dumps', async () => {
    const guest = await start(api);
    const token = guest.body.accessToken;
    for (let i = 0; i < 50; i += 1)
      expect(
        (await api.req('POST', '/dumps', { token, body: { text: `Thought ${String(i)}` } })).status,
      ).toBe(201);
    const over = await api.req<{ code: string; detail: string }>('POST', '/dumps', {
      token,
      body: { text: 'One too many' },
    });
    expect(over.status).toBe(403);
    expect(over.body.code).toBe('guest_limit');
    expect(over.body.detail).toContain('50 dumps');
  });

  it('does not limit an account', async () => {
    const me = await api.signIn();
    for (let i = 0; i < 22; i += 1)
      expect(
        (await api.req('POST', '/tasks', { token: me.token, body: { title: `T${String(i)}` } }))
          .status,
      ).toBe(201);
  });
});

describe('a guest keeps its name (B2)', () => {
  it('cannot clear it, can rename it', async () => {
    const guest = await start(api);
    const token = guest.body.accessToken;
    const cleared = await api.req<Me>('PATCH', '/me', { token, body: { nickname: null } });
    expect(cleared.status).toBe(200);
    expect(cleared.body).toMatchObject({ nickname: 'Guest', detailsDone: true });
    const empty = await api.req<{ code: string }>('PATCH', '/me', {
      token,
      body: { nickname: '' },
    });
    expect(empty.status).toBe(400);
    const renamed = await api.req<Me>('PATCH', '/me', { token, body: { nickname: 'Sam' } });
    expect(renamed.body.nickname).toBe('Sam');
  });

  it('an account can still clear its name', async () => {
    const me = await api.signIn();
    await api.req('PATCH', '/me', { token: me.token, body: { nickname: 'Ada' } });
    const res = await api.req<Me>('PATCH', '/me', { token: me.token, body: { nickname: null } });
    expect(res.body.nickname).toBeNull();
  });
});

describe('clearing a guest space (B3)', () => {
  it('DELETE /me erases it at once: 204, no grace period, the data key and the data gone', async () => {
    const guest = await start(api);
    const token = guest.body.accessToken;
    const id = guest.body.user.id;
    await api.req('POST', '/tasks', { token, body: { title: 'A private task' } });
    await api.req('POST', '/dumps', { token, body: { text: 'A private thought' } });
    const res = await api.req('DELETE', '/me', { token });
    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
    expect(await prisma.user.findUnique({ where: { id } })).toBeNull();
    expect(await prisma.task.count({ where: { userId: id } })).toBe(0);
    expect(await prisma.dump.count({ where: { userId: id } })).toBe(0);
    expect(await prisma.deletionRequest.count({ where: { userId: id } })).toBe(0);
    // Signed out: the refresh token is gone with the session.
    const again = await api.req('POST', '/auth/refresh', {
      body: { refreshToken: guest.body.refreshToken },
      headers: NATIVE,
    });
    expect(again.status).toBe(401);
  });

  it('also accepts the confirmation words, as an account does', async () => {
    const guest = await start(api);
    const res = await api.req('DELETE', '/me', {
      token: guest.body.accessToken,
      body: { confirm: 'delete my account' },
    });
    expect(res.status).toBe(204);
  });

  it('an account is deleted as before: 202, a grace period, the words needed', async () => {
    const me = await api.signIn();
    expect((await api.req('DELETE', '/me', { token: me.token })).status).toBe(400);
    expect(
      (await api.req('DELETE', '/me', { token: me.token, body: { confirm: 'yes' } })).status,
    ).toBe(400);
    const res = await api.req<{ scheduledFor: string }>('DELETE', '/me', {
      token: me.token,
      body: { confirm: 'delete my account' },
    });
    expect(res.status).toBe(202);
    expect(res.body.scheduledFor).toBeTruthy();
  });

  it('a guest space is never restored by a sign-in link, even with a deletion request on it', async () => {
    const guest = await start(api);
    const id = guest.body.user.id;
    await prisma.deletionRequest.create({
      data: { userId: id, scheduledFor: new Date(Date.now() + 7 * DAY) },
    });
    await prisma.user.update({ where: { id }, data: { status: 'deleted', deletedAt: new Date() } });
    const { sha256 } = await import('../src/common/crypto/envelope.js');
    const token = `guest-restore-${randomUUID()}`;
    await prisma.magicLink.create({
      data: {
        email: 'someone@example.test',
        tokenHash: sha256(token),
        codeHash: sha256('someone@example.test:123456'),
        userId: id,
        purpose: 'sign_in',
        expiresAt: new Date(Date.now() + 600_000),
      },
    });
    const res = await api.req('POST', '/auth/magic-link/verify', { body: { token } });
    expect(res.status).toBe(401);
    const row = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('deleted');
    expect(row.deletedAt).not.toBeNull();
  });
});

describe('the daily guest purge (B4)', () => {
  const privacy = () => api.app.get(PrivacyService);
  const expireAt = (id: string, at: Date) =>
    prisma.user.update({ where: { id }, data: { guestExpiresAt: at } });

  it('erases the guest spaces whose time has come, in batches, and nothing else', async () => {
    const now = new Date('2030-01-01T03:10:00Z');
    const old: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const g = await start(api);
      await api.req('POST', '/tasks', { token: g.body.accessToken, body: { title: 'Mine' } });
      await expireAt(g.body.user.id, new Date(now.getTime() - (i + 1) * 1000));
      old.push(g.body.user.id);
    }
    const alive = await start(api);
    await expireAt(alive.body.user.id, new Date(now.getTime() + DAY));
    const account = await api.signIn();
    // An account is never touched, whatever its dates say.
    await prisma.user.update({
      where: { id: account.userId },
      data: { guestExpiresAt: new Date(now.getTime() - DAY) },
    });
    // The "now" in the test is 2030: only guest spaces expired before it are due, and those made
    // by the earlier tests in this file have expired by then too, so count what this test made.
    const before = await prisma.user.count({ where: { isGuest: true } });
    const erased = await privacy().purgeGuests(now, 2);
    expect(erased).toBeGreaterThanOrEqual(5);
    for (const id of old) {
      expect(await prisma.user.findUnique({ where: { id } })).toBeNull();
      expect(await prisma.task.count({ where: { userId: id } })).toBe(0);
    }
    expect(await prisma.user.findUnique({ where: { id: alive.body.user.id } })).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { id: account.userId } })).not.toBeNull();
    expect(await prisma.user.count({ where: { isGuest: true } })).toBe(before - erased);
  });

  it('is a no-op when nothing is due, and drops sign-up counter rows older than two days', async () => {
    const now = new Date('2031-06-01T03:10:00Z');
    await prisma.guestSignup.deleteMany();
    await prisma.guestSignup.create({
      data: { addrHash: 'b'.repeat(64), createdAt: new Date(now.getTime() - 3 * DAY) },
    });
    await prisma.guestSignup.create({
      data: { addrHash: 'c'.repeat(64), createdAt: new Date(now.getTime() - DAY) },
    });
    // Guests still alive at this date: none are due before the clock reaches them.
    await prisma.user.updateMany({
      where: { isGuest: true },
      data: { guestExpiresAt: new Date(now.getTime() + DAY) },
    });
    expect(await privacy().purgeGuests(now)).toBe(0);
    const left = await prisma.guestSignup.findMany();
    expect(left.map((r) => r.addrHash)).toEqual(['c'.repeat(64)]);
  });

  it('a guest space past its time cannot start a session or refresh one', async () => {
    const g = await start(api);
    await expireAt(g.body.user.id, new Date(Date.now() - 1000));
    await expect(api.app.get(SessionsService).issue(g.body.user.id, 'test')).rejects.toThrow(
      /ended/,
    );
    const res = await api.req('POST', '/auth/refresh', {
      body: { refreshToken: g.body.refreshToken },
      headers: NATIVE,
    });
    expect(res.status).toBe(401);
  });
});
