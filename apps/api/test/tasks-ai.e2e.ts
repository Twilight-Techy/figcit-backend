import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFakeModel, type FakeModel } from './fake-model.js';
import { bootApi, type Api } from './helpers.js';

interface Task {
  id: string;
  title: string;
  status: string;
  timeline: string | null;
  dueAt: string | null;
  steps: { id: string; text: string; done: boolean; source: string }[];
}

let api: Api;
let model: FakeModel;
let token: string;

beforeAll(async () => {
  model = await startFakeModel();
  api = await bootApi({ AI_BASE_URL: model.url });
  ({ token } = await api.signIn());
});
afterAll(async () => {
  await api.close();
  await model.close();
});

describe('tasks', () => {
  it('creates, lists, edits steps and finishes a task', async () => {
    const t = await api.req<Task>('POST', '/tasks', {
      token,
      body: {
        title: 'Email my tutor',
        kind: 'study',
        dueAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        steps: ['Open a draft'],
      },
    });
    expect(t.status).toBe(201);
    expect(t.body.timeline).toBe('T0');
    expect(t.body.steps[0]?.text).toBe('Open a draft');
    const s = await api.req<Task>('PUT', `/tasks/${t.body.id}/steps`, {
      token,
      body: { steps: [{ text: 'Open a draft', done: true }, { text: 'Write one line' }] },
    });
    expect(s.body.steps.map((x) => x.done)).toEqual([true, false]);
    const done = await api.req<Task>('PATCH', `/tasks/${t.body.id}`, {
      token,
      body: { status: 'done' },
    });
    expect(done.body.status).toBe('done');
    const open = await api.req<{ items: Task[] }>('GET', '/tasks', { token });
    expect(open.body.items.find((x) => x.id === t.body.id)).toBeUndefined();
    const finished = await api.req<{ items: Task[] }>('GET', '/tasks?status=done', { token });
    expect(finished.body.items.some((x) => x.id === t.body.id)).toBe(true);
  });

  it('keeps what Adapt changed: pace and codes on the task, later and codes on a step', async () => {
    const t = await api.req<Task>('POST', '/tasks', {
      token,
      body: { title: 'Write the report', steps: ['Open the file', 'Write the intro'] },
    });
    expect(t.body).toMatchObject({ stepMinutes: null, breakMinutes: null, adaptCodes: [] });
    const paced = await api.req<Task & { stepMinutes: number; adaptCodes: string[] }>(
      'PATCH',
      `/tasks/${t.body.id}`,
      {
        token,
        body: { stepMinutes: 10, breakMinutes: 2, adaptCodes: ['block_sound', 'block_sound'] },
      },
    );
    expect(paced.body).toMatchObject({
      stepMinutes: 10,
      breakMinutes: 2,
      adaptCodes: ['block_sound'],
    });
    const s = await api.req<{ steps: { later: boolean; adaptCodes: string[] }[] }>(
      'PUT',
      `/tasks/${t.body.id}/steps`,
      {
        token,
        body: {
          steps: [
            { text: 'Open the file', adaptCodes: ['first_sentence', 'speak_it'] },
            { text: 'Write the intro', later: true },
          ],
        },
      },
    );
    expect(s.body.steps.map((x) => [x.later, x.adaptCodes])).toEqual([
      [false, ['first_sentence', 'speak_it']],
      [true, []],
    ]);
    const bad = await api.req('PATCH', `/tasks/${t.body.id}`, {
      token,
      body: { adaptCodes: ['Not a code!'] },
    });
    expect(bad.status).toBe(400);
  });

  it('rolls a recurring task forward when done', async () => {
    const t = await api.req<Task>('POST', '/tasks', {
      token,
      body: {
        title: 'Bins out',
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO;BYHOUR=19;BYMINUTE=0',
        dueAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    });
    const done = await api.req<Task>('PATCH', `/tasks/${t.body.id}`, {
      token,
      body: { status: 'done' },
    });
    expect(done.body.status).toBe('open');
    expect(new Date(String(done.body.dueAt)).getTime()).toBeGreaterThan(
      new Date(String(t.body.dueAt)).getTime(),
    );
  });

  it('ignores an older offline edit', async () => {
    const t = await api.req<Task>('POST', '/tasks', { token, body: { title: 'Fresh title' } });
    const stale = await api.req<Task>('PATCH', `/tasks/${t.body.id}`, {
      token,
      body: { title: 'Old title', clientUpdatedAt: '2020-01-01T00:00:00Z' },
    });
    expect(stale.body.title).toBe('Fresh title');
  });

  it('orders open tasks for the current light with a why', async () => {
    const { token: t } = await api.signIn();
    await api.req('POST', '/tasks', {
      token: t,
      body: { title: 'Big new project', drivers: ['challenge', 'novelty'], timeline: 'T3' },
    });
    await api.req('POST', '/tasks', {
      token: t,
      body: { title: 'Weekly shop', drivers: ['routine'], timeline: 'T3' },
    });
    const before = await api.req<{
      lightKnown: boolean;
      items: { title: string; whyNowText: string }[];
    }>('GET', '/tasks/ordered', { token: t });
    expect(before.body.lightKnown).toBe(false);
    await api.req('POST', '/check-ins', {
      token: t,
      body: { state: { kind: 'grid', energy: 1, mood: 1 } },
    });
    const after = await api.req<{ light: string; items: { title: string; onlyIfMust: boolean }[] }>(
      'GET',
      '/tasks/ordered',
      { token: t },
    );
    expect(after.body.light).toBe('red');
    expect(after.body.items[0]?.title).toBe('Weekly shop');
    expect(after.body.items.find((i) => i.title === 'Big new project')?.onlyIfMust).toBe(true);
  });

  it('keeps tasks private', async () => {
    const t = await api.req<Task>('POST', '/tasks', { token, body: { title: 'Mine' } });
    const other = await api.signIn();
    expect((await api.req('GET', `/tasks/${t.body.id}`, { token: other.token })).status).toBe(404);
    expect(
      (await api.req('PATCH', `/tasks/${t.body.id}`, { token: other.token, body: { title: 'x' } }))
        .status,
    ).toBe(404);
    expect((await api.req('DELETE', `/tasks/${t.body.id}`, { token: other.token })).status).toBe(
      404,
    );
  });
});

describe('AI with a model server', () => {
  it('uses valid model steps, within the step cap', async () => {
    const t = await api.req<Task>('POST', '/tasks', {
      token,
      body: { title: 'Write the report', timeline: 'T0' },
    });
    model.reply(
      JSON.stringify({
        steps: [
          { text: 'Open the report', minutes: 2 },
          { text: 'Write the summary line', minutes: 5 },
        ],
        estimatedDemand: 'low',
      }),
    );
    const res = await api.req<{ source: string; saved: boolean; task: Task }>(
      'POST',
      `/tasks/${t.body.id}/break-down`,
      { token, body: {} },
    );
    expect(res.body.source).toBe('ai');
    expect(res.body.saved).toBe(true);
    expect(res.body.task.steps.map((s) => s.source)).toEqual(['ai', 'ai']);
    const sent = model.requests.at(-1)?.body.messages[1]?.content ?? '';
    expect(sent).toContain('<user_words>');
  });

  it('falls back to templates when the model breaks the rules or fails', async () => {
    const t = await api.req<Task>('POST', '/tasks', {
      token,
      body: { title: 'Email my tutor', timeline: 'T0' },
    });
    model.reply(
      JSON.stringify({
        steps: [{ text: 'You should have finally done this', minutes: 2 }],
        estimatedDemand: 'low',
      }),
    );
    const blamed = await api.req<{ source: string; steps: unknown[] }>(
      'POST',
      `/tasks/${t.body.id}/break-down`,
      { token, body: { save: false } },
    );
    expect(blamed.body.source).toBe('fallback');
    expect(blamed.body.steps.length).toBeLessThanOrEqual(3);
    model.fail(500);
    const failed = await api.req<{ source: string }>('POST', `/tasks/${t.body.id}/break-down`, {
      token,
      body: { save: false },
    });
    expect(failed.body.source).toBe('fallback');
  });

  it('parses needs only into real codes and screens risk text before the model', async () => {
    model.reply(
      JSON.stringify({ needs: ['not_a_code'], heard: [], task: null, supportOnly: false }),
    );
    const bad = await api.req<{ safety: boolean; source: string; needs: string[] }>(
      'POST',
      '/ai/parse-need',
      { token, body: { text: "I'm overwhelmed and need to finish my essay" } },
    );
    expect(bad.body.source).toBe('fallback');
    expect(bad.body.needs).toContain('feel_calmer');
    const calls = model.requests.length;
    const risk = await api.req<{ safety: boolean; crisisRoutes: unknown[] }>(
      'POST',
      '/ai/parse-need',
      { token, body: { text: 'I want to kill myself' } },
    );
    expect(risk.body.safety).toBe(true);
    expect(risk.body.crisisRoutes.length).toBeGreaterThan(0);
    expect(model.requests.length).toBe(calls);
  });

  it('maps feelings to chips and asks below 0.7 confidence (Tab 11 layer 3)', async () => {
    type Mapped = {
      source: string;
      selected: string[];
      ask: { options: { code: string; label: string }[] } | null;
    };
    // Decision scoring: labels follow the chip order (A = anxious, C = tired, E = overwhelmed).
    model.decide({ A: 0.92, B: 0.08 });
    const sure = await api.req<Mapped>('POST', '/ai/map-feeling', {
      token,
      body: { text: 'My chest is tight and I keep worrying' },
    });
    expect(sure.body).toMatchObject({ source: 'ai', selected: ['anxious'], ask: null });
    model.decide({ E: 0.55, C: 0.45 });
    const unsure = await api.req<Mapped>('POST', '/ai/map-feeling', {
      token,
      body: { text: 'just a lot today' },
    });
    expect(unsure.body.selected).toEqual([]);
    expect(unsure.body.ask?.options.map((o) => o.code)).toEqual(['overwhelmed', 'tired']);
    // The model server failing: the keyword rules answer instead.
    model.fail(500);
    const down = await api.req<Mapped>('POST', '/ai/map-feeling', {
      token,
      body: { text: 'I feel anxious' },
    });
    expect(down.body).toMatchObject({ source: 'fallback', selected: ['anxious'] });
  });

  it("splits tasks only into the user's own words (Tab 11 layer 6)", async () => {
    model.reply(JSON.stringify({ tasks: ['Email Sam', 'Finish the report'] }));
    const ok = await api.req<{ source: string; tasks: string[] }>('POST', '/ai/split-tasks', {
      token,
      body: { text: 'email Sam and finish the report' },
    });
    expect(ok.body).toMatchObject({ source: 'ai', tasks: ['Email Sam', 'Finish the report'] });
    model.reply(JSON.stringify({ tasks: ['Email Sam', 'Book a holiday'] }));
    const invented = await api.req<{ source: string; tasks: string[] }>('POST', '/ai/split-tasks', {
      token,
      body: { text: 'email Sam and finish the report' },
    });
    expect(invented.body.source).toBe('fallback');
    expect(invented.body.tasks).toEqual(['Email Sam', 'Finish the report']);
  });

  it('suggests drivers in Browse mode', async () => {
    // Decision scoring: A novelty, B challenge, C routine … H none.
    model.decide({ C: 0.9, H: 0.1 });
    const res = await api.req<{ drivers: string[]; source: string }>(
      'POST',
      '/ai/suggest-drivers',
      {
        body: { title: 'Weekly timesheet' },
        headers: { 'x-browse-token': 'browse-device-token-1234567890' },
      },
    );
    expect(res.status).toBe(201);
    expect(res.body.drivers).toEqual(['routine']);
  });
  it('orders Browse tasks from what ordering reads, never their titles (E-59)', async () => {
    const browse = { 'x-browse-token': 'browse-device-token-1234567890' };
    const task = (id: string, over: object) => ({
      id,
      timeline: null,
      drivers: [],
      stepsLeft: 3,
      puttingOff: false,
      skipCount: 0,
      planSlot: null,
      ...over,
    });
    const later = '0190a000-0000-7000-8000-000000000001';
    const now = '0190a000-0000-7000-8000-000000000002';
    const res = await api.req<{ items: { id: string; whyNow: string; onlyIfMust: boolean }[] }>(
      'POST',
      '/tasks/order',
      {
        headers: browse,
        body: {
          light: 'green',
          tasks: [task(later, { timeline: 'T6' }), task(now, { timeline: 'T0' })],
        },
      },
    );
    expect(res.status).toBe(200);
    expect(res.body.items.map((i) => i.id)).toEqual([now, later]);
    const titled = await api.req('POST', '/tasks/order', {
      headers: browse,
      body: { light: 'green', tasks: [{ ...task(now, {}), title: 'Essay' }] },
    });
    expect(titled.status).toBe(400);
  });
});
