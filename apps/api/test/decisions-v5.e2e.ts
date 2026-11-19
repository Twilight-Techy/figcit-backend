// Rules Engine v5.0 decisions (docs/engine-v2/V5.md): the v5.0 workbook imported and published as
// an admin would, then the app's Quick and Full check-ins through /v1/decisions/v5. v3.3 is
// published again afterwards, for the files that follow.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/db/prisma.service.js';
import { decide as nudgePolicy } from '../src/modules/notifications/policy.js';
import { RecommendationService } from '../src/modules/recommendation/recommendation.service.js';
import { DecisionsV5Service } from '../src/modules/decisions/decisions-v5.service.js';
import { InstitutionsService } from '../src/modules/institutions/institutions.service.js';
import type { DecisionV5Dto, PreviewV5Dto } from '../src/modules/decisions/v5.schemas.js';
import { bootApi, publishV2, type Api } from './helpers.js';

let api: Api;
let admin: string;
let user: string;
let label: string;

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
  label = await publishV2(api, admin, '5');
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
    // Every emotion is free; ten wait under More (owner, 19 Nov 2026).
    expect(feelings.find((o) => o.code === 'frustrated')?.group).toBe('more');
    expect(feelings.filter((o) => o.group === 'prime')).toEqual([]);
    expect((res.body.inputs['help'] ?? []).length).toBeGreaterThan(8);
    // Not sure's three pictures, with the Energy and Mood level each one stands for (S150).
    const levels = (input: string) =>
      ((res.body.inputs[input] ?? []) as { code: string; level?: number }[]).map(
        (o) => `${o.code}${o.level === undefined ? '' : `:${String(o.level)}`}`,
      );
    expect(levels('not_sure_body')).toEqual(['heavy', 'floaty', 'buzzy', 'settled']);
    expect(levels('not_sure_energy')).toEqual(['empty:1', 'low:2', 'some:3', 'full:4']);
    expect(levels('not_sure_comfort')).toEqual(['hard:1', 'uneasy:2', 'okay:3', 'good:4']);
    // Tab 13 step 2: each state's name, icon and meaning, from Tab 1.
    const cells = (res.body as unknown as { cells: { id: string; name: string }[] }).cells;
    expect(cells).toHaveLength(16);
    expect(cells.find((c) => c.id === 'E3M3')?.name).toBe('Full Flow');
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

  it('drops a locked option for a free user (ENT-12) and says so; never an emotion', async () => {
    const res = await decide({ emotions: [{ code: 'frustrated', level: 6 }], body: ['headache'] });
    expect(res.status).toBe(201);
    expect(res.body.dropped).toEqual([{ input: 'body', code: 'headache', why: 'locked' }]);
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
    // Like every other paid feature: 402 not_entitled, naming the plan (B-10).
    const free = await api.req<{ code: string; detail: string }>(
      'GET',
      '/decisions/v5/fit-summary',
      {
        token: user,
      },
    );
    expect(free.status).toBe(402);
    expect(free.body).toMatchObject({
      code: 'not_entitled',
      detail: 'My fit summary is part of Premium.',
    });
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

  it('the staff Simulator runs a v5.0 check-in for a plan, with the card and the rules that fired', async () => {
    const sim = (body: object) =>
      api.req<{
        card: { headline: string; primary: { code: string; plan: string | null } | null } | null;
        dropped: { input: string; code: string; why: string }[];
        fired: string[];
        input: Record<string, unknown>;
      }>('POST', `/rulesets/${label}/simulate-check-in-v5`, { token: admin, body });
    const checkIn = {
      mode: 'full',
      state: GREEN,
      emotions: [{ code: 'not_good_enough', level: 2 }],
    };
    const free = await sim({ checkIn });
    expect(free.status).toBe(200);
    expect(free.body.card?.primary?.code).toBe('rfl_today');
    expect(free.body.fired.some((f) => f.startsWith('feelings'))).toBe(true);
    const premium = await sim({ checkIn, plan: 'premium' });
    expect(premium.body.card?.primary).toMatchObject({ code: 'rfl_helped', plan: 'prime' });
    const locked = await sim({
      checkIn: { ...checkIn, mode: 'full', body: ['headache'] },
    });
    expect(locked.body.dropped).toEqual([{ input: 'body', code: 'headache', why: 'locked' }]);
    const back = await sim({
      checkIn: { ...checkIn, mode: 'quick', tasks: [{ title: 'Shift', chip: 'can_t_wait' }] },
      returnToWork: true,
    });
    expect(back.body.input['prefs.return_to_work']).toBe(true);
    expect(back.body.card?.headline).toMatch(/^Today fits/);
    expect((await sim({ checkIn, plan: 'nope' })).status).toBe(400);
    expect(
      (
        await api.req('POST', `/rulesets/${label}/simulate-check-in-v5`, {
          token: user,
          body: { checkIn },
        })
      ).status,
    ).toBe(403);
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

  it('counts v5.0 check-ins in an organisation’s group trends', async () => {
    const prisma = api.app.get(PrismaService);
    const floor = 5;
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Trend test',
        slug: `trend-${String(Date.now())}`,
        kind: 'other',
        anonymityFloor: floor,
      },
    });
    const code = `V5${String(Date.now()).slice(-6)}`;
    await prisma.inviteCode.create({ data: { code, tenantId: tenant.id } });
    for (let i = 0; i < floor; i += 1) {
      const m = await api.signIn();
      await api.req('POST', '/institutions/join', { token: m.token, body: { code } });
      await api.req('POST', '/me/consents', {
        token: m.token,
        body: { choices: [{ purpose: 'institution_sharing', granted: true }], source: 'settings' },
      });
      expect((await decide({}, m.token)).status).toBe(201);
    }
    await api.app.get(InstitutionsService).aggregate();
    const rows = await prisma.cohortAggregate.findMany({
      where: { tenantId: tenant.id, metric: 'checkins' },
      orderBy: { weekStart: 'desc' },
    });
    expect(rows[0]).toMatchObject({ value: floor, suppressed: false });
  });

  describe('what the check-in may hold (B-09)', () => {
    type Problem = { code: string; detail?: string; issues?: { path: string; message: string }[] };
    const bad = async (body: object, path: string) => {
      const res = await api.req<Problem>('POST', '/decisions/v5', {
        token: user,
        body: { mode: 'full', state: GREEN, emotions: [], ...body },
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('invalid_input');
      // The problem names the field, in `issues` and in a readable `detail`.
      expect(res.body.issues?.some((i) => i.path.startsWith(path))).toBe(true);
      expect(res.body.detail).toContain(path);
    };

    it('refuses an urgent sign the rule set does not publish, instead of a normal card', async () => {
      await bad(
        { urgent: { signs: ['chest_pain', 'not_a_sign'], answer: 'sudden_new' } },
        'urgent.signs',
      );
    });

    it('refuses the same emotion twice', async () => {
      await bad(
        {
          emotions: [
            { code: 'calm', level: 3 },
            { code: 'calm', level: 5 },
          ],
        },
        'emotions.1.code',
      );
    });

    it('accepts Something else words before the feeling is rated, and neither stores nor uses them', async () => {
      // The app sends the words while the strength is still unrated, with the emotion left out.
      const body = {
        somethingElse: { text: 'gutted-orphan' },
        emotions: [{ code: 'calm', level: 3 }],
      };
      const seen = await preview(body);
      expect(seen.status).toBe(200);
      const plain = await preview({ emotions: [{ code: 'calm', level: 3 }] });
      expect(seen.body.light).toBe(plain.body.light);
      expect(seen.body.reason).toBe(plain.body.reason);
      const made = await decide(body);
      expect(made.status).toBe(201);
      expect(JSON.stringify(made.body)).not.toContain('gutted-orphan');
      const record = await api.app
        .get(PrismaService)
        .decisionRecord.findUniqueOrThrow({ where: { id: made.body.id } });
      expect(JSON.stringify(record)).not.toContain('gutted-orphan');
    });

    it('takes them together, and still ignores keys it does not know (Not sure answers stay stripped)', async () => {
      const ok = await decide({
        emotions: [{ code: 'something_else', level: 4 }],
        somethingElse: { text: 'gutted' },
        state: { kind: 'not_sure', answers: ['heavy', 'low', 'uneasy'] },
        extra: 'ignored',
      });
      expect(ok.status).toBe(201);
    });
  });

  describe('Blue on a re-check (RC-1, B-04)', () => {
    const RED = { kind: 'grid', energy: 1, mood: 1 } as const;
    const BETTER = { kind: 'grid', energy: 3, mood: 3 } as const;
    const HOUR = 3_600_000;
    /**
     * Red, then a completed (or not) support session, then a much better re-check. Decision records
     * cannot be changed, so time is set the other way round: the session starts `sessionHours`
     * after the decision (the API takes a start time) and the re-check is made `recheckHours`
     * after it (the service takes the time it runs at).
     */
    const recheck = async (
      finished: boolean,
      when: { sessionHours: number; recheckHours: number } = { sessionHours: 0, recheckHours: 0 },
    ) => {
      const me = await api.signIn();
      const first = await decide({ state: RED }, me.token);
      expect(first.body.card.light).toBe('red');
      const t0 = new Date(first.body.createdAt).getTime();
      const session = await api.req<{ id: string }>('POST', '/sessions', {
        token: me.token,
        body: {
          pathway: 'regulate',
          toolId: 'breathe',
          ...(when.sessionHours !== 0
            ? { startedAt: new Date(t0 + when.sessionHours * HOUR).toISOString() }
            : {}),
        },
      });
      expect(session.status).toBe(201);
      if (finished)
        await api.req('PATCH', `/sessions/${session.body.id}`, {
          token: me.token,
          body: { endedAt: new Date().toISOString(), lengthSeconds: 180, completed: true },
        });
      const now = new Date(Math.max(Date.now(), t0 + when.recheckHours * HOUR));
      return {
        card: (
          await api.app
            .get(DecisionsV5Service)
            .decide(
              { mode: 'full', state: BETTER, emotions: [], recheckOfId: first.body.id },
              me.userId,
              now,
            )
        ).card,
      };
    };

    it('is reached when the support was finished and the state is much better', async () => {
      const second = await recheck(true);
      expect(second.card.light).toBe('blue');
    });

    it('is not reached when the support was not finished', async () => {
      const second = await recheck(false);
      expect(second.card.light).not.toBe('blue');
    });

    it('is reached for a session finished inside the day after the decision', async () => {
      const second = await recheck(true, { sessionHours: 1, recheckHours: 5 });
      expect(second.card.light).toBe('blue');
    });

    it('is not reached by an unrelated session two days later', async () => {
      const second = await recheck(true, { sessionHours: 48, recheckHours: 49 });
      expect(second.card.light).not.toBe('blue');
    });

    it('is not reached when the decision is older than a day, even for a session soon after it', async () => {
      const second = await recheck(true, { sessionHours: 1, recheckHours: 30 });
      expect(second.card.light).not.toBe('blue');
    });

    it('is not reached by a session finished before the decision', async () => {
      const second = await recheck(true, { sessionHours: -3, recheckHours: 5 });
      expect(second.card.light).not.toBe('blue');
    });
  });

  describe('the modules that read how the person is (B-01)', () => {
    const RED = { kind: 'grid', energy: 1, mood: 1 } as const;
    const gate = (token: string) =>
      api.req<{ allowed: boolean; reason: string; light: string }>('GET', '/reflect/gate', {
        token,
      });
    const ordered = (token: string) =>
      api.req<{ light: string; lightKnown: boolean }>('GET', '/tasks/ordered', { token });

    it('a Red v5.0 check-in holds Reflect, orders tasks by the light and holds task nudges', async () => {
      const me = await api.signIn();
      expect((await gate(me.token)).body).toMatchObject({ allowed: true, light: 'yellow' });
      expect((await decide({ state: RED }, me.token)).body.card.light).toBe('red');
      expect((await gate(me.token)).body).toMatchObject({
        allowed: false,
        reason: 'regulate_first',
        light: 'red',
      });
      expect((await ordered(me.token)).body).toMatchObject({ light: 'red', lightKnown: true });
      const state = await api.app.get(RecommendationService).currentState(me.userId);
      expect(state).toMatchObject({ light: 'red', known: true });
      const nudge = nudgePolicy({
        now: new Date('2026-11-18T12:00:00Z'),
        timeZone: 'UTC',
        category: 'tasks',
        style: 'standard',
        categories: ['tasks'],
        quietStart: null,
        quietEnd: null,
        inWorship: false,
        inWorshipUntil: null,
        taskNudgesToday: 0,
        light: state.known ? state.light : null,
      });
      expect(nudge).toBe('held_capacity');
    });

    it('a v5.0 check-in counts for the profile prompt (ME-1) and for Progress', async () => {
      const me = await api.signIn();
      type View = { promptDue: boolean };
      expect((await api.req<View>('GET', '/me/profile', { token: me.token })).body.promptDue).toBe(
        false,
      );
      await decide({ state: RED }, me.token);
      expect((await api.req<View>('GET', '/me/profile', { token: me.token })).body.promptDue).toBe(
        true,
      );
      const progress = await api.req<{
        checkIns: number;
        lights: Record<string, number>;
        days: { light: string | null; averageEnergy: number | null }[];
      }>('GET', '/progress?range=7', { token: me.token });
      expect(progress.body.checkIns).toBe(1);
      expect(progress.body.lights['red']).toBe(1);
      expect(progress.body.days.at(-1)).toMatchObject({ light: 'red', averageEnergy: 1 });
    });

    it('the newest check-in counts: a Green one after a Red one lets Reflect through', async () => {
      const me = await api.signIn();
      await decide({ state: RED }, me.token);
      expect((await gate(me.token)).body.allowed).toBe(false);
      await decide({ state: GREEN }, me.token);
      expect((await gate(me.token)).body).toMatchObject({ allowed: true, light: 'green' });
    });
  });
});
