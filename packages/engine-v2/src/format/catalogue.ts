import type { WorkbookCell } from '../ruleset/types.js';
import { DOMAINS, type Domain } from './registry.js';

/** The catalogue table's columns, in order (an added table, shaded like the workbook's own). */
export const CATALOGUE_HEADER = [
  'Domain',
  'Code',
  'Label',
  'Order',
  'From',
  'To',
  'Group',
  'Source',
  'Note',
] as const;
export type CatalogueColumn = (typeof CATALOGUE_HEADER)[number];

/** One standard value. `from`/`to` are an inclusive range (intensity bands); `group` a parent. */
export interface CatalogueValue {
  readonly code: string;
  readonly label: string;
  readonly order: number | null;
  readonly from: number | null;
  readonly to: number | null;
  readonly group: string | null;
  /** The Note column, when filled; for a v5.0 tool, its approved user_description (LBL-1). */
  readonly note?: string;
}

/** Every domain's values, in catalogue order (Order, then row order). */
export type Catalogue = ReadonlyMap<Domain, readonly CatalogueValue[]>;

/** A problem found in the catalogue or in a rule, with a JSON-pointer-like path. */
export interface Issue {
  readonly path: string;
  readonly message: string;
}

export const CODE_PATTERN = /^[A-Za-z0-9_]{1,48}$/;
const NUMBER = /^-?\d+(\.\d+)?$/;

const isDomain = (value: string): value is Domain => (DOMAINS as readonly string[]).includes(value);

/** A cell's text by column heading. */
export function cellText(columns: readonly WorkbookCell[], header: string): string {
  return (columns.find((c) => c.header === header)?.text ?? '').trim();
}

function numberOr(text: string, path: string, issues: Issue[]): number | null {
  if (text === '') return null;
  if (!NUMBER.test(text)) {
    issues.push({ path, message: `"${text}" is not a number` });
    return null;
  }
  return Number(text);
}

/** Checks one catalogue row; returns the value it defines when it is sound. */
export function readCatalogueRow(
  columns: readonly WorkbookCell[],
  at = '',
): { domain: Domain; value: CatalogueValue } | { issues: Issue[] } {
  const issues: Issue[] = [];
  const domain = cellText(columns, 'Domain');
  const code = cellText(columns, 'Code');
  const label = cellText(columns, 'Label');
  if (!isDomain(domain))
    issues.push({ path: `${at}/Domain`, message: `unknown domain "${domain}"` });
  if (!CODE_PATTERN.test(code))
    issues.push({ path: `${at}/Code`, message: 'use 1-48 letters, digits or _' });
  if (label === '') issues.push({ path: `${at}/Label`, message: 'a label is needed' });
  const order = numberOr(cellText(columns, 'Order'), `${at}/Order`, issues);
  const from = numberOr(cellText(columns, 'From'), `${at}/From`, issues);
  const to = numberOr(cellText(columns, 'To'), `${at}/To`, issues);
  if (from !== null && to !== null && from > to)
    issues.push({ path: `${at}/To`, message: 'To is below From' });
  if (issues.length > 0 || !isDomain(domain)) return { issues };
  const group = cellText(columns, 'Group');
  const note = cellText(columns, 'Note');
  return {
    domain,
    value: {
      code,
      label,
      order,
      from,
      to,
      group: group === '' ? null : group,
      ...(note === '' ? {} : { note }),
    },
  };
}

/** The rows the catalogue is built from: live rows of the catalogue table. */
export interface CatalogueRow {
  readonly tab: string;
  readonly status: string;
  readonly frame: number | null;
  readonly columns: readonly WorkbookCell[];
}

/**
 * Builds the catalogue from a version's rows. A bad row is reported and left out, never guessed.
 * A code repeated within a domain is reported (the database also refuses it). O(n log n).
 */
export function catalogueOf(rows: readonly CatalogueRow[]): {
  catalogue: Catalogue;
  issues: Issue[];
} {
  const issues: Issue[] = [];
  const byDomain = new Map<Domain, { value: CatalogueValue; at: number }[]>();
  rows.forEach((row, at) => {
    if (row.tab !== 'catalogue' || row.status !== 'active' || row.frame === null) return;
    const read = readCatalogueRow(row.columns, `/catalogue/${String(at)}`);
    if ('issues' in read) {
      issues.push(...read.issues);
      return;
    }
    const list = byDomain.get(read.domain) ?? [];
    if (list.some((v) => v.value.code === read.value.code))
      issues.push({
        path: `/catalogue/${String(at)}/Code`,
        message: `"${read.value.code}" is already in ${read.domain}`,
      });
    else list.push({ value: read.value, at });
    byDomain.set(read.domain, list);
  });
  const catalogue = new Map<Domain, readonly CatalogueValue[]>();
  for (const domain of DOMAINS) {
    const list = byDomain.get(domain) ?? [];
    list.sort(
      (a, b) =>
        (a.value.order !== null && b.value.order !== null ? a.value.order - b.value.order : 0) ||
        a.at - b.at,
    );
    catalogue.set(
      domain,
      list.map((v) => v.value),
    );
  }
  return { catalogue, issues };
}

/** The values of a domain, or an empty list. */
export const valuesOf = (catalogue: Catalogue, domain: Domain): readonly CatalogueValue[] =>
  catalogue.get(domain) ?? [];
