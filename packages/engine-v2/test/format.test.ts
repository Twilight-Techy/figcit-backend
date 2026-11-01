import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  CATALOGUE_FILE,
  catalogueOf,
  describeFormat,
  engineJsonSchema,
  FACTS,
  readWorkbook,
  slug,
  validateEngine,
  validateMapping,
  withAdditions,
  writeWorkbook,
  type Catalogue,
  type WorkbookCell,
} from '../src/index.js';

const dir = resolve(import.meta.dirname, '../../../docs/specs/rules-engine-v3.3');
const files: Record<string, string> = {};
for (const name of readdirSync(dir)) {
  if (name.endsWith('.csv')) files[name] = readFileSync(resolve(dir, name), 'utf8');
}
const imported = withAdditions(readWorkbook(files));
const { catalogue, issues: catalogueIssues } = catalogueOf(imported.records);
const codes = (c: Catalogue, domain: Parameters<Catalogue['get']>[0]): string[] =>
  (c.get(domain) ?? []).map((v) => v.code);

/** EX-1 as engine columns: one rule, read straight from the Tab 10 text. */
const ex1 = {
  stage: 'capacity_fit',
  rules: [
    {
      when: {
        any: [
          { fact: 'peak.negative', op: 'gte', value: { band: 'high' } },
          { fact: 'sensation.intensity', key: 'pain', op: 'gte', value: 7 },
          { fact: 'families', op: 'contains', value: 'shutdown_freeze_numb' },
        ],
      },
      then: [{ kind: 'band.lower', steps: 1 }],
    },
  ],
};
/** A catalogue with a sensation group and a tool, as M3 will add (E-19). */
const withExtras = catalogueOf([
  ...imported.records,
  ...[
    ['sensation_group', 'pain', 'Pain'],
    ['tool', 'breathe', 'Breathe'],
  ].map(([domain = '', code = '', label = '']) => ({
    tab: 'catalogue',
    status: 'active',
    frame: 0,
    columns: [
      { header: 'Domain', text: domain, col: 0 },
      { header: 'Code', text: code, col: 1 },
      { header: 'Label', text: label, col: 2 },
    ],
  })),
]).catalogue;

