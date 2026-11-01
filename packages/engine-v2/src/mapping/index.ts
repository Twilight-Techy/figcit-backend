import { catalogueOf, type Catalogue, type Issue } from '../format/catalogue.js';
import { rowIssues, VALUE_TABS } from '../format/rows.js';
import type { JsonValue } from '../ruleset/canonical.js';
import type { RulesetRecord } from '../ruleset/store.js';
import type { TabKey } from '../ruleset/types.js';
import { BAND_RULES, BANDS, STATE_GRID } from './bands.js';
import { CONTEXTS, SENSITIVITY_FLAGS } from './context.js';
import { DEMAND_CHARACTERISTICS, TIMELINES } from './demand.js';
import { EXPERIENCE_CORE } from './experience.js';
import { EXPERIENCE_REFLECT } from './experience-reflect.js';
import { NEEDS } from './needs.js';
import { NON_NEGOTIABLES } from './non-negotiables.js';
import { PATTERNS_BAND } from './patterns-band.js';
import { PATTERNS_OFFER } from './patterns-offer.js';
import { PATTERNS_TRIGGER } from './patterns-trigger.js';
import { REFLECT_MEDITATE } from './reflect-meditate.js';
import { TOOLS_TIERS } from './tools-tiers.js';
import { COVERAGE_GAPS, DECISION_SEQUENCE, DRIVERS, JOURNEY_LAYERS } from './reference-tabs.js';
import type { EngineColumns, EngineRule } from '../format/types.js';
import type { RowMapping, TabMapping } from './types.js';

/** The reviewed mapping file, by tab (M3). Tabs not listed stay `pending`. */
export const MAPPINGS: Readonly<Partial<Record<TabKey, TabMapping>>> = {
  journey_layers: JOURNEY_LAYERS,
  experience_triggers: { rows: { ...EXPERIENCE_CORE, ...EXPERIENCE_REFLECT } },
  decision_sequence: DECISION_SEQUENCE,
  coverage_gaps: COVERAGE_GAPS,
  drivers: DRIVERS,
  bands: BANDS,
  band_rules: BAND_RULES,
  state_grid: STATE_GRID,
  contexts: CONTEXTS,
  sensitivity_flags: SENSITIVITY_FLAGS,
  timelines: TIMELINES,
  demand_characteristics: DEMAND_CHARACTERISTICS,
  needs: NEEDS,
  reflect_meditate: REFLECT_MEDITATE,
  tools_tiers: TOOLS_TIERS,
  patterns: { rows: { ...PATTERNS_BAND, ...PATTERNS_TRIGGER, ...PATTERNS_OFFER } },
  non_negotiables: NON_NEGOTIABLES,
};

const NOT_A_RULE: RowMapping = {
  mapping: 'reference',
  reason: 'Not a rule: a note, an example or a reference table. Kept word for word, never run.',
};

export interface TabCoverage {
  readonly rules: number;
  readonly exact: number;
  readonly interpreted: number;
  readonly unresolved: number;
  readonly reference: number;
  readonly pending: number;
}

export interface MappingReport {
  readonly byTab: Readonly<Partial<Record<TabKey, TabCoverage>>>;
  /** Mapping entries whose row isn't in the workbook (renamed or removed rows). */
  readonly unmatched: readonly string[];
  /** Rows whose mapping fails the format check; they are left `pending`. */
  readonly invalid: readonly { readonly ref: string; readonly issues: readonly Issue[] }[];
  /** Unresolved rows and who decides, for the gap register. */
  readonly unresolved: readonly {
    readonly tab: TabKey;
    readonly ref: string;
    readonly reason: string;
    readonly decides: Extract<RowMapping, { mapping: 'unresolved' }>['decides'];
  }[];
}

function applyOne(r: RulesetRecord, m: RowMapping): RulesetRecord {
  if (m.mapping !== 'exact' && m.mapping !== 'interpreted')
    return { ...r, mapping: m.mapping, engine: null };
  const engine = m.mapping === 'interpreted' ? { ...m.engine, interpretation: m.reason } : m.engine;
  // Engine columns are plain JSON by construction; the format check runs on the result.
  return { ...r, mapping: m.mapping, engine: engine as unknown as JsonValue };
}

