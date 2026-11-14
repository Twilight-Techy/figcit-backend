// Sign-up details (S04a) and the age rule: one rule for the whole UK.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/db/prisma.service.js';
import { bootApi, type Api } from './helpers.js';

let api: Api;
let prisma: PrismaService;

beforeAll(async () => {
  api = await bootApi();
  prisma = api.app.get(PrismaService);
});
afterAll(() => api.close());

describe('your details (S04a) and the age rule', () => {
  const details = (ageBand: string, extra: Record<string, unknown> = {}) => ({
    nickname: 'Torera',
    ageBand,
    region: 'GB-WLS',
    acceptTerms: true,
    ...extra,
  });
  type Result = {
    outcome: string;
    me: { nickname: string; region: string; ageBand: string | null; detailsDone: boolean } | null;
  };

  it('18 or over carries on, with the name and nation stored', async () => {
    const u = await api.signIn();
    const before = await api.req<{ detailsDone: boolean }>('GET', '/me', { token: u.token });
    expect(before.body.detailsDone).toBe(false);
    const r = await api.req<Result>('POST', '/me/details', {
      token: u.token,
      body: details('18_plus', { productUpdates: true }),
    });
    expect(r.status).toBe(200);
    expect(r.body.outcome).toBe('ok');
    expect(r.body.me).toMatchObject({
      nickname: 'Torera',
      region: 'GB-WLS',
      ageBand: 'adult',
      detailsDone: true,
    });
  });

  it('needs Terms and a real name, and keeps any script', async () => {
    const u = await api.signIn();
    const noTerms = await api.req('POST', '/me/details', {
      token: u.token,
      body: details('18_plus', { acceptTerms: false }),
    });
    expect(noTerms.status).toBe(400);
    const long = await api.req('POST', '/me/details', {
      token: u.token,
      body: details('18_plus', { nickname: 'x'.repeat(31) }),
    });
    expect(long.status).toBe(400);
    const arabic = await api.req<Result>('POST', '/me/details', {
      token: u.token,
      body: details('18_plus', { nickname: 'تُريرا', region: 'IE' }),
    });
    expect(arabic.body.me).toMatchObject({ nickname: 'تُريرا', region: 'IE' });
  });

  it('16 or 17 joins through an institution first', async () => {
    const u = await api.signIn();
    const first = await api.req<Result>('POST', '/me/details', {
      token: u.token,
      body: details('16_17'),
    });
    expect(first.body.outcome).toBe('needs_institution');
    expect(first.body.me?.detailsDone).toBe(false);
    const tenant = await prisma.tenant.create({
      data: { name: 'College', slug: `c-${randomUUID().slice(0, 8)}`, kind: 'school' },
    });
    const code = `C${randomUUID().slice(0, 7).toUpperCase()}`;
    await prisma.inviteCode.create({ data: { code, tenantId: tenant.id } });
    await api.req('POST', '/institutions/join', { token: u.token, body: { code } });
    const again = await api.req<Result>('POST', '/me/details', {
      token: u.token,
      body: details('16_17'),
    });
    expect(again.body.outcome).toBe('ok');
    expect(again.body.me).toMatchObject({ ageBand: 'minor_institution', detailsDone: true });
  });

  it('under 16 erases the account at once', async () => {
    const u = await api.signIn();
    const r = await api.req<Result>('POST', '/me/details', {
      token: u.token,
      body: details('under_16'),
    });
    expect(r.body).toEqual({ outcome: 'not_available', me: null });
    expect(await prisma.user.findUnique({ where: { id: u.userId } })).toBeNull();
  });
});

