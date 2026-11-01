// Tab 6d (M3, E-50): the section A rows split the tools into Advanced, safety floor and free
// without overlap, and the entitlement rows are covered.
import { describe, expect, it } from 'vitest';
import { TOOL_SEED } from '../src/format/tool-seed.js';
import { applyMappings, catalogueOf, mappedRules } from '../src/index.js';
import { imported } from './fixtures.js';

function tiers(): Record<'advanced' | 'floor', Set<string>> {
  const out = { advanced: new Set<string>(), floor: new Set<string>() };
  const marks = [...mappedRules()]
    .filter((r) => r.tab === 'tools_tiers')
    .flatMap((r) => r.rule.then.filter((e) => e.kind === 'tools.tier'));
  for (const e of marks)
    for (const t of e['tools'] as string[]) out[e['tier'] as 'advanced' | 'floor'].add(t);
  return out;
}

describe('Tab 6d tiers', () => {
  const { advanced, floor } = tiers();
  const pathwayOf = new Map(TOOL_SEED.map(([code, , pathway]) => [code, pathway]));

  it('never marks a tool both Advanced and safety floor', () => {
    expect([...floor].filter((t) => advanced.has(t))).toEqual([]);
  });

  it('gives every pathway but Reflect a free safety floor (ENT-1)', () => {
    const withFloor = new Set([...floor].map((t) => pathwayOf.get(t)));
    const pathways = new Set(TOOL_SEED.map(([, , p]) => p));
    expect([...pathways].filter((p) => !withFloor.has(p))).toEqual(['reflect']);
  });

  it('splits the 79 tools as section A does', () => {
    expect(advanced.size).toBe(44);
    expect(floor.size).toBe(17);
    expect(TOOL_SEED.length - advanced.size).toBe(35);
    expect([...floor].sort()).toContain('own_practice');
    expect(advanced.has('recitation_player')).toBe(true);
  });

  it('is covered row by row', () => {
    const { report } = applyMappings(imported.records, catalogueOf(imported.records).catalogue);
    expect(report.byTab.tools_tiers).toEqual({
      rules: 33,
      exact: 2,
      interpreted: 10,
      unresolved: 0,
      reference: 21,
      pending: 0,
    });
  });
});
