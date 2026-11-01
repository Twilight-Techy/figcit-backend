import { parseCsv } from './csv.js';
import { FILE_LAYOUTS, FILE_ORDER, type FileLayout, type TableSpec } from './layout.js';
import { segment, type Block, type NoteBlock, type SheetRow, type TableBlock } from './segment.js';
import type {
  ImportReport,
  ReadResult,
  RuleRecordDraft,
  TabCount,
  TabKey,
  TableFrame,
  WorkbookCell,
} from './types.js';

const MAX_TITLE = 120;

/** Spreadsheet column letters: 0 -> A, 25 -> Z, 26 -> AA. */
export function columnLetter(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Every cell with a heading or text, word for word; empty unlabelled cells are not columns. */
export function cellsOf(header: readonly string[], row: readonly string[]): WorkbookCell[] {
  const width = Math.max(header.length, row.length);
  const out: WorkbookCell[] = [];
  for (let i = 0; i < width; i += 1) {
    const head = header[i] ?? '';
    const text = row[i] ?? '';
    if (head !== '' || text !== '') out.push({ header: head, text, col: i });
  }
  return out;
}

/** The cells up to the last filled one; the sheet export pads every row to the widest. */
export function trimEnd(cells: readonly string[]): string[] {
  let last = cells.length - 1;
  while (last >= 0 && (cells[last] ?? '') === '') last -= 1;
  return cells.slice(0, last + 1);
}

function rangeOf(row: SheetRow): string {
  let last = row.cells.length - 1;
  while (last > 0 && (row.cells[last] ?? '') === '') last -= 1;
  return `A${String(row.sheetRow)}:${columnLetter(Math.max(last, 0))}${String(row.sheetRow)}`;
}

const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();

interface RefResult {
  readonly ref: string;
  readonly note: string | undefined;
}

function referenceFor(spec: TableSpec, row: SheetRow, file: string): RefResult {
  const parts = spec.refCols.map((col) => squash(row.cells[col] ?? '')).filter((p) => p !== '');
  let ref = parts.join(' · ');
  if (ref === '')
    return {
      ref: `row ${String(row.sheetRow)}`,
      note: `${file} row ${String(row.sheetRow)}: no reference in the sheet`,
    };
  if (spec.numeric && /^\d+\.0$/.test(ref)) {
    const plain = ref.slice(0, -2);
    const note = `${file} row ${String(row.sheetRow)}: "${ref}" read as "${plain}"`;
    ref = plain;
    return { ref, note };
  }
  return { ref, note: undefined };
}

/** Mutable state while reading; the result is frozen into the report at the end. */
class Collector {
  readonly records: RuleRecordDraft[] = [];
  readonly counts = new Map<TabKey, { rows: number; notes: number }>();
  readonly unmapped: string[] = [];
  readonly duplicates: string[] = [];
  readonly refNotes: string[] = [];
  readonly frames = new Map<string, TableFrame[]>();
  private readonly seen = new Map<string, number>();
  private order = 0;

  private count(tab: TabKey, kind: 'rows' | 'notes'): void {
    const entry = this.counts.get(tab) ?? { rows: 0, notes: 0 };
    entry[kind] += 1;
    this.counts.set(tab, entry);
  }

  private unique(tab: TabKey, section: string | null, ref: string, where: string): string {
    const key = `${tab}|${section ?? ''}|${ref}`;
    const n = (this.seen.get(key) ?? 0) + 1;
    this.seen.set(key, n);
    if (n === 1) return ref;
    this.duplicates.push(`${where}: "${ref}" appears ${String(n)} times in ${tab}`);
    return `${ref} #${String(n)}`;
  }

  /** Registers a table's frame and returns its index within the file. */
  addFrame(file: string, table: TableBlock): number {
    const list = this.frames.get(file) ?? [];
    list.push({ header: trimEnd(table.header), banner: table.banner.map((b) => trimEnd(b.cells)) });
    this.frames.set(file, list);
    return list.length - 1;
  }

  addRow(args: {
    file: string;
    spec: TableSpec;
    table: TableBlock;
    row: SheetRow;
    frame: number;
  }): void {
    const { file, spec, table, row, frame } = args;
    const section = table.heading === null ? null : table.heading.slice(0, MAX_TITLE);
    const { ref, note } = referenceFor(spec, row, file);
    if (note !== undefined) this.refNotes.push(note);
    const sourceRef = this.unique(spec.tab, section, ref, `${file} row ${String(row.sheetRow)}`);
    this.order += 1;
    this.count(spec.tab, 'rows');
    this.records.push({
      tab: spec.tab,
      role: spec.role,
      section,
      sourceRef,
      order: this.order,
      columns: cellsOf(table.header, row.cells),
      origin: { file, sheetRow: row.sheetRow, range: rangeOf(row) },
      frame,
    });
  }

  addNote(args: { file: string; tab: TabKey; note: NoteBlock; role: 'note' | 'rule' }): void {
    const { file, tab, note, role } = args;
    const { text, sheetRow, col } = note;
    const n = (this.counts.get(tab)?.notes ?? 0) + 1;
    this.count(tab, 'notes');
    this.order += 1;
    this.records.push({
      tab,
      role,
      section: null,
      sourceRef: `${tab} · note ${String(n)}`,
      order: this.order,
      columns: [{ header: 'note', text, col }],
      origin: {
        file,
        sheetRow,
        range: `${columnLetter(col)}${String(sheetRow)}:${columnLetter(col)}${String(sheetRow)}`,
      },
      frame: null,
    });
  }
}

/** The tab each block belongs to: a note goes with the next table (it introduces it), else the previous. */
function tabsOf(blocks: readonly Block[], layout: FileLayout): TabKey[] {
  let tableIndex = 0;
  const own = blocks.map((block) => {
    if (block.type !== 'table') return undefined;
    const tab = layout.tables[tableIndex]?.tab;
    tableIndex += 1;
    return tab;
  });
  let previous = layout.noteTab;
  // O(b^2) in the blocks of one sheet, at most a dozen.
  return own.map((tab, i) => {
    if (tab !== undefined) {
      previous = tab;
      return tab;
    }
    return own.slice(i).find((t) => t !== undefined) ?? previous;
  });
}

interface FileState {
  readonly file: string;
  readonly layout: FileLayout;
  readonly out: Collector;
  /** Index of the next table in the sheet. */
  tableIndex: number;
  /** Notes read after the last table. */
  footer: number;
}

function readTable(state: FileState, table: TableBlock, tab: TabKey): void {
  const known = state.layout.tables[state.tableIndex];
  const spec: TableSpec = known ?? { tab, role: 'reference', refCols: [0] };
  if (!known) {
    const heading = table.heading ?? '(no heading)';
    state.out.unmapped.push(`${state.file} table ${String(state.tableIndex + 1)}: ${heading}`);
  }
  state.tableIndex += 1;
  const frame = state.out.addFrame(state.file, table);
  for (const row of table.rows) state.out.addRow({ file: state.file, spec, table, row, frame });
}

function readNote(state: FileState, note: NoteBlock, tab: TabKey, isFooter: boolean): void {
  const { file, layout, out } = state;
  if (isFooter && layout.footerTab) {
    state.footer += 1;
    const role = state.footer === 1 ? 'note' : 'rule';
    out.addNote({ file, tab: layout.footerTab, note, role });
    return;
  }
  out.addNote({ file, tab, note, role: 'note' });
}

function readFile(file: string, layout: FileLayout, text: string, out: Collector): void {
  const blocks = segment(parseCsv(text), layout.headerFirstCell);
  const tabs = tabsOf(blocks, layout);
  const lastTable = blocks.map((b) => b.type).lastIndexOf('table');
  const state: FileState = { file, layout, out, tableIndex: 0, footer: 0 };
  blocks.forEach((block, i) => {
    const tab = tabs[i] ?? layout.noteTab;
    if (block.type === 'table') readTable(state, block, tab);
    else readNote(state, block, tab, i > lastTable);
  });
}

function buildReport(out: Collector, given: readonly string[]): ImportReport {
  const byTab: Partial<Record<TabKey, TabCount>> = {};
  for (const [tab, count] of out.counts) byTab[tab] = count;
  const expected = new Set(FILE_ORDER);
  return {
    files: FILE_ORDER.filter((f) => given.includes(f)),
    missingFiles: FILE_ORDER.filter((f) => !given.includes(f) && !FILE_LAYOUTS[f]?.addition),
    unknownFiles: given.filter((f) => !expected.has(f)),
    totalRecords: out.records.length,
    byTab,
    unmappedTables: out.unmapped,
    duplicateRefs: out.duplicates,
    normalisedRefs: out.refNotes,
  };
}

/**
 * Reads the workbook's tabs (one CSV text per file name) into records, word for word, with the
 * author's reference and where each row came from. O(total cells) time and space.
 */
export function readWorkbook(files: Readonly<Record<string, string>>): ReadResult {
  const out = new Collector();
  const given = Object.keys(files);
  for (const file of FILE_ORDER) {
    const text = files[file];
    const layout = FILE_LAYOUTS[file];
    if (text !== undefined && layout) readFile(file, layout, text, out);
  }
  const frames: Record<string, readonly TableFrame[]> = {};
  for (const [file, list] of out.frames) frames[file] = list;
  return { records: out.records, frames, report: buildReport(out, given) };
}
