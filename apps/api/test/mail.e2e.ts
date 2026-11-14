// The account emails, as people get them (the dev mailbox keeps the plain-text twin; the HTML is
// built from the same layout): sign-in, reset and the password lockout.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApi, type Api } from './helpers.js';

let api: Api;
const PASSWORD = 'Correct-horse-battery-42';

interface Mail {
  to: string;
  subject: string;
  text: string;
}
const inbox = async (to: string): Promise<Mail[]> =>
  (await api.req<{ mail: Mail[] }>('GET', `/dev/mailbox?to=${encodeURIComponent(to)}`)).body.mail;

beforeAll(async () => {
  api = await bootApi();
});
afterAll(async () => {
  await api.close();
});

describe('the account emails', () => {
  it('sign-in: the link, the code to type instead, and a quiet note', async () => {
    const email = `mail-${randomUUID().slice(0, 8)}@example.test`;
    await api.req('POST', '/auth/magic-link', { body: { email } });
    const mail = (await inbox(email)).at(-1);
    expect(mail?.subject).toBe('Your FigCit sign-in link');
    expect(mail?.text).toMatch(/^Your sign-in link\n/);
    expect(mail?.text).toMatch(/Open FigCit: \S+\/enter\/link\/\?token=/);
    expect(mail?.text).toMatch(/On another device\? Enter this code instead: \d{6}/);
    expect(mail?.text).toContain("If you didn't ask for this, you can ignore this email.");
  });

  it('reset: a link to choose a new password', async () => {
    const email = `reset-${randomUUID().slice(0, 8)}@example.test`;
    expect(
      (await api.req('POST', '/auth/password/sign-up', { body: { email, password: PASSWORD } }))
        .status,
    ).toBeLessThan(300);
    await api.req('POST', '/auth/password/forgot', { body: { email } });
    const mail = (await inbox(email)).find((m) => m.subject === 'Reset your FigCit password');
    expect(mail?.text).toMatch(/Choose a new password: \S+\/enter\/reset\/\?token=/);
    expect(mail?.text).toContain('Your password stays the same.');
    // The link works: a new password, then signing in with it.
    const token = /token=([^\s&]+)/.exec(mail?.text ?? '')?.[1] ?? '';
    const NEW = 'A-new-password-for-figcit-7';
    const reset = await api.req('POST', '/auth/password/reset', {
      body: { token: decodeURIComponent(token), password: NEW },
    });
    expect(reset.status).toBeLessThan(300);
    const signIn = await api.req('POST', '/auth/password/sign-in', {
      body: { email, password: NEW },
    });
    expect(signIn.status).toBeLessThan(300);
  });

  it('lockout: after five wrong passwords, a pause and what to do', async () => {
    const email = `lock-${randomUUID().slice(0, 8)}@example.test`;
    await api.req('POST', '/auth/password/sign-up', { body: { email, password: PASSWORD } });
    for (let i = 0; i < 5; i += 1)
      await api.req('POST', '/auth/password/sign-in', {
        body: { email, password: 'not-the-password-1' },
      });
    const mail = (await inbox(email)).find((m) => m.subject === 'We paused password sign-in');
    expect(mail?.text).toMatch(/^We paused password sign-in for 15 minutes\n/);
    expect(mail?.text).toContain('nothing has been accessed');
  });
});
