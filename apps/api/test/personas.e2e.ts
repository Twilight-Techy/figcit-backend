// Seeds the demo personas into the test database and checks each one shows what docs/build/SEED.md says.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedInstitution } from '../prisma/seed/personas/institution.js';
import { DOMAIN, seedPersonas } from '../prisma/seed/personas/personas.js';
import { DEMO_PASSWORD, Seeder } from '../prisma/seed/personas/seeder.js';
import { SustainedService } from '../src/modules/safety/sustained.service.js';
import { bootApi, type Api } from './helpers.js';

let api: Api;
let tenantId: string;

const signIn = async (name: string): Promise<string> => {
  const res = await api.req<{ accessToken: string }>('POST', '/auth/password/sign-in', {
    body: { email: `${name}@${DOMAIN}`, password: DEMO_PASSWORD },
    headers: { 'x-client': 'native' },
  });
  if (!res.body.accessToken) throw new Error(`sign-in ${name}: ${JSON.stringify(res.body)}`);
  return res.body.accessToken;
};

beforeAll(async () => {
  api = await bootApi();
  const s = new Seeder(api.app);
  await s.wipe(DOMAIN);
  await seedPersonas(s);
  tenantId = (await seedInstitution(s, DOMAIN)).tenantId;
  await new Promise((r) => setTimeout(r, 1000));
}, 180_000);
afterAll(() => api.close());

describe('demo personas', () => {
  it('Ada has a full history across every pathway', async () => {
    const t = await signIn('ada');
    const progress = await api.req<{
      checkIns: number;
      lights: Record<string, number>;
      didItHelp: unknown[];
    }>('GET', '/progress?range=90', { token: t });
    expect(progress.body.checkIns).toBeGreaterThan(25);
    expect(Object.values(progress.body.lights).filter((n) => n > 0).length).toBeGreaterThanOrEqual(
      4,
    );
    expect(progress.body.didItHelp.length).toBeGreaterThan(0);
    const [tasks, dumps, drafts, refl, practices, contacts, shares, patterns] = await Promise.all(
      [
        '/tasks/ordered',
        '/dumps',
        '/drafts',
        '/reflections',
        '/practices',
        '/me/trusted-contacts',
        '/shares',
        '/patterns',
      ].map((u) => api.req<{ items?: unknown[]; saved?: unknown[] }>('GET', u, { token: t })),
    );
    for (const r of [tasks, dumps, drafts, refl, practices, contacts, shares])
      expect(r?.body.items?.length).toBeGreaterThan(0);
    expect(patterns?.body.saved?.length).toBeGreaterThan(0);
    expect(
      (await api.req<{ tier: string }>('GET', '/me/entitlements', { token: t })).body.tier,
    ).toBe('plus');
  });

  it('Ben is new and mostly empty', async () => {
    const t = await signIn('ben');
    expect(
      (await api.req<{ items: unknown[] }>('GET', '/check-ins', { token: t })).body.items,
    ).toHaveLength(2);
    expect(
      (await api.req<{ items: unknown[] }>('GET', '/reflections', { token: t })).body.items,
    ).toHaveLength(0);
  });

  it('Chi gets the SF-2 support prompt', async () => {
    await api.app.get(SustainedService).run();
    const t = await signIn('chi');
    const inbox = await api.req<{ items: { kind: string }[] }>('GET', '/inbox', { token: t });
    expect(inbox.body.items.some((i) => i.kind === 'support_prompt')).toBe(true);
  });

  it('Hana keeps comfort settings and Fin keeps Plus until the end date', async () => {
    const h = await api.req<{ preferences: { textSize: number; lowStimulation: boolean } }>(
      'GET',
      '/me',
      { token: await signIn('hana') },
    );
    expect(h.body.preferences).toMatchObject({ textSize: 3, lowStimulation: true });
    const f = await api.req<{ tier: string; items: { endsAt: string | null }[] }>(
      'GET',
      '/me/entitlements',
      { token: await signIn('fin') },
    );
    expect(f.body.tier).toBe('plus');
    expect(f.body.items[0]?.endsAt).toBeTruthy();
  });

  it('the support lead sees trends above the floor and Dee’s request', async () => {
    const t = await signIn('lead');
    const dash = await api.req<{ weeks: { suppressed: boolean }[] }>(
      'GET',
      `/institutions/${tenantId}/dashboard`,
      { token: t },
    );
    expect(dash.body.weeks.some((w) => !w.suppressed)).toBe(true);
    const out = await api.req<{ items: { message: string }[] }>(
      'GET',
      `/institutions/${tenantId}/outreach`,
      { token: t },
    );
    expect(out.body.items[0]?.message).toContain('Exams');
  });
});
