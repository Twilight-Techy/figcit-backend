import type { RulesetRecord } from '../ruleset/store.js';
import type { WorkbookCell } from '../ruleset/types.js';
import { cellText, type Issue } from './catalogue.js';
import { COPY_SEED } from './copy-seed.js';
import { COPY_KEY } from './validate.js';

/**
 * The card's wording (M8, E-53): an added table of wording keys and their text, so the clinical
 * admin can change a sentence without a release and Clinical Safety signs it off in one place
 * (T-21). Text may hold `{task}`, filled with the task's title on the card.
 */
export const COPY_FILE = 'x-copy.csv';
export const COPY_HEADER = ['Key', 'Text', 'Source', 'Note'] as const;

/** Checks one wording row on its own. */
export function readCopyRow(
  columns: readonly WorkbookCell[],
  at = '',
): { key: string; text: string } | { issues: Issue[] } {
  const key = cellText(columns, 'Key');
  const text = cellText(columns, 'Text');
  const issues: Issue[] = [];
  if (!COPY_KEY.test(key))
    issues.push({ path: `${at}/Key`, message: 'expected a wording key like card.p5.cta' });
  if (text === '') issues.push({ path: `${at}/Text`, message: 'the wording is empty' });
  if (text.length > 300) issues.push({ path: `${at}/Text`, message: 'at most 300 characters' });
  return issues.length > 0 ? { issues } : { key, text };
}

/** A version's wording by key, from its active rows (the first row of a key wins). O(n). */
export function copyOf(
  rows: readonly {
    readonly tab: string;
    readonly status: string;
    readonly frame: number | null;
    readonly columns: readonly WorkbookCell[];
  }[],
): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const r of rows) {
    if (r.tab !== 'copy' || r.status !== 'active' || r.frame === null) continue;
    const read = readCopyRow(r.columns);
    if ('key' in read && !out.has(read.key)) out.set(read.key, read.text);
  }
  return out;
}

/** The wording as first filled, as records without an order yet. */
export function copySeedRows(): Omit<RulesetRecord, 'order'>[] {
  return COPY_SEED.map(([key, text, source, how, note = '']) => {
    const cells: Record<string, string> = { Key: key, Text: text, Source: source, Note: note };
    return {
      tab: 'copy' as const,
      role: 'rule' as const,
      section: null,
      sourceRef: key,
      columns: COPY_HEADER.map((header, col) => ({ header, text: cells[header] ?? '', col })),
      origin: { file: COPY_FILE, sheetRow: 0, range: '' },
      frame: 0,
      engine: null,
      mapping: how,
      status: 'active' as const,
      // The support screen's words are clinical wording (Tab 7 pattern 28, T-21).
      safety: key.startsWith('card.support'),
      workbookTag: null,
    };
  });
}
