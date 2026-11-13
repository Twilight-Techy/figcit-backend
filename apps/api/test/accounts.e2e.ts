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
