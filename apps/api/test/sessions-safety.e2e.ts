import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApi, type Api } from './helpers.js';

interface Result {
  checkIn: { id: string };
  card: { id: string; light: string; primary: { pathway?: string; toolId?: string } };
}
interface Session {
  id: string;
  completed: boolean;
  endedAt: string | null;
  pausedAt: string | null;
  feedback: {
    outcome: string;
    offerRecheck: boolean;
    recheckRule: string | null;
    recoveryEndsAt: string | null;
  } | null;
}

let api: Api;
let token: string;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  api = await bootApi();
  ({ token } = await api.signIn());
});
afterAll(() => api.close());

describe('sessions, feedback and the re-check', () => {
  it('runs a session, asks for a re-check and opens Blue recovery when it improved', async () => {
    const first = await api.req<Result>('POST', '/check-ins', {
      token,
      body: {
        state: { kind: 'grid', energy: 3, mood: 1 },
        emotions: [{ code: 'frustrated', intensity: 8 }],
        context: { environment: 'home', social: 'alone' },
      },
    });
    expect(['amber', 'red', 'yellow']).toContain(first.body.card.light);
    const s = await api.req<Session>('POST', '/sessions', {
      token,
      body: { recommendationId: first.body.card.id, pathway: 'regulate', toolId: 'breathe' },
    });
    expect(s.status).toBe(201);
    const paused = await api.req<Session>('PATCH', `/sessions/${s.body.id}`, {
      token,
      body: { paused: true, remainingSeconds: 60 },
    });
    expect(paused.body.pausedAt).not.toBeNull();
    const done = await api.req<Session>('PATCH', `/sessions/${s.body.id}`, {
      token,
      body: { paused: false, completed: true, lengthSeconds: 120 },
    });
    expect(done.body.completed).toBe(true);
    expect(done.body.endedAt).not.toBeNull();
    const fb = await api.req<Session>('POST', `/sessions/${s.body.id}/feedback`, {
      token,
      body: { outcome: 'helped', helpful: 4 },
    });
    expect(fb.body.feedback?.offerRecheck).toBe(true);

    const recheck = await api.req<Result>('POST', '/check-ins', {
      token,
      body: {
        entry: 'recheck',
        recheckOfId: first.body.checkIn.id,
        state: { kind: 'grid', energy: 3, mood: 3 },
        emotions: [{ code: 'frustrated', intensity: 3 }],
      },
    });
    expect(recheck.body.card.light).toBe('blue');
    await wait(200);
    const after = await api.req<Session>('GET', `/sessions/${s.body.id}`, { token });
    expect(after.body.feedback?.recheckRule).toBe('RC-1');
    expect(after.body.feedback?.recoveryEndsAt).not.toBeNull();
    expect(after.body.feedback?.offerRecheck).toBe(false);
  });

  it('does not turn Blue when the re-check did not improve', async () => {
    const first = await api.req<Result>('POST', '/check-ins', {
      token,
      body: {
        state: { kind: 'grid', energy: 3, mood: 1 },
        emotions: [{ code: 'frustrated', intensity: 7 }],
      },
    });
    const s = await api.req<Session>('POST', '/sessions', {
      token,
      body: { recommendationId: first.body.card.id, pathway: 'regulate', toolId: 'move' },
    });
    await api.req('PATCH', `/sessions/${s.body.id}`, { token, body: { completed: true } });
    await api.req('POST', `/sessions/${s.body.id}/feedback`, {
      token,
      body: { outcome: 'not_really' },
    });
    const recheck = await api.req<Result>('POST', '/check-ins', {
      token,
      body: {
        entry: 'recheck',
        recheckOfId: first.body.checkIn.id,
        state: { kind: 'grid', energy: 3, mood: 1 },
        emotions: [{ code: 'frustrated', intensity: 7 }],
      },
    });
    expect(recheck.body.card.light).not.toBe('blue');
    expect(recheck.body.card.primary.toolId).not.toBe('move');
  });

  it('lists sessions by pathway and keeps them private', async () => {
    const list = await api.req<{ items: Session[] }>('GET', '/sessions?pathway=regulate', {
      token,
    });
    expect(list.body.items.length).toBeGreaterThanOrEqual(2);
    const other = await api.signIn();
    const res = await api.req('GET', `/sessions/${String(list.body.items[0]?.id)}`, {
      token: other.token,
    });
    expect(res.status).toBe(404);
    const start = await api.req('POST', '/sessions', {
      token: other.token,
      body: {
        recommendationId: (
          await api.req<Result>('POST', '/check-ins', {
            token,
            body: { state: { kind: 'grid', energy: 4, mood: 4 } },
          })
        ).body.card.id,
        pathway: 'regulate',
        toolId: 'breathe',
      },
    });
    expect(start.status).toBe(404);
  });
});

