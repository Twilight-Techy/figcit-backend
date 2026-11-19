// The safety log (SE-1) and SF-2 for Rules Engine v5.0 check-ins: a Help/SOS or urgent screen is a
// safety event, and a week of hard v5.0 check-ins offers support.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/common/db/prisma.service.js';
import { DecisionsV5Service } from '../src/modules/decisions/decisions-v5.service.js';
import type { DecisionV5Dto } from '../src/modules/decisions/v5.schemas.js';
import { SustainedService } from '../src/modules/safety/sustained.service.js';
import { bootApi, publishV2, type Api } from './helpers.js';

let api: Api;
let admin: string;

const GREEN = { kind: 'grid', energy: 3, mood: 3 } as const;
const decide = (body: object, token: string) =>
  api.req<DecisionV5Dto>('POST', '/decisions/v5', {
    token,
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
});

afterAll(async () => {
  await publishV2(api, admin);
  await api.close();
});

describe('the safety log (SE-1)', () => {
  /** A fresh account's safety events, once the fire-and-forget write lands. */
  const eventsOf = (userId: string, count: number) =>
    vi.waitFor(async () => {
      const rows = await api.app.get(PrismaService).safetyEvent.findMany({ where: { userId } });
      expect(rows).toHaveLength(count);
      return rows;
    });

  it('logs risk words as a phrase match', async () => {
    const someone = await api.signIn();
    const res = await decide({ tasks: [{ title: 'I want to kill myself' }] }, someone.token);
    expect(res.body.card.kind).toBe('support_screen');
    const [row] = await eventsOf(someone.userId, 1);
    expect(row).toMatchObject({ sourceModule: 'checkin', trigger: 'phrase' });
    expect(row?.ruleId).toBeTruthy();
    expect(row?.category).toBeTruthy();
  });

  it('logs an urgent sign as an answer (SF-4)', async () => {
    const someone = await api.signIn();
    await decide({ urgent: { signs: ['chest_pain'], answer: 'sudden_new' } }, someone.token);
    const [row] = await eventsOf(someone.userId, 1);
    expect(row).toMatchObject({ sourceModule: 'checkin', trigger: 'option', ruleId: 'SF-4' });
  });

  it('SF-2 sees v5.0 check-ins: a week of Very Constrained offers support', async () => {
    const someone = await api.signIn();
    // A week of them, made back then: a decision record never changes, so it can't be backdated.
    const v5 = api.app.get(DecisionsV5Service);
    for (const d of [6.5, 4.5, 2.5, 0.5])
      await v5.decide(
        { mode: 'full', state: { kind: 'grid', energy: 1, mood: 1 }, emotions: [] },
        someone.userId,
        new Date(Date.now() - d * 86_400_000),
      );
    const records = await api.app.get(PrismaService).decisionRecord.findMany({
      where: { userId: someone.userId },
    });
    // v5.0 keeps no recommendation, only the decision record.
    expect(records.map((r) => r.band)).toEqual(Array(4).fill('very_constrained'));
    await api.app.get(SustainedService).run();
    const [row] = await eventsOf(someone.userId, 1);
    expect(row).toMatchObject({ trigger: 'sustained', ruleId: 'SF-2' });
  });

  it('logs nothing for an ordinary card, and the preview never logs', async () => {
    const someone = await api.signIn();
    const res = await decide({ emotions: [{ code: 'calm', level: 5 }] }, someone.token);
    expect(res.body.card.kind).toBe('card');
    await api.req('POST', '/decisions/v5/preview', {
      token: someone.token,
      body: {
        mode: 'full',
        state: GREEN,
        emotions: [],
        tasks: [{ title: 'I want to kill myself' }],
      },
    });
    await new Promise((r) => setTimeout(r, 200));
    await eventsOf(someone.userId, 0);
  });
});