describe('the catalogue, filled from the workbook', () => {
  it('has every standard value the workbook defines', () => {
    expect(catalogueIssues).toEqual([]);
    expect(codes(catalogue, 'cell')).toHaveLength(16);
    expect(codes(catalogue, 'band')).toEqual([
      'very_constrained',
      'constrained',
      'conditional',
      'available',
    ]);
    expect(codes(catalogue, 'light')).toEqual(['green', 'yellow', 'amber', 'red', 'blue']);
    expect(codes(catalogue, 'family')).toHaveLength(33);
    expect(codes(catalogue, 'family')).toContain('anxious_fearful');
    expect(catalogue.get('intensity_band')?.map((v) => [v.code, v.from, v.to])).toEqual([
      ['mild', 0, 3],
      ['moderate', 4, 6],
      ['high', 7, 8],
      ['very_high', 9, 10],
    ]);
    expect(codes(catalogue, 'sensitivity_flag')).toHaveLength(8);
    expect(codes(catalogue, 'context')).toHaveLength(19);
    expect(codes(catalogue, 'timeline')).toEqual([
      'T0',
      'T1',
      'T2',
      'T3',
      'T4',
      'T5',
      'T6',
      'TX',
      'TR',
    ]);
    expect(catalogue.get('driver')?.map((v) => `${v.group ?? ''}:${v.code}`)).toContain(
      'C:collaboration',
    );
    expect(codes(catalogue, 'demand_characteristic')).toHaveLength(17);
    expect(codes(catalogue, 'need')).toHaveLength(21);
    expect(codes(catalogue, 'pathway')).toEqual([
      'regulate',
      'express',
      'execute',
      'dump',
      'adapt',
      'reflect',
      'connect',
      'meditate',
    ]);
    expect(codes(catalogue, 'pattern')).toHaveLength(41);
    expect(codes(catalogue, 'tool')).toEqual([]);
  });

  it('marks values read from the text as interpreted, and says what it left out', () => {
    const rows = imported.records.filter((r) => r.tab === 'catalogue');
    const interpreted = rows.filter((r) => r.mapping === 'interpreted').map((r) => r.sourceRef);
    expect(interpreted).toContain('setting_class · public');
    expect(interpreted).toContain('plan · free');
    // 16 cells, 4 bands, 5 lights, 33 families, 4 intensity bands, 8 flags, 19 contexts,
    // 9 timelines, 8 drivers, 17 characteristics, 21 needs, 8 pathways, 41 patterns.
    expect(rows.filter((r) => r.mapping === 'exact')).toHaveLength(193);
    expect(imported.additions.notes.some((n) => n.includes('ALL public'))).toBe(true);
    expect(imported.additions.catalogueGiven).toBe(false);
  });

  it('survives export and re-import unchanged, with the added tables kept as given', () => {
    const again = withAdditions(readWorkbook(writeWorkbook(imported.records, imported.frames)));
    expect(again.additions).toMatchObject({
      catalogue: 0,
      catalogueGiven: true,
      inputMappingsGiven: true,
    });
    expect(catalogueOf(again.records).catalogue).toEqual(catalogue);
    expect(again.frames).toEqual(imported.frames);
    expect(readWorkbook(files).report.missingFiles).toEqual([]);
    expect(CATALOGUE_FILE in readWorkbook(files).frames).toBe(false);
  });

  it('reports bad catalogue rows instead of guessing', () => {
    const row = (
      cells: Record<string, string>,
    ): { tab: string; status: string; frame: number; columns: WorkbookCell[] } => ({
      tab: 'catalogue',
      status: 'active',
      frame: 0,
      columns: Object.entries(cells).map(([header, text], col) => ({ header, text, col })),
    });
    const out = catalogueOf([
      row({ Domain: 'colour', Code: 'red', Label: 'Red' }),
      row({ Domain: 'band', Code: 'bad code', Label: '' }),
      row({ Domain: 'intensity_band', Code: 'x', Label: 'X', From: '9', To: '3', Order: 'one' }),
      row({ Domain: 'plan', Code: 'free', Label: 'Free' }),
      row({ Domain: 'plan', Code: 'free', Label: 'Again' }),
      { ...row({ Domain: 'plan', Code: 'gone', Label: 'Gone' }), status: 'retired' },
    ]);
    expect(out.issues.map((i) => i.message)).toEqual([
      'unknown domain "colour"',
      'use 1-48 letters, digits or _',
      'a label is needed',
      '"one" is not a number',
      'To is below From',
      '"free" is already in plan',
    ]);
    expect(codes(out.catalogue, 'plan')).toEqual(['free']);
  });

  it('makes codes from labels', () => {
    expect(slug("'Not sure how I feel'")).toBe('not_sure_how_i_feel');
    expect(slug('Pain / illness flare  (SENSATION-LED: Body)')).toBe('pain_illness_flare');
    expect(slug('(only brackets)')).toBe('value');
    expect(slug('a'.repeat(30) + ' ' + 'b'.repeat(30))).toBe('a'.repeat(30));
  });
});

