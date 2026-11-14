// Rules Engine v5.0 read like v3.3: one file per tab, word for word, nothing dropped.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { editionOf, filesOf, readWorkbook, type TabKey } from '../src/index.js';

const dir = resolve(import.meta.dirname, '../../../docs/specs/rules-engine-v5');
const files: Record<string, string> = {};
for (const name of readdirSync(dir))
  if (name.endsWith('.csv')) files[name] = readFileSync(resolve(dir, name), 'utf8');
const result = readWorkbook(files);
const rows = (tab: TabKey, role = 'rule'): number =>
  result.records.filter((r) => r.tab === tab && r.role === role).length;

describe('reading the v5.0 workbook', () => {
  it('is v5.0, with every tab and nothing unexpected', () => {
    expect(editionOf(Object.keys(files))).toBe('5.0');
    expect(result.report.missingFiles).toEqual([]);
    expect(result.report.unknownFiles).toEqual([]);
    expect(result.report.unmappedTables).toEqual([]);
    expect(result.report.files).toEqual(filesOf('5.0'));
  });

  it('reads the rows the engine and the checks use', () => {
    expect(rows('capacity')).toBe(17); // 16 states and Not sure
    expect(rows('feelings')).toBe(4 + 5 + 21 + 5); // levels, groups, 20 emotions + Something else, rules
    expect(rows('body_senses')).toBe(14 + 3 + 5 + 8); // body signs, rules, urgent signs, senses
    expect(rows('colours')).toBe(5);
    expect(rows('colour_rules')).toBe(22);
    expect(rows('card_patterns')).toBe(49 + 11);
    expect(rows('labels')).toBe(44 + 5 + 14); // tool labels, colour labels, new labels
    expect(rows('outcomes', 'example')).toBe(2550);
    expect(rows('place_routes', 'example')).toBe(320);
    expect(rows('stories', 'example')).toBe(201);
    expect(rows('test_cases', 'example')).toBe(37);
  });

  it('keeps the author references', () => {
    const refs = (tab: TabKey): string[] =>
      result.records.filter((r) => r.tab === tab && r.role === 'rule').map((r) => r.sourceRef);
    expect(refs('capacity')).toContain('E3M3');
    expect(refs('feelings')).toEqual(expect.arrayContaining(['EM01', 'EM20', 'EM00', 'FE-3']));
    expect(refs('body_senses')).toEqual(expect.arrayContaining(['BD05', 'UR3', 'SN08', 'BS-1']));
    expect(refs('colour_rules')).toEqual(
      expect.arrayContaining(['FE-1', 'FE-2', 'BS-1', 'CAP-1', 'SF-4', 'CX-R', 'DV-R']),
    );
  });
});
