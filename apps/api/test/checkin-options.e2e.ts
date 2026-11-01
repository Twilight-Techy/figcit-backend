// The check-in's standard input (DECISION_LOG E-39 to E-46): options from the published rule set,
// every value checked against them, nothing the user didn't choose, Browse on the server, and the
// user's own places. Runs before checkin.e2e.ts, so later files see a v2 rule set with options.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApi, type Api } from './helpers.js';

const dir = resolve(import.meta.dirname, '../../../docs/specs/rules-engine-v3.3');
const files: Record<string, string> = {};
for (const name of readdirSync(dir))
  if (name.endsWith('.csv')) files[name] = readFileSync(resolve(dir, name), 'utf8');

interface Option {
  code: string;
  label: string;
  group: string | null;
  risk?: true;
  needsTask?: true;
}
interface Options {
  version: string;
  hash: string;
  inputs: Record<string, Option[]>;
  intensityBands: { code: string; from: number; to: number }[];
  cells: { id: string; name: string }[];
}
interface Result {
  checkIn: { id: string; emotions: { code: string; intensity: number | null }[] };
  card: { light: string; primary: { kind: string } };
  detail?: string;
}

let api: Api;
let user: string;
let admin: string;

/** Publishes a fresh v2 rule set (with its check-in options), like an admin would. */
async function publishV2(): Promise<void> {
  const list = await api.req<{ items: { label: string; status: string }[] }>('GET', '/rulesets', {
    token: admin,
  });
  for (const v of list.body.items.filter((x) => x.status === 'draft' || x.status === 'in_review'))
    await api.req('POST', `/rulesets/${v.label}/discard`, {
      token: admin,
      body: { reason: 'e2e' },
    });
  const wb = `c${String(Date.now()).slice(-9)}`;
  const imp = await api.req<{ version: { label: string } }>('POST', '/rulesets/import', {
    token: admin,
    body: { files, workbookVersion: wb },
  });
  const label = imp.body.version.label;
  await api.req('POST', `/rulesets/${label}/submit`, { token: admin });
  const pub = await api.req<{ status: string }>('POST', `/rulesets/${label}/publish`, {
    token: admin,
  });
  if (pub.body.status !== 'published')
    throw new Error(`publish failed: ${JSON.stringify(pub.body)}`);
}

const checkIn = (body: object, token?: string, headers?: Record<string, string>) =>
  api.req<Result>('POST', '/check-ins', {
    ...(token ? { token } : {}),
    ...(headers ? { headers } : {}),
    body: { state: { kind: 'grid', energy: 3, mood: 3 }, ...body },
  });

beforeAll(async () => {
  api = await bootApi();
  admin = (await api.staff(['clinical_admin'])).token;
  user = (await api.signIn()).token;
  await publishV2();
  // The options service caches for 30 s; a fresh app reads the new version straight away.
  await api.close();
  api = await bootApi();
  user = (await api.signIn()).token;
});

afterAll(async () => {
  await api.close();
});

describe('check-in options (E-40)', () => {
  it('serves Figma’s options from the published rule set, publicly, with an ETag', async () => {
    const res = await api.req<Options>('GET', '/check-in/options');
    expect(res.status).toBe(200);
    const { inputs } = res.body;
    expect(inputs['feeling']?.filter((o) => o.group === 'harder')).toHaveLength(18);
    expect(inputs['feeling']?.find((o) => o.code === 'hopeless')?.risk).toBe(true);
    expect(inputs['need']?.find((o) => o.code === 'get_started')?.needsTask).toBe(true);
    expect(inputs['need']?.find((o) => o.code === 'feel_calmer')?.needsTask).toBeUndefined();
    expect(inputs['place']?.filter((o) => o.group === 'common')).toHaveLength(10);
    expect(res.body.cells.find((c) => c.id === 'E2M2')?.name).toBe('Slow Warm');
    expect(inputs['not_sure_comfort']?.map((o) => (o as Option & { level: number }).level)).toEqual(
      [1, 2, 3, 4],
    );
    expect(res.body.intensityBands.map((b) => b.code)).toEqual([
      'mild',
      'moderate',
      'high',
      'very_high',
    ]);
    expect(JSON.stringify(res.body)).not.toContain('mapsTo');
    const again = await api.req('GET', '/check-in/options', {
      headers: { 'if-none-match': `"${res.body.hash}"` },
    });
    expect(again.status).toBe(304);
  });
});

