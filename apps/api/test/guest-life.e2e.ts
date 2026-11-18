// Guest space: clearing it, the daily purge and the expiring notices.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/db/prisma.service.js';
import { SessionsService } from '../src/modules/auth/sessions.service.js';
import { PrivacyService } from '../src/modules/privacy/privacy.service.js';
import { bootApi, type Api } from './helpers.js';
import { DAY, MANY, NATIVE, start } from './guest-helpers.js';

let api: Api;
let prisma: PrismaService;

beforeAll(async () => {
  api = await bootApi(MANY);
  prisma = api.app.get(PrismaService);
});
afterAll(() => api.close());

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

describe('guest_expiring notices (B5)', () => {
  const privacy = () => api.app.get(PrivacyService);
  const notices = (userId: string) =>
    prisma.inboxItem.findMany({
      where: { userId, kind: 'guest_expiring' },
      orderBy: { createdAt: 'asc' },
      select: { refType: true },
    });
  const setLeft = (id: string, now: Date, days: number) =>
    prisma.user.update({
      where: { id },
      data: { guestExpiresAt: new Date(now.getTime() + days * DAY) },
    });

  it('writes one notice at 7, 3 and 1 days left, once each, however often it runs', async () => {
    const now = new Date();
    const g = await start(api);
    const id = g.body.user.id;
    await setLeft(id, now, 10);
    await privacy().notifyGuestsExpiring(now);
    expect(await notices(id)).toEqual([]);

    await setLeft(id, now, 6.5);
    await privacy().notifyGuestsExpiring(now);
    await privacy().notifyGuestsExpiring(now);
    expect(await notices(id)).toEqual([{ refType: 'days_7' }]);

    await setLeft(id, now, 2.2);
    await privacy().notifyGuestsExpiring(now);
    await privacy().notifyGuestsExpiring(now);
    await setLeft(id, now, 0.4);
    await privacy().notifyGuestsExpiring(now);
    await privacy().notifyGuestsExpiring(now);
    expect((await notices(id)).map((n) => n.refType)).toEqual(['days_7', 'days_3', 'days_1']);
  });

  it('writes the smallest threshold reached when days were missed, and nothing for an ended space', async () => {
    const now = new Date();
    const g = await start(api);
    await setLeft(g.body.user.id, now, 1.5);
    await privacy().notifyGuestsExpiring(now);
    expect((await notices(g.body.user.id)).map((n) => n.refType)).toEqual(['days_3']);
    const over = await start(api);
    await setLeft(over.body.user.id, now, -1);
    await privacy().notifyGuestsExpiring(now);
    expect(await notices(over.body.user.id)).toEqual([]);
  });

  it('never writes one for an account', async () => {
    const now = new Date();
    const me = await api.signIn();
    await prisma.user.update({
      where: { id: me.userId },
      data: { guestExpiresAt: new Date(now.getTime() + 2 * DAY) },
    });
    await privacy().notifyGuestsExpiring(now);
    expect(await notices(me.userId)).toEqual([]);
  });

  it('shows calm words and opens About your guest space', async () => {
    const now = new Date();
    const g = await start(api);
    const token = g.body.accessToken;
    const texts: string[] = [];
    for (const days of [6.5, 2.2, 0.4]) {
      await setLeft(g.body.user.id, now, days);
      await privacy().notifyGuestsExpiring(now);
    }
    const inbox = await api.req<{
      items: { kind: string; title: string; body: string; href: string }[];
    }>('GET', '/inbox', { token });
    const items = inbox.body.items.filter((i) => i.kind === 'guest_expiring');
    expect(items.map((i) => i.title).sort()).toEqual([
      'Your guest space ends tomorrow',
      'Your guest space has 3 days left',
      'Your guest space has 7 days left',
    ]);
    for (const i of items) {
      expect(i.href).toBe('/me/guest/');
      texts.push(i.title, i.body);
    }
    // Plain, not alarming: no em dashes, no shouting, no exclamation marks.
    for (const t of texts) expect(t).not.toMatch(/[—!]|URGENT|WARNING|deleted|lose/i);
  });
});

describe('a guest token stops at the date of the space (item 9)', () => {
  it('an access token issued before the date is refused after it, before any purge runs', async () => {
    const g = await start(api);
    const token = g.body.accessToken;
    expect((await api.req('GET', '/me', { token })).status).toBe(200);
    await prisma.user.update({
      where: { id: g.body.user.id },
      data: { guestExpiresAt: new Date(Date.now() - 1000) },
    });
    expect((await api.req('GET', '/me', { token })).status).toBe(401);
    expect((await api.req('POST', '/tasks', { token, body: { title: 'Late' } })).status).toBe(401);
  });

  it('an account is not checked this way: its tokens are not guest tokens', async () => {
    const me = await api.signIn();
    await prisma.user.update({
      where: { id: me.userId },
      data: { isGuest: false, guestExpiresAt: new Date(Date.now() - 1000) },
    });
    expect((await api.req('GET', '/me', { token: me.token })).status).toBe(200);
  });

  it('a guest whose session was revoked is signed out at once', async () => {
    const g = await start(api);
    await prisma.session.updateMany({
      where: { userId: g.body.user.id },
      data: { revokedAt: new Date() },
    });
    expect((await api.req('GET', '/me', { token: g.body.accessToken })).status).toBe(401);
  });
});
