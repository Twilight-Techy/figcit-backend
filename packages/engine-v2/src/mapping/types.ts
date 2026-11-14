import type { EngineColumns } from '../format/types.js';

/**
 * How one workbook row is read for the engine (DESIGN §6 step 3, the reviewed mapping file):
 * - `exact`: the engine columns say exactly what the text says;
 * - `interpreted`: the text needed reading; `reason` says how, for the author to confirm;
 * - `unresolved`: it can't be represented yet; the engine skips it and a gap records why (E-11);
 * - `reference`: the row states nothing the engine runs (a definition or a description).
 */
export type RowMapping =
  | {
      readonly mapping: 'exact' | 'interpreted';
      readonly engine: Omit<EngineColumns, 'interpretation'>;
      readonly reason: string;
    }
  | {
      readonly mapping: 'unresolved';
      readonly reason: string;
      readonly decides: 'founder' | 'clinical_safety';
    }
  | { readonly mapping: 'reference'; readonly reason: string };

/** A tab's mapping: per row by the author's reference, and a default for rows not listed. */
export interface TabMapping {
  readonly rows?: Readonly<Record<string, RowMapping>>;
  /**
   * Rows of one table of the tab, by the start of its heading: for a tab whose tables reuse the
   * same references (v5.0 Tab 10's Green, Yellow ... in two tables). Checked before `rows`.
   */
  readonly sections?: Readonly<Record<string, Readonly<Record<string, RowMapping>>>>;
  readonly all?: RowMapping;
}
