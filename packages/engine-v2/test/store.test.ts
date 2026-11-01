import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  fromDraft,
  initialSafety,
  readWorkbook,
  referenceOf,
  RULESET_FORMAT,
  rulesetDocument,
  tableSpec,
  toCsv,
  writeWorkbook,
  type JsonValue,
  type RuleRecordDraft,
} from '../src/index.js';

const dir = resolve(import.meta.dirname, '../../../docs/specs/rules-engine-v3.3');
const files: Record<string, string> = {};
for (const name of readdirSync(dir)) {
  if (name.endsWith('.csv')) files[name] = readFileSync(resolve(dir, name), 'utf8');
}
const first = readWorkbook(files);

/** What must survive a round trip: everything except where the row now sits in the sheet. */
const essence = (r: RuleRecordDraft): unknown => ({
  tab: r.tab,
  role: r.role,
  section: r.section,
  sourceRef: r.sourceRef,
  columns: r.columns,
  file: r.origin.file,
  frame: r.frame,
});

describe('writing the workbook back', () => {
  const written = writeWorkbook(first.records, first.frames);
  const again = readWorkbook(written);

  it('gives the same records, tables and report when read again', () => {
    expect(again.records.map(essence)).toEqual(first.records.map(essence));
    expect(again.frames).toEqual(first.frames);
    expect(again.report.byTab).toEqual(first.report.byTab);
    expect(again.report.unmappedTables).toEqual(first.report.unmappedTables);
    expect(again.report.duplicateRefs).toEqual(first.report.duplicateRefs);
    expect(again.report.missingFiles).toEqual([]);
  });

  it('is stable: writing what was read back gives the same files', () => {
    expect(writeWorkbook(again.records, again.frames)).toEqual(written);
  });

  it('leaves out retired rows and keeps a table whose rows are all gone', () => {
    const grid = first.records.filter((r) => r.origin.file === '1-state-grid-16-cells.csv');
    const notes = grid.filter((r) => r.frame === null);
    const out = readWorkbook(writeWorkbook(notes, first.frames));
    expect(out.records.filter((r) => r.role === 'rule')).toEqual([]);
    expect(out.frames['1-state-grid-16-cells.csv']).toEqual(
      first.frames['1-state-grid-16-cells.csv'],
    );
  });

  it('quotes CSV fields only when needed and pads rows', () => {
    expect(toCsv([['a', 'b,c'], ['say "hi"'], ['line\nbreak']])).toBe(
      'a,"b,c"\n"say ""hi""",\n"line\nbreak",\n',
    );
    expect(toCsv([])).toBe('\n');
  });

  it('skips files with nothing in them', () => {
    expect(writeWorkbook([], {})).toEqual({});
  });
});

describe('canonical JSON (RFC 8785)', () => {
  it('sorts keys by UTF-16 code units and drops undefined', () => {
    const value = { b: 1, a: [true, null, 'x'], '€': 2, '\r': 3, c: undefined };
    expect(canonicalJson(value)).toBe('{"\\r":3,"a":[true,null,"x"],"b":1,"€":2}');
  });

  it('writes numbers the ECMAScript way', () => {
    const numbers: JsonValue = [0, -0, 1e21, 1e-7, 333333333.3333333, 5e-324, -1.5];
    expect(canonicalJson(numbers)).toBe('[0,0,1e+21,1e-7,333333333.3333333,5e-324,-1.5]');
  });

  it('refuses values JSON cannot hold', () => {
    expect(() => canonicalJson(Number.NaN)).toThrow(TypeError);
    expect(() => canonicalJson(Infinity)).toThrow(TypeError);
    expect(() => canonicalJson((() => 1) as unknown as JsonValue)).toThrow(TypeError);
  });

  it('escapes strings as JSON.stringify does', () => {
    expect(canonicalJson('a"b\\c\u0001 ')).toBe('"a\\"b\\\\c\\u0001 "');
  });
});

describe('rule set versions', () => {
  const records = first.records.map(fromDraft);
  const content = { workbookVersion: '3.3', frames: first.frames, records };

  it('hashes the same content the same way, whatever the record order given', () => {
    const doc = rulesetDocument(content);
    expect(rulesetDocument({ ...content, records: [...records].reverse() })).toBe(doc);
    expect(doc.startsWith(`{"format":${String(RULESET_FORMAT)},`)).toBe(true);
  });

  it('changes when any cell changes', () => {
    const doc = rulesetDocument(content);
    const edited = records.map((r, i) =>
      i === 10 ? { ...r, columns: r.columns.map((c) => ({ ...c, text: `${c.text}!` })) } : r,
    );
    expect(rulesetDocument({ ...content, records: edited })).not.toBe(doc);
  });

  it('starts every row pending, active and with no engine columns', () => {
    expect(records.every((r) => r.mapping === 'pending' && r.status === 'active')).toBe(true);
    expect(records.every((r) => r.engine === null && r.workbookTag === null)).toBe(true);
  });

  it('marks the safety rows (E-25) and nothing that is not a rule', () => {
    const safe = records.filter((r) => r.safety);
    const refs = safe.map((r) => `${r.tab}:${r.sourceRef}`);
    expect(refs).toEqual(
      expect.arrayContaining([
        'patterns:28',
        'band_rules:SF-1',
        'band_rules:SF-2',
        'band_rules:RC-5',
        'tools_tiers:Regulate',
      ]),
    );
    expect(refs.some((r) => r.startsWith('experience_triggers:Immediate risk language'))).toBe(
      true,
    );
    expect(refs.some((r) => r.startsWith('bands:Very Constrained'))).toBe(true);
    expect(refs.some((r) => r.startsWith('decision_sequence:0.'))).toBe(true);
    expect(safe.every((r) => r.role === 'rule')).toBe(true);
    expect(
      initialSafety({ tab: 'patterns', role: 'example', sourceRef: '28', section: null }),
    ).toBe(false);
    expect(initialSafety({ tab: 'drivers', role: 'rule', sourceRef: 'x', section: null })).toBe(
      false,
    );
  });

  it('works out a row’s reference from its columns, as the reader does', () => {
    for (const r of first.records) {
      if (r.frame === null || r.sourceRef.includes(' #') || r.sourceRef.startsWith('row '))
        continue;
      expect(referenceOf(r.origin.file, r.frame, r.columns)).toBe(r.sourceRef);
    }
    expect(
      referenceOf('7-recommendation-matrix.csv', 0, [{ header: '#', text: '16.0', col: 0 }]),
    ).toBe('16');
    expect(referenceOf('1-state-grid-16-cells.csv', 0, [])).toBeNull();
    expect(referenceOf('unknown.csv', 3, [{ header: 'x', text: ' a  b ', col: 0 }])).toBe('a b');
    expect(tableSpec('unknown.csv', 0)).toBeUndefined();
  });
});