describe('organisation codes (ENT-7, T-22)', () => {
  type Org = { id: string; plan: string; seatsUsed: number; codes: { code: string }[] };

  it('staff add an organisation and issue a code; joining gives Premium at once', async () => {
    const admin = await api.staff(['admin']);
    const made = await api.req<Org>('POST', '/admin/organisations', {
      token: admin.token,
      body: { name: 'Northgate College', kind: 'college' },
    });
    expect(made.status).toBe(201);
    const code = await api.req<{ code: string }>(
      'POST',
      `/admin/organisations/${made.body.id}/codes`,
      {
        token: admin.token,
        body: { maxUses: 50 },
      },
    );
    expect(code.body.code).toMatch(/^[A-Z2-9]{8}$/);
    const u = await api.signIn();
    await api.req('POST', '/institutions/join', { token: u.token, body: { code: code.body.code } });
    const ent = await api.req<{ level: string }>('GET', '/me/entitlements', { token: u.token });
    expect(ent.body.level).toBe('premium');
    const list = await api.req<{ items: Org[] }>('GET', '/admin/organisations', {
      token: admin.token,
    });
    expect(list.body.items.find((o) => o.id === made.body.id)?.seatsUsed).toBe(1);
  });

  it('the pilot gives Premium for six weeks, then the person chooses', async () => {
    const admin = await api.staff(['admin']);
    const pilot = await api.req<Org>('POST', '/admin/organisations', {
      token: admin.token,
      body: { name: 'Launch cohort', kind: 'programme', plan: 'pilot' },
    });
    const code = await api.req<{ code: string }>(
      'POST',
      `/admin/organisations/${pilot.body.id}/codes`,
      {
        token: admin.token,
        body: {},
      },
    );
    const u = await api.signIn();
    await api.req('POST', '/institutions/join', { token: u.token, body: { code: code.body.code } });
    const row = await prisma.entitlement.findFirstOrThrow({
      where: { userId: u.userId, source: 'institution' },
    });
    expect(row.planCode).toBe('pilot');
    const days = ((row.endsAt?.getTime() ?? 0) - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(42);
  });

  it('is for staff admins only', async () => {
    const u = await api.signIn();
    const r = await api.req('GET', '/admin/organisations', { token: u.token });
    expect(r.status).toBe(403);
  });
});

describe('Me and Life right now (ME-1 to ME-6)', () => {
  type View = { promptDue: boolean; lifeNow: string[]; pronouns: string | null };

  it('keeps the optional profile private, and prompts only after a first check-in', async () => {
    const u = await api.signIn();
    const empty = await api.req<View>('GET', '/me/profile', { token: u.token });
    expect(empty.body).toMatchObject({ promptDue: false, lifeNow: [], pronouns: null });
    await api.req('POST', '/check-ins', {
      token: u.token,
      body: { state: { kind: 'grid', energy: 3, mood: 3 } },
    });
    expect((await api.req<View>('GET', '/me/profile', { token: u.token })).body.promptDue).toBe(
      true,
    );
    const dismissed = await api.req<View>('POST', '/me/profile/prompt-dismissed', {
      token: u.token,
    });
    expect(dismissed.body.promptDue).toBe(false);
    const saved = await api.req<View>('PATCH', '/me/profile', {
      token: u.token,
      body: { pronouns: 'they/them', lifeNow: ['big_change', 'money'] },
    });
    expect(saved.body).toMatchObject({ pronouns: 'they/them', lifeNow: ['big_change', 'money'] });
    // Encrypted at rest: the stored blob doesn't contain what was written.
    const row = await prisma.user.findUniqueOrThrow({ where: { id: u.userId } });
    expect(Buffer.from(row.profileEnc ?? []).toString('utf8')).not.toContain('they/them');
  });

  it('asks about everyday life only, and "Prefer not to say" stands alone', async () => {
    const u = await api.signIn();
    const harm = await api.req('PATCH', '/me/profile', {
      token: u.token,
      body: { lifeNow: ['mental_health'] },
    });
    expect(harm.status).toBe(400);
    const mixed = await api.req('PATCH', '/me/profile', {
      token: u.token,
      body: { lifeNow: ['prefer_not', 'money'] },
    });
    expect(mixed.status).toBe(400);
  });
});
