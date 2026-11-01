// Tab 7 and the non-negotiables (M3, E-50), and the whole workbook: every rule row is mapped.
import { describe, expect, it } from 'vitest';
import {
  applyMappings,
  catalogueOf,
  copyKeysOf,
  copyOf,
  MAPPINGS,
  mappedRules,
} from '../src/index.js';
import { TOOL_SEED } from '../src/format/tool-seed.js';
import { imported } from './fixtures.js';

const { report } = applyMappings(imported.records, catalogueOf(imported.records).catalogue);
const engineOf = (tab: 'patterns', ref: string) => {
  const m = MAPPINGS[tab]?.rows?.[ref];
  return m && (m.mapping === 'exact' || m.mapping === 'interpreted') ? m.engine : undefined;
};

describe('Tab 7', () => {
  it('is covered row by row', () => {
    expect(report.byTab.patterns).toEqual({
      rules: 41,
      exact: 4,
      interpreted: 35,
      unresolved: 0,
      reference: 2,
      pending: 0,
    });
    expect(report.byTab.non_negotiables).toEqual({
      rules: 9,
      exact: 0,
      interpreted: 1,
      unresolved: 0,
      reference: 8,
      pending: 0,
    });
  });

  it('puts CTA wording on each pattern that proposes a primary', () => {
    for (let n = 1; n <= 41; n += 1) {
      const engine = engineOf('patterns', String(n));
      const primaries = (engine?.rules ?? []).flatMap((r) =>
        r.then.filter((e) => e.kind === 'propose' && e['slot'] === 'primary'),
      );
      if (primaries.length === 0) continue;
      expect(
        primaries.some((e) => typeof e['copy'] === 'string'),
        `pattern ${String(n)}`,
      ).toBe(true);
    }
  });

  it('has text for every wording key the rules use, and a headline for every CTA', () => {
    const copy = copyOf(imported.records);
    expect(copyKeysOf().filter((k) => !copy.has(k))).toEqual([]);
    const ctas = [...copy.keys()].filter((k) => /^card\.p\d+\.cta$/.test(k));
    expect(ctas.filter((k) => !copy.has(k.replace(/\.cta$/, '.title')))).toEqual([]);
  });

  it('ranks the band patterns below every feeling, need and task due now', () => {
    for (const n of ['1', '2', '3', '4', '5', '6', '7', '8', '14', '31'])
      expect(engineOf('patterns', n)?.layer, n).toBe('default');
    expect(engineOf('patterns', '15')?.layer).toBe('task_due');
    expect(engineOf('patterns', '40')?.layer).toBe('guard');
  });
});

describe('the whole workbook', () => {
  it('leaves no rule row pending', () => {
    const pending = Object.entries(report.byTab).filter(([, c]) => c.pending > 0);
    expect(pending).toEqual([]);
    expect(report.invalid).toEqual([]);
  });

  it('never forces Reflect or Meditate (Tab 7 non-negotiables, MD-6)', () => {
    const optional = new Set([
      'reflect',
      'meditate',
      ...TOOL_SEED.filter(([, , p]) => p === 'reflect' || p === 'meditate').map(([c]) => c),
    ]);
    const forced = [...mappedRules()].flatMap(({ tab, ref, rule }) =>
      rule.then
        .filter((e) => e.kind === 'require')
        .map((e) => e['target'] as { pathway?: string; tool?: string })
        .filter((t) => optional.has(t.pathway ?? t.tool ?? ''))
        .map(() => `${tab} · ${ref}`),
    );
    expect(forced).toEqual([]);
  });

  it('lists the wording keys M4 must write', () => {
    const keys = copyKeysOf();
    expect(keys.length).toBeGreaterThan(80);
    expect(keys.every((k) => k.startsWith('card.'))).toBe(true);
  });
});
