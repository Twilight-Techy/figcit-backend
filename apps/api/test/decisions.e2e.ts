// Engine v2 decisions (M5, DESIGN §7, §10, DECISION_LOG E-52): a check-in becomes a card and a
// record; the owner sees the card, staff the input and trace; replay gives the same card; the
// Simulator and explorer run any version; records can't change.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/db/prisma.service.js';
import { DecisionsService } from '../src/modules/decisions/decisions.service.js';
import { bootApi, publishV2, type Api } from './helpers.js';

interface Item {
  pathway: string | null;
  tool: string | null;
  target: Record<string, string>;
}
interface Decision {
  id: string;
  mode: string;
  engineVersion: string;
  ruleset: { label: string; hash: string };
  card: {
    kind: string;
    light: string | null;
    band: string | null;
    primary: Item | null;
    visible: Item[];
    supportVisible: boolean;
  };
  input?: Record<string, unknown>;
  trace?: { level: string; stages: unknown[] };
  replay?: { matches: boolean } | null;
}

let api: Api;
let admin: string;
let user: string;
let other: string;
let label: string;
const started = new Date();

let device: string;
/** A check-in: as the signed-in user given, or as a Browse device (X-Browse-Token). */
const decide = (body: object, token?: string) =>
  api.req<Decision>('POST', '/decisions', {
    ...(token ? { token } : { headers: { 'x-browse-token': device } }),
    body: { state: { kind: 'grid', energy: 3, mood: 3 }, ...body },
  });

beforeAll(async () => {
  api = await bootApi();
  admin = (await api.staff(['clinical_admin'])).token;
  label = await publishV2(api, admin);
  // The runtime and the options cache for 30 s; a fresh app reads the new version at once.
  await api.close();
  api = await bootApi();
  admin = (await api.staff(['clinical_admin'])).token;
  user = (await api.signIn()).token;
  other = (await api.signIn()).token;
  device = (await api.req<{ browseToken: string }>('POST', '/auth/browse')).body.browseToken;
});

afterAll(async () => {
  await api.close();
});