describe('validating engine columns', () => {
  it('accepts a rule written from the text', () => {
    expect(validateEngine(ex1, withExtras)).toEqual([]);
  });

  it('says a value is missing from the catalogue rather than accepting it', () => {
    expect(validateEngine(ex1, catalogue)).toEqual([
      {
        path: '/rules/0/when/any/1/key',
        message: 'the catalogue has no sensation_group values yet',
      },
    ]);
  });

  it('finds every problem, with where it is', () => {
    const bad = {
      stage: 'lunch',
      extra: 1,
      rules: [
        {
          when: {
            all: [
              { fact: 'band.final', op: 'gte', value: 'purple' },
              {
                fact: 'families',
                op: 'contains_any',
                value: ['anxious_fearful', 'anxious_fearful'],
              },
              { fact: 'demand.present', op: 'is', value: 'yes' },
              { fact: 'needs', op: 'empty', value: 'x' },
              { fact: 'state.energy', op: 'gte', value: 9 },
              { fact: 'family.intensity', op: 'gte', value: 7 },
              { fact: 'light', key: 'x', op: 'contains', value: 'red' },
              { fact: 'nope', op: 'eq' },
              { fact: 'peak.negative', op: 'gte' },
              { not: 'x' },
              { all: [] },
            ],
          },
          then: [
            { kind: 'band.lower', steps: 4 },
            { kind: 'propose', slot: 'middle', target: { pathway: 'regulate', tool: 'x' } },
            { kind: 'require', slot: 'primary', target: { action: 'dance' } },
            { kind: 'copy.use', slot: 'primary', key: 'Bad Key' },
            { kind: 'drivers.add', drivers: [] },
            { kind: 'step_cap.set', max: 2.5 },
            { kind: 'forbid', target: { colour: 'red' } },
            { kind: 'teleport' },
            'x',
          ],
          note: '',
        },
        'x',
      ],
      interpretation: 3,
    };
    const issues = validateEngine(bad, withExtras);
    const at = (path: string): string[] =>
      issues.filter((i) => i.path === path).map((i) => i.message);
    expect(at('/extra')).toEqual(['not allowed here']);
    expect(at('/stage')[0]).toMatch(/^expected one of safety/);
    expect(at('/layer')).toEqual(['a row that proposes needs a layer']);
    expect(at('/rules/0/when/all/0/value')).toEqual(['"purple" is not a band in the catalogue']);
    expect(at('/rules/0/when/all/1/value')).toEqual(['a value is repeated']);
    expect(at('/rules/0/when/all/2/value')).toEqual(['expected true or false']);
    expect(at('/rules/0/when/all/3/value')).toEqual(['empty takes no value']);
    expect(at('/rules/0/when/all/4/value')).toEqual(['expected a number from 1 to 4']);
    expect(at('/rules/0/when/all/5/key')).toEqual(['expected a family code']);
    expect(at('/rules/0/when/all/6/key')).toEqual(['light takes no key']);
    expect(at('/rules/0/when/all/6/op')[0]).toMatch(/^light allows eq/);
    expect(at('/rules/0/when/all/7/fact')).toEqual(['unknown fact "nope"']);
    expect(at('/rules/0/when/all/8/value')).toEqual(['missing']);
    expect(at('/rules/0/when/all/9/not')).toEqual(['expected a condition']);
    expect(at('/rules/0/when/all/10/all')).toEqual(['expected 1-16 conditions']);
    expect(at('/rules/0/then/0/steps')).toEqual(['expected a whole number from 1 to 3']);
    expect(at('/rules/0/then/1/slot')[0]).toMatch(/^expected one of primary/);
    expect(at('/rules/0/then/1/target')).toEqual([
      'expected one of { pathway }, { tool } or { action }',
    ]);
    expect(at('/rules/0/then/2/target/action')[0]).toMatch(/^expected one of get_support_now/);
    expect(at('/rules/0/then/3/key')).toEqual(['expected a wording key like card.reset.title']);
    expect(at('/rules/0/then/4/drivers')).toEqual(['give 1 to 40 values']);
    expect(at('/rules/0/then/5/max')).toEqual(['expected a whole number from 1 to 20']);
    expect(at('/rules/0/then/6/target')).toEqual([
      'expected one of { pathway }, { tool } or { action }',
    ]);
    expect(at('/rules/0/then/7/kind')).toEqual(['unknown effect "teleport"']);
    expect(at('/rules/0/then/8')).toEqual(['expected an effect']);
    expect(at('/rules/0/note')).toEqual(['expected text of 1-2000 characters']);
    expect(at('/rules/1')).toEqual(['expected a rule']);
    expect(at('/interpretation')).toEqual(['expected text of 1-2000 characters']);
  });

  it('keeps conditions small and shallow', () => {
    let deep: unknown = { fact: 'demand.present', op: 'is', value: true };
    for (let i = 0; i < 7; i += 1) deep = { not: deep };
    const big = {
      all: Array.from({ length: 16 }, () => ({
        any: Array.from({ length: 4 }, () => ({ fact: 'demand.present', op: 'is', value: true })),
      })),
    };
    const run = (when: unknown) =>
      validateEngine(
        { stage: 'demand', rules: [{ when, then: [{ kind: 'support.show' }] }] },
        catalogue,
      );
    expect(run(deep).map((i) => i.message)).toEqual(['conditions nest at most 6 deep']);
    expect(run(big).map((i) => i.message)).toEqual(['a condition may have at most 64 parts']);
    expect(validateEngine({ stage: 'demand', rules: [] }, catalogue)[0]?.message).toBe(
      'expected 1-16 rules',
    );
    expect(validateEngine('x', catalogue)[0]?.message).toBe('expected the engine columns');
  });

  it('ties the mapping status to the engine columns', () => {
    expect(validateMapping('pending', null, catalogue)).toEqual([]);
    expect(validateMapping('reference', ex1, catalogue)[0]?.message).toBe(
      'a reference row has no engine columns',
    );
    expect(validateMapping('exact', null, catalogue)[0]?.message).toBe(
      'an exact row needs engine columns',
    );
    expect(validateMapping('interpreted', ex1, withExtras)).toEqual([
      { path: '/interpretation', message: 'say how the text was read' },
    ]);
    expect(
      validateMapping(
        'interpreted',
        { ...ex1, interpretation: 'Pain read as the Body pain group' },
        withExtras,
      ),
    ).toEqual([]);
  });
});

