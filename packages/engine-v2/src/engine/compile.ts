import type { Catalogue, Issue } from '../format/catalogue.js';
import { EFFECTS } from '../format/effects.js';
import { FACTS, STAGES, type StageKey } from '../format/registry.js';
import type { EngineColumns } from '../format/types.js';
import { VALUE_TABS } from '../format/rows.js';
import { factsIn, validateEngine } from '../format/validate.js';
import { TAB_KEYS } from '../ruleset/types.js';
import type { CompiledRule, CompiledRuleset, EngineRow } from './types.js';

const STAGE_INDEX = new Map<string, number>(STAGES.map((s, i) => [s.key, i]));
const TAB_INDEX = new Map<string, number>(TAB_KEYS.map((t, i) => [t, i]));
const FACT_BY_NAME = new Map(FACTS.map((f) => [f.name, f]));
const WRITES = new Map(EFFECTS.flatMap((e) => (e.writes ? [[e.kind, e.writes] as const] : [])));
const RUNS = ['exact', 'interpreted'];

/** Derived facts a rule reads that rules of its own stage set: it must run after them. */
function sameStageReads(when: unknown, stage: StageKey): string[] {
  return [...new Set(factsIn(when))].filter((name) => {
    const spec = FACT_BY_NAME.get(name);
    return spec?.derived === true && spec.stage === stage;
  });
}

interface Draft extends Omit<CompiledRule, 'seq'> {
  readonly tab: number;
  readonly order: number;
  readonly index: number;
  readonly reads: readonly string[];
}

function draftsOf(row: EngineRow, engine: EngineColumns): Draft[] {
  return engine.rules.map((rule, index) => {
    const stage = rule.stage ?? engine.stage;
    const reads = sameStageReads(rule.when, stage);
    return {
      id: `${row.id}#${String(index)}`,
      rowId: row.id,
      ref: `${row.tab} · ${row.sourceRef}`,
      stage,
      layer: engine.layer ?? null,
      wave: reads.length > 0 ? 1 : 0,
      when: rule.when,
      then: rule.then,
      tab: TAB_INDEX.get(row.tab) ?? TAB_KEYS.length,
      order: row.order,
      index,
      reads,
    };
  });
}

/**
 * Within a stage the engine runs the rules that set a derived fact before the rules that read it
 * (two waves). A late rule that sets a fact another late rule reads can't be ordered: reported.
 */
function orderIssues(drafts: readonly Draft[]): Issue[] {
  const late = drafts.filter((d) => d.wave === 1);
  return late.flatMap((writer) =>
    writer.then.flatMap((e): Issue[] => {
      const fact = WRITES.get(e.kind);
      const reader = late.find((d) => d.stage === writer.stage && fact && d.reads.includes(fact));
      return reader && fact
        ? [
            {
              path: writer.ref,
              message: `sets ${fact}, which ${reader.ref} reads in the same stage after it; split the stages`,
            },
          ]
        : [];
    }),
  );
}

/**
 * The published version's runnable rules, in run order: stage (Tab 8), then wave, then tab and
 * row order (the workbook's), then rule order. Only active `exact` and `interpreted` rows run;
 * a row whose columns fail the format check is left out and reported (publishing refuses those,
 * so this only happens for a draft). O(n log n).
 */
export function compile(rows: readonly EngineRow[], catalogue: Catalogue): CompiledRuleset {
  const issues: Issue[] = [];
  let exempt = 0;
  const drafts: Draft[] = [];
  for (const row of rows) {
    // Catalogue and input-mapping rows are values, not rules: their mapping says where they came from.
    if (row.status !== 'active' || VALUE_TABS.includes(row.tab)) continue;
    if (row.mapping === 'unresolved') exempt += 1;
    if (!RUNS.includes(row.mapping)) continue;
    const problems = validateEngine(row.engine, catalogue);
    if (problems.length > 0) {
      const at = `${row.tab} · ${row.sourceRef}`;
      issues.push(...problems.map((p) => ({ path: `${at}${p.path}`, message: p.message })));
      continue;
    }
    drafts.push(...draftsOf(row, row.engine as EngineColumns));
  }
  issues.push(...orderIssues(drafts));
  drafts.sort(
    (a, b) =>
      (STAGE_INDEX.get(a.stage) ?? 0) - (STAGE_INDEX.get(b.stage) ?? 0) ||
      a.wave - b.wave ||
      a.tab - b.tab ||
      a.order - b.order ||
      a.index - b.index,
  );
  const rules = drafts.map(
    ({ tab: _tab, order: _order, index: _index, reads: _reads, ...rule }, seq): CompiledRule => ({
      ...rule,
      seq,
    }),
  );
  return { rules, catalogue, issues, exempt };
}
