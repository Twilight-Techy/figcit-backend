import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/db/prisma.service.js';
import { BillingService } from '../src/modules/billing/billing.service.js';
import { InstitutionsService } from '../src/modules/institutions/institutions.service.js';
import { bootApi, type Api } from './helpers.js';

let api: Api;
let prisma: PrismaService;

beforeAll(async () => {
  api = await bootApi();
  prisma = api.app.get(PrismaService);
});
afterAll(() => api.close());

describe('plans and billing (fake provider)', () => {
  it('buys Plus, unlocks Advanced, cancels at period end and handles webhooks', async () => {
    const plans = await api.req<{ items: { code: string; priceMinor: number | null }[] }>(
      'GET',
      '/plans',
    );
    expect(plans.body.items.map((p) => p.code)).toContain('plus_monthly');
    const { token, userId } = await api.signIn();
    expect((await api.req<{ tier: string }>('GET', '/me/entitlements', { token })).body.tier).toBe(
      'free',
    );
    // ENT-8: only a confirmed adult can buy.
    const unconfirmed = await api.req<{ code: string }>('POST', '/billing/checkout', {
      token,
      body: { planCode: 'plus_monthly' },
    });
    expect(unconfirmed.status).toBe(403);
    expect(unconfirmed.body.code).toBe('age_unconfirmed');
    expect(
      (await api.req('POST', '/me/age-confirmation', { token, body: { confirmed18: true } }))
        .status,
    ).toBe(201);
    expect(
      (await api.req('POST', '/billing/checkout', { token, body: { planCode: 'plus_concession' } }))
        .status,
    ).toBe(400);
    const co = await api.req<{ sessionId: string; url: string }>('POST', '/billing/checkout', {
      token,
      body: { planCode: 'plus_monthly' },
    });
    expect(co.body.url).toContain('/plans/checkout/?session=');
    await api.req('POST', '/billing/fake/complete', {
      token,
      body: { sessionId: co.body.sessionId },
    });
    expect((await api.req<{ tier: string }>('GET', '/me/entitlements', { token })).body.tier).toBe(
      'plus',
    );
    expect((await api.req('GET', '/progress?range=90', { token })).status).toBe(200);
    expect(
      (await api.req('POST', '/billing/checkout', { token, body: { planCode: 'plus_yearly' } }))
        .status,
    ).toBe(409);

    const billing = api.app.get(BillingService);
    const body = JSON.stringify({ id: `evt_${randomUUID()}`, type: 'payment_failed', userId });
    const bad = await api.app.inject({
      method: 'POST',
      url: '/v1/billing/webhook',
      headers: { 'content-type': 'application/json', 'x-signature': 'nope' },
      payload: body,
    });
    expect(bad.statusCode).toBe(403);
    const ok = await api.app.inject({
      method: 'POST',
      url: '/v1/billing/webhook',
      headers: { 'content-type': 'application/json', 'x-signature': billing.sign(body) },
      payload: body,
    });
    expect(ok.statusCode).toBe(200);
    const again = await api.app.inject({
      method: 'POST',
      url: '/v1/billing/webhook',
      headers: { 'content-type': 'application/json', 'x-signature': billing.sign(body) },
      payload: body,
    });
    expect(JSON.parse(again.body)).toEqual({ duplicate: true });
    const ent = await api.req<{ tier: string; items: { status: string }[] }>(
      'GET',
      '/me/entitlements',
      { token },
    );
    expect(ent.body.tier).toBe('plus');
    expect(ent.body.items[0]?.status).toBe('grace');

    const paid = JSON.stringify({ id: `evt_${randomUUID()}`, type: 'payment_succeeded', userId });
    await api.app.inject({
      method: 'POST',
      url: '/v1/billing/webhook',
      headers: { 'content-type': 'application/json', 'x-signature': billing.sign(paid) },
      payload: paid,
    });
    const cancel = await api.req<{ endsAt: string }>('POST', '/billing/cancel', { token });
    expect(new Date(cancel.body.endsAt).getTime()).toBeGreaterThan(Date.now());
    expect((await api.req<{ tier: string }>('GET', '/me/entitlements', { token })).body.tier).toBe(
      'plus',
    );
  });
});

