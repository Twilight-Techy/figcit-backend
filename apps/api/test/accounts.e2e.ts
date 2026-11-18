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
    // 30 characters as the user sees them, but 210 code points: more than the column holds (B-08).
    const family = '👨‍👩‍👧‍👦';
    const emoji = await api.req<{ title: string; detail: string }>('POST', '/me/details', {
      token: u.token,
      body: details('18_plus', { nickname: family.repeat(30) }),
    });
    expect(emoji.status).toBe(400);
    const patched = await api.req('PATCH', '/me', {
      token: u.token,
      body: { nickname: family.repeat(30) },
    });
    expect(patched.status).toBe(400);
    const some = await api.req<{ me: { nickname: string } }>('PATCH', '/me', {
      token: u.token,
      body: { nickname: family.repeat(10) },
    });
    expect(some.status).toBe(200);
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

  it('staff set seats, add a support lead and invoice by hand; the lead sees seats and invoices', async () => {
    type Invoice = {
      id: string;
      number: string;
      seats: number;
      amountMinor: number;
      vatMinor: number;
      totalMinor: number;
      periodEnd: string;
      status: string;
      dueAt: string | null;
    };
    const admin = await api.staff(['admin']);
    const org = await api.req<Org>('POST', '/admin/organisations', {
      token: admin.token,
      body: { name: 'Riverside Works', kind: 'employer' },
    });
    const id = org.body.id;
    const seats = await api.req<Org & { seatsPurchased: number | null }>(
      'PATCH',
      `/admin/organisations/${id}`,
      { token: admin.token, body: { seatsPurchased: 25 } },
    );
    expect(seats.body.seatsPurchased).toBe(25);

    // The lead: an existing account, not counted as a seat.
    const lead = await api.signIn();
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: lead.userId } })).email ?? '';
    const added = await api.req<Org & { leads: string[] }>(
      'POST',
      `/admin/organisations/${id}/leads`,
      { token: admin.token, body: { email: email.toUpperCase() } },
    );
    expect(added.status).toBe(201);
    expect(added.body.leads).toEqual([email]);
    expect(added.body.seatsUsed).toBe(0);
    const nobody = await api.req('POST', `/admin/organisations/${id}/leads`, {
      token: admin.token,
      body: { email: 'nobody-here@example.com' },
    });
    expect(nobody.status).toBe(400);

    const code = await api.req<{ code: string }>('POST', `/admin/organisations/${id}/codes`, {
      token: admin.token,
      body: {},
    });
    const member = await api.signIn();
    await api.req('POST', '/institutions/join', {
      token: member.token,
      body: { code: code.body.code },
    });

    // A month of the 25 seats at £10, VAT on top; then a year at the year price.
    const inv = await api.req<Invoice>('POST', `/admin/organisations/${id}/invoices`, {
      token: admin.token,
      body: { periodStart: '2027-01-01' },
    });
    expect(inv.status).toBe(201);
    expect(inv.body).toMatchObject({
      seats: 25,
      amountMinor: 25_000,
      vatMinor: 5_000,
      totalMinor: 30_000,
      periodEnd: '2027-01-31',
      status: 'draft',
    });
    expect(inv.body.number).toMatch(/^FC-2027-\d{4}$/);
    const year = await api.req<Invoice>('POST', `/admin/organisations/${id}/invoices`, {
      token: admin.token,
      body: { periodStart: '2027-02-01', interval: 'year', seats: 3, note: 'Pilot group' },
    });
    expect(year.body).toMatchObject({ seats: 3, amountMinor: 30_000, periodEnd: '2028-01-31' });
    expect(year.body.number).not.toBe(inv.body.number);

    // Drafts stay with staff; a sent invoice shows on the lead's dashboard, then paid.
    const dash = async () =>
      api.req<{
        members: number;
        seats: { used: number; purchased: number | null };
        invoices: { number: string; status: string; totalMinor: number }[];
      }>('GET', `/institutions/${id}/dashboard`, { token: lead.token });
    const before = await dash();
    expect(before.status).toBe(200);
    expect(before.body.seats).toEqual({ used: 1, purchased: 25 });
    expect(before.body.invoices).toEqual([]);
    const sent = await api.req<Invoice>(
      'PATCH',
      `/admin/organisations/${id}/invoices/${inv.body.id}`,
      { token: admin.token, body: { status: 'sent' } },
    );
    expect(sent.body.status).toBe('sent');
    expect(sent.body.dueAt).toBeTruthy();
    expect((await dash()).body.invoices).toMatchObject([
      { number: inv.body.number, status: 'sent', totalMinor: 30_000 },
    ]);
    await api.req('PATCH', `/admin/organisations/${id}/invoices/${inv.body.id}`, {
      token: admin.token,
      body: { status: 'paid' },
    });
    expect((await dash()).body.invoices[0]?.status).toBe('paid');
    const again = await api.req('PATCH', `/admin/organisations/${id}/invoices/${inv.body.id}`, {
      token: admin.token,
      body: { status: 'void' },
    });
    expect(again.status).toBe(409);
    const list = await api.req<{ items: Invoice[] }>('GET', `/admin/organisations/${id}/invoices`, {
      token: admin.token,
    });
    expect(list.body.items.map((i) => i.status).sort()).toEqual(['draft', 'paid']);
    // Members never see the dashboard.
    expect(
      (await api.req('GET', `/institutions/${id}/dashboard`, { token: member.token })).status,
    ).toBe(403);
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
