// Guest space: what needs an account, what a guest may keep, and its name.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApi, type Api } from './helpers.js';
import { MANY, start, type Me } from './guest-helpers.js';

let api: Api;

beforeAll(async () => {
  api = await bootApi(MANY);
});
afterAll(() => api.close());

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
    // The task helper that calls the model (Break down, S21).
    ['POST', `/tasks/${ID}/break-down`],
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

describe('what the teammates added since f3972ca, for a guest and for an account (merge check)', () => {
  it('Express Draft (free, #148): a guest can write and keep a draft, but "assist" is an account feature', async () => {
    const guest = await start(api);
    const token = guest.body.accessToken;
    const draft = await api.req<{ id: string }>('POST', '/drafts', {
      token,
      body: { title: 'To my tutor', body: 'Hello, I need more time.', mode: 'draft' },
    });
    expect(draft.status).toBe(201);
    expect((await api.req('GET', `/drafts/${draft.body.id}`, { token })).status).toBe(200);
    expect(
      (
        await api.req('PATCH', `/drafts/${draft.body.id}`, {
          token,
          body: { body: 'Hello, I would like more time.' },
        })
      ).status,
    ).toBe(200);
    // The assist (every mode, Draft included) goes to the model: an account is needed.
    const assist = await api.req<{ code: string }>('POST', `/drafts/${draft.body.id}/assist`, {
      token,
      body: { mode: 'draft' },
    });
    expect(assist.status).toBe(403);
    expect(assist.body.code).toBe('account_required');
  });

  it('own communication cards (#152) work for a guest and for an account', async () => {
    for (const who of ['guest', 'account'] as const) {
      const token =
        who === 'guest' ? (await start(api)).body.accessToken : (await api.signIn()).token;
      const made = await api.req<{ id: string; text: string }>('POST', '/comm-cards', {
        token,
        body: { text: 'I need a quiet moment' },
      });
      expect(made.status).toBe(201);
      const list = await api.req<{ items: { text: string }[] }>('GET', '/comm-cards', { token });
      expect(list.body.items.map((c) => c.text)).toContain('I need a quiet moment');
      expect((await api.req('DELETE', `/comm-cards/${made.body.id}`, { token })).status).toBe(204);
    }
  });

  it('tester feedback (#155): a guest can send text feedback; an account too; staff routes stay staff', async () => {
    for (const who of ['guest', 'account'] as const) {
      const token =
        who === 'guest' ? (await start(api)).body.accessToken : (await api.signIn()).token;
      const res = await api.req('POST', '/app-feedback', {
        token,
        body: { kind: 'idea', text: 'More colours please', screen: '/home/' },
      });
      expect(res.status).toBe(201);
    }
    const guest = await start(api);
    expect(
      (await api.req('GET', '/admin/feedback', { token: guest.body.accessToken })).status,
    ).toBe(403);
    // A screenshot is a file upload: an account feature (a guest can send the text without it).
    const shot = await api.req<{ code: string }>('POST', '/files/uploads', {
      token: guest.body.accessToken,
      body: { purpose: 'feedback_screenshot', contentType: 'image/png', sizeBytes: 1000 },
    });
    expect(shot.status).toBe(403);
    expect(shot.body.code).toBe('account_required');
    const account = await api.signIn();
    const ok = await api.req('POST', '/files/uploads', {
      token: account.token,
      body: { purpose: 'feedback_screenshot', contentType: 'image/png', sizeBytes: 1000 },
    });
    expect(ok.status).toBe(201);
  });
});
