// Guest space: keeping it by confirming an email (docs/GUEST_SPACE.md, "Linking").
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/db/prisma.service.js';
import { bootApi, type Api } from './helpers.js';
import { DAY, MANY, NATIVE, start, type Me } from './guest-helpers.js';

let api: Api;
let prisma: PrismaService;

beforeAll(async () => {
  api = await bootApi({ ...MANY, REFRESH_TTL_DAYS: '90' });
  prisma = api.app.get(PrismaService);
});
afterAll(() => api.close());

const fresh = () => `link-${randomUUID()}@example.test`;
const link = (token: string, email: string) =>
  api.req<{ ok: true }>('POST', '/auth/guest/link/email', { token, body: { email } });

/** The newest "Confirm your email" mail to an address, from the dev mailbox (newest first). */
async function mailTo(email: string): Promise<{ subject: string; text: string; html: string }> {
  const res = await api.req<{
    mail: { to: string; subject: string; text: string; html: string }[];
  }>('GET', `/dev/mailbox?to=${encodeURIComponent(email)}`);
  const mail = res.body.mail.find((m) => m.to === email && m.subject === 'Confirm your email');
  if (!mail) throw new Error(`no mail to ${email}`);
  return mail;
}
const tokenIn = (text: string): string => {
  const m = /[?&]token=([^\s&"]+)/.exec(text);
  if (!m?.[1]) throw new Error('no token in the mail');
  return decodeURIComponent(m[1]);
};

describe('POST /v1/auth/guest/link/email (C1)', () => {
  it('answers 202 and sends a "Confirm your email" mail with a link for that guest', async () => {
    const guest = await start(api);
    const email = fresh();
    const res = await link(guest.body.accessToken, email);
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ ok: true });
    const mail = await mailTo(email);
    expect(mail.subject).toBe('Confirm your email');
    expect(mail.text).toContain('/enter/link/?token=');
    expect(mail.text).not.toMatch(/—/);
    const row = await prisma.magicLink.findFirstOrThrow({ where: { email } });
    expect(row).toMatchObject({ purpose: 'link_guest', userId: guest.body.user.id, usedAt: null });
    // Nothing is attached yet: the email is not the guest's until it is confirmed.
    const user = await prisma.user.findUniqueOrThrow({ where: { id: guest.body.user.id } });
    expect(user).toMatchObject({ email: null, isGuest: true });
  });

  it('answers the same 202 whether or not the email already has an account', async () => {
    const owner = await api.signIn();
    const guest = await start(api);
    const taken = await link(guest.body.accessToken, owner.email);
    const free = await link(guest.body.accessToken, fresh());
    expect(taken.status).toBe(202);
    expect(taken.body).toEqual(free.body);
  });

  it('is only for a guest space', async () => {
    const me = await api.signIn();
    const res = await link(me.token, fresh());
    expect(res.status).toBe(403);
  });

  it('needs a valid email and a session', async () => {
    const guest = await start(api);
    expect((await link(guest.body.accessToken, 'not an email')).status).toBe(400);
    const anon = await api.req('POST', '/auth/guest/link/email', { body: { email: fresh() } });
    expect(anon.status).toBe(401);
  });

  it('is limited like the magic link: a few a quarter hour per address and per guest space', async () => {
    const guest = await start(api);
    const email = fresh();
    for (let i = 0; i < 5; i += 1)
      expect((await link(guest.body.accessToken, email)).status).toBe(202);
    expect((await link(guest.body.accessToken, email)).status).toBe(429);
    const other = await start(api);
    for (let i = 0; i < 5; i += 1)
      expect((await link(other.body.accessToken, fresh())).status).toBe(202);
    expect((await link(other.body.accessToken, fresh())).status).toBe(429);
  });

  it('cannot get in the way of the real owner signing in with a code', async () => {
    const owner = fresh();
    await api.req('POST', '/auth/magic-link', { body: { email: owner } });
    const guest = await start(api);
    // Someone asks to attach the owner's email to a guest space, after the owner asked to sign in.
    await link(guest.body.accessToken, owner);
    const mails = await api.req<{ mail: { to: string; text: string }[] }>(
      'GET',
      `/dev/mailbox?to=${encodeURIComponent(owner)}`,
    );
    const signIn = mails.body.mail
      .filter((m) => m.to === owner && !m.text.includes('Confirm'))
      .at(-1);
    const code = /\b(\d{6})\b/.exec(signIn?.text ?? '')?.[1];
    const res = await api.req('POST', '/auth/magic-link/verify', {
      body: { email: owner, code },
      headers: NATIVE,
    });
    expect(res.status).toBe(200);
  });
});

interface Linked {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; isGuest: boolean; isNew: boolean };
}
const open = (token: string) =>
  api.req<Linked & { code?: string }>('POST', '/auth/magic-link/verify', {
    body: { token },
    headers: NATIVE,
  });
/** A guest space that has asked to keep `email`, with the token from the mail. */
async function asking(email = fresh()) {
  const guest = await start(api);
  await link(guest.body.accessToken, email);
  return { guest, email, token: tokenIn((await mailTo(email)).text) };
}

