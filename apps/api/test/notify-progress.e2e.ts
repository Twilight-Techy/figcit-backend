import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InboxService } from '../src/modules/notifications/inbox.service.js';
import { DispatcherService } from '../src/modules/notifications/dispatcher.service.js';
import { PrismaService } from '../src/common/db/prisma.service.js';
import { bootApi, type Api } from './helpers.js';

interface Reminder {
  id: string;
  nextRunAt: string | null;
  active: boolean;
}

let api: Api;
let token: string;
let userId: string;
let prisma: PrismaService;
let dispatcher: DispatcherService;

beforeAll(async () => {
  api = await bootApi();
  ({ token, userId } = await api.signIn());
  prisma = api.app.get(PrismaService);
  dispatcher = api.app.get(DispatcherService);
});
afterAll(() => api.close());

describe('reminders and inbox', () => {
  it('creates reminders and computes the next run', async () => {
    const later = await api.req<Reminder>('POST', '/reminders', {
      token,
      body: { subjectType: 'recheck', inMinutes: 30 },
    });
    expect(later.status).toBe(201);
    expect(new Date(String(later.body.nextRunAt)).getTime()).toBeGreaterThan(
      Date.now() + 29 * 60_000,
    );
    const weekly = await api.req<Reminder>('POST', '/reminders', {
      token,
      body: { subjectType: 'checkin', rrule: 'FREQ=DAILY;BYHOUR=10;BYMINUTE=0' },
    });
    expect(weekly.body.nextRunAt).toBeTruthy();
    const paused = await api.req<Reminder>('PATCH', `/reminders/${weekly.body.id}`, {
      token,
      body: { active: false },
    });
    expect(paused.body.nextRunAt).toBeNull();
    expect(
      (await api.req('POST', '/reminders', { token, body: { subjectType: 'custom' } })).status,
    ).toBe(400);
  });

  it('sends due reminders to the inbox when no device is registered, and holds task nudges in quiet hours', async () => {
    const r = await api.req<Reminder>('POST', '/reminders', {
      token,
      body: { subjectType: 'checkin', inMinutes: 5 },
    });
    const noon = new Date();
    noon.setUTCHours(12, 0, 0, 0);
    await prisma.reminder.update({
      where: { id: r.body.id },
      data: { nextRunAt: new Date(noon.getTime() - 60_000) },
    });
    await dispatcher.tick(noon);
    const inbox = await api.req<{
      unread: number;
      items: { kind: string; href: string; title: string }[];
    }>('GET', '/inbox', { token });
    expect(inbox.body.items[0]).toMatchObject({
      kind: 'reminder_checkin',
      href: '/check/?mode=quick',
    });
    const after = await prisma.reminder.findUniqueOrThrow({ where: { id: r.body.id } });
    expect(after.active).toBe(false);

    const t = await api.req<Reminder>('POST', '/reminders', {
      token,
      body: { subjectType: 'custom', inMinutes: 5 },
    });
    const night = new Date(noon.getTime() + 10 * 3_600_000 + 30 * 60_000); // 22:30 UTC = London quiet hours
    await prisma.reminder.update({
      where: { id: t.body.id },
      data: { nextRunAt: new Date(night.getTime() - 60_000) },
    });
    await dispatcher.tick(night);
    const log = await prisma.notificationLog.findFirst({ where: { reminderId: t.body.id } });
    expect(log?.result).toBe('held_quiet_hours');
    await api.req('POST', '/inbox/read-all', { token });
    expect((await api.req<{ unread: number }>('GET', '/inbox', { token })).body.unread).toBe(0);
  });

  it("opens the check-in and the re-check at the PWA's /check/ routes (A1-01)", async () => {
    const inbox = api.app.get(InboxService);
    const decisionId = '01a1deb2-0a2d-7ff3-af2a-c0766852cb26';
    await inbox.add(userId, 'reminder_recheck', { type: 'recheck', id: decisionId });
    await inbox.add(userId, 'reminder_recheck', { type: 'recheck', id: null });
    const list = await api.req<{ items: { kind: string; href: string }[] }>('GET', '/inbox', {
      token,
    });
    const hrefs = list.body.items.filter((i) => i.kind === 'reminder_recheck').map((i) => i.href);
    expect(hrefs).toContain(`/check/?recheck=${decisionId}`);
    expect(hrefs).toContain('/check/?mode=quick');
    expect(list.body.items.map((i) => i.href).filter((h) => h.includes('/check-in/'))).toEqual([]);
  });

  it('stores push subscriptions and serves the public key', async () => {
    const key = await api.req<{ publicKey: string | null }>('GET', '/push/vapid-key');
    expect(key.status).toBe(200);
    const sub = await api.req<{ id: string }>('POST', '/push/subscriptions', {
      token,
      body: {
        endpoint: 'https://push.example.test/abc',
        keys: {
          p256dh:
            'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
          auth: 'tBHItJI5svbpez7KI4CCXg',
        },
      },
    });
    expect(sub.status).toBe(201);
    expect((await api.req('DELETE', `/push/subscriptions/${sub.body.id}`, { token })).status).toBe(
      204,
    );
  });
});