describe('analytics', () => {
  it('drops events without consent and keeps codes with it', async () => {
    const { token } = await api.signIn();
    const events = [{ name: 'card.shown', props: { light: 'green', pattern: 12 } }];
    expect(
      (await api.req<{ accepted: number }>('POST', '/events', { token, body: { events } })).body
        .accepted,
    ).toBe(0);
    await api.req('POST', '/me/consents', {
      token,
      body: { choices: [{ purpose: 'analytics', granted: true }], source: 'settings' },
    });
    expect(
      (await api.req<{ accepted: number }>('POST', '/events', { token, body: { events } })).body
        .accepted,
    ).toBe(1);
    expect(
      (
        await api.req('POST', '/events', {
          token,
          body: { events: [{ name: 'x', props: { text: 'I feel awful today' } }] },
        })
      ).status,
    ).toBe(400);
    const browse = await api.req<{ accepted: number }>('POST', '/events', {
      body: { consent: true, events },
      headers: { 'x-browse-token': 'browse-device-token-abcdefghij' },
    });
    expect(browse.body.accepted).toBe(1);
  });
});

describe('sync', () => {
  it('applies an offline batch once and reports per item', async () => {
    const { token } = await api.signIn();
    const now = new Date().toISOString();
    const taskId = randomUUID();
    const checkInId = randomUUID();
    const ops = [
      {
        id: randomUUID(),
        entity: 'task',
        op: 'create',
        entityId: taskId,
        data: { title: 'Offline task' },
        clientUpdatedAt: now,
      },
      {
        id: randomUUID(),
        entity: 'task',
        op: 'update',
        entityId: taskId,
        data: { status: 'done' },
        clientUpdatedAt: now,
      },
      {
        id: randomUUID(),
        entity: 'check_in',
        op: 'create',
        entityId: checkInId,
        data: { state: { kind: 'grid', energy: 3, mood: 3 } },
        clientUpdatedAt: now,
      },
      {
        id: randomUUID(),
        entity: 'task',
        op: 'create',
        entityId: randomUUID(),
        data: { nope: true },
        clientUpdatedAt: now,
      },
    ];
    const res = await api.req<{ results: { result: string; error: string | null }[] }>(
      'POST',
      '/sync/push',
      { token, body: { operations: ops } },
    );
    expect(res.body.results.map((r) => r.result)).toEqual([
      'applied',
      'applied',
      'applied',
      'rejected',
    ]);
    expect(res.body.results[3]?.error).toBe('invalid_input');
    const replay = await api.req<{ results: { result: string }[] }>('POST', '/sync/push', {
      token,
      body: { operations: ops.slice(0, 1) },
    });
    expect(replay.body.results[0]?.result).toBe('duplicate');
    expect(
      (await api.req<{ status: string }>('GET', `/tasks/${taskId}`, { token })).body.status,
    ).toBe('done');
    const pull = await api.req<{
      changes: { tasks: { id: string }[]; checkIns: { id: string }[] };
    }>('GET', `/sync/pull?since=${new Date(Date.now() - 60_000).toISOString()}`, { token });
    expect(pull.body.changes.tasks.map((t) => t.id)).toContain(taskId);
    expect(pull.body.changes.checkIns.map((t) => t.id)).toContain(checkInId);
  });
});