describe('opening the confirmation link (C2)', () => {
  it('keeps the same account: same id, same key, same data, now with the email', async () => {
    const { guest, email, token } = await asking();
    const guestToken = guest.body.accessToken;
    const id = guest.body.user.id;
    const task = await api.req<{ id: string }>('POST', '/tasks', {
      token: guestToken,
      body: { title: 'Made as a guest' },
    });
    await api.req('POST', '/dumps', { token: guestToken, body: { text: 'A guest thought' } });
    const checkedIn = await api.req<{ id: string }>('POST', '/check-ins', {
      token: guestToken,
      body: { state: { kind: 'grid', energy: 3, mood: 3 }, ownWords: 'felt flat today' },
    });
    expect(checkedIn.status).toBe(201);
    const before = await prisma.user.findUniqueOrThrow({ where: { id } });

    const res = await open(token);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id, isGuest: false, isNew: false });

    const after = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(after).toMatchObject({ email, isGuest: false, guestExpiresAt: null });
    expect(after.emailVerifiedAt).not.toBeNull();
    expect(Buffer.from(after.dataKeyEnc).equals(Buffer.from(before.dataKeyEnc))).toBe(true);
    expect(after.nickname).toBe('Guest');

    const me = await api.req<Me>('GET', '/me', { token: res.body.accessToken });
    expect(me.body).toMatchObject({ id, email, isGuest: false, guestExpiresAt: null });
    // The data made as a guest is still there, decrypts, and is the same rows.
    const tasks = await api.req<{ items: { id: string; title: string }[] }>('GET', '/tasks', {
      token: res.body.accessToken,
    });
    expect(tasks.body.items.find((t) => t.id === task.body.id)?.title).toBe('Made as a guest');
    const dumps = await api.req<{ items: { items: { text: string }[] }[] }>('GET', '/dumps', {
      token: res.body.accessToken,
    });
    expect(JSON.stringify(dumps.body)).toContain('A guest thought');
    expect(await prisma.checkIn.count({ where: { id: checkedIn.body.id, userId: id } })).toBe(1);
    // The guest session in the app carries on, as the same user, now with an account.
    const same = await api.req<Me>('GET', '/me', { token: guestToken });
    expect(same.body).toMatchObject({ id, email, isGuest: false });
    // An account has no guest limits and can use what needs one.
    const checkout = await api.req<{ code?: string }>('POST', '/billing/checkout', {
      token: guestToken,
      body: {},
    });
    expect(checkout.body.code).not.toBe('account_required');
    // Its sessions no longer end with the guest space.
    const sessions = await prisma.session.findMany({ where: { userId: id, revokedAt: null } });
    expect(sessions.length).toBeGreaterThan(0);
    for (const s of sessions) expect(s.expiresAt.getTime()).toBeGreaterThan(Date.now() + 60 * DAY);
  });

  it('is idempotent: opening it again signs in the same account, and changes nothing', async () => {
    const { email, token } = await asking();
    const first = await open(token);
    const again = await open(token);
    expect(again.status).toBe(200);
    expect(again.body.user).toMatchObject({ id: first.body.user.id, isGuest: false });
    expect(await prisma.user.count({ where: { email } })).toBe(1);
  });

  it("cannot attach someone else's email without their mailbox", async () => {
    const victim = await api.signIn();
    const attacker = await start(api);
    // The attacker can ask, but the link goes to the victim's mailbox, not to the attacker.
    expect((await link(attacker.body.accessToken, victim.email)).status).toBe(202);
    const me = await api.req<Me>('GET', '/me', { token: attacker.body.accessToken });
    expect(me.body).toMatchObject({ email: null, isGuest: true });
    // Guessing does not help: not a token, not a code, not the link of another request.
    expect((await open('x'.repeat(40))).status).toBe(401);
    const code = await api.req('POST', '/auth/magic-link/verify', {
      body: { email: victim.email, code: '000000' },
      headers: NATIVE,
    });
    expect(code.status).toBe(401);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: victim.userId } });
    expect(row.email).toBe(victim.email);
    expect(await prisma.user.count({ where: { email: victim.email } })).toBe(1);
  });

  it('refuses an email that has an account: 409, nothing attached, the link is spent', async () => {
    const owner = await api.signIn();
    const { guest, token } = await asking(owner.email);
    const res = await api.req<{ code: string }>('POST', '/auth/magic-link/verify', {
      body: { token },
      headers: NATIVE,
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('email_has_account');
    const me = await api.req<Me>('GET', '/me', { token: guest.body.accessToken });
    expect(me.body).toMatchObject({ email: null, isGuest: true });
    // The owner's account is untouched, and the link cannot be tried again.
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.userId } })).email).toBe(
      owner.email,
    );
    expect((await open(token)).status).toBe(410);
  });

  it('the same email cannot be claimed twice: the second guest space gets 409', async () => {
    const email = fresh();
    const a = await asking(email);
    const b = await asking(email);
    expect((await open(a.token)).status).toBe(200);
    const second = await api.req<{ code: string }>('POST', '/auth/magic-link/verify', {
      body: { token: b.token },
      headers: NATIVE,
    });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('email_has_account');
    expect(await prisma.user.count({ where: { email } })).toBe(1);
    const stays = await api.req<Me>('GET', '/me', { token: b.guest.body.accessToken });
    expect(stays.body).toMatchObject({ email: null, isGuest: true });
  });

  it('refuses a link that has expired, and one for a guest space that has ended', async () => {
    const old = await asking();
    await prisma.magicLink.updateMany({
      where: { email: old.email },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await open(old.token)).status).toBe(410);
    const ended = await asking();
    await prisma.user.update({
      where: { id: ended.guest.body.user.id },
      data: { guestExpiresAt: new Date(Date.now() - 1000) },
    });
    expect((await open(ended.token)).status).toBe(410);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: ended.guest.body.user.id } })).email,
    ).toBeNull();
  });
});