describe('decisions (engine v2)', () => {
  it('makes a card for Browse, recorded without an account', async () => {
    const res = await decide({ emotions: [{ code: 'overwhelmed', intensity: 8 }] });
    expect(res.status).toBe(201);
    expect(res.body.mode).toBe('browse');
    expect(res.body.engineVersion).toBe('2.0.0');
    expect(res.body.ruleset.label).toBe(label);
    expect(res.body.ruleset.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.card.supportVisible).toBe(true);
    expect(res.body.card.primary?.pathway).toBe('regulate');
    const stored = await api.app
      .get(PrismaService)
      .decisionRecord.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(stored.userId).toBeNull();
  });

  it('shows the support screen for the Hopeless chip', async () => {
    const res = await decide({ emotions: [{ code: 'hopeless', intensity: null }] }, user);
    expect(res.body.card.kind).toBe('support_screen');
    expect(res.body.card.visible.map((i) => i.target['action'])).toEqual(['get_support_now']);
  });

  it('refuses a value the rule set does not offer', async () => {
    const res = await decide({ emotions: [{ code: 'not_a_feeling', intensity: 3 }] });
    expect(res.status).toBe(400);
  });

  it('shows the card to its owner only, and the input and trace to staff', async () => {
    const made = await decide(
      { state: { kind: 'grid', energy: 1, mood: 3 }, demand: { title: 'Essay', timeline: 'T3' } },
      user,
    );
    expect(made.body.mode).toBe('signed_in');
    expect(made.body.card.light).toBe('amber');
    const own = await api.req<Decision>('GET', `/decisions/${made.body.id}`, { token: user });
    expect(own.status).toBe(200);
    expect(own.body.trace).toBeUndefined();
    expect((await api.req('GET', `/decisions/${made.body.id}`, { token: other })).status).toBe(404);
    const staff = await api.req<Decision>('GET', `/decisions/${made.body.id}`, { token: admin });
    expect(staff.body.input).toMatchObject({
      'state.energy': 1,
      'state.mood': 3,
      'demand.present': true,
      'demand.timeline': 'T3',
      'signals.plan': 'free',
    });
    expect(staff.body.trace?.level).toBe('full');
  });

  it('re-checks an earlier decision of the same user', async () => {
    const first = await decide(
      {
        state: { kind: 'grid', energy: 1, mood: 1 },
        emotions: [{ code: 'anxious', intensity: 8 }],
      },
      user,
    );
    const again = await decide(
      { recheckOfId: first.body.id, emotions: [{ code: 'anxious', intensity: 3 }] },
      user,
    );
    expect(again.status).toBe(201);
    const staff = await api.req<Decision>('GET', `/decisions/${again.body.id}`, { token: admin });
    expect(staff.body.input).toMatchObject({
      'recheck.present': true,
      'recheck.previous_band': 'very_constrained',
      'recheck.previous_light': 'red',
      'recheck.previous_peak': 8,
    });
    expect((await decide({ recheckOfId: first.body.id }, other)).status).toBe(404);
  });

  it('replays a record to the identical card, for staff only', async () => {
    const made = await decide({ emotions: [{ code: 'lonely', intensity: 6 }] }, user);
    expect(
      (await api.req('POST', `/decisions/${made.body.id}/replay`, { token: user })).status,
    ).toBe(403);
    const replay = await api.req<{ matches: boolean; sameCard: boolean }>(
      'POST',
      `/decisions/${made.body.id}/replay`,
      { token: admin },
    );
    expect(replay.body).toMatchObject({ matches: true, sameCard: true });
    const staff = await api.req<Decision>('GET', `/decisions/${made.body.id}`, { token: admin });
    expect(staff.body.replay?.matches).toBe(true);
  });

  it("replays the day's records in the daily job", async () => {
    // Only this run's records: older ones were made by earlier builds of the engine.
    await api.app.get(PrismaService).decisionRecord.updateMany({
      where: { replayedAt: null, createdAt: { lt: started } },
      data: { replayedAt: new Date() },
    });
    await decide({ emotions: [{ code: 'restless', intensity: 4 }] });
    const result = await api.app.get(DecisionsService).replaySample();
    expect(result.replayed).toBeGreaterThan(0);
    expect(result.mismatched).toEqual([]);
  });

  it('keeps records append-only: only the replay outcome can change', async () => {
    const made = await decide({});
    const prisma = api.app.get(PrismaService);
    await expect(
      prisma.decisionRecord.update({ where: { id: made.body.id }, data: { light: 'tampered' } }),
    ).rejects.toThrow(/cannot change/);
    await expect(
      prisma.decisionRecord.update({ where: { id: made.body.id }, data: { replayMatches: true } }),
    ).resolves.toBeDefined();
  });

  it('simulates input facts on a version, nothing stored, staff only', async () => {
    const body = {
      input: {
        'state.energy': 1,
        'state.mood': 1,
        'demand.present': true,
        'demand.timeline': 'T0',
      },
    };
    expect(
      (await api.req('POST', `/rulesets/${label}/simulate`, { token: user, body })).status,
    ).toBe(403);
    const res = await api.req<{
      ok: boolean;
      card: Decision['card'];
      trace: { stages: unknown[] };
    }>('POST', `/rulesets/${label}/simulate`, { token: admin, body });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.card.light).toBe('red');
    expect(res.body.trace.stages.length).toBeGreaterThan(0);
    const bad = await api.req<{ ok: boolean; issues: { path: string }[] }>(
      'POST',
      `/rulesets/${label}/simulate`,
      { token: admin, body: { input: { light: 'red' } } },
    );
    expect(bad.body).toMatchObject({ ok: false, issues: [{ path: '/light' }] });
  });

  it('explores many inputs on a version, with the fixed-rule checks', async () => {
    const inputs = [
      { 'state.energy': 1, 'state.mood': 1 },
      { 'state.energy': 4, 'state.mood': 4 },
      { nope: 1 },
    ];
    const res = await api.req<{
      ran: number;
      refused: number;
      byLight: Record<string, number>;
      checks: { counts: object };
    }>('POST', `/rulesets/${label}/explore`, { token: admin, body: { inputs } });
    expect(res.body).toMatchObject({ ran: 3, refused: 1, byLight: { red: 1, green: 1 } });
    expect(res.body.checks.counts).toEqual({});
  });
});
