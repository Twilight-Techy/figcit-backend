// The reviewed mapping file (M3): every mapped row passes the format check against the real
// catalogue, every mapping entry finds its row, and coverage is what the file says.
import { describe, expect, it } from 'vitest';
import { applyMappings, catalogueOf, MAPPINGS } from '../src/index.js';
import { imported } from './fixtures.js';

const { records, report } = applyMappings(
  imported.records,
  catalogueOf(imported.records).catalogue,
);

describe('the mapping file', () => {
  it('maps only rows that exist, and every mapped row is valid', () => {
    expect(report.invalid).toEqual([]);
    expect(report.unmatched).toEqual([]);
  });

  it('marks every row that is not a rule as reference, never pending', () => {
    expect(
      records.filter((r) => r.role !== 'rule' && r.tab !== 'catalogue' && r.mapping === 'pending'),
    ).toEqual([]);
  });

  it('covers the mapped tabs completely', () => {
    for (const tab of Object.keys(MAPPINGS)) {
      const c = report.byTab[tab as keyof typeof report.byTab];
      expect(c?.pending, tab).toBe(0);
    }
    expect(report.byTab.band_rules).toMatchObject({
      rules: 14,
      exact: 4,
      interpreted: 8,
      reference: 2,
    });
    expect(report.byTab.bands).toMatchObject({ rules: 5, exact: 1, interpreted: 3, reference: 1 });
    expect(report.byTab.state_grid).toMatchObject({ rules: 16, interpreted: 4, reference: 12 });
  });

  it('covers Tabs 3a, 3b, 4, 6 and 6b row by row', () => {
    expect(report.byTab.contexts).toMatchObject({
      rules: 20,
      interpreted: 19,
      reference: 1,
      pending: 0,
    });
    expect(report.byTab.sensitivity_flags).toMatchObject({ rules: 8, interpreted: 8, pending: 0 });
    expect(report.byTab.timelines).toMatchObject({
      rules: 9,
      interpreted: 8,
      reference: 1,
      pending: 0,
    });
    expect(report.byTab.demand_characteristics).toMatchObject({
      rules: 17,
      exact: 8,
      interpreted: 5,
      reference: 4,
    });
    expect(report.byTab.needs).toMatchObject({ rules: 21, exact: 3, interpreted: 18, pending: 0 });
  });

  it('covers Tab 2 row by row', () => {
    expect(report.byTab.experience_triggers).toMatchObject({
      rules: 34,
      exact: 5,
      interpreted: 25,
      unresolved: 1,
      reference: 3,
      pending: 0,
    });
    expect(report.unresolved).toContainEqual(
      expect.objectContaining({
        tab: 'experience_triggers',
        ref: 'Recurring struggle noticed (SYSTEM-LED + user confirms) · n/a (pattern)',
        decides: 'founder',
      }),
    );
  });

  it('never fires a Tab 2 rule without its trigger', () => {
    const rows = records.filter((r) => r.tab === 'experience_triggers' && r.engine !== null);
    for (const r of rows) {
      const engine = r.engine as { rules: { when: unknown }[] };
      for (const rule of engine.rules) expect(rule.when, r.sourceRef).not.toBeNull();
    }
  });

  it('runs shutdown, sensory overload and rumination as guards (ADR 0001 §2)', () => {
    const layerOf = (prefix: string) =>
      (
        records.find((r) => r.tab === 'experience_triggers' && r.sourceRef.startsWith(prefix))
          ?.engine as { layer?: string }
      ).layer;
    expect(layerOf('Shutdown')).toBe('guard');
    expect(layerOf('Sensory overload')).toBe('guard');
    expect(layerOf('Rumination')).toBe('guard');
    expect(layerOf('Wanting to make sense')).toBe('offer');
    expect(layerOf('Distress')).toBe('trigger');
  });

  it('marks deferred characteristics as reference, with the reason', () => {
    const imposed = records.find(
      (r) => r.tab === 'demand_characteristics' && r.sourceRef === 'Imposed by someone else',
    );
    expect(imposed?.mapping).toBe('reference');
    expect(MAPPINGS.demand_characteristics?.rows?.['Imposed by someone else']?.reason).toMatch(
      /Deferred/,
    );
  });

  it('stores the interpretation with the engine columns', () => {
    const cx1 = records.find((r) => r.tab === 'band_rules' && r.sourceRef === 'CX-1');
    expect(cx1?.mapping).toBe('interpreted');
    expect((cx1?.engine as { interpretation?: string }).interpretation).toMatch(
      /negative experience family/,
    );
    const cap1 = records.find((r) => r.tab === 'band_rules' && r.sourceRef === 'CAP-1');
    expect(cap1?.mapping).toBe('exact');
    expect((cap1?.engine as { interpretation?: string }).interpretation).toBeUndefined();
  });

  it('reports a bad mapping and leaves the row pending', () => {
    const bad = applyMappings(imported.records, catalogueOf(imported.records).catalogue, {
      band_rules: {
        rows: {
          'EX-1': {
            mapping: 'exact',
            reason: 'x',
            engine: {
              stage: 'capacity_fit',
              rules: [{ when: null, then: [{ kind: 'band.lower', steps: 9 }] }],
            },
          },
          'ZZ-9': { mapping: 'reference', reason: 'no such row' },
        },
      },
    });
    expect(bad.report.invalid.map((i) => i.ref)).toEqual(['band_rules · EX-1']);
    expect(bad.report.unmatched).toEqual(['band_rules · ZZ-9']);
    expect(bad.records.find((r) => r.sourceRef === 'EX-1' && r.tab === 'band_rules')?.mapping).toBe(
      'pending',
    );
  });
});
