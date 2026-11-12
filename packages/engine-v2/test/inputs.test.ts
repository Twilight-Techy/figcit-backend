import { describe, expect, it } from 'vitest';
import {
  inputOptionsOf,
  parseMapsTo,
  readWorkbook,
  rowIssues,
  withAdditions,
  type WorkbookCell,
} from '../src/index.js';
import { catalogue, codes, ex1, imported } from './fixtures.js';

describe('check-in options (E-40)', () => {
  const { options, issues } = inputOptionsOf(imported.records, catalogue);
  const codesOf = (input: keyof typeof options): string[] => options[input].map((o) => o.code);

  it('fills every option from Figma, each pointing at a real catalogue value', () => {
    expect(issues).toEqual([]);
    expect(codesOf('feeling')).toHaveLength(26);
    expect(options.feeling.filter((o) => o.group === 'harder')).toHaveLength(17);
    expect(codesOf('sensation')).toHaveLength(75);
    expect(codesOf('life_event')).toHaveLength(13);
    expect(options.place.filter((o) => o.group === 'common').map((o) => o.label)).toEqual([
      'Home',
      'School',
      'Work',
      'Public',
      'Transit',
      'Restaurant',
      'Mall',
      'Bus / train station',
      'Place of worship',
      'Prayer or quiet room',
    ]);
    expect(codesOf('need').slice(0, 11)).toContain('grateful');
    expect(codesOf('not_sure_energy')).toEqual(['empty', 'low', 'some', 'full']);
    expect(options.not_sure_comfort[1]?.mapsTo).toEqual({ axis: 'mood', level: 2 });
    expect(imported.additions.inputs).toBe(
      Object.values(options).reduce((n, list) => n + list.length, 0),
    );
  });

  it('maps Hopeless to immediate risk and marks it as a safety row', () => {
    expect(options.feeling.find((o) => o.code === 'hopeless')?.mapsTo).toEqual({
      domain: 'family',
      code: 'immediate_risk_language',
    });
    const row = imported.records.find((r) => r.sourceRef === 'feeling · hopeless');
    expect(row?.safety).toBe(true);
    expect(row?.mapping).toBe('interpreted');
  });

  it('marks the needs that need a task, and adds the sensation groups', () => {
    const task = (catalogue.get('need') ?? []).filter((v) => v.group === 'task_needed');
    expect(task.map((v) => v.code)).toEqual([
      'get_started',
      'break_it_into_steps',
      'decide_what_matters_now',
      'prepare_for_an_event',
    ]);
    expect(codes(catalogue, 'sensation_group')).toContain('detached');
  });

  it('reports bad option rows and options pointing nowhere', () => {
    const row = (cells: Record<string, string>) => ({
      tab: 'input_mappings',
      status: 'active',
      frame: 0,
      columns: Object.entries(cells).map(([header, text], col) => ({ header, text, col })),
    });
    const out = inputOptionsOf(
      [
        row({ Input: 'colour', Code: 'x', Label: 'X' }),
        row({ Input: 'feeling', Code: 'bad code', Label: '', Order: 'one', 'Maps to': 'nowhere' }),
        row({ Input: 'feeling', Code: 'x', Label: 'X', 'Maps to': 'family:not_a_family' }),
        row({ Input: 'time', Code: 'x', Label: 'X' }),
        row({ Input: 'time', Code: 'x', Label: 'Again' }),
      ],
      catalogue,
    );
    expect(out.issues.map((i) => i.message)).toEqual([
      'unknown input "colour"',
      'use 1-48 letters, digits or _',
      'a label is needed',
      '"one" is not a whole number',
      '"nowhere" is not a domain:code, energy:1-4 or mood:1-4',
      '"family:not_a_family" is not in the catalogue',
      '"x" is already an option of time',
    ]);
    expect(parseMapsTo('energy:5')).toBe('"energy:5" is not a domain:code, energy:1-4 or mood:1-4');
    expect(parseMapsTo('colour:red')).toMatch(/is not a domain:code/);
  });
});

describe('one row in its version (rowIssues)', () => {
  const cells = (o: Record<string, string>): WorkbookCell[] =>
    Object.entries(o).map(([header, text], col) => ({ header, text, col }));
  const base = { role: 'rule', frame: 0, engine: null, columns: [] as WorkbookCell[] };

  it('keeps value rows free of engine columns and checks their cells', () => {
    const cat = {
      ...base,
      tab: 'catalogue',
      mapping: 'exact',
      columns: cells({ Domain: 'plan', Code: 'x', Label: 'X' }),
    };
    expect(rowIssues(cat, catalogue)).toEqual([]);
    expect(
      rowIssues({ ...cat, engine: ex1, mapping: 'reference' }, catalogue).map((i) => i.message),
    ).toEqual([
      'catalogue rows have no engine columns',
      'catalogue rows use pending, exact, interpreted',
    ]);
    const input = {
      ...base,
      tab: 'input_mappings',
      mapping: 'interpreted',
      columns: cells({ Input: 'time', Code: 'x', Label: '' }),
    };
    expect(rowIssues(input, catalogue).map((i) => i.message)).toEqual(['a label is needed']);
  });

  it('allows notes and examples only pending or reference, and checks rules in full', () => {
    expect(
      rowIssues(
        { ...base, tab: 'readme', role: 'note', frame: null, mapping: 'reference' },
        catalogue,
      ),
    ).toEqual([]);
    expect(
      rowIssues({ ...base, tab: 'examples', role: 'example', mapping: 'exact' }, catalogue)[0]
        ?.message,
    ).toBe('example rows use pending, reference');
    expect(rowIssues({ ...base, tab: 'band_rules', mapping: 'pending' }, catalogue)).toEqual([]);
    expect(rowIssues({ ...base, tab: 'band_rules', mapping: 'exact' }, catalogue)).toEqual([
      { path: '/engine', message: 'an exact row needs engine columns' },
    ]);
    expect(
      rowIssues({ ...base, tab: 'band_rules', mapping: 'exact', engine: ex1 }, catalogue),
    ).toEqual([]);
  });

  it('says when the workbook has no intensity bands to fill', () => {
    const tiny = withAdditions(readWorkbook({ 'readme.csv': 'Just a note,\n' }));
    expect(tiny.additions.notes.some((n) => n.startsWith('intensity_band'))).toBe(true);
  });
});
