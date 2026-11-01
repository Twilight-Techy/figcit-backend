/** The tables of the rule store: one per workbook tab or section (engine-v2 DESIGN §3.1). */
export const TAB_KEYS = [
  'readme',
  'state_grid',
  'experience_triggers',
  'sensitivity_flags',
  'contexts',
  'timelines',
  'drivers',
  'demand_characteristics',
  'needs',
  'reflect_meditate',
  'tools_tiers',
  'patterns',
  'non_negotiables',
  'decision_sequence',
  'worked_example',
  'bands',
  'band_rules',
  'journey_layers',
  'coverage_gaps',
  'examples',
] as const;
export type TabKey = (typeof TAB_KEYS)[number];

/**
 * What a record is for. `rule` rows are run once they have engine columns; `example` rows are
 * kept as read-only reference and never run (DECISION_LOG E-10, E-21); `reference` is other
 * information the workbook carries; `note` is free text between tables.
 */
export const RECORD_ROLES = ['rule', 'example', 'reference', 'note'] as const;
export type RecordRole = (typeof RECORD_ROLES)[number];

/** One workbook cell, word for word: the column heading and the exact text. */
export interface WorkbookCell {
  readonly header: string;
  readonly text: string;
}

/** Where a record came from, so it can be traced back to the sheet. */
export interface RecordOrigin {
  readonly file: string;
  /** 1-based row in the sheet. */
  readonly sheetRow: number;
  /** For example `A7:H7`. */
  readonly range: string;
}

/** A record as read from the workbook, before it is stored. */
export interface RuleRecordDraft {
  readonly tab: TabKey;
  readonly role: RecordRole;
  /** The heading of the table it sits in, e.g. "C. Gating and safety rules ..." (or null). */
  readonly section: string | null;
  /** The author's own reference (EX-1, E1M1, T0, 7 ...), unique within tab and section. */
  readonly sourceRef: string;
  /** Position in the sheet file, so exports keep the workbook's row order. */
  readonly order: number;
  readonly columns: readonly WorkbookCell[];
  readonly origin: RecordOrigin;
}

export interface TabCount {
  readonly rows: number;
  readonly notes: number;
}

/** Everything the reader noticed. Nothing is dropped silently (DESIGN §6). */
export interface ImportReport {
  readonly files: readonly string[];
  readonly missingFiles: readonly string[];
  readonly unknownFiles: readonly string[];
  readonly totalRecords: number;
  readonly byTab: Readonly<Partial<Record<TabKey, TabCount>>>;
  /** Tables the reader found that no layout entry names; they are kept as reference. */
  readonly unmappedTables: readonly string[];
  /** Records whose reference clashed with an earlier one in the same table; `#2` was added. */
  readonly duplicateRefs: readonly string[];
  /** Reference values changed from the sheet's text (e.g. `16.0` to `16`). */
  readonly normalisedRefs: readonly string[];
}

export interface ReadResult {
  readonly records: readonly RuleRecordDraft[];
  readonly report: ImportReport;
}
