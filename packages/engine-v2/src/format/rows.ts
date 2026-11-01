import type { JsonValue } from '../ruleset/canonical.js';
import type { WorkbookCell } from '../ruleset/types.js';
import { readCatalogueRow, type Catalogue, type Issue } from './catalogue.js';
import { validateMapping } from './validate.js';

/** Added tables that hold values (standard values, input mappings), never engine columns. */
export const VALUE_TABS: readonly string[] = ['catalogue', 'input_mappings'];

/** On a value row, the mapping says where the value came from, not how a rule was read. */
const VALUE_MAPPINGS: readonly string[] = ['pending', 'exact', 'interpreted'];
/** Rows that are not rules (notes, examples, reference tables) carry no engine columns. */
const NON_RULE_MAPPINGS: readonly string[] = ['pending', 'reference'];

export interface CheckedRow {
  readonly tab: string;
  readonly role: string;
  readonly frame: number | null;
  readonly mapping: string;
  readonly engine: JsonValue | undefined;
  readonly columns: readonly WorkbookCell[];
}

function noEngine(row: CheckedRow, allowed: readonly string[], what: string): Issue[] {
  const issues: Issue[] = [];
  if (row.engine !== null && row.engine !== undefined)
    issues.push({ path: '/engine', message: `${what} have no engine columns` });
  if (!allowed.includes(row.mapping))
    issues.push({ path: '/mapping', message: `${what} use ${allowed.join(', ')}` });
  return issues;
}

/**
 * Everything wrong with one row in its version: the one check the editor runs on save and the
 * submit check runs on every live row, so the two can't disagree (DESIGN §4, E-36, E-37).
 */
export function rowIssues(row: CheckedRow, catalogue: Catalogue): Issue[] {
  if (row.tab === 'catalogue' && row.frame !== null) {
    const read = readCatalogueRow(row.columns);
    return [
      ...noEngine(row, VALUE_MAPPINGS, 'catalogue rows'),
      ...('issues' in read ? read.issues : []),
    ];
  }
  if (VALUE_TABS.includes(row.tab) || row.role !== 'rule')
    return noEngine(
      row,
      VALUE_TABS.includes(row.tab) ? VALUE_MAPPINGS : NON_RULE_MAPPINGS,
      VALUE_TABS.includes(row.tab) ? 'value rows' : `${row.role} rows`,
    );
  return validateMapping(row.mapping, row.engine ?? null, catalogue).map((i) => ({
    path: `/engine${i.path}`,
    message: i.message,
  }));
}
