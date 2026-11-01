import { canonicalJson, type JsonValue } from './canonical.js';
import { FILE_LAYOUTS, type TableSpec } from './layout.js';
import type {
  RecordOrigin,
  RecordRole,
  RuleRecordDraft,
  SheetFrames,
  TabKey,
  WorkbookCell,
} from './types.js';

/**
 * Version of the rule set's structure (DESIGN §5 "format versions"). Raised when a new kind of
 * rule, effect or column is added, with a script that upgrades older rule sets.
 * 2: engine columns, the catalogue and input mappings tables (E-36, E-37).
 * 3: band.set, band.limit_drop, band.limit_rise, light.never, classes.add and the re-check facts
 *    the Tab 10 rules need (E-48); while M3 is open its additions join format 3, as no format 3
 *    rule set has left the dev database: minutes.cap and driver weights (E-49); practice.limit,
 *    tools.tier, tier.limit, tier.require, reminder.offer, two card actions, the default layer,
 *    the practice_mode and tier values, six input facts and the derived-fact stage check (E-50).
 */
export const RULESET_FORMAT = 3;

/**
 * How far a record's engine columns say what its workbook text says (DESIGN §3.3):
 * `pending` the engine columns are not written yet; `exact`; `interpreted` (the author must
 * confirm); `unresolved` (exempt: the engine does not run it and a gap records why, E-11);
 * `reference` the row states nothing the engine runs: a definition (its values are in the
 * catalogue) or a description (E-37).
 */
export const MAPPING_STATUSES = [
  'pending',
  'exact',
  'interpreted',
  'unresolved',
  'reference',
] as const;
export type MappingStatus = (typeof MAPPING_STATUSES)[number];

/** A retired record stays in the version (and its history) but is not run or exported. */
export const RECORD_STATUSES = ['active', 'retired'] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

/** A record as it sits in a rule set version: the workbook row plus engine and control fields. */
export interface RulesetRecord {
  readonly tab: TabKey;
  readonly role: RecordRole;
  readonly section: string | null;
  readonly sourceRef: string;
  readonly order: number;
  readonly columns: readonly WorkbookCell[];
  readonly origin: RecordOrigin;
  readonly frame: number | null;
  /** The structured form the engine runs (M2/M3); null until written. */
  readonly engine: JsonValue;
  readonly mapping: MappingStatus;
  readonly status: RecordStatus;
  /** Changing it needs Clinical Safety approval (deferred to T-01; E-20). */
  readonly safety: boolean;
  /** The workbook's v3 / v3.1 / v3.2 / v3.3 marking, where the sheet shows it. */
  readonly workbookTag: string | null;
}

/** The whole of a version, as hashed. Database IDs and labels are left out on purpose. */
export interface RulesetContent {
  readonly workbookVersion: string;
  readonly frames: SheetFrames;
  readonly records: readonly RulesetRecord[];
}

const cellJson = (c: WorkbookCell): JsonValue => ({ header: c.header, text: c.text, col: c.col });

function recordJson(r: RulesetRecord): JsonValue {
  return {
    tab: r.tab,
    role: r.role,
    section: r.section,
    sourceRef: r.sourceRef,
    order: r.order,
    columns: r.columns.map(cellJson),
    origin: { file: r.origin.file, sheetRow: r.origin.sheetRow, range: r.origin.range },
    frame: r.frame,
    engine: r.engine,
    mapping: r.mapping,
    status: r.status,
    safety: r.safety,
    workbookTag: r.workbookTag,
  };
}

/**
 * The canonical document of a version (RFC 8785). Its SHA-256 is the version hash: equal rules
 * give an equal hash, whatever the label or database IDs (so a rollback copy hashes the same).
 * Records are in workbook order; ties (none expected) by tab and reference.
 */
export function rulesetDocument(content: RulesetContent): string {
  const records = [...content.records].sort(
    (a, b) =>
      a.order - b.order || a.tab.localeCompare(b.tab) || a.sourceRef.localeCompare(b.sourceRef),
  );
  const frames: Record<string, JsonValue> = {};
  for (const [file, list] of Object.entries(content.frames))
    frames[file] = list.map((f) => ({
      header: [...f.header],
      banner: f.banner.map((b) => [...b]),
    }));
  return canonicalJson({
    format: RULESET_FORMAT,
    workbookVersion: content.workbookVersion,
    frames,
    records: records.map(recordJson),
  });
}

/** The layout entry for a table of a sheet file; unknown tables are reference, keyed on column A. */
export function tableSpec(file: string, frame: number): TableSpec | undefined {
  return FILE_LAYOUTS[file]?.tables[frame];
}

/**
 * The author's reference for a row, from the columns the layout names (the same rule the reader
 * uses, without the `#2` for repeats: an edit that repeats a reference is refused instead).
 * Null when the row has none.
 */
export function referenceOf(
  file: string,
  frame: number,
  columns: readonly WorkbookCell[],
): string | null {
  const spec = tableSpec(file, frame);
  const refCols = spec?.refCols ?? [0];
  const parts = refCols
    .map((col) => (columns.find((c) => c.col === col)?.text ?? '').replace(/\s+/g, ' ').trim())
    .filter((p) => p !== '');
  if (parts.length === 0) return null;
  const ref = parts.join(' · ');
  return spec?.numeric && /^\d+\.0$/.test(ref) ? ref.slice(0, -2) : ref;
}

const SAFETY_REFS: Readonly<
  Partial<Record<TabKey, (ref: string, section: string | null) => boolean>>
> = {
  experience_triggers: (ref) => ref.startsWith('Immediate risk language'),
  patterns: (ref) => ref === '28',
  band_rules: (ref) => ['SF-1', 'SF-2', 'RC-5'].includes(ref),
  bands: (ref) => ref.startsWith('Very Constrained'),
  decision_sequence: (ref) => ref.startsWith('0.'),
  tools_tiers: (_ref, section) => section?.startsWith('A.') ?? false,
  non_negotiables: () => true,
};

/**
 * Whether a row is marked `safety` when first imported (DECISION_LOG E-25, interpreted): the risk
 * rows, the safety override, the Red band, the safety screen step, the safety floor tools and the
 * Tab 7 non-negotiables. The Clinical Safety lead confirms or changes the marking per row.
 */
export function initialSafety(
  draft: Pick<RuleRecordDraft, 'tab' | 'role' | 'sourceRef' | 'section'>,
): boolean {
  if (draft.role !== 'rule') return false;
  return SAFETY_REFS[draft.tab]?.(draft.sourceRef, draft.section) ?? false;
}

/** A freshly read row, as it enters a draft version. */
export function fromDraft(draft: RuleRecordDraft): RulesetRecord {
  return {
    ...draft,
    engine: null,
    mapping: 'pending',
    status: 'active',
    safety: initialSafety(draft),
    workbookTag: null,
  };
}
