// The staff check-in Simulator (E-61): a check-in as the app sends it, through any version, with
// every step shown, giving exactly the engine input a real check-in gives; nothing is stored.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/db/prisma.service.js';
import type { SimulateCheckInResult } from '../src/modules/decisions/simulator.schemas.js';
import { startFakeModel } from './fake-model.js';
import { bootApi, publishV2, type Api } from './helpers.js';

let api: Api;
let admin: string;
let label: string;
let counts: { decisions: number; safety: number };

const STATE = { kind: 'grid', energy: 2, mood: 2 } as const;

const simulate = (body: object, token = admin) =>
  api.req<SimulateCheckInResult>('POST', `/rulesets/${label}/simulate-check-in`, { token, body });

/** The card's outcome, when the engine ran. */
function ran(r: SimulateCheckInResult): Extract<SimulateCheckInResult['outcome'], { ok: true }> {
  if (!r.outcome.ok) throw new Error(JSON.stringify(r.outcome.issues));
  return r.outcome;
}

const stored = async (): Promise<{ decisions: number; safety: number }> => {
  const db = api.app.get(PrismaService);
  return { decisions: await db.decisionRecord.count(), safety: await db.safetyEvent.count() };
};

beforeAll(async () => {
  api = await bootApi();
  admin = (await api.staff(['clinical_admin'])).token;
  label = await publishV2(api, admin);
  await api.close();
  api = await bootApi();
  admin = (await api.staff(['clinical_admin'])).token;
  counts = await stored();
});

afterAll(async () => {
  await api.close();
});

