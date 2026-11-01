import type { RecordRole, TabKey } from './types.js';

/** What a table in a sheet is, in the order the tables appear in the file. */
export interface TableSpec {
  readonly tab: TabKey;
  readonly role: RecordRole;
  /** Header columns whose text, joined with " · ", is the author's reference for the row. */
  readonly refCols: readonly number[];
  /** The reference is a number written as `16.0` by the sheet export; keep `16`. */
  readonly numeric?: true;
}

export interface FileLayout {
  readonly tables: readonly TableSpec[];
  /** Tabs 0 and 0b have grouping rows above the real header, which starts with this text. */
  readonly headerFirstCell?: string;
  /** Where notes go when no table is near. */
  readonly noteTab: TabKey;
  /** Notes after the last table are rules that apply across all rows (Tab 7). */
  readonly footerTab?: TabKey;
  /** An added table, not a workbook tab: optional in an upload (DESIGN §3.4). */
  readonly addition?: true;
}

const rule = (tab: TabKey, refCols: readonly number[] = [0]): TableSpec => ({
  tab,
  role: 'rule',
  refCols,
});
const example = (tab: TabKey, refCols: readonly number[] = [0]): TableSpec => ({
  tab,
  role: 'example',
  refCols,
});
const reference = (tab: TabKey, refCols: readonly number[] = [0]): TableSpec => ({
  tab,
  role: 'reference',
  refCols,
});

/**
 * The workbook's own tabs, one CSV file each. A table the reader finds beyond the ones listed is
 * kept as reference and named in the import report (nothing is dropped).
 */
export const FILE_LAYOUTS: Readonly<Record<string, FileLayout>> = {
  'readme.csv': { tables: [], noteTab: 'readme' },
  '0-simplified-matrix.csv': {
    tables: [example('examples')],
    headerFirstCell: 'Ref',
    noteTab: 'examples',
  },
  '0b-extended-scenarios.csv': {
    tables: [example('examples')],
    headerFirstCell: 'Ref',
    noteTab: 'examples',
  },
  '1-state-grid-16-cells.csv': { tables: [rule('state_grid')], noteTab: 'state_grid' },
  '2-experience-intervention.csv': {
    tables: [rule('experience_triggers', [0, 2])],
    noteTab: 'experience_triggers',
  },
  '3-sensitivity-context.csv': {
    tables: [rule('sensitivity_flags'), rule('contexts')],
    noteTab: 'sensitivity_flags',
  },
  '4-timeline-codes.csv': { tables: [rule('timelines')], noteTab: 'timelines' },
  '5-nucripce-drivers.csv': { tables: [rule('drivers')], noteTab: 'drivers' },
  '6-demand-type-to-nucripce.csv': {
    tables: [rule('demand_characteristics')],
    noteTab: 'demand_characteristics',
  },
  '6b-need-to-intervention.csv': { tables: [rule('needs')], noteTab: 'needs' },
  // Sections A to E; the section title is kept on each row.
  '6c-reflect-meditate.csv': {
    tables: [
      rule('reflect_meditate'),
      rule('reflect_meditate'),
      rule('reflect_meditate'),
      rule('reflect_meditate'),
      example('reflect_meditate'),
    ],
    noteTab: 'reflect_meditate',
  },
  // Sections A to F; F (scenarios) is example data.
  '6d-free-advanced-tools.csv': {
    tables: [
      rule('tools_tiers'),
      rule('tools_tiers'),
      rule('tools_tiers'),
      rule('tools_tiers'),
      rule('tools_tiers'),
      example('tools_tiers'),
    ],
    noteTab: 'tools_tiers',
  },
  '7-recommendation-matrix.csv': {
    tables: [{ ...rule('patterns'), numeric: true }],
    noteTab: 'patterns',
    footerTab: 'non_negotiables',
  },
  '8-decision-sequence.csv': { tables: [rule('decision_sequence')], noteTab: 'decision_sequence' },
  '9-worked-example.csv': { tables: [example('worked_example')], noteTab: 'worked_example' },
  '10-band-safety-modifiers.csv': {
    tables: [rule('bands'), rule('band_rules'), reference('band_rules')],
    noteTab: 'bands',
  },
  '11-journey-inputs-outputs.csv': { tables: [rule('journey_layers')], noteTab: 'journey_layers' },
  '12-coverage-gaps-additions.csv': { tables: [rule('coverage_gaps')], noteTab: 'coverage_gaps' },
  // Added tables (engine-v2 format); written by an export, read back on re-import.
  'x-catalogue.csv': { tables: [rule('catalogue', [0, 1])], noteTab: 'catalogue', addition: true },
  'x-input-mappings.csv': {
    tables: [rule('input_mappings', [0, 1])],
    noteTab: 'input_mappings',
    addition: true,
  },
  'x-copy.csv': { tables: [rule('copy', [0])], noteTab: 'copy', addition: true },
};

export const FILE_ORDER: readonly string[] = Object.keys(FILE_LAYOUTS);