describe('speech without a server', () => {
  it('fails gently so the app can switch to typing', async () => {
    const { token } = await api.signIn();
    const up = await api.req<{ fileId: string; upload: { url: string }; serverAvailable: boolean }>(
      'POST',
      '/speech/uploads',
      { token, body: { contentType: 'audio/webm', sizeBytes: 4 } },
    );
    expect(up.body.serverAvailable).toBe(false);
    await api.app.inject({
      method: 'PUT',
      url: up.body.upload.url.replace(/^https?:\/\/[^/]+/, ''),
      headers: { 'content-type': 'audio/webm' },
      payload: Buffer.from('abcd'),
    });
    const t = await api.req<{ status: string; errorCode: string }>(
      'POST',
      '/speech/transcriptions',
      { token, body: { fileId: up.body.fileId, purpose: 'dump' } },
    );
    expect(t.body).toMatchObject({ status: 'failed', errorCode: 'not_configured' });
  });
});

describe('admin', () => {
  it('needs a staff role', async () => {
    const { token } = await api.signIn();
    expect((await api.req('GET', '/admin/metrics', { token })).status).toBe(403);
    const editor = await api.staff(['content_editor']);
    expect((await api.req('GET', '/admin/metrics', { token: editor.token })).status).toBe(200);
    expect((await api.req('GET', '/admin/staff', { token: editor.token })).status).toBe(403);
  });

  it('uploads, reviews, signs off and publishes a snapshot; publishing an old one rolls back', async () => {
    const dir = resolve(import.meta.dirname, '../../../docs/specs/rules-engine-v3.3');
    const files: Record<string, string> = {};
    for (const f of await readdir(dir))
      if (f.endsWith('.csv')) files[f] = await readFile(resolve(dir, f), 'utf8');
    const editor = await api.staff(['content_editor']);
    const safety = await api.staff(['safety_reviewer']);
    const admin = await api.staff(['admin']);
    // A small change to a crisis route, so the snapshot touches safety.
    const up = await api.req<{
      id: string;
      status: string;
      touchesSafety: boolean;
      fixtureReport: { total: number; passed: number };
    }>('POST', '/admin/snapshots', { token: editor.token, body: { files, notes: 'e2e' } });
    expect(up.status).toBe(201);
    expect(up.body.fixtureReport.total).toBeGreaterThan(100);
    expect(up.body.fixtureReport.passed).toBe(up.body.fixtureReport.total);
    const own = await api.req('POST', `/admin/snapshots/${up.body.id}/review`, {
      token: editor.token,
    });
    expect([400, 403]).toContain(own.status);
    const bad = await api.req('POST', '/admin/snapshots', {
      token: editor.token,
      body: { files: { 'x.csv': 'a,b' } },
    });
    expect(bad.status).toBe(400);
    // A changed label makes a new draft that doesn't touch safety.
    const changed = {
      ...files,
      '4-timeline-codes.csv': (files['4-timeline-codes.csv'] ?? '').replace(
        'T1,Later today',
        'T1,Later on today',
      ),
    };
    const draft = await api.req<{
      id: string;
      status: string;
      touchesSafety: boolean;
      diffSummary: { changed: string[] };
    }>('POST', '/admin/snapshots', { token: editor.token, body: { files: changed } });
    expect(draft.body).toMatchObject({ status: 'draft', touchesSafety: false });
    expect(draft.body.diffSummary.changed).toContain('timelines');
    expect(
      (await api.req('POST', `/admin/snapshots/${draft.body.id}/publish`, { token: admin.token }))
        .status,
    ).toBe(400);
    expect(
      (await api.req('POST', `/admin/snapshots/${draft.body.id}/review`, { token: editor.token }))
        .status,
    ).toBe(403);
    const reviewed = await api.req<{ status: string }>(
      'POST',
      `/admin/snapshots/${draft.body.id}/review`,
      { token: safety.token },
    );
    expect(reviewed.body.status).toBe('in_review');
    const before = await api.req<{ version: string }>('GET', '/rules/snapshot');
    await api.req('POST', `/admin/snapshots/${draft.body.id}/publish`, { token: admin.token });
    const live = await api.req<{ timelines: { code: string; label: string }[] }>(
      'GET',
      '/rules/snapshot',
    );
    expect(live.body.timelines.find((t) => t.code === 'T1')?.label).toBe('Later on today');
    const all = await api.req<{ items: { id: string; version: string; status: string }[] }>(
      'GET',
      '/admin/snapshots',
      { token: admin.token },
    );
    const previous = all.body.items.find((x) => x.version === before.body.version);
    expect(previous?.status).toBe('retired');
    await api.req('POST', `/admin/snapshots/${String(previous?.id)}/publish`, {
      token: admin.token,
    });
    expect((await api.req<{ version: string }>('GET', '/rules/snapshot')).body.version).toBe(
      before.body.version,
    );
    expect(safety.userId).toBeTruthy();
  });

  it('shows decisions and safety events without user ids, and audits views', async () => {
    const { token } = await api.signIn();
    const c = await api.req<{ card: { id: string } }>('POST', '/check-ins', {
      token,
      body: { state: { kind: 'grid', energy: 2, mood: 2 } },
    });
    const reviewer = await api.staff(['safety_reviewer']);
    const decisions = await api.req<{ items: Record<string, unknown>[] }>(
      'GET',
      '/admin/decisions?limit=5',
      { token: reviewer.token },
    );
    expect(decisions.body.items[0]).not.toHaveProperty('userId');
    const one = await api.req<{ trace: unknown }>('GET', `/admin/decisions/${c.body.card.id}`, {
      token: reviewer.token,
    });
    expect(one.body.trace).toBeDefined();
    const ev = await api.req<{ recent: Record<string, unknown>[] }>('GET', '/admin/safety-events', {
      token: reviewer.token,
    });
    for (const e of ev.body.recent) expect(e).not.toHaveProperty('userId');
    const admin = await api.staff(['admin']);
    const audit = await api.req<{ items: { action: string }[] }>('GET', '/admin/audit', {
      token: admin.token,
    });
    expect(audit.body.items.some((a) => a.action === 'decision.view')).toBe(true);
  });

  it('publishes safety-touching content only with a safety reviewer, never by its author', async () => {
    const editor = await api.staff(['content_editor']);
    const reviewer = await api.staff(['safety_reviewer']);
    const item = await api.req<{ id: string }>('POST', '/admin/content', {
      token: editor.token,
      body: {
        key: 'e2e.sample',
        kind: 'copy',
        body: [{ code: 'hi', text: 'Hi there' }],
        touchesSafety: true,
      },
    });
    expect(
      (await api.req('POST', `/admin/content/${item.body.id}/publish`, { token: editor.token }))
        .status,
    ).toBe(403);
    const other = await api.staff(['content_editor']);
    expect(
      (await api.req('POST', `/admin/content/${item.body.id}/publish`, { token: other.token }))
        .status,
    ).toBe(403);
    expect(
      (await api.req('POST', `/admin/content/${item.body.id}/publish`, { token: reviewer.token }))
        .status,
    ).toBe(201);
    const content = await api.req<{ items: { key: string; body: { code: string }[] }[] }>(
      'GET',
      '/content',
    );
    expect(content.body.items.find((i) => i.key === 'e2e.sample')?.body[0]?.code).toBe('hi');
  });
});

