// Rules Engine v5.0 decisions (docs/engine-v2/V5.md): the v5.0 workbook imported and published as
// an admin would, then the app's Quick and Full check-ins through /v1/decisions/v5. v3.3 is
// published again afterwards, for the files that follow.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/db/prisma.service.js';
import type { DecisionV5Dto, PreviewV5Dto } from '../src/modules/decisions/v5.schemas.js';
import { bootApi, publishV2, type Api } from './helpers.js';

let api: Api;
let admin: string;
let user: string;

const GREEN = { kind: 'grid', energy: 3, mood: 3 } as const;
const decide = (body: object, token = user) =>
  api.req<DecisionV5Dto>('POST', '/decisions/v5', {
    token,
    body: { mode: 'full', state: GREEN, emotions: [], ...body },
  });
const preview = (body: object) =>
  api.req<PreviewV5Dto>('POST', '/decisions/v5/preview', {
    token: user,
    body: { mode: 'full', state: GREEN, emotions: [], ...body },
  });

beforeAll(async () => {
  api = await bootApi();
  admin = (await api.staff(['clinical_admin'])).token;
  await publishV2(api, admin, '5');
  // The runtime and the options cache for 30 s; a fresh app reads the new version at once.
  await api.close();
  api = await bootApi();
  admin = (await api.staff(['clinical_admin'])).token;
  user = (await api.signIn()).token;
});

afterAll(async () => {
  await publishV2(api, admin);
  await api.close();
});

describe('Rules Engine v5.0 decisions', () => {
  it('serves the v5.0 check-in options, each with the plan that can pick it', async () => {
    const res = await api.req<{ inputs: Record<string, { code: string; group: string | null }[]> }>(
      'GET',
      '/check-in/options',
    );
    expect(res.status).toBe(200);
    const feelings = res.body.inputs['feeling'] ?? [];
    expect(feelings.find((o) => o.code === 'anxious')?.group).toBe('always_free');
    expect(feelings.find((o) => o.code === 'frustrated')?.group).toBe('prime');
    expect((res.body.inputs['help'] ?? []).length).toBeGreaterThan(8);
  });

  it('shows the colour, its sentence and the Help menu as the person goes', async () => {
    const res = await preview({ emotions: [{ code: 'angry', level: 8 }], body: ['tension'] });
    expect(res.status).toBe(200);
    expect(res.body.light).toBe('yellow');
    expect(res.body.lowered).toBe(true);
    expect(res.body.reason).toBe(
      "You're in Full Flow, feeling angry (strong) with tension. Feeling this strongly makes things harder, so you're in yellow for now.",
    );
    expect(res.body.menu.cards.map((c) => c.code)).not.toContain('hc_6');
    expect(res.body.menu.cards[0]).toEqual({
      code: 'hc_1',
      label: 'Help me calm down',
      hint: 'Stress, burnout, fatigue, meltdown or outburst',
    });
  });

  it('makes and records the card, with its words, labels and the tasks in order', async () => {
    const res = await decide(
      {
        emotions: [{ code: 'calm', level: 5 }],
        place: { code: 'home', canStepAway: true },
        tasks: [
          { title: 'Washing up', chip: 'usual' },
          { title: 'Rent', chip: 'can_t_wait' },
        ],
      },
      user,
    );
    expect(res.status).toBe(201);
    const { card } = res.body;
    expect(card.light).toBe('green');
    expect(card.pattern).toBe('54');
    expect(card.headline).toBe('Ready to start?');
    expect(card.primary).toMatchObject({
      kind: 'action',
      code: 'start_task',
      label: 'Start: Rent',
    });
    expect(card.tasks?.first[0]).toBe('Rent');
    expect(card.taskLine).toMatch(/^We've put the thing that can't wait/);
    const own = await api.req<{ card: { pattern?: string } }>('GET', `/decisions/${res.body.id}`, {
      token: user,
    });
    expect(own.status).toBe(200);
    expect(own.body.card.pattern).toBe('54');
  });

  it('labels the tools with their approved words and a free user gets the free one (T-20)', async () => {
    const res = await decide({ emotions: [{ code: 'not_good_enough', level: 2 }] }, user);
    const { card } = res.body;
    expect(card.primary).toMatchObject({ kind: 'tool', code: 'rfl_today', plan: null });
    expect(card.primary?.label).toBe('Make sense of today');
    expect(card.alternatives.some((a) => a.code === 'rfl_helped' && a.plan === 'prime')).toBe(true);
  });

  it('drops a locked option for a free user (ENT-12) and says so', async () => {
    const res = await decide({ emotions: [{ code: 'frustrated', level: 6 }] });
    expect(res.status).toBe(201);
    expect(res.body.dropped).toEqual([{ input: 'feeling', code: 'frustrated', why: 'locked' }]);
  });

  it('shows the urgent screen for an urgent sign that is sudden or new (SF-4, T-34)', async () => {
    const res = await decide({ urgent: { signs: ['chest_pain'], answer: 'sudden_new' } });
    expect(res.body.card.kind).toBe('urgent_screen');
    expect(res.body.card.reason).toBe(
      'You told us this is sudden or new. Please get urgent help now.',
    );
  });

  it('screens the free text: risk words in a task title are Help/SOS (SF-1)', async () => {
    const res = await decide({ tasks: [{ title: 'I want to kill myself' }] });
    expect(res.body.card.kind).toBe('support_screen');
  });

  it("asks 'Which first?' for a support card and a task in Green (T-02)", async () => {
    const res = await decide({
      emotions: [{ code: 'calm', level: 5 }],
      helpCard: 'hc_8',
      tasks: [{ title: 'Write the project proposal' }],
    });
    expect(res.body.card.pattern).toBe('43');
    expect(res.body.card.headline).toBe('Which would you like first?');
    expect(res.body.card.alternatives.map((a) => a.label)).toEqual([
      'Start: Write the project proposal',
    ]);
  });

  it('My fit summary is Premium: colours with the kinds of task brought (RW-5)', async () => {
    const free = await api.req('GET', '/decisions/v5/fit-summary', { token: user });
    expect(free.status).toBe(403);
    const premium = await api.signIn();
    await api.app.get(PrismaService).entitlement.create({
      data: {
        userId: premium.userId,
        planCode: 'premium_monthly',
        source: 'web',
        status: 'active',
      },
    });
    await decide(
      { emotions: [{ code: 'calm', level: 5 }], tasks: [{ title: 'Rent', chip: 'can_t_wait' }] },
      premium.token,
    );
    const res = await api.req<{
      checkIns: number;
      lights: { light: string; checkIns: number; chips: { chip: string; checkIns: number }[] }[];
    }>('GET', '/decisions/v5/fit-summary', { token: premium.token });
    expect(res.status).toBe(200);
    expect(res.body.checkIns).toBe(1);
    expect(res.body.lights).toEqual([
      {
        light: 'green',
        checkIns: 1,
        chips: [{ chip: 'can_t_wait', label: "Can't wait", checkIns: 1 }],
      },
    ]);
  });

  it('needs an account (SU-1)', async () => {
    const res = await api.req('POST', '/decisions/v5', {
      body: { mode: 'quick', state: GREEN, emotions: [] },
    });
    expect(res.status).toBe(401);
  });

  it('refuses an option the version does not offer', async () => {
    const res = await decide({ emotions: [{ code: 'not_a_feeling', level: 3 }] });
    expect(res.status).toBe(201);
    expect(res.body.dropped).toEqual([
      { input: 'feeling', code: 'not_a_feeling', why: 'not_offered' },
    ]);
  });
});