describe('safety', () => {
  it('serves crisis routes signed out and logs Help opens from Browse mode', async () => {
    const routes = await api.req<{ routes: { href: string }[] }>('GET', '/safety/routes?region=GB');
    expect(routes.status).toBe(200);
    expect(routes.body.routes.some((r) => r.href === 'tel:999')).toBe(true);
    const anon = await api.req('POST', '/safety/events', {
      body: { sourceModule: 'help', trigger: 'button' },
    });
    expect(anon.status).toBe(401);
    const browse = await api.req('POST', '/safety/events', {
      body: { sourceModule: 'help', trigger: 'button', routeChosen: 'samaritans' },
      headers: { 'x-browse-token': 'device-token-abcdefghijklmnop' },
    });
    expect(browse.status).toBe(202);
  });

  it('screens Browse text with the server phrase rules, storing no text (E-59)', async () => {
    const browse = { 'x-browse-token': 'device-token-abcdefghijklmnop' };
    const risky = await api.req<{ safety: boolean; category: string | null }>(
      'POST',
      '/safety/screen',
      {
        headers: browse,
        body: { sourceModule: 'dump', texts: ['groceries', 'I want to kill myself'] },
      },
    );
    expect(risky.status).toBe(200);
    expect(risky.body.safety).toBe(true);
    expect(risky.body.category).not.toBeNull();
    const calm = await api.req<{ safety: boolean }>('POST', '/safety/screen', {
      headers: browse,
      body: { sourceModule: 'reflect', texts: ['I am dying to see the new film'] },
    });
    expect(calm.body).toEqual({ safety: false, category: null });
    expect(
      (await api.req('POST', '/safety/screen', { body: { sourceModule: 'dump', texts: ['x'] } }))
        .status,
    ).toBe(401);
  });

  it('keeps an encrypted support plan', async () => {
    const empty = await api.req<{ messages: string[] }>('GET', '/me/support-plan', { token });
    expect(empty.body.messages).toEqual([]);
    const saved = await api.req<{ whatHelps: string; messages: string[] }>(
      'PUT',
      '/me/support-plan',
      {
        token,
        body: {
          whatHelps: 'Dim lights and a weighted blanket',
          messages: ['I am having a hard time, can you call me?'],
          preferredRoutes: ['shout'],
        },
      },
    );
    expect(saved.body.whatHelps).toBe('Dim lights and a weighted blanket');
    const stale = await api.req<{ whatHelps: string }>('PUT', '/me/support-plan', {
      token,
      body: { whatHelps: 'old', clientUpdatedAt: '2020-01-01T00:00:00Z' },
    });
    expect(stale.body.whatHelps).toBe('Dim lights and a weighted blanket');
  });

  it('manages trusted contacts with limits', async () => {
    const bad = await api.req('POST', '/me/trusted-contacts', {
      token,
      body: { name: 'No way to reach' },
    });
    expect(bad.status).toBe(400);
    const a = await api.req<{ id: string; name: string; consentConfirmed: boolean }>(
      'POST',
      '/me/trusted-contacts',
      {
        token,
        body: {
          name: 'Sam',
          phone: '+44 7700 900123',
          contactWhen: ['connect', 'sos'],
          consentConfirmed: true,
        },
      },
    );
    expect(a.status).toBe(201);
    expect(a.body.consentConfirmed).toBe(true);
    const upd = await api.req<{ relationship: string }>(
      'PATCH',
      `/me/trusted-contacts/${a.body.id}`,
      { token, body: { relationship: 'friend' } },
    );
    expect(upd.body.relationship).toBe('friend');
    const clear = await api.req('PATCH', `/me/trusted-contacts/${a.body.id}`, {
      token,
      body: { phone: null },
    });
    expect(clear.status).toBe(400);
    for (let i = 0; i < 4; i += 1)
      await api.req('POST', '/me/trusted-contacts', {
        token,
        body: { name: `P${String(i)}`, email: `p${String(i)}@example.test` },
      });
    const sixth = await api.req('POST', '/me/trusted-contacts', {
      token,
      body: { name: 'Too many', email: 'x@example.test' },
    });
    expect(sixth.status).toBe(400);
    const del = await api.req('DELETE', `/me/trusted-contacts/${a.body.id}`, { token });
    expect(del.status).toBe(204);
    const list = await api.req<{ items: unknown[] }>('GET', '/me/trusted-contacts', { token });
    expect(list.body.items).toHaveLength(4);
  });
});
