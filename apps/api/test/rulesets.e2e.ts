// Engine v2 rule store: import the real workbook, edit a draft, publish, roll back, the safety
// exemption gate, the registers and the audit chain (docs/engine-v2/DESIGN.md §3, §6, §7).
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readWorkbook } from '@figcit/engine-v2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApi, type Api } from './helpers.js';

/** Catalogue rows seeded from the workbook and the additions (E-49, E-50). */
const CATALOGUE_ROWS = 299;

const dir = resolve(import.meta.dirname, '../../../docs/specs/rules-engine-v3.3');
const files: Record<string, string> = {};
for (const name of readdirSync(dir))
  if (name.endsWith('.csv')) files[name] = readFileSync(resolve(dir, name), 'utf8');

interface Version {
  label: string;
  status: string;
  hash: string | null;
  basedOn: string | null;
  counts: { records: number; rules: number; safety: number; retired: number };
  checks: {
    blocking: unknown[];
    invalid: { sourceRef: string }[];
    behaviour?: { ran: number; counts: Record<string, number> };
  } | null;
}
interface Row {
  recordId: string;
  sourceRef: string;
  safety: boolean;
  mapping: string;
  status: string;
  order: number;
  columns: { header: string; text: string; col: number }[];
}
type Items<T> = { items: T[] };

/** Rows the mapping file marks unresolved; each must have exactly one open gap (E-50). */
const UNRESOLVED = [
  'experience_triggers · Recurring struggle noticed (SYSTEM-LED + user confirms) · n/a (pattern)',
  'patterns · 34',
];
const openGapsFor = async (ref: string): Promise<number> => {
  const res = await api.req<Items<{ kind: string; sourceRefs: string[] }>>(
    'GET',
    '/rulesets/gaps?status=open',
    { token: admin },
  );
  return res.body.items.filter((g) => g.kind === 'unrepresentable' && g.sourceRefs.includes(ref))
    .length;
};

let api: Api;
let admin: string;
let reader: string;
// A unique workbook version per run, so the test never meets versions from earlier runs.
const wb = `t${String(Date.now()).slice(-9)}`;

async function discardOpen(): Promise<void> {
  const list = await api.req<Items<Version>>('GET', '/rulesets', { token: admin });
  for (const v of list.body.items.filter((x) => x.status === 'draft' || x.status === 'in_review'))
    await api.req('POST', `/rulesets/${v.label}/discard`, {
      token: admin,
      body: { reason: 'e2e clean start' },
    });
}

beforeAll(async () => {
  api = await bootApi();
  admin = (await api.staff(['clinical_admin'])).token;
  reader = (await api.staff(['content_editor'])).token;
  await discardOpen();
});

afterAll(async () => {
  await discardOpen();
  await api.close();
});