describe('the check-in input (E-41, E-45)', () => {
  it('keeps an unrated feeling unrated, and takes several supports', async () => {
    const res = await checkIn(
      {
        emotions: [
          { code: 'anxious', intensity: null },
          { code: 'calm', intensity: 4 },
        ],
        context: { environment: 'home', supports: ['just_me', 'headphones'], sensitivity: [] },
        justSupport: true,
      },
      user,
    );
    expect(res.status).toBe(201);
    expect(res.body.checkIn.emotions).toEqual(
      expect.arrayContaining([
        { code: 'anxious', intensity: null },
        { code: 'calm', intensity: 4 },
      ]),
    );
  });

  it('refuses values that aren’t offered, and answers that contradict each other', async () => {
    const bad = async (body: object): Promise<string> => {
      const res = await checkIn(body, user);
      expect(res.status).toBe(400);
      return res.body.detail ?? '';
    };
    expect(await bad({ emotions: [{ code: 'bored', intensity: 5 }] })).toBe(
      'Unknown feeling: bored',
    );
    expect(await bad({ context: { environment: 'open_plan' } })).toBe('Unknown place: open_plan');
    expect(await bad({ context: { supports: ['just_me', 'someone_with_me'] } })).toContain(
      'can’t both be picked'.replace('’', "'"),
    );
    expect(await bad({ needs: ['get_started'], justSupport: true })).toContain('the task step can');
  });

  it('takes a skipped state from quick entry', async () => {
    const res = await checkIn(
      { entry: 'quick', state: { kind: 'not_given' }, needs: ['feel_calmer'], justSupport: true },
      user,
    );
    expect(res.status).toBe(201);
  });

  it('gives a Hopeless check-in the safety card even when unrated (E-42, E-43)', async () => {
    const res = await checkIn({ emotions: [{ code: 'hopeless', intensity: null }] }, user);
    expect(res.status).toBe(201);
    expect(res.body.card.light).toBe('red');
  });
});

describe('Browse on the server (E-02, E-46)', () => {
  it('returns a card without an account and stores nothing', async () => {
    const token = await api.req<{ browseToken: string }>('POST', '/auth/browse');
    const res = await checkIn(
      {
        emotions: [{ code: 'overwhelmed', intensity: 8 }],
        needs: ['feel_calmer'],
        justSupport: true,
      },
      undefined,
      { 'x-browse-token': token.body.browseToken },
    );
    expect(res.status).toBe(201);
    expect(res.body.card.primary.kind).toBeTruthy();
    const stored = await api.req('GET', `/check-ins/${res.body.checkIn.id}`, { token: user });
    expect(stored.status).toBe(404);
    expect((await checkIn({ needs: ['feel_calmer'] })).status).toBe(401);
  });
});

describe('my own places (S10 + S90, E-45)', () => {
  it('saves a named place linked to a standard place, and uses it', async () => {
    const created = await api.req<{ id: string; label: string; likeCode: string }>(
      'POST',
      '/custom-places',
      { token: user, body: { label: 'Library quiet zone', likeCode: 'school' } },
    );
    expect(created.status).toBe(201);
    const refused = await api.req('POST', '/custom-places', {
      token: user,
      body: { label: 'Nowhere', likeCode: 'somewhere_else' },
    });
    expect(refused.status).toBe(400);
    const res = await checkIn(
      {
        context: { environment: 'school', customTagIds: [created.body.id] },
        needs: ['feel_calmer'],
        justSupport: true,
      },
      user,
    );
    expect(res.status).toBe(201);
    const mine = await api.req<{ items: { label: string; likeCode: string }[] }>(
      'GET',
      '/custom-places',
      { token: user },
    );
    expect(mine.body.items).toEqual([
      expect.objectContaining({ label: 'Library quiet zone', likeCode: 'school' }),
    ]);
    expect(
      (await api.req('DELETE', `/custom-places/${created.body.id}`, { token: user })).status,
    ).toBe(204);
  });
});
