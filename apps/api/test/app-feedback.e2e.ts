// Tester feedback (owner, 19 Nov 2026): sent from the app (signed in or Browse) or the website's
// server, kept for staff to read and mark, and each one emailed to FEEDBACK_TO.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApi, type Api } from './helpers.js';

const KEY = 'website-feedback-key-for-tests-0123456789';
const TO = 'admin@figcit.co.uk';
let api: Api;
beforeAll(async () => {
  api = await bootApi({ WEBSITE_FEEDBACK_KEY: KEY, FEEDBACK_TO: TO });
});
afterAll(() => api.close());

type Item = {
  id: string;
  source: string;
  text: string;
  screen: string | null;
  status: string;
  signedIn: boolean;
  email: string | null;
};
type Mail = { to: string; subject: string; text: string };
const inbox = async (): Promise<Mail[]> =>
  (await api.req<{ mail: Mail[] }>('GET', `/dev/mailbox?to=${encodeURIComponent(TO)}`)).body.mail;

describe('tester feedback', () => {
  it('takes a report from the app, emails it, and staff can read and mark it', async () => {
    const { token } = await api.signIn();
    const text = `The Save button did nothing ${String(Date.now())}`;
    const sent = await api.req<{ id: string }>('POST', '/app-feedback', {
      token,
      body: { kind: 'broken', text, screen: '/tasks/plan/', appVersion: '1.2.3', device: 'iPhone' },
    });
    expect(sent.status).toBe(201);
    const mail = (await inbox()).find((m) => m.text.includes(text));
    expect(mail?.subject).toBe("Feedback: Something's broken (the app)");
    expect(mail?.text).toContain('Where: /tasks/plan/');

    const staff = await api.staff(['content_editor']);
    const list = await api.req<{ items: Item[] }>('GET', '/admin/feedback?status=new', {
      token: staff.token,
    });
    const item = list.body.items.find((i) => i.id === sent.body.id);
    expect(item).toMatchObject({ source: 'app', text, screen: '/tasks/plan/', signedIn: true });
    const done = await api.req<Item>('PATCH', `/admin/feedback/${sent.body.id}`, {
      token: staff.token,
      body: { status: 'done' },
    });
    expect(done.body.status).toBe('done');
  });

  it('takes one from Browse mode too, without an account', async () => {
    const res = await api.req('POST', '/app-feedback', {
      headers: { 'x-browse-token': 'browse-token-0123456789abcdef' },
      body: { kind: 'idea', text: 'A dark mode for the plan grid' },
    });
    expect(res.status).toBe(201);
  });

  it("refuses the website route without the website's key", async () => {
    const body = { kind: 'confusing', text: 'Which plan do I need?', email: 'tester@example.test' };
    expect((await api.req('POST', '/app-feedback/website', { body })).status).toBe(403);
    const bad = { 'x-website-key': `${KEY}x` };
    expect((await api.req('POST', '/app-feedback/website', { body, headers: bad })).status).toBe(
      403,
    );
    const ok = await api.req<{ id: string }>('POST', '/app-feedback/website', {
      body,
      headers: { 'x-website-key': KEY },
    });
    expect(ok.status).toBe(201);
    const staff = await api.staff(['admin']);
    const list = await api.req<{ items: Item[] }>('GET', '/admin/feedback', { token: staff.token });
    expect(list.body.items.find((i) => i.id === ok.body.id)).toMatchObject({
      source: 'website',
      signedIn: false,
      email: 'tester@example.test',
    });
  });

  it('is for staff only to read, and takes only your own screenshot', async () => {
    const { token } = await api.signIn();
    expect((await api.req('GET', '/admin/feedback', { token })).status).toBe(403);
    const res = await api.req('POST', '/app-feedback', {
      token,
      body: { kind: 'broken', text: 'x', screenshotId: '01900000-0000-7000-8000-000000000000' },
    });
    expect(res.status).toBe(400);
  });
});
