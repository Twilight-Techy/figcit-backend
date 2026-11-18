// Guest space: keeping it by confirming an email (docs/GUEST_SPACE.md, "Linking").
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/db/prisma.service.js';
import { bootApi, type Api } from './helpers.js';
import { MANY, NATIVE, start } from './guest-helpers.js';

let api: Api;
let prisma: PrismaService;

beforeAll(async () => {
  api = await bootApi(MANY);
  prisma = api.app.get(PrismaService);
});
afterAll(() => api.close());

const fresh = () => `link-${randomUUID()}@example.test`;
const link = (token: string, email: string) =>
  api.req<{ ok: true }>('POST', '/auth/guest/link/email', { token, body: { email } });

/** The newest mail to an address, from the dev mailbox. */
async function mailTo(email: string): Promise<{ subject: string; text: string; html: string }> {
  const res = await api.req<{
    mail: { to: string; subject: string; text: string; html: string }[];
  }>('GET', `/dev/mailbox?to=${encodeURIComponent(email)}`);
  const mail = res.body.mail.filter((m) => m.to === email).at(-1);
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

  it('is not a sign-in link: the code path never matches it, and the token path waits for the next step', async () => {
    const guest = await start(api);
    const email = fresh();
    await link(guest.body.accessToken, email);
    const token = tokenIn((await mailTo(email)).text);
    const res = await api.req('POST', '/auth/magic-link/verify', {
      body: { token },
      headers: NATIVE,
    });
    expect(res.status).toBe(410);
    const row = await prisma.magicLink.findFirstOrThrow({ where: { email } });
    expect(row.usedAt).toBeNull();
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
