import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFakeModel, type FakeModel } from './fake-model.js';
import { bootApi, type Api } from './helpers.js';

interface Item {
  id: string;
  text: string;
  bucket: string | null;
  suggestedBucket: string | null;
  movedTo: string | null;
}
interface Dump {
  id: string;
  items: Item[];
  safety: boolean;
  sortedAt: string | null;
  counts: Record<string, number>;
}
interface Draft {
  id: string;
  body: string;
  versions: { id: string; mode: string; aiUsed: boolean; changes: { summary: string } | null }[];
}

let api: Api;
let model: FakeModel;
let token: string;
let userId: string;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  model = await startFakeModel();
  api = await bootApi({ AI_BASE_URL: model.url });
  ({ token, userId } = await api.signIn());
});
afterAll(async () => {
  await api.close();
  await model.close();
});

describe('dump', () => {
  it('splits text into items, sorts them and moves to-dos to tasks', async () => {
    const d = await api.req<Dump>('POST', '/dumps', {
      token,
      body: { text: 'Call the dentist\nWhat if I fail the exam\nMaybe paint the hallway' },
    });
    expect(d.status).toBe(201);
    expect(d.body.items.map((i) => i.text)).toEqual([
      'Call the dentist',
      'What if I fail the exam',
      'Maybe paint the hallway',
    ]);
    expect(d.body.safety).toBe(false);
    const [todo, worry, idea] = d.body.items;
    await api.req('PATCH', `/dump-items/${String(todo?.id)}`, { token, body: { bucket: 'todo' } });
    await api.req('PATCH', `/dump-items/${String(worry?.id)}`, {
      token,
      body: { bucket: 'worries' },
    });
    await api.req('PATCH', `/dump-items/${String(idea?.id)}`, { token, body: { bucket: 'ideas' } });
    const sorted = await api.req<Dump>('GET', `/dumps/${d.body.id}`, { token });
    expect(sorted.body.sortedAt).not.toBeNull();
    expect(sorted.body.counts).toMatchObject({ todo: 1, worries: 1, ideas: 1, unsorted: 0 });

    const moved = await api.req<{ item: Item; targetId: string }>(
      'POST',
      `/dump-items/${String(todo?.id)}/to-task`,
      { token, body: { timeline: 'T2' } },
    );
    expect(moved.status).toBe(201);
    expect(moved.body.item.movedTo).toBe('task');
    const task = await api.req<{ title: string; source: string; timeline: string | null }>(
      'GET',
      `/tasks/${moved.body.targetId}`,
      { token },
    );
    expect(task.body).toMatchObject({ title: 'Call the dentist', source: 'dump', timeline: 'T2' });
    const again = await api.req<{ targetId: string }>(
      'POST',
      `/dump-items/${String(todo?.id)}/to-task`,
      { token, body: {} },
    );
    expect(again.body.targetId).toBe(moved.body.targetId);

    const refused = await api.req<{ code: string }>(
      'POST',
      `/dump-items/${String(worry?.id)}/to-task`,
      { token, body: {} },
    );
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('worry_not_task');

    const draft = await api.req<{ targetId: string }>(
      'POST',
      `/dump-items/${String(idea?.id)}/to-draft`,
      { token },
    );
    const dr = await api.req<Draft>('GET', `/drafts/${draft.body.targetId}`, { token });
    expect(dr.body.body).toBe('Maybe paint the hallway');
  });

  it('flags risk text but keeps what was written', async () => {
    const d = await api.req<Dump>('POST', '/dumps', {
      token,
      body: { items: [{ text: 'groceries' }, { text: 'I want to end my life' }] },
    });
    expect(d.body.safety).toBe(true);
    expect(d.body.items).toHaveLength(2);
  });

  it('adds model bucket suggestions for Plus users only', async () => {
    const plus = await api.signIn();
    await api.grantPlus(plus.userId);
    model.reply((body) => {
      const items = JSON.parse(
        ((body as { messages: { content: string }[] }).messages[1]?.content ?? '')
          .replace(/<\/?user_words>/g, '')
          .trim(),
      ) as { id: string }[];
      return JSON.stringify({ items: items.map((i) => ({ id: i.id, bucket: 'notes' })) });
    });
    const d = await api.req<Dump>('POST', '/dumps', {
      token: plus.token,
      body: { text: 'one thing\nanother thing' },
    });
    await wait(300);
    const after = await api.req<Dump>('GET', `/dumps/${d.body.id}`, { token: plus.token });
    expect(after.body.items.every((i) => i.suggestedBucket === 'notes')).toBe(true);
    expect(after.body.items.every((i) => i.bucket === null)).toBe(true);
    const free = await api.req<Dump>('POST', '/dumps', { token, body: { text: 'free item' } });
    await wait(200);
    expect(
      (await api.req<Dump>('GET', `/dumps/${free.body.id}`, { token })).body.items[0]
        ?.suggestedBucket,
    ).toBeNull();
  });
});

