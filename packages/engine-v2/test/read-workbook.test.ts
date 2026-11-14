import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FILE_ORDER,
  filesOf,
  parseCsv,
  readWorkbook,
  segment,
  filledCount,
  columnLetter,
  cellsOf,
  type TabKey,
} from '../src/index.js';

const dir = resolve(import.meta.dirname, '../../../docs/specs/rules-engine-v3.3');
const files: Record<string, string> = {};
for (const name of readdirSync(dir)) {
  if (name.endsWith('.csv')) files[name] = readFileSync(resolve(dir, name), 'utf8');
}
const result = readWorkbook(files);
const parsed = new Map(Object.entries(files).map(([name, text]) => [name, parseCsv(text)]));
const rowsOf = (tab: TabKey): number => result.report.byTab[tab]?.rows ?? 0;

describe('reading the v3.3 workbook', () => {
  it('finds every tab file and nothing unexpected', () => {
    expect(result.report.missingFiles).toEqual([]);
    expect(result.report.unknownFiles).toEqual([]);
    expect(result.report.files).toEqual(filesOf('3.3'));
  });

  it('reads the rows of each rule tab', () => {
    expect(rowsOf('state_grid')).toBe(16);
    expect(rowsOf('experience_triggers')).toBe(34);
    expect(rowsOf('sensitivity_flags')).toBe(8);
    expect(rowsOf('contexts')).toBe(20);
    expect(rowsOf('timelines')).toBe(9);
    expect(rowsOf('drivers')).toBe(8);
    expect(rowsOf('demand_characteristics')).toBe(17);
    expect(rowsOf('needs')).toBe(21);
    expect(rowsOf('patterns')).toBe(41);
    expect(rowsOf('decision_sequence')).toBe(15);
    expect(rowsOf('bands')).toBe(5);
    expect(rowsOf('journey_layers')).toBe(18);
    expect(rowsOf('coverage_gaps')).toBe(58);
    expect(rowsOf('reflect_meditate')).toBe(33);
    expect(rowsOf('tools_tiers')).toBe(39);
  });

  it('keeps the author’s own references', () => {
    const refs = (tab: string): string[] =>
      result.records
        .filter((r) => r.tab === tab && r.role === 'rule' && r.columns[0]?.header !== 'note')
        .map((r) => r.sourceRef);
    expect(refs('state_grid')).toContain('E1M1');
    expect(refs('state_grid')).toContain('E4M4');
    expect(refs('timelines')).toEqual(['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'TX', 'TR']);
    expect(refs('band_rules')).toEqual(
      expect.arrayContaining(['EX-1', 'CX-1', 'CAP-1', 'SF-1', 'SF-2', 'RC-5']),
    );
    expect(refs('reflect_meditate')).toEqual(
      expect.arrayContaining(['RF-1', 'RF-5', 'MD-1', 'MD-6']),
    );
    expect(refs('tools_tiers')).toEqual(expect.arrayContaining(['ENT-1', 'ENT-9']));
    expect(refs('patterns')[0]).toBe('1');
    expect(refs('patterns')).toContain('16');
    expect(refs('patterns')).toContain('41');
  });

  it('keeps examples as read-only reference, never as rules', () => {
    const examples = result.records.filter(
      (r) => r.tab === 'examples' && r.origin.file.startsWith('0'),
    );
    expect(examples.length).toBeGreaterThan(150);
    expect(examples.every((r) => r.role !== 'rule')).toBe(true);
    expect(
      result.records.filter((r) => r.tab === 'worked_example').every((r) => r.role !== 'rule'),
    ).toBe(true);
    expect(result.records.some((r) => r.tab === 'examples' && r.sourceRef === 'E1M1.1')).toBe(true);
  });

  it('puts the Tab 7 footer rules in their own table', () => {
    const footer = result.records.filter((r) => r.tab === 'non_negotiables');
    expect(footer.length).toBeGreaterThanOrEqual(9);
    expect(footer[0]?.role).toBe('note');
    expect(footer.slice(1).every((r) => r.role === 'rule')).toBe(true);
  });

  it('records where each row came from', () => {
    const e1m1 = result.records.find((r) => r.tab === 'state_grid' && r.sourceRef === 'E1M1');
    expect(e1m1?.origin.file).toBe('1-state-grid-16-cells.csv');
    expect(e1m1?.origin.sheetRow).toBe(4);
    expect(e1m1?.origin.range).toBe('A4:H4');
  });

  it('copies every cell word for word, in order', () => {
    for (const record of result.records) {
      const source = parsed.get(record.origin.file)?.[record.origin.sheetRow - 1] ?? [];
      const wanted = source.filter((cell) => cell !== '');
      const got = record.columns.map((c) => c.text).filter((text) => text !== '');
      expect(got).toEqual(wanted);
    }
  });

  it('drops no row: every filled sheet row is a record, a header or a banner', () => {
    for (const name of FILE_ORDER) {
      const rows = parsed.get(name) ?? [];
      const blocks = segment(rows, name.startsWith('0') ? 'Ref' : undefined);
      const structural = new Set<number>();
      for (const block of blocks) {
        if (block.type === 'table') {
          structural.add(block.headerRow);
          for (const b of block.banner) structural.add(b.sheetRow);
        }
      }
      const recorded = new Set(
        result.records.filter((r) => r.origin.file === name).map((r) => r.origin.sheetRow),
      );
      rows.forEach((cells, i) => {
        if (filledCount(cells) > 0)
          expect(recorded.has(i + 1) || structural.has(i + 1), `${name} row ${String(i + 1)}`).toBe(
            true,
          );
      });
    }
  });

  it('reports what it normalised and what it could not place', () => {
    expect(result.report.normalisedRefs.length).toBeGreaterThan(0);
    expect(result.report.normalisedRefs[0]).toContain('read as');
    // Tab 0 carries glossary tables after the scenarios; they are kept as reference and named.
    expect(result.report.unmappedTables.length).toBeGreaterThan(0);
    expect(result.report.totalRecords).toBe(result.records.length);
  });

  it('makes every reference unique within its table', () => {
    const keys = result.records.map((r) => `${r.tab}|${r.section ?? ''}|${r.sourceRef}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('reader pieces', () => {
  it('names spreadsheet columns', () => {
    expect([
      columnLetter(0),
      columnLetter(25),
      columnLetter(26),
      columnLetter(27),
      columnLetter(701),
    ]).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ']);
  });

  it('keeps unlabelled cells only when they hold text', () => {
    expect(cellsOf(['A', '', ''], ['1', '', 'x'])).toEqual([
      { header: 'A', text: '1', col: 0 },
      { header: '', text: 'x', col: 2 },
    ]);
  });

  it('reads missing files, unknown files and quoted text', () => {
    const odd = readWorkbook({
      'readme.csv': 'one,\n"two, ""quoted""\nline",\n',
      'extra.csv': 'x',
    });
    expect(odd.report.unknownFiles).toEqual(['extra.csv']);
    // A README alone is read as v3.3: every other v3.3 tab is missing, and none of v5.0's.
    expect(odd.report.missingFiles).toEqual(filesOf('3.3').filter((f) => f !== 'readme.csv'));
    expect(odd.records.map((r) => r.columns[0]?.text)).toEqual(['one', 'two, "quoted"\nline']);
  });

  it('numbers repeated references and starts a new table after a blank row', () => {
    const csv = ['Cell ID,Name', 'E1M1,One', 'E1M1,Again', '', 'Second,Table', 'Another,Row'].join(
      '\n',
    );
    const out = readWorkbook({ '1-state-grid-16-cells.csv': csv });
    expect(out.records.map((r) => r.sourceRef)).toEqual(['E1M1', 'E1M1 #2', 'Another']);
    expect(out.report.duplicateRefs.length).toBe(1);
    expect(out.report.unmappedTables).toEqual(['1-state-grid-16-cells.csv table 2: (no heading)']);
  });

  it('keeps a table without a header row as unlabelled reference cells', () => {
    const csv = ['Ref,Name', 'a,b', 'Title', 'x,y', 'z,w'].join('\n');
    const out = readWorkbook({ '0b-extended-scenarios.csv': csv });
    const rows = out.records.filter((r) => r.role === 'reference');
    expect(rows.map((r) => r.columns.map((c) => c.text))).toEqual([
      ['x', 'y'],
      ['z', 'w'],
    ]);
    expect(rows[0]?.columns[0]?.header).toBe('');
    expect(out.report.unmappedTables).toEqual(['0b-extended-scenarios.csv table 2: Title']);
  });
});
