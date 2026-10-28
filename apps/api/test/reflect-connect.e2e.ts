import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApi, type Api } from './helpers.js';

interface Gate {
  allowed: boolean;
  reason: string;
  alternatives: { href: string }[];
}

let api: Api;
let token: string;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  api = await bootApi();
  ({ token } = await api.signIn());
});
afterAll(() => api.close());

const answers = [
  { promptId: 'what_happened', chips: ['A meeting'] },
  { promptId: 'what_helped', chips: [], text: 'Writing it down helped' },
  { promptId: 'take_forward', chips: ['Ask earlier'] },
];

describe('content', () => {
  it('serves defaults signed out', async () => {
    const res = await api.req<{ items: { key: string; body: unknown[] }[] }>('GET', '/content');
    expect(res.status).toBe(200);
    expect(res.body.items.find((i) => i.key === 'reflect.variants')?.body.length).toBeGreaterThan(
      3,
    );
    expect(res.headers['cache-control']).toContain('max-age');
  });
});

describe('reflect', () => {
  it('gates by light: Red regulates first, Amber saves for later, a win is always fine', async () => {
    const { token: t } = await api.signIn();
    expect((await api.req<Gate>('GET', '/reflect/gate', { token: t })).body.allowed).toBe(true);
    await api.req('POST', '/check-ins', {
      token: t,
      body: { state: { kind: 'grid', energy: 1, mood: 1 } },
    });
    const red = await api.req<Gate>('GET', '/reflect/gate', { token: t });
    expect(red.body).toMatchObject({ allowed: false, reason: 'regulate_first' });
    expect(red.body.alternatives[0]?.href).toBe('/dump/');
    expect(
      (await api.req<Gate>('GET', '/reflect/gate?variant=win', { token: t })).body.allowed,
    ).toBe(true);
    await api.req('POST', '/check-ins', {
      token: t,
      body: {
        state: { kind: 'grid', energy: 3, mood: 3 },
        emotions: [{ code: 'frustrated', intensity: 8 }],
      },
    });
    expect((await api.req<Gate>('GET', '/reflect/gate', { token: t })).body.reason).toBe(
      'save_for_later',
    );
  });

  it('saves a reflection privately, lists it and blocks rumination on the same topic', async () => {
    for (let i = 0; i < 3; i += 1) {
      const r = await api.req<{
        id: string;
        answers: { prompt: string; text: string | null }[];
        safety: boolean;
      }>('POST', '/reflections', {
        token,
        body: {
          variant: 'make_sense',
          answers,
          takeaway: 'Ask for slides early',
          topicTag: 'seminar',
        },
      });
      expect(r.status).toBe(201);
      expect(r.body.safety).toBe(false);
      expect(r.body.answers[1]).toMatchObject({
        prompt: 'What helped, even a little?',
        text: 'Writing it down helped',
      });
    }
    const gate = await api.req<Gate>('GET', '/reflect/gate?topicTag=seminar', { token });
    expect(gate.body.reason).toBe('rumination');
    const other = await api.req<Gate>('GET', '/reflect/gate?topicTag=family', { token });
    expect(other.body.allowed).toBe(true);
    const list = await api.req<{ items: unknown[] }>('GET', '/reflections?kind=prompts', { token });
    expect(list.body.items).toHaveLength(3);
    const patterns = await api.req<{ cards: { code: string }[]; saved: { takeaway: string }[] }>(
      'GET',
      '/patterns',
      { token },
    );
    expect(patterns.body.cards.some((c) => c.code === 'recurring_topic')).toBe(true);
    expect(patterns.body.saved[0]?.takeaway).toBe('Ask for slides early');
  });

  it('keeps wins, saves for later and screens risk text', async () => {
    const win = await api.req<{ kind: string; winSize: string }>('POST', '/reflections', {
      token,
      body: {
        variant: 'win',
        answers: [{ promptId: 'win', chips: ['Asked for help'] }],
        winSize: 'huge',
      },
    });
    expect(win.body).toMatchObject({ kind: 'win', winSize: 'huge' });
    await api.req('POST', '/reflections', {
      token,
      body: { variant: 'make_sense', answers: [], savedForLater: true, saved: false },
    });
    const later = await api.req<{ items: unknown[] }>('GET', '/reflections?kind=later', { token });
    expect(later.body.items).toHaveLength(1);
    const risk = await api.req<{ safety: boolean; crisisRoutes: unknown[] }>(
      'POST',
      '/reflections',
      {
        token,
        body: {
          variant: 'journal',
          answers: [{ promptId: 'entry', text: 'I feel like ending my life' }],
        },
      },
    );
    expect(risk.body.safety).toBe(true);
    expect(risk.body.crisisRoutes.length).toBeGreaterThan(0);
    const bad = await api.req('POST', '/reflections', {
      token,
      body: { variant: 'make_sense', answers: [{ promptId: 'nope' }] },
    });
    expect(bad.status).toBe(400);
  });

  it('keeps Advanced prompt sets and the monthly summary for Plus', async () => {
    expect(
      (
        await api.req('POST', '/reflections', {
          token,
          body: { variant: 'what_helped', answers: [] },
        })
      ).status,
    ).toBe(402);
    expect((await api.req('GET', '/patterns/monthly', { token })).status).toBe(402);
    const plus = await api.signIn();
    await api.grantPlus(plus.userId);
    await api.req('POST', '/check-ins', {
      token: plus.token,
      body: { state: { kind: 'grid', energy: 3, mood: 3 } },
    });
    const m = await api.req<{ checkIns: number; harderDays: unknown[] }>(
      'GET',
      '/patterns/monthly',
      { token: plus.token },
    );
    expect(m.status).toBe(200);
    expect(m.body.checkIns).toBe(1);
    expect(m.body.harderDays).toHaveLength(7);
  });

  it('marks a dump item as reflected on', async () => {
    const d = await api.req<{ items: { id: string }[] }>('POST', '/dumps', {
      token,
      body: { text: 'The meeting went badly' },
    });
    const id = d.body.items[0]?.id;
    await api.req('POST', '/reflections', {
      token,
      body: { variant: 'make_sense', dumpItemId: id, answers: [] },
    });
    await wait(200);
    const after = await api.req<{ items: { movedTo: string | null }[] }>(
      'GET',
      `/dumps/${(d.body as unknown as { id: string }).id}`,
      { token },
    );
    expect(after.body.items[0]?.movedTo).toBe('reflection');
  });
});