describe('age (D-02)', () => {
  it('16–17 only through an institution, and then no purchases', async () => {
    const teen = await api.signIn();
    const early = await api.req('POST', '/me/age-confirmation', {
      token: teen.token,
      body: { under18ViaInstitution: true },
    });
    expect(early.status).toBe(403);
    const tenant = await prisma.tenant.create({
      data: { name: 'Sixth Form', slug: `sf-${randomUUID().slice(0, 8)}`, kind: 'school' },
    });
    const code = `S${randomUUID().slice(0, 7).toUpperCase()}`;
    await prisma.inviteCode.create({ data: { code, tenantId: tenant.id } });
    await api.req('POST', '/institutions/join', { token: teen.token, body: { code } });
    const ok = await api.req<{ ageBand: string; ageConfirmed: boolean }>(
      'POST',
      '/me/age-confirmation',
      { token: teen.token, body: { under18ViaInstitution: true } },
    );
    expect(ok.body).toMatchObject({ ageBand: 'minor_institution', ageConfirmed: true });
    const buy = await api.req('POST', '/billing/checkout', {
      token: teen.token,
      body: { planCode: 'plus_monthly' },
    });
    expect(buy.status).toBe(403);
  });
});

describe('institutions', () => {
  it('joins by code, shares only above the floor, and routes support requests', async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Test College',
        slug: `test-${randomUUID().slice(0, 8)}`,
        kind: 'school',
        anonymityFloor: 5,
      },
    });
    await prisma.inviteCode.create({
      data: { code: `T${randomUUID().slice(0, 7).toUpperCase()}`, tenantId: tenant.id },
    });
    const code = (await prisma.inviteCode.findFirstOrThrow({ where: { tenantId: tenant.id } }))
      .code;
    const lead = await api.signIn();
    await api.req('POST', '/institutions/join', { token: lead.token, body: { code } });
    await prisma.tenantMembership.update({
      where: { tenantId_userId: { tenantId: tenant.id, userId: lead.userId } },
      data: { role: 'support_lead' },
    });
    const members = [];
    for (let i = 0; i < 2; i += 1) {
      const m = await api.signIn();
      await api.req('POST', '/institutions/join', { token: m.token, body: { code } });
      await api.req('POST', '/me/consents', {
        token: m.token,
        body: { choices: [{ purpose: 'institution_sharing', granted: true }], source: 'settings' },
      });
      await api.req('POST', '/check-ins', {
        token: m.token,
        body: { state: { kind: 'grid', energy: 4, mood: 4 } },
      });
      members.push(m);
    }
    const first = members[0];
    if (!first) throw new Error('no member');
    expect(
      (await api.req<{ tier: string }>('GET', '/me/entitlements', { token: first.token })).body
        .tier,
    ).toBe('plus');
    await api.app.get(InstitutionsService).aggregate();
    const dash = await api.req<{
      sharing: number | null;
      weeks: { metric: string; suppressed: boolean }[];
    }>('GET', `/institutions/${tenant.id}/dashboard`, { token: lead.token });
    expect(dash.body.sharing).toBeNull();
    expect(dash.body.weeks.every((w) => w.suppressed)).toBe(true);
    expect(
      (await api.req('GET', `/institutions/${tenant.id}/dashboard`, { token: first.token })).status,
    ).toBe(403);
    await api.req('POST', '/me/institution/outreach', {
      token: first.token,
      body: { message: 'Could someone check in with me this week?' },
    });
    const out = await api.req<{ items: { id: string; message: string }[] }>(
      'GET',
      `/institutions/${tenant.id}/outreach`,
      { token: lead.token },
    );
    expect(out.body.items[0]?.message).toBe('Could someone check in with me this week?');
    await api.req('DELETE', '/me/institution', { token: first.token });
    expect(
      (await api.req<{ tier: string }>('GET', '/me/entitlements', { token: first.token })).body
        .tier,
    ).toBe('free');
  });
});

describe('web sessions', () => {
  it('refreshes from the cookie with no request body', async () => {
    const email = `web-${randomUUID()}@example.test`;
    await api.req('POST', '/auth/magic-link', { body: { email } });
    const mail = await api.req<{ mail: { to: string; text: string }[] }>('GET', '/dev/mailbox');
    const code = /\b(\d{6})\b/.exec(mail.body.mail.find((m) => m.to === email)?.text ?? '')?.[1];
    const verify = await api.req('POST', '/auth/magic-link/verify', { body: { email, code } });
    const cookie = String(verify.headers['set-cookie']).split(';')[0] ?? '';
    expect(cookie).toMatch(/^figcit_rt=/);
    const res = await api.req<{ accessToken: string }>('POST', '/auth/refresh', {
      headers: { cookie },
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });
});
