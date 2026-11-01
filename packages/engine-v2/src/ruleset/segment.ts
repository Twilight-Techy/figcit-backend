/**
 * Splits one workbook sheet into its notes and tables, keeping every row.
 *
 * Every tab has the same shape: a row with a single filled cell is a note or a section title; a
 * run of rows with two or more filled cells is a table whose first row is the header. Rows with
 * only some cells filled are normal data rows. Blank rows and notes end a table.
 */
export interface SheetRow {
  readonly cells: readonly string[];
  /** 1-based row in the sheet. */
  readonly sheetRow: number;
}

export interface NoteBlock {
  readonly type: 'note';
  readonly text: string;
  readonly sheetRow: number;
}

export interface TableBlock {
  readonly type: 'table';
  readonly header: readonly string[];
  readonly headerRow: number;
  readonly rows: readonly SheetRow[];
  /** Grouping rows above the header (Tab 0 and 0b). */
  readonly banner: readonly SheetRow[];
  /** The last note before the table, usually its section title. */
  readonly heading: string | null;
}

export type Block = NoteBlock | TableBlock;

interface OpenTable {
  header: readonly string[] | undefined;
  headerRow: number;
  rows: SheetRow[];
  banner: SheetRow[];
  heading: string | null;
}

export const filledCount = (cells: readonly string[]): number =>
  cells.filter((cell) => cell.trim() !== '').length;

const firstFilled = (cells: readonly string[]): string =>
  cells.find((cell) => cell.trim() !== '') ?? '';

function close(open: OpenTable | undefined, out: Block[]): void {
  if (!open) return;
  if (open.header) {
    out.push({
      type: 'table',
      header: open.header,
      headerRow: open.headerRow,
      rows: open.rows,
      banner: open.banner,
      heading: open.heading,
    });
    return;
  }
  // A run that never found its header (the glossary tables under Tab 0) is kept as a table with
  // no column names, so its cells stay word for word and the reader reports it.
  if (open.banner.length > 0)
    out.push({
      type: 'table',
      header: [],
      headerRow: 0,
      rows: open.banner,
      banner: [],
      heading: open.heading,
    });
}

function addRow(open: OpenTable, row: SheetRow, headerFirstCell: string | undefined): void {
  if (open.header) {
    open.rows.push(row);
  } else if (headerFirstCell === undefined || (row.cells[0] ?? '').trim() === headerFirstCell) {
    open.header = row.cells;
    open.headerRow = row.sheetRow;
  } else {
    open.banner.push(row);
  }
}

/** O(r * c) time and O(r * c) space, r = rows and c = columns in the sheet. */
export function segment(
  rows: readonly (readonly string[])[],
  headerFirstCell?: string,
): readonly Block[] {
  const out: Block[] = [];
  let open: OpenTable | undefined;
  let lastNote: string | null = null;
  rows.forEach((cells, index) => {
    const sheetRow = index + 1;
    const filled = filledCount(cells);
    if (filled === 0) {
      close(open, out);
      open = undefined;
    } else if (filled === 1) {
      close(open, out);
      open = undefined;
      lastNote = firstFilled(cells);
      out.push({ type: 'note', text: cells.find((c) => c.trim() !== '') ?? '', sheetRow });
    } else {
      open ??= { header: undefined, headerRow: 0, rows: [], banner: [], heading: lastNote };
      addRow(open, { cells, sheetRow }, headerFirstCell);
    }
  });
  close(open, out);
  return out;
}