describe('practices', () => {
  it('adds a scheduled prayer and feeds it to the engine', async () => {
    const { token: t } = await api.signIn();
    const p = await api.req<{ id: string; nextAt: string; name: string }>('POST', '/practices', {
      token: t,
      body: {
        type: 'prayer',
        name: 'Midday prayer',
        scheduleRule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=12;BYMINUTE=45',
        minutes: 10,
        helpsWhenStruggling: true,
      },
    });
    expect(p.status).toBe(201);
    expect(p.body.nextAt).toBeTruthy();
    const bad = await api.req('POST', '/practices', {
      token: t,
      body: { type: 'prayer', name: 'x', scheduleRule: 'every day' },
    });
    expect(bad.status).toBe(400);
    await api.req('PATCH', `/practices/${p.body.id}`, {
      token: t,
      body: { makesMeWorse: false, name: 'Dhuhr' },
    });
    const list = await api.req<{ items: { name: string }[] }>('GET', '/practices', { token: t });
    expect(list.body.items[0]?.name).toBe('Dhuhr');
    const card = await api.req<{
      card: { primary: { kind: string }; alternatives: { kind: string }[] };
    }>('POST', '/check-ins', {
      token: t,
      body: {
        state: { kind: 'grid', energy: 2, mood: 2 },
        emotions: [{ code: 'grief', intensity: 5 }],
        context: { environment: 'home' },
      },
    });
    const kinds = [card.body.card.primary.kind, ...card.body.card.alternatives.map((a) => a.kind)];
    expect(kinds).toContain('own_practice');
    expect((await api.req('DELETE', `/practices/${p.body.id}`, { token: t })).status).toBe(204);
  });
});

describe('connect and adapt', () => {
  it('composes a message with send links for a trusted person', async () => {
    const c = await api.req<{ id: string }>('POST', '/me/trusted-contacts', {
      token,
      body: { name: 'Ope', phone: '+44 7700 900123' },
    });
    const home = await api.req<{
      contacts: unknown[];
      starters: { id: string }[];
      rooms: { available: boolean };
    }>('GET', '/connect', { token });
    expect(home.body.contacts).toHaveLength(1);
    expect(home.body.rooms.available).toBe(false);
    const msg = await api.req<{
      text: string;
      contactName: string;
      links: { sms: string; whatsapp: string };
    }>('POST', '/connect/compose', {
      token,
      body: { contactId: c.body.id, starterCode: 'text_later' },
    });
    expect(msg.body.contactName).toBe('Ope');
    expect(msg.body.links.sms).toMatch(/^sms:\+447700900123/);
    expect(msg.body.links.whatsapp).toContain('wa.me/447700900123');
    const own = await api.req<{ savedStarterId: string }>('POST', '/connect/compose', {
      token,
      body: { text: 'Fancy a quiet walk later?', save: true },
    });
    expect(own.body.savedStarterId).toBeTruthy();
    const again = await api.req<{ starters: { own: boolean; text: string }[] }>('GET', '/connect', {
      token,
    });
    expect(again.body.starters[0]).toMatchObject({ own: true, text: 'Fancy a quiet walk later?' });
    const g = await api.req<{ id: string }>('POST', '/connect/groups', {
      token,
      body: { name: 'Thursday choir', kind: 'community' },
    });
    expect((await api.req('DELETE', `/connect/groups/${g.body.id}`, { token })).status).toBe(204);
  });

  it('lists adaptations with favourites first', async () => {
    const res = await api.req<{
      kinds: { kind: string; options: { code: string; saved: boolean }[] }[];
      commCards: unknown[];
    }>('GET', '/adapt', { token });
    expect(res.body.kinds.map((k) => k.kind)).toContain('scope');
    expect(res.body.commCards.length).toBeGreaterThan(3);
  });
});
