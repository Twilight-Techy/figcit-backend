import { FILE_ORDER } from './layout.js';
import type { RuleRecordDraft, SheetFrames, TableFrame } from './types.js';

/** The parts of a record the writer needs; stored records carry more. */
export type WritableRecord = Pick<RuleRecordDraft, 'columns' | 'frame' | 'order' | 'origin'>;

const QUOTE = /[",\r\n]/;

/** One CSV field, quoted only when it has to be (RFC 4180). */
function field(text: string): string {
  return QUOTE.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** RFC 4180 CSV, every row padded to the widest so the file reads like a sheet export. */
export function toCsv(rows: readonly (readonly string[])[]): string {
  const width = Math.max(1, ...rows.map((r) => r.length));
  return rows
    .map((row) => {
      const cells = Array.from({ length: width }, (_, i) => row[i] ?? '');
      return cells.map(field).join(',');
    })
    .join('\n')
    .concat('\n');
}

/** A record's cells laid out by column. */
function rowOf(record: WritableRecord): string[] {
  const row: string[] = [];
  for (const cell of record.columns) {
    while (row.length < cell.col) row.push('');
    row[cell.col] = cell.text;
  }
  return row;
}

class SheetWriter {
  readonly rows: string[][] = [];
  private nextFrame = 0;
  private current: number | null = null;

  constructor(private readonly frames: readonly TableFrame[]) {}

  private blank(): void {
    if (this.rows.length > 0 && this.rows[this.rows.length - 1]?.length !== 0) this.rows.push([]);
  }

  private open(index: number): void {
    const frame = this.frames[index];
    this.blank();
    if (frame) {
      for (const banner of frame.banner) this.rows.push([...banner]);
      if (frame.header.length > 0) this.rows.push([...frame.header]);
    }
    this.current = index;
    this.nextFrame = index + 1;
  }

  /** Tables with no rows left still keep their place, so later tables keep their index. */
  private openUpTo(index: number): void {
    while (this.nextFrame < index) this.open(this.nextFrame);
  }

  add(record: WritableRecord): void {
    if (record.frame === null) {
      if (this.current !== null) this.blank();
      this.current = null;
      this.rows.push(rowOf(record));
      return;
    }
    if (record.frame !== this.current) {
      this.openUpTo(record.frame);
      this.open(record.frame);
    }
    this.rows.push(rowOf(record));
  }

  finish(): string[][] {
    this.openUpTo(this.frames.length);
    return this.rows;
  }
}

/**
 * Writes records back into the workbook's sheets, one CSV text per file, in the workbook's row
 * order (`order`). Reading the result gives the same records (tested), so the author can keep
 * working in a spreadsheet and re-import. O(total cells) time and space.
 */
export function writeWorkbook(
  records: readonly WritableRecord[],
  frames: SheetFrames,
): Record<string, string> {
  const byFile = new Map<string, WritableRecord[]>();
  for (const record of records) {
    const list = byFile.get(record.origin.file) ?? [];
    list.push(record);
    byFile.set(record.origin.file, list);
  }
  const files = new Set([...FILE_ORDER, ...byFile.keys(), ...Object.keys(frames)]);
  const out: Record<string, string> = {};
  for (const file of files) {
    const list = [...(byFile.get(file) ?? [])].sort((a, b) => a.order - b.order);
    const sheetFrames = frames[file] ?? [];
    if (list.length === 0 && sheetFrames.length === 0) continue;
    const writer = new SheetWriter(sheetFrames);
    for (const record of list) writer.add(record);
    out[file] = toCsv(writer.finish());
  }
  return out;
}