describe('progress and shares', () => {
  it('summarises days, lights and what helped', async () => {
    const c = await api.req<{ card: { id: string } }>('POST', '/check-ins', {
      token,
      body: { state: { kind: 'grid', energy: 1, mood: 1 } },
    });
    const s = await api.req<{ id: string }>('POST', '/sessions', {
      token,
      body: { recommendationId: c.body.card.id, pathway: 'regulate', toolId: 'breathe' },
    });
    await api.req('PATCH', `/sessions/${s.body.id}`, {
      token,
      body: { completed: true, lengthSeconds: 180 },
    });
    await api.req('POST', `/sessions/${s.body.id}/feedback`, {
      token,
      body: { outcome: 'helped' },
    });
    const p = await api.req<{
      days: { checkIns: number; light: string | null }[];
      lights: Record<string, number>;
      didItHelp: { toolId: string; helped: number }[];
      pathways: { pathway: string; minutes: number }[];
    }>('GET', '/progress?range=7', { token });
    expect(p.status).toBe(200);
    expect(p.body.days).toHaveLength(7);
    expect(p.body.days.at(-1)?.light).toBe('red');
    expect(p.body.lights['red']).toBeGreaterThanOrEqual(1);
    expect(p.body.didItHelp[0]).toMatchObject({ toolId: 'breathe', helped: 1 });
    expect(p.body.pathways[0]).toMatchObject({ pathway: 'regulate', minutes: 3 });
    expect((await api.req('GET', '/progress?range=12', { token })).status).toBe(400);
  });

  it('shares a frozen, revocable report with only the chosen sections', async () => {
    await api.req('PATCH', '/me', { token, body: { nickname: 'Ada' } });
    const share = await api.req<{ id: string; token: string; url: string }>('POST', '/shares', {
      token,
      body: { sections: ['did_it_help'], recipientLabel: 'My tutor', rangeDays: 30 },
    });
    expect(share.status).toBe(201);
    expect(share.body.url).toContain('/shared/?t=');
    const view = await api.req<{ sharedBy: string; report: Record<string, unknown> }>(
      'GET',
      `/shared/${share.body.token}`,
    );
    expect(view.status).toBe(200);
    expect(view.body.sharedBy).toBe('Ada');
    expect(view.body.report['didItHelp']).toBeDefined();
    expect(view.body.report['lights']).toBeUndefined();
    expect(view.body.report['reflections']).toBeUndefined();
    const list = await api.req<{ items: { viewCount: number }[] }>('GET', '/shares', { token });
    expect(list.body.items[0]?.viewCount).toBe(1);
    const inbox = await api.req<{ items: { kind: string }[] }>('GET', '/inbox', { token });
    expect(inbox.body.items.some((i) => i.kind === 'share_viewed')).toBe(true);
    await api.req('DELETE', `/shares/${share.body.id}`, { token });
    expect((await api.req('GET', `/shared/${share.body.token}`)).status).toBe(410);
    expect((await api.req('GET', '/shared/not-a-real-token-xxxxxxxxxx')).status).toBe(404);
    expect(userId).toBeTruthy();
  });
});
