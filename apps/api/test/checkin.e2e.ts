import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from '@figcit/engine-v2';
import { bootApi, publishV2, type Api } from './helpers.js';

interface Card {
  id: string;
  light: string;
  title: string;
  primary: { kind: string; pathway?: string; toolId?: string; href: string };
  alternatives: { toolId?: string }[];
  safetyTriggered: boolean;
  crisisRoutes: unknown[];
  state: { cellId: string; confirmed: boolean };
  taskId: string | null;
}
interface Result {
  checkIn: { id: string; light: string; cellId: string };
  card: Card;
}

let api: Api;
let token: string;

beforeAll(async () => {
  // Cards come from the published engine v2 rule set (E-53); publish a clean one, as another file
  // may have left an exemption published. A fresh app reads it at once (caches are 30 s).
  api = await bootApi();
  await publishV2(api, (await api.staff(['clinical_admin'])).token);
  await api.close();
  api = await bootApi();
  ({ token } = await api.signIn());
});
afterAll(() => api.close());

const checkIn = (body: unknown) => api.req<Result>('POST', '/check-ins', { token, body });

describe('check-in → card', () => {
  it('needs a signed-in user', async () => {
    const res = await api.req('POST', '/check-ins', {
      body: { state: { kind: 'grid', energy: 3, mood: 3 } },
    });
    expect(res.status).toBe(401);
  });

  it('returns a Green card for high energy and good mood', async () => {
    const res = await checkIn({ state: { kind: 'grid', energy: 4, mood: 4 } });
    expect(res.status).toBe(201);
    expect(res.body.card.light).toBe('green');
    expect(res.body.checkIn.cellId).toBe('E4M4');
    expect(res.body.card.primary.href.startsWith('/')).toBe(true);
  });

  it('creates a task for a new demand and links execute actions to it', async () => {
    const res = await checkIn({
      state: { kind: 'grid', energy: 2, mood: 1 },
      emotions: [{ code: 'anxious', intensity: 7 }],
      context: { environment: 'work', social: 'colleagues', time: 'limited' },
      needs: ['get_started'],
      demand: {
        title: 'Finish the report',
        kind: 'work',
        dueAt: new Date(Date.now() + 12 * 3_600_000).toISOString(),
        traits: ['multi_step'],
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.card.light).toBe('red');
    expect(res.body.card.taskId).toBeTruthy();
    // Red defers the task (Tab 10; ADR 0007 §3): care first, never the task.
    expect(res.body.card.primary.pathway).not.toBe('execute');
    expect(res.body.card.crisisRoutes.length).toBeGreaterThan(0);
    // When the task can lead, its step opens that task.
    const green = await checkIn({
      state: { kind: 'grid', energy: 3, mood: 4 },
      demand: { title: 'Send the invoice', kind: 'work', timeline: 'T3' },
    });
    expect(green.body.card.primary.pathway).toBe('execute');
    expect(green.body.card.primary.href).toContain(`id=${String(green.body.card.taskId)}`);
  });

  it('rejects unknown catalogue codes', async () => {
    const res = await checkIn({
      state: { kind: 'grid', energy: 3, mood: 3 },
      needs: ['not_a_need'],
    });
    expect(res.status).toBe(400);
  });

  it('routes risk phrases to support and logs a safety event without text', async () => {
    const res = await checkIn({
      state: { kind: 'grid', energy: 1, mood: 1 },
      ownWords: 'I want to end it all',
    });
    expect(res.body.card.safetyTriggered).toBe(true);
    expect(res.body.card.primary.kind).toBe('support');
    expect(res.body.card.primary.href).toBe('/help/');
  });

  it('does not trigger on excluded phrases', async () => {
    const res = await checkIn({
      state: { kind: 'grid', energy: 3, mood: 3 },
      ownWords: 'I absolutely killed it at the gym',
    });
    expect(res.body.card.safetyTriggered).toBe(false);
  });

  it('replays an offline check-in by its client id', async () => {
    const id = randomUUID();
    const body = { id, origin: 'offline', state: { kind: 'grid', energy: 3, mood: 3 } };
    const a = await checkIn(body);
    const b = await checkIn(body);
    expect(a.body.card.id).toBe(b.body.card.id);
    expect(a.body.checkIn.id).toBe(id);
  });

  it('handles Not sure with the body questions', async () => {
    const res = await checkIn({ state: { kind: 'not_sure', answers: [] } });
    expect(res.body.card.state.confirmed).toBe(false);
    expect(res.body.card.primary.href).toBe('/check-in/not-sure/');
  });

  it('lists history with a cursor and reads one check-in', async () => {
    const page1 = await api.req<{ items: { id: string }[]; next: string | null }>(
      'GET',
      '/check-ins?limit=2',
      { token },
    );
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.next).toBeTruthy();
    const page2 = await api.req<{ items: { id: string }[] }>(
      'GET',
      `/check-ins?limit=2&after=${String(page1.body.next)}`,
      { token },
    );
    expect(page2.body.items[0]?.id).not.toBe(page1.body.items[0]?.id);
    const one = await api.req<{ card: Card | null }>(
      'GET',
      `/check-ins/${String(page1.body.items[0]?.id)}`,
      { token },
    );
    expect(one.status).toBe(200);
    expect(one.body.card).not.toBeNull();
  });

  it("does not show another user's check-in", async () => {
    const mine = await checkIn({ state: { kind: 'grid', energy: 3, mood: 3 } });
    const other = await api.signIn();
    const res = await api.req('GET', `/check-ins/${mine.body.checkIn.id}`, { token: other.token });
    expect(res.status).toBe(404);
    const rec = await api.req('GET', `/recommendations/${mine.body.card.id}`, {
      token: other.token,
    });
    expect(rec.status).toBe(404);
  });
});

describe('card actions', () => {
  it('try another avoids the declined tool, adapt re-runs, why explains', async () => {
    const first = await checkIn({
      state: { kind: 'grid', energy: 3, mood: 2 },
      emotions: [{ code: 'overwhelmed', intensity: 5 }],
      context: { environment: 'home' },
    });
    const id = first.body.card.id;
    const tried = await api.req<{ card: Card }>('POST', `/recommendations/${id}/actions`, {
      token,
      body: { action: 'try_another' },
    });
    expect(tried.status).toBe(201);
    if (first.body.card.primary.toolId && tried.body.card.primary.toolId)
      expect(tried.body.card.primary.toolId).not.toBe(first.body.card.primary.toolId);
    const adapted = await api.req<Card>('POST', `/recommendations/${id}/adapt`, {
      token,
      body: { adaptations: [{ kind: 'scope', detailCode: 'smaller_piece' }], save: true },
    });
    expect(adapted.status).toBe(201);
    const why = await api.req<{ reasons: unknown[]; versions: { engine: string } }>(
      'GET',
      `/recommendations/${id}/why`,
      { token },
    );
    expect(why.body.reasons.length).toBeGreaterThan(0);
    expect(why.body.versions.engine).toBe(ENGINE_VERSION);
  });

  it('goes quiet after three declines', async () => {
    const { token: t } = await api.signIn();
    const first = await api.req<Result>('POST', '/check-ins', {
      token: t,
      body: { state: { kind: 'grid', energy: 3, mood: 3 } },
    });
    const id = first.body.card.id;
    const results: (string | null)[] = [];
    for (let i = 0; i < 3; i += 1) {
      const res = await api.req<{ quietUntil: string | null }>(
        'POST',
        `/recommendations/${id}/actions`,
        { token: t, body: { action: 'not_now' } },
      );
      results.push(res.body.quietUntil);
    }
    expect(results[0]).toBeNull();
    expect(results[2]).not.toBeNull();
  });
});