describe('rule store (engine v2)', () => {
  const first = `${wb}-r1`;
  let rules: Row[];

  it('imports the workbook word for word into a draft', async () => {
    const res = await api.req<{
      version: Version;
      report: { totalRecords: number };
      additions: { catalogue: number; inputs: number };
    }>('POST', '/rulesets/import', {
      token: admin,
      body: { files, workbookVersion: wb, notes: 'e2e' },
    });
    expect(res.status).toBe(201);
    expect(res.body.version.label).toBe(first);
    expect(res.body.version.status).toBe('draft');
    const expected = readWorkbook(files);
    expect(res.body.report.totalRecords).toBe(expected.records.length);

    const v = await api.req<Version>('GET', `/rulesets/${first}`, { token: reader });
    // The workbook's rows, plus the catalogue filled from them (E-36).
    // 175 values read exactly from rows; 124 interpreted (setting classes, plans, sensation groups,
    // 79 tools and 4 supports: E-49; practice modes and tiers: E-50; harder families: E-51).
    expect(res.body.additions.catalogue).toBe(CATALOGUE_ROWS);
    // ...plus the check-in options filled from Figma (E-40).
    expect(v.body.counts.records).toBe(
      expected.records.length + CATALOGUE_ROWS + res.body.additions.inputs,
    );
    expect(v.body.counts.safety).toBeGreaterThan(5);

    const tab = await api.req<Items<Row>>('GET', `/rulesets/${first}/tabs/band_rules`, {
      token: reader,
    });
    rules = tab.body.items;
    const ex1 = rules.find((r) => r.sourceRef === 'EX-1');
    const source = expected.records.find((r) => r.tab === 'band_rules' && r.sourceRef === 'EX-1');
    expect(ex1?.columns).toEqual(source?.columns);
    expect(rules.find((r) => r.sourceRef === 'SF-1')?.safety).toBe(true);
    // Unresolved rows open a gap each, for the decider named in the mapping file.
    for (const ref of UNRESOLVED) expect(await openGapsFor(ref), ref).toBe(1);
  });

  it('refuses a second open version, an incomplete upload and writes by readers', async () => {
    const again = await api.req('POST', '/rulesets/import', {
      token: admin,
      body: { files, workbookVersion: wb },
    });
    expect(again.status).toBe(409);
    const partial = await api.req('POST', '/rulesets/import', {
      token: admin,
      body: { files: { 'readme.csv': files['readme.csv'] }, workbookVersion: wb },
    });
    expect(partial.status).toBe(400);
    const denied = await api.req('POST', `/rulesets/${first}/submit`, { token: reader });
    expect(denied.status).toBe(403);
    // A platform admin can read rules but not change them (E-34).
    const platform = (await api.staff(['admin'])).token;
    expect((await api.req('GET', `/rulesets/${first}`, { token: platform })).status).toBe(200);
    const notClinical = await api.req('POST', `/rulesets/${first}/submit`, { token: platform });
    expect(notClinical.status).toBe(403);
  });

  it('exports the draft back into the same sheets', async () => {
    const res = await api.req<{ files: Record<string, string> }>(
      'GET',
      `/rulesets/${first}/export`,
      { token: reader },
    );
    const strip = (r: { tab: string; sourceRef: string; columns: unknown }): unknown => [
      r.tab,
      r.sourceRef,
      r.columns,
    ];
    const exported = readWorkbook(res.body.files).records;
    // The workbook's own tabs come back as they were uploaded...
    const added = new Set(['catalogue', 'input_mappings']);
    expect(exported.filter((r) => !added.has(r.tab)).map(strip)).toEqual(
      readWorkbook(files).records.map(strip),
    );
    // ...and the added tables travel with them, so a re-import keeps them (E-36).
    expect(exported.filter((r) => r.tab === 'catalogue')).toHaveLength(CATALOGUE_ROWS);
    expect(exported.filter((r) => r.tab === 'input_mappings').length).toBeGreaterThan(200);
    expect(Object.keys(res.body.files)).toEqual(
      expect.arrayContaining(['x-catalogue.csv', 'x-input-mappings.csv']),
    );
  });

  it('edits, adds and retires single rows in the draft, with history', async () => {
    const ex1 = rules.find((r) => r.sourceRef === 'EX-1');
    if (!ex1) throw new Error('EX-1 missing');
    const why = ex1.columns.find((c) => c.header === 'Why');
    const edit = await api.req<Row>('PATCH', `/rulesets/${first}/records/${ex1.recordId}`, {
      token: admin,
      body: {
        cells: [
          ...ex1.columns.filter((c) => c !== why),
          { col: why?.col ?? 4, text: 'Edited.' },
        ].map((c) => ({ col: c.col, text: c.text })),
        reason: 'e2e edit',
      },
    });
    expect(edit.status).toBe(200);
    expect(edit.body.columns.find((c) => c.header === 'Why')?.text).toBe('Edited.');
    expect(edit.body.sourceRef).toBe('EX-1');

    const dup = await api.req('POST', `/rulesets/${first}/records`, {
      token: admin,
      body: {
        after: ex1.recordId,
        cells: [
          { col: 0, text: 'CX-1' },
          { col: 2, text: 'x' },
        ],
        reason: 'dup',
      },
    });
    expect(dup.status).toBe(409);

    const added = await api.req<Row>('POST', `/rulesets/${first}/records`, {
      token: admin,
      body: {
        after: ex1.recordId,
        cells: [
          { col: 0, text: 'EX-9' },
          { col: 1, text: 'Experience' },
          { col: 2, text: 'A new trigger' },
        ],
        reason: 'e2e add',
      },
    });
    expect(added.status).toBe(201);
    expect(added.body.order).toBe(ex1.order + 1);

    const retired = await api.req<Row>(
      'POST',
      `/rulesets/${first}/records/${added.body.recordId}/retire`,
      {
        token: admin,
        body: { reason: 'e2e retire' },
      },
    );
    expect(retired.body.status).toBe('retired');

    const nothing = await api.req('PATCH', `/rulesets/${first}/records/${ex1.recordId}`, {
      token: admin,
      body: { safety: false, reason: 'no change' },
    });
    expect(nothing.status).toBe(400);
  });

  it('checks engine columns on save and again before publishing', async () => {
    const format = await api.req<{
      format: number;
      facts: { name: string }[];
      domains: { domain: string; values: { code: string }[] }[];
      schema: { $defs: Record<string, unknown> };
    }>('GET', `/rulesets/${first}/format`, { token: reader });
    expect(format.status).toBe(200);
    expect(format.body.format).toBe(3);
    expect(format.body.facts.map((f) => f.name)).toContain('peak.negative');
    expect(format.body.domains.find((d) => d.domain === 'band')?.values.map((v) => v.code)).toEqual(
      ['very_constrained', 'constrained', 'conditional', 'available'],
    );
    expect(format.body.schema.$defs['effect:band.lower']).toBeDefined();

    const ex1 = rules.find((r) => r.sourceRef === 'EX-1');
    if (!ex1) throw new Error('EX-1 missing');
    const engine = {
      stage: 'capacity_fit',
      rules: [
        {
          when: {
            any: [
              { fact: 'peak.negative', op: 'gte', value: { band: 'high' } },
              { fact: 'sensation.intensity', key: 'body_ache', op: 'gte', value: { band: 'high' } },
              { fact: 'families', op: 'contains', value: 'shutdown_freeze_numb' },
            ],
          },
          then: [{ kind: 'band.lower', steps: 1 }],
        },
      ],
    };
    const edit = (body: object) =>
      api.req<{ issues?: { path: string; message: string }[] }>(
        'PATCH',
        `/rulesets/${first}/records/${ex1.recordId}`,
        { token: admin, body: { reason: 'e2e engine columns', ...body } },
      );
    const missing = await edit({ mapping: 'exact', engine });
    expect(missing.status).toBe(400);
    expect(missing.body.issues).toEqual([
      {
        path: '/engine/rules/0/when/any/1/key',
        message: '"body_ache" is not a sensation_group in the catalogue',
      },
    ]);
    // A mapped row can't lose its engine columns and stay exact.
    expect((await edit({ mapping: 'exact', engine: null })).status).toBe(400);

    const catalogue = await api.req<Items<Row>>('GET', `/rulesets/${first}/tabs/catalogue`, {
      token: reader,
    });
    const pain = await api.req<Row>('POST', `/rulesets/${first}/records`, {
      token: admin,
      body: {
        after: catalogue.body.items[0]?.recordId,
        cells: [
          { col: 0, text: 'sensation_group' },
          { col: 1, text: 'body_ache' },
          { col: 2, text: 'Body ache' },
        ],
        reason: 'E-19 fill for EX-1',
      },
    });
    expect(pain.status).toBe(201);
    expect(pain.body.sourceRef).toBe('sensation_group · body_ache');
    expect((await edit({ mapping: 'exact', engine })).status).toBe(200);

    const rename = (code: string) =>
      api.req('PATCH', `/rulesets/${first}/records/${pain.body.recordId}`, {
        token: admin,
        body: {
          cells: [
            { col: 0, text: 'sensation_group' },
            { col: 1, text: code },
            { col: 2, text: 'Body ache' },
          ],
          reason: 'e2e rename',
        },
      });
    expect((await rename('body_aches')).status).toBe(200);
    const submitted = await api.req<Version>('POST', `/rulesets/${first}/submit`, { token: admin });
    expect(submitted.body.checks?.invalid.map((r) => r.sourceRef)).toEqual(['EX-1']);
    const refused = await api.req<{ code: string }>('POST', `/rulesets/${first}/publish`, {
      token: admin,
    });
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('ruleset_invalid');
    await api.req('POST', `/rulesets/${first}/reopen`, { token: admin });
    expect((await rename('body_ache')).status).toBe(200);
  });

  it('blocks publishing an exempt safety row until its gap is acknowledged', async () => {
    const sf1 = rules.find((r) => r.sourceRef === 'SF-1');
    if (!sf1) throw new Error('SF-1 missing');
    // Rule IDs carry across imports, so gaps acknowledged in an earlier run still cover SF-1.
    const old = await api.req<Items<{ id: string; recordIds: string[] }>>(
      'GET',
      '/rulesets/gaps?status=acknowledged',
      { token: admin },
    );
    // ...and so do the gaps recording a broken fixed rule (E-51): reopen both for this run.
    const byTitle = await api.req<Items<{ id: string; title: string }>>(
      'GET',
      '/rulesets/gaps?status=acknowledged',
      { token: admin },
    );
    for (const g of byTitle.body.items.filter((x) => x.title.startsWith('Breaks a fixed rule')))
      await api.req('PATCH', `/rulesets/gaps/${g.id}`, {
        token: admin,
        body: { status: 'open', reason: 'e2e reset' },
      });
    for (const g of old.body.items.filter((x) => x.recordIds.includes(sf1.recordId)))
      await api.req('PATCH', `/rulesets/gaps/${g.id}`, {
        token: admin,
        body: { status: 'open', reason: 'e2e reset' },
      });
    await api.req('PATCH', `/rulesets/${first}/records/${sf1.recordId}`, {
      token: admin,
      body: { mapping: 'unresolved', engine: null, reason: 'e2e exemption' },
    });
    const submitted = await api.req<Version>('POST', `/rulesets/${first}/submit`, { token: admin });
    expect(submitted.body.status).toBe('in_review');
    expect(submitted.body.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(submitted.body.checks?.blocking).toHaveLength(1);
    // With SF-1 exempt, the Hopeless chip no longer stops the run: the engine check catches it.
    expect(submitted.body.checks?.behaviour?.counts['hopeless_override']).toBeGreaterThan(0);
    expect(submitted.body.checks?.behaviour?.ran).toBe(3468);

    const editInReview = await api.req('PATCH', `/rulesets/${first}/records/${sf1.recordId}`, {
      token: admin,
      body: { mapping: 'pending', reason: 'too late' },
    });
    expect(editInReview.status).toBe(409);

    const blocked = await api.req<{ code: string }>('POST', `/rulesets/${first}/publish`, {
      token: admin,
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('safety_exemptions_open');

    const gap = await api.req<{ id: string; code: string; safety: boolean }>(
      'POST',
      '/rulesets/gaps',
      {
        token: admin,
        body: {
          title: 'Risk wording comes from another team',
          kind: 'undefined_term',
          detail: 'SF-1 reads a free-text flag whose form is not agreed (INPUT_GAPS IG-20).',
          recordIds: [sf1.recordId],
          decides: 'clinical_safety',
          whileExempt: 'Pattern 28 still fires on the Hopeless chip.',
          docRef: 'INPUT_GAPS IG-20',
        },
      },
    );
    expect(gap.status).toBe(201);
    expect(gap.body.safety).toBe(true);
    expect(gap.body.code).toMatch(/^GAP-\d{4}$/);
    await api.req('PATCH', `/rulesets/gaps/${gap.body.id}`, {
      token: admin,
      body: { status: 'acknowledged', reason: 'e2e sign-off' },
    });

    // The broken fixed rule was recorded as a gap on submit; it blocks until acknowledged too.
    const unsafe = await api.req<{ code: string }>('POST', `/rulesets/${first}/publish`, {
      token: admin,
    });
    expect(unsafe.status).toBe(409);
    expect(unsafe.body.code).toBe('ruleset_unsafe');
    const breaks = await api.req<Items<{ id: string; title: string; safety: boolean }>>(
      'GET',
      '/rulesets/gaps?status=open',
      { token: admin },
    );
    const hopeless = breaks.body.items.find((g) => g.title.includes('Hopeless chip'));
    expect(hopeless?.safety).toBe(true);
    await api.req('PATCH', `/rulesets/gaps/${hopeless?.id ?? ''}`, {
      token: admin,
      body: { status: 'acknowledged', reason: 'e2e sign-off of the exemption' },
    });

    const published = await api.req<Version>('POST', `/rulesets/${first}/publish`, {
      token: admin,
    });
    expect(published.status).toBe(201);
    expect(published.body.status).toBe('published');

    const frozen = await api.req('PATCH', `/rulesets/${first}/records/${sf1.recordId}`, {
      token: admin,
      body: { mapping: 'pending', reason: 'after publish' },
    });
    expect(frozen.status).toBe(409);

    const decision = await api.req('POST', '/rulesets/decisions', {
      token: admin,
      body: {
        code: `E2E-${wb}`,
        title: 'Keep SF-1 exempt until IG-20 is agreed',
        detail: 'e2e',
        source: 'e2e',
        decidedBy: 'e2e',
        decidedAt: '2026-11-01',
        gapIds: [gap.body.id],
      },
    });
    expect(decision.status).toBe(201);
  });

  it('copies a draft with the same rule IDs and hash, and rolls back to an older version', async () => {
    const second = await api.req<Version>('POST', '/rulesets/drafts', { token: admin, body: {} });
    expect(second.body.label).toBe(`${wb}-r2`);
    expect(second.body.basedOn).toBe(first);
    const v2 = await api.req<Version>('POST', `/rulesets/${wb}-r2/submit`, { token: admin });
    const v1 = await api.req<Version>('GET', `/rulesets/${first}`, { token: admin });
    expect(v2.body.hash).toBe(v1.body.hash);
    await api.req('POST', `/rulesets/${wb}-r2/publish`, { token: admin });
    expect(
      (await api.req<Version>('GET', `/rulesets/${first}`, { token: admin })).body.status,
    ).toBe('retired');

    const back = await api.req<Version>('POST', `/rulesets/${first}/rollback`, {
      token: admin,
      body: { reason: 'e2e rollback' },
    });
    expect(back.status).toBe(201);
    expect(back.body.label).toBe(`${wb}-r3`);
    expect(back.body.status).toBe('published');
    expect(back.body.hash).toBe(v1.body.hash);

    const sf1 = rules.find((r) => r.sourceRef === 'SF-1');
    const history = await api.req<Items<{ version: string }>>(
      'GET',
      `/rulesets/records/${sf1?.recordId ?? ''}/history`,
      {
        token: reader,
      },
    );
    expect(history.body.items.map((h) => h.version).slice(-3)).toEqual([
      first,
      `${wb}-r2`,
      `${wb}-r3`,
    ]);
  });

  it('keeps rule IDs on re-import and records everything in an unbroken audit chain', async () => {
    const res = await api.req<{ version: Version }>('POST', '/rulesets/import', {
      token: admin,
      body: { files, workbookVersion: wb },
    });
    const label = res.body.version.label;
    const tab = await api.req<Items<Row>>('GET', `/rulesets/${label}/tabs/band_rules`, {
      token: admin,
    });
    expect(tab.body.items.find((r) => r.sourceRef === 'EX-1')?.recordId).toBe(
      rules.find((r) => r.sourceRef === 'EX-1')?.recordId,
    );
    // A re-import doesn't open a second gap for a row whose gap is still open.
    for (const ref of UNRESOLVED) expect(await openGapsFor(ref), ref).toBe(1);
    await api.req('POST', `/rulesets/${label}/discard`, {
      token: admin,
      body: { reason: 'e2e done' },
    });

    const log = await api.req<Items<{ action: string }>>('GET', '/rulesets/audit?limit=200', {
      token: reader,
    });
    const actions = new Set(log.body.items.map((e) => e.action));
    for (const a of [
      'ruleset.import',
      'record.edit',
      'record.add',
      'record.retire',
      'gap.create',
      'gap.update',
      'ruleset.publish',
      'ruleset.rollback',
      'ruleset.discard',
    ])
      expect(actions.has(a), a).toBe(true);
    const chain = await api.req<{ ok: boolean; checked: number }>('GET', '/rulesets/audit/verify', {
      token: reader,
    });
    expect(chain.body.ok).toBe(true);
    expect(chain.body.checked).toBeGreaterThan(10);
  });
});
