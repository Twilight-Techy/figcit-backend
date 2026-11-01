// Tab 6c (M3, E-50): the gates' "asked for" lists match the rows that offer Reflect or Meditate,
// and the tab is covered row by row.
import { describe, expect, it } from 'vitest';
import {
  MEDITATE_FAMILIES,
  MEDITATE_NEEDS,
  REFLECT_FAMILIES,
  REFLECT_NEEDS,
} from '../src/mapping/reflect-meditate.js';
import { TOOL_SEED } from '../src/format/tool-seed.js';
import type { Effect } from '../src/format/types.js';
import { applyMappings, catalogueOf, mappedRules } from '../src/index.js';
import { imported } from './fixtures.js';

const pathwayOf = new Map(TOOL_SEED.map(([code, , pathway]) => [code, pathway]));

/** The families and needs a condition requires (values under a `not` don't count). */
function triggersOf(
  cond: unknown,
  out = { families: new Set<string>(), needs: new Set<string>() },
) {
  if (cond === null || typeof cond !== 'object') return out;
  const c = cond as Record<string, unknown>;
  for (const key of ['all', 'any'])
    if (Array.isArray(c[key])) for (const child of c[key] as unknown[]) triggersOf(child, out);
  if (c['fact'] === 'families' && c['op'] === 'contains') out.families.add(String(c['value']));
  if (c['fact'] === 'family.intensity') out.families.add(String(c['key']));
  if (c['fact'] === 'needs' && c['op'] === 'contains') out.needs.add(String(c['value']));
  return out;
}

/** Which of Reflect and Meditate a rule proposes, by pathway or by one of their tools. */
function offers(then: readonly Effect[]): Set<'reflect' | 'meditate'> {
  const out = new Set<'reflect' | 'meditate'>();
  for (const e of then.filter((x) => x.kind === 'propose')) {
    const t = e['target'] as { pathway?: string; tool?: string };
    const pathway = t.pathway ?? (t.tool === undefined ? undefined : pathwayOf.get(t.tool));
    if (pathway === 'reflect' || pathway === 'meditate') out.add(pathway);
  }
  return out;
}

describe('Tab 6c', () => {
  it('knows every feeling and need whose row offers Reflect or Meditate', () => {
    const found = {
      reflect: { families: new Set<string>(), needs: new Set<string>() },
      meditate: { families: new Set<string>(), needs: new Set<string>() },
    };
    const rules = [...mappedRules()].filter(
      (r) => r.tab === 'experience_triggers' || r.tab === 'needs',
    );
    for (const { rule } of rules) {
      const t = triggersOf(rule.when);
      for (const pathway of offers(rule.then)) {
        const into = found[pathway];
        t.families.forEach((f) => into.families.add(f));
        t.needs.forEach((n) => into.needs.add(n));
      }
    }
    expect([...found.reflect.families].sort()).toEqual([...REFLECT_FAMILIES].sort());
    expect([...found.reflect.needs].sort()).toEqual([...REFLECT_NEEDS].sort());
    expect([...found.meditate.families].sort()).toEqual([...MEDITATE_FAMILIES].sort());
    expect([...found.meditate.needs].sort()).toEqual([...MEDITATE_NEEDS].sort());
  });

  it('is covered row by row; examples and notes never run', () => {
    const { records, report } = applyMappings(
      imported.records,
      catalogueOf(imported.records).catalogue,
    );
    expect(report.byTab.reflect_meditate).toEqual({
      rules: 28,
      exact: 0,
      interpreted: 13,
      unresolved: 0,
      reference: 15,
      pending: 0,
    });
    const examples = records.filter((r) => r.tab === 'reflect_meditate' && r.role === 'example');
    expect(examples).toHaveLength(5);
    expect(examples.every((r) => r.mapping === 'reference' && r.engine === null)).toBe(true);
  });
});