describe('check-in Simulator', () => {
  it("serves a version's check-in options to staff only", async () => {
    const res = await api.req<{ version: string; inputs: Record<string, unknown[]> }>(
      'GET',
      `/rulesets/${label}/check-in-options`,
      { token: admin },
    );
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(label);
    expect(res.body.inputs['feeling']?.length).toBeGreaterThan(0);
    const user = (await api.signIn()).token;
    const refused = await api.req('GET', `/rulesets/${label}/check-in-options`, { token: user });
    expect(refused.status).toBe(403);
    expect((await simulate({ checkIn: { state: STATE } }, user)).status).toBe(403);
  });

  it('shows what each answer gives, what is left out, and what the server adds', async () => {
    const res = await simulate({
      checkIn: {
        state: STATE,
        emotions: [
          { code: 'overwhelmed', intensity: 8 },
          { code: 'tired', intensity: 4 },
        ],
        context: { social: 'alone' },
        ownWords: 'a long day',
      },
    });
    expect(res.status).toBe(200);
    const r = res.body;
    expect(r.contributions).toContainEqual({
      kind: 'rating',
      from: { input: 'emotions', code: 'overwhelmed' },
      fact: 'family.intensity',
      key: 'distress_overwhelm',
      value: 8,
    });
    expect(r.unused).toEqual(
      expect.arrayContaining([
        { from: { input: 'emotions', code: 'tired' }, why: 'maps_to_nothing' },
        { from: { input: 'context.social', code: 'alone' }, why: 'no_fact', gap: 'IG-08' },
        { from: { input: 'ownWords' }, why: 'risk_check' },
      ]),
    );
    expect(r.server).toContainEqual({ fact: 'signals.plan', value: 'free', source: 'account' });
    expect(r.server).toContainEqual({
      fact: 'signals.declines_session',
      value: 0,
      source: 'new_user',
    });
    expect(r.risk).toEqual({ checked: [{ input: 'ownWords', matched: false }], category: null });
    expect(r.handEdited).toBe(false);
    const out = ran(r);
    expect(out.card.primary?.pathway).toBe('regulate');
    expect(out.shown.light).toBe(out.card.light);
    expect(out.shown.rationale).toContain('overwhelmed (strong)');
  });

  it('gives exactly the engine input a real check-in of a new user records', async () => {
    const checkIn = {
      state: STATE,
      emotions: [{ code: 'anxious', intensity: 6 }],
      needs: ['learn_what_works'],
    };
    const user = (await api.signIn()).token;
    const real = await api.req<{ id: string }>('POST', '/decisions', {
      token: user,
      body: checkIn,
    });
    expect(real.status).toBe(201);
    const record = await api.req<{ input: Record<string, unknown> }>(
      'GET',
      `/decisions/${real.body.id}`,
      { token: admin },
    );
    const sim = await simulate({ checkIn });
    expect(sim.body.input).toEqual(record.body.input);
    counts = await stored(); // the real check-in above was stored, the simulations never are
  });

  it('changes the card with the plan: Plus can be offered an Advanced tool first', async () => {
    const checkIn = {
      state: STATE,
      emotions: [{ code: 'anxious', intensity: 4 }],
      needs: ['learn_what_works'],
    };
    const free = ran((await simulate({ checkIn, account: 'free' })).body);
    const plus = ran((await simulate({ checkIn, account: 'plus' })).body);
    expect(free.card.primary?.tool).toBe('my_patterns');
    expect(plus.card.primary?.tool).toBe('pattern_review');
    expect(plus.card.primary?.advanced).toBe(true);
    // The card as the app receives it carries the flag, so the app labels it "Advanced".
    expect(plus.shown.primary).toMatchObject({ toolId: 'pattern_review', advanced: true });
    expect(free.shown.primary.advanced).toBeUndefined();
    const browse = (await simulate({ checkIn, account: 'browse' })).body;
    expect(browse.server).toEqual([
      { fact: 'signals.plan', value: 'free', source: 'account' },
      { fact: 'safety.risk', value: false, source: 'risk_check' },
    ]);
  });

  it('runs the risk check on the free text without recording a safety event', async () => {
    const r = (await simulate({ checkIn: { state: STATE, ownWords: 'I want to end it all' } }))
      .body;
    expect(r.risk.checked).toEqual([{ input: 'ownWords', matched: true }]);
    expect(r.risk.category).not.toBeNull();
    expect(r.server).toContainEqual({ fact: 'safety.risk', value: true, source: 'risk_check' });
    expect(ran(r).card.kind).toBe('support_screen');
  });

  it('plays "Try another" and a re-check as the app does', async () => {
    const checkIn = { state: { kind: 'grid', energy: 1, mood: 1 }, emotions: [] };
    const first = (await simulate({ checkIn })).body;
    const tool = ran(first).card.primary?.tool;
    expect(tool).toBeTruthy();
    const another = (await simulate({ checkIn, declined: [tool] })).body;
    const rejected = another.server.find((s) => s.source === 'try_another');
    expect(rejected?.fact).toBe('signals.rejected');
    expect(ran(another).card.primary?.tool).not.toBe(tool);
    const recheck = (await simulate({ checkIn, recheckOf: { input: first.input } })).body;
    expect(recheck.server).toContainEqual({
      fact: 'recheck.present',
      value: true,
      source: 'recheck',
    });
  });

  it('marks input edited by hand, and leaves it unmarked when nothing changed', async () => {
    const checkIn = { state: STATE };
    const base = (await simulate({ checkIn })).body;
    const same = (await simulate({ checkIn, facts: base.input })).body;
    expect(same.handEdited).toBe(false);
    const edited = (await simulate({ checkIn, facts: { ...base.input, 'state.energy': 4 } })).body;
    expect(edited.handEdited).toBe(true);
    expect(edited.input['state.energy']).toBe(4);
  });

  it("refuses a check-in the server would refuse, with the server's reason", async () => {
    const res = await api.req<{ detail?: string }>('POST', `/rulesets/${label}/simulate-check-in`, {
      token: admin,
      body: { checkIn: { state: STATE, emotions: [{ code: 'nope', intensity: 3 }] } },
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('nope');
  });

  it('runs the AI steps as the app gets them; "the real AI" is refused while it isn\'t ready', async () => {
    const off = await bootApi({ AI_BASE_URL: undefined });
    try {
      const status = await off.req<{ configured: boolean }>('GET', '/ai/status', { token: admin });
      expect(status.body.configured).toBe(false);
      const text = "I'm overwhelmed and need to finish my essay";
      const real = await off.req('POST', '/ai/try/parse-need', {
        token: admin,
        body: { text, real: true },
      });
      expect(real.status).toBe(503);
      const app = await off.req<{ source: string; needs: string[] }>('POST', '/ai/try/parse-need', {
        token: admin,
        body: { text },
      });
      expect(app.status).toBe(200);
      expect(app.body.source).toBe('fallback');
      const risk = await off.req<{ safety: boolean; category: string | null }>(
        'POST',
        '/ai/try/parse-need',
        { token: admin, body: { text: 'I want to end it all' } },
      );
      expect(risk.body).toMatchObject({ safety: true });
      const user = (await off.signIn()).token;
      expect((await off.req('GET', '/ai/status', { token: user })).status).toBe(403);
    } finally {
      await off.close();
    }
    const model = await startFakeModel();
    const on = await bootApi({ AI_BASE_URL: model.url });
    try {
      // Decision scoring (main's ADR 0005): C is routine, H none.
      model.decide({ C: 0.9, H: 0.1 });
      const drivers = await on.req<{ source: string; drivers: string[] }>(
        'POST',
        '/ai/try/suggest-drivers',
        { token: admin, body: { title: 'Essay due tomorrow', real: true } },
      );
      expect(drivers.body).toMatchObject({ source: 'ai', drivers: ['routine'] });
    } finally {
      await on.close();
      await model.close();
    }
  });

  it('saves scenarios for all staff, keeps each run with its version, and audits saves and deletes', async () => {
    const request = {
      checkIn: {
        state: STATE,
        emotions: [{ code: 'anxious', intensity: 4 }],
        needs: ['learn_what_works'],
      },
      account: 'plus',
    };
    const made = await api.req<{ id: string; name: string; runs: unknown[] }>(
      'POST',
      '/rulesets/scenarios',
      { token: admin, body: { name: 'Plus, learn what works', answers: { draft: 1 }, request } },
    );
    expect(made.status).toBe(201);
    expect(made.body.runs).toEqual([]);
    const id = made.body.id;
    const other = (await api.staff(['safety_reviewer'])).token;
    const listed = await api.req<{ items: { id: string }[] }>('GET', '/rulesets/scenarios', {
      token: other,
    });
    expect(listed.body.items.map((i) => i.id)).toContain(id);

    const ran = await api.req<{ run: { label: string; outcome: { primary: { tool: string } } } }>(
      'POST',
      `/rulesets/scenarios/${id}/run`,
      { token: other, body: { label } },
    );
    expect(ran.status).toBe(201);
    expect(ran.body.run).toMatchObject({ label, outcome: { primary: { tool: 'pattern_review' } } });
    const draft = await api.req<{ label: string }>('POST', '/rulesets/drafts', {
      token: admin,
      body: { from: label },
    });
    await api.req('POST', `/rulesets/scenarios/${id}/run`, {
      token: admin,
      body: { label: draft.body.label },
    });
    const opened = await api.req<{ answers: unknown; runs: { label: string }[] }>(
      'GET',
      `/rulesets/scenarios/${id}`,
      { token: admin },
    );
    expect(opened.body.answers).toEqual({ draft: 1 });
    expect(opened.body.runs.map((r) => r.label)).toEqual([draft.body.label, label]);

    const user = (await api.signIn()).token;
    expect((await api.req('GET', '/rulesets/scenarios', { token: user })).status).toBe(403);
    const gone = await api.req('DELETE', `/rulesets/scenarios/${id}`, {
      token: other,
      body: { reason: 'no longer needed' },
    });
    expect(gone.status).toBe(204);
    expect((await api.req('GET', `/rulesets/scenarios/${id}`, { token: admin })).status).toBe(404);
    const db = api.app.get(PrismaService);
    expect(await db.simScenarioRun.count({ where: { scenarioId: id } })).toBe(0);
    const audit = await db.rulesetAuditEvent.findMany({
      where: { action: { in: ['scenario.create', 'scenario.delete'] } },
      orderBy: { seq: 'asc' },
    });
    const mine = audit.filter((a) => (a.detail as { scenarioId?: string }).scenarioId === id);
    expect(mine.map((a) => a.action)).toEqual(['scenario.create', 'scenario.delete']);
    expect(mine[1]?.detail).toMatchObject({ runs: 2, reason: 'no longer needed' });
    await api.req('POST', `/rulesets/${draft.body.label}/discard`, {
      token: admin,
      body: { reason: 'e2e' },
    });
  });

  it('stores nothing', async () => {
    expect(await stored()).toEqual(counts);
  });
});