describe('the JSON Schema agrees with the validator', () => {
  const ajv = new Ajv2020({ allowUnionTypes: true, strict: true });
  const check = ajv.compile(engineJsonSchema(withExtras));
  const samples: unknown[] = [
    ex1,
    { ...ex1, stage: 'lunch' },
    {
      stage: 'orchestration',
      layer: 'trigger',
      rules: [
        {
          when: null,
          then: [
            {
              kind: 'propose',
              slot: 'primary',
              target: { pathway: 'regulate' },
              copy: 'card.reset.title',
            },
          ],
        },
      ],
    },
    {
      stage: 'orchestration',
      layer: 'trigger',
      rules: [
        { when: null, then: [{ kind: 'propose', slot: 'primary', target: { pathway: 'swim' } }] },
      ],
    },
    {
      stage: 'context',
      rules: [
        {
          when: { fact: 'context.classes', op: 'contains_all', value: ['public', 'formal'] },
          then: [{ kind: 'tools.exclude', tools: ['breathe'] }],
        },
      ],
    },
    {
      stage: 'context',
      rules: [
        {
          when: { fact: 'context.classes', op: 'contains_all', value: 'public' },
          then: [{ kind: 'support.show' }],
        },
      ],
    },
    {
      stage: 'demand',
      rules: [
        {
          when: { fact: 'demand.timeline', op: 'in', value: ['T0', 'T1'] },
          then: [{ kind: 'step_cap.set', max: null }],
        },
      ],
    },
    {
      stage: 'demand',
      rules: [
        {
          when: { fact: 'demand.timeline', op: 'gte', value: 'T0' },
          then: [{ kind: 'step_cap.set', max: 3 }],
        },
      ],
    },
    {
      stage: 'feedback',
      rules: [
        {
          when: { fact: 'recheck.intensity_change', op: 'lte', value: -2 },
          then: [{ kind: 'light.set', light: 'blue' }],
        },
      ],
    },
    {
      stage: 'feedback',
      rules: [
        {
          when: { fact: 'family.intensity', key: 'grief_loss', op: 'present' },
          then: [{ kind: 'drivers.keep_only', drivers: [] }],
        },
      ],
    },
    {
      stage: 'feedback',
      rules: [{ when: { fact: 'family.intensity', op: 'present' }, then: [{ kind: 'band.hold' }] }],
    },
    {
      stage: 'safety',
      rules: [
        {
          when: { fact: 'safety.risk', op: 'is', value: true },
          then: [
            { kind: 'stop' },
            { kind: 'require', slot: 'visible', target: { action: 'get_support_now' } },
          ],
        },
      ],
      extra: 1,
    },
  ];

  it('accepts and refuses the same rules', () => {
    for (const sample of samples) {
      // Two rules the schema can't state (layer when proposing; size limits) are not in these samples.
      expect(check(sample), JSON.stringify(sample)).toBe(
        validateEngine(sample, withExtras).length === 0,
      );
    }
    expect(samples.filter((s) => check(s)).length).toBe(6);
  });

  it('describes every fact and effect for the staff app', () => {
    const format = describeFormat(withExtras, []);
    expect(format.format).toBe(2);
    expect(format.facts).toHaveLength(FACTS.length);
    expect(format.facts.find((f) => f.name === 'band.final')?.ops).toContain('gte');
    expect(format.domains.find((d) => d.domain === 'tool')?.values.map((v) => v.code)).toEqual([
      'breathe',
    ]);
    expect(format.mappingStatuses).toContain('reference');
    const schema = engineJsonSchema(catalogue) as {
      $defs: Record<string, { oneOf: { not?: unknown }[] }>;
    };
    expect(schema.$defs['target']?.oneOf[1]).toEqual({
      type: 'object',
      properties: { tool: { not: {}, description: 'The catalogue has no tool values yet' } },
      required: ['tool'],
      additionalProperties: false,
    });
  });
});
