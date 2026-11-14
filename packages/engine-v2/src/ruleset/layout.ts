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

/** Which workbook a file belongs to: v3.3, or Rules Engine v5.0 (November 2026). */
export type Edition = '3.3' | '5.0';

export interface FileLayout {
  readonly tables: readonly TableSpec[];
  /** The workbook edition with this file; files of both are optional to the other (readme: both). */
  readonly edition?: Edition;
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

const v5 = (layout: Omit<FileLayout, 'edition'>): FileLayout => ({ ...layout, edition: '5.0' });

/**
 * Rules Engine v5.0's tabs (docs/engine-v2/V5.md). Rule tables are the ones the engine runs or
 * reads values from; Tabs 18-21 (every outcome, routes by place, stories, test cases) are
 * examples the checks run against, never rules.
 */
const V5_LAYOUTS: Readonly<Record<string, FileLayout>> = {
  '1-capacity-matrix.csv': v5({ tables: [rule('capacity')], noteTab: 'capacity' }),
  '2-feelings.csv': v5({
    tables: [rule('feelings'), rule('feelings'), rule('feelings'), rule('feelings')],
    noteTab: 'feelings',
  }),
  '3-body-senses.csv': v5({
    tables: [rule('body_senses'), rule('body_senses'), rule('body_senses'), rule('body_senses')],
    noteTab: 'body_senses',
  }),
  '4-places.csv': v5({ tables: [rule('places')], noteTab: 'places' }),
  '5-devices.csv': v5({ tables: [rule('devices'), reference('devices')], noteTab: 'devices' }),
  '6-bands-modifiers.csv': v5({
    tables: [rule('colours'), rule('colour_rules')],
    noteTab: 'colours',
  }),
  '7-help-menu.csv': v5({ tables: [rule('help_menu'), rule('help_menu')], noteTab: 'help_menu' }),
  '8-eight-pathways.csv': v5({
    tables: [rule('pathways'), rule('pathways'), rule('pathways'), rule('pathways')],
    noteTab: 'pathways',
  }),
  '9-plans-tools.csv': v5({
    tables: [
      rule('plans_tools'),
      rule('plans_tools'),
      reference('plans_tools'),
      rule('plans_tools'),
      rule('plans_tools'),
      rule('plans_tools'),
    ],
    noteTab: 'plans_tools',
  }),
  '10-time-drivers-demand.csv': v5({
    tables: [
      rule('time_demand'),
      rule('time_demand'),
      rule('time_demand'),
      rule('time_demand'),
      rule('time_demand'),
      rule('time_demand'),
      rule('time_demand'),
    ],
    noteTab: 'time_demand',
  }),
  '11-patterns-card.csv': v5({
    tables: [
      { ...rule('card_patterns'), numeric: true },
      rule('card_rules'),
      { ...rule('card_patterns'), numeric: true },
    ],
    noteTab: 'card_patterns',
  }),
  '12-reflect-meditate-gates.csv': v5({ tables: [rule('gates')], noteTab: 'gates' }),
  '13-decision-sequence.csv': v5({ tables: [rule('sequence')], noteTab: 'sequence' }),
  '14-screen-display.csv': v5({ tables: [reference('screens')], noteTab: 'screens' }),
  '15-accounts-me.csv': v5({
    tables: [
      reference('accounts'),
      reference('accounts'),
      reference('accounts'),
      reference('accounts'),
      reference('accounts'),
      reference('accounts'),
      reference('accounts'),
    ],
    noteTab: 'accounts',
  }),
  '16-action-rules.csv': v5({
    tables: [reference('actions'), reference('actions')],
    noteTab: 'actions',
  }),
  '17-labels-copy.csv': v5({
    tables: [rule('labels'), rule('labels'), reference('labels'), rule('labels')],
    noteTab: 'labels',
  }),
  '18-all-outcomes.csv': v5({ tables: [example('outcomes')], noteTab: 'outcomes' }),
  '19-route-by-place.csv': v5({ tables: [example('place_routes')], noteTab: 'place_routes' }),
  '20-stories.csv': v5({ tables: [example('stories')], noteTab: 'stories' }),
  '21-test-cases.csv': v5({
    tables: [example('test_cases'), example('test_cases')],
    noteTab: 'test_cases',
  }),
  '22-change-log.csv': v5({
    tables: [reference('change_log'), reference('change_log')],
    noteTab: 'change_log',
  }),
};

/**
 * The workbook's own tabs, one CSV file each. A table the reader finds beyond the ones listed is
 * kept as reference and named in the import report (nothing is dropped).
 */
export const FILE_LAYOUTS: Readonly<Record<string, FileLayout>> = {
  // Both editions have a README; v5.0's has an Item / Detail table, kept as reference.
  'readme.csv': { tables: [reference('readme')], noteTab: 'readme' },
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
  ...V5_LAYOUTS,
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

/** The edition a set of files is: v5.0 when any of its own files is there, else v3.3. */
export function editionOf(files: readonly string[]): Edition {
  return files.some((f) => FILE_LAYOUTS[f]?.edition === '5.0') ? '5.0' : '3.3';
}

/** The files an edition's workbook has (both editions share the README). */
export function filesOf(edition: Edition): string[] {
  return FILE_ORDER.filter((f) => {
    const layout = FILE_LAYOUTS[f];
    return (
      !layout?.addition && (layout?.edition ?? (f === 'readme.csv' ? edition : '3.3')) === edition
    );
  });
}