function coverageOf(records: readonly RulesetRecord[]): Partial<Record<TabKey, TabCoverage>> {
  const out: Partial<Record<TabKey, { -readonly [K in keyof TabCoverage]: number }>> = {};
  for (const r of records) {
    if (r.role !== 'rule' || VALUE_TABS.includes(r.tab)) continue;
    const c = (out[r.tab] ??= {
      rules: 0,
      exact: 0,
      interpreted: 0,
      unresolved: 0,
      reference: 0,
      pending: 0,
    });
    c.rules += 1;
    c[r.mapping] += 1;
  }
  return out;
}

/**
 * Applies the mapping file to an import's rows: rows that aren't rules become `reference`; rule
 * rows take their tab's mapping. A mapping that fails the format check is reported and the row is
 * left `pending`, never stored half-right. O(n) plus the check per mapped row.
 */
export function applyMappings(
  records: readonly RulesetRecord[],
  catalogue: Catalogue = catalogueOf(records).catalogue,
  mappings: Readonly<Partial<Record<TabKey, TabMapping>>> = MAPPINGS,
): { records: RulesetRecord[]; report: MappingReport } {
  const used = new Set<string>();
  const invalid: { ref: string; issues: Issue[] }[] = [];
  const unresolved: MappingReport['unresolved'][number][] = [];
  const out = records.map((r) => {
    if (VALUE_TABS.includes(r.tab)) return r;
    if (r.role !== 'rule') return r.mapping === 'pending' ? applyOne(r, NOT_A_RULE) : r;
    const tab = mappings[r.tab];
    const m = tab?.rows?.[r.sourceRef] ?? tab?.all;
    if (!m) return r;
    if (tab?.rows?.[r.sourceRef]) used.add(`${r.tab} · ${r.sourceRef}`);
    const next = applyOne(r, m);
    const issues = rowIssues(next, catalogue);
    if (issues.length > 0) {
      invalid.push({ ref: `${r.tab} · ${r.sourceRef}`, issues });
      return r;
    }
    if (m.mapping === 'unresolved')
      unresolved.push({ tab: r.tab, ref: r.sourceRef, reason: m.reason, decides: m.decides });
    return next;
  });
  const unmatched = Object.entries(mappings).flatMap(([tab, m]) =>
    Object.keys(m.rows ?? {})
      .map((ref) => `${tab} · ${ref}`)
      .filter((key) => !used.has(key)),
  );
  return { records: out, report: { byTab: coverageOf(out), unmatched, invalid, unresolved } };
}

/** One rule of a mapped row, with where it comes from. */
export interface MappedRule {
  readonly tab: TabKey;
  readonly ref: string;
  readonly layer: EngineColumns['layer'];
  readonly rule: EngineRule;
}

/** Every rule of every `exact` or `interpreted` row in the mapping file, in file order. */
export function* mappedRules(
  mappings: Readonly<Partial<Record<TabKey, TabMapping>>> = MAPPINGS,
): Generator<MappedRule> {
  for (const [tab, m] of Object.entries(mappings) as [TabKey, TabMapping][]) {
    for (const [ref, row] of Object.entries(m.rows ?? {})) {
      if (row.mapping !== 'exact' && row.mapping !== 'interpreted') continue;
      for (const rule of row.engine.rules) yield { tab, ref, layer: row.engine.layer, rule };
    }
  }
}

/**
 * Every wording key the mapping file uses, sorted: the copy table M4 must fill. Read from the
 * engine columns, so a key can't be used without appearing here.
 */
export function copyKeysOf(
  mappings: Readonly<Partial<Record<TabKey, TabMapping>>> = MAPPINGS,
): string[] {
  const keys = new Set<string>();
  for (const { rule } of mappedRules(mappings)) {
    for (const e of rule.then) {
      const key = e.kind === 'copy.use' ? e['key'] : e['copy'];
      if (typeof key === 'string') keys.add(key);
    }
  }
  return [...keys].sort();
}

export type { RowMapping, TabMapping } from './types.js';