describe('express', () => {
  it('simplifies by rules without a model, with what changed', async () => {
    const off = await bootApi({ AI_BASE_URL: '' });
    const { token: t } = await off.signIn();
    const d = await off.req<Draft>('POST', '/drafts', {
      token: t,
      body: {
        body: "I'm so sorry to bother you, I was just wondering if I could have an extension?",
        purpose: 'my tutor',
      },
    });
    const res = await off.req<{ text: string; source: string; changes: { summary: string } }>(
      'POST',
      `/drafts/${d.body.id}/assist`,
      { token: t, body: { mode: 'simplify', level: 'gentle' } },
    );
    expect(res.body.source).toBe('fallback');
    expect(res.body.text.toLowerCase()).not.toContain('sorry');
    expect(res.body.changes.summary).toMatch(/Removed \d/);
    const after = await off.req<Draft>('GET', `/drafts/${d.body.id}`, { token: t });
    expect(after.body.versions).toHaveLength(2);
    expect(after.body.body).toBe(res.body.text);
    await off.close();
  });

  it('streams model text and replaces it when a check fails', async () => {
    const d = await api.req<Draft>('POST', '/drafts', {
      token,
      body: { body: 'Could we move the meeting to later please?' },
    });
    model.reply('Could we move the meeting later?');
    const ok = await api.app.inject({
      method: 'POST',
      url: `/v1/drafts/${d.body.id}/assist`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      payload: JSON.stringify({ mode: 'simplify' }),
    });
    expect(ok.headers['content-type']).toContain('text/event-stream');
    expect(ok.body).toContain('event: delta');
    const done = JSON.parse(/event: done\ndata: (.*)\n/.exec(ok.body)?.[1] ?? '{}') as {
      source: string;
      text: string;
    };
    expect(done).toMatchObject({ source: 'ai', text: 'Could we move the meeting later?' });

    model.reply('Could we move the meeting to 3pm on Friday with Alex please, thanks so much?');
    const bad = await api.req<{ source: string; replaced: boolean }>(
      'POST',
      `/drafts/${d.body.id}/assist`,
      { token, body: { mode: 'simplify' } },
    );
    expect(bad.body).toMatchObject({ source: 'fallback', replaced: true });
  });

  it('keeps structure and script for Plus and enforces the free allowance', async () => {
    const d = await api.req<Draft>('POST', '/drafts', {
      token,
      body: { body: 'I need an extension. My laptop broke.' },
    });
    const locked = await api.req<{ code: string }>('POST', `/drafts/${d.body.id}/assist`, {
      token,
      body: { mode: 'structure' },
    });
    expect(locked.status).toBe(402);
    const plus = await api.signIn();
    await api.grantPlus(plus.userId);
    const pd = await api.req<Draft>('POST', '/drafts', {
      token: plus.token,
      body: { body: 'I need an extension. My laptop broke.' },
    });
    model.fail(500);
    const s = await api.req<{ sections: { role: string }[]; source: string }>(
      'POST',
      `/drafts/${pd.body.id}/assist`,
      { token: plus.token, body: { mode: 'structure' } },
    );
    expect(s.body.source).toBe('fallback');
    expect(s.body.sections[0]?.role).toBe('ask');

    const { token: t } = await api.signIn();
    const fd = await api.req<Draft>('POST', '/drafts', {
      token: t,
      body: { body: 'Sorry, could I just ask one thing?' },
    });
    let limited = false;
    for (let i = 0; i < 11; i += 1) {
      model.reply('Could I ask one thing?');
      const r = await api.req<{ limited: boolean }>('POST', `/drafts/${fd.body.id}/assist`, {
        token: t,
        body: { mode: 'rewrite' },
      });
      limited = r.body.limited;
    }
    expect(limited).toBe(true);
  });

  it('archives drafts and keeps them private', async () => {
    const d = await api.req<Draft>('POST', '/drafts', { token, body: { body: 'hello' } });
    await api.req('PATCH', `/drafts/${d.body.id}`, { token, body: { archived: true } });
    const archived = await api.req<{ items: { id: string }[] }>('GET', '/drafts?archived=true', {
      token,
    });
    expect(archived.body.items.some((x) => x.id === d.body.id)).toBe(true);
    const other = await api.signIn();
    expect((await api.req('GET', `/drafts/${d.body.id}`, { token: other.token })).status).toBe(404);
    expect(userId).toBeTruthy();
  });
});
