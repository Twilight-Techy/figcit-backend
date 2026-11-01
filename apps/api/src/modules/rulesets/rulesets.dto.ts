import { createHash } from 'node:crypto';
import type {
  MappingStatus,
  RecordOrigin,
  RulesetRecord,
  TabKey,
  WorkbookCell,
} from '@figcit/engine-v2';
import { Prisma, type RulesetVersion } from '@prisma/client';
import { BadInput } from '../../common/errors/errors.js';

// Shapes the rule store returns, and the mapping from database rows to them.

export interface VersionSummary {
  readonly id: string;
  readonly label: string;
  readonly workbookVersion: string;
  readonly revision: number;
  readonly format: number;
  readonly status: string;
  readonly hash: string | null;
  readonly basedOn: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly submittedAt: string | null;
  readonly publishedAt: string | null;
  readonly retiredAt: string | null;
}

export interface VersionDetail extends VersionSummary {
  readonly counts: VersionCounts;
  readonly checks: unknown;
  readonly importReport: unknown;
  readonly sourceHash: string | null;
}

export interface VersionCounts {
  readonly records: number;
  readonly byTab: Readonly<Record<string, number>>;
  readonly rules: number;
  readonly byMapping: Readonly<Record<MappingStatus, number>>;
  readonly safety: number;
  readonly retired: number;
}

export interface RecordDto {
  readonly id: string;
  readonly recordId: string;
  readonly tab: string;
  readonly role: string;
  readonly section: string | null;
  readonly sourceRef: string;
  readonly order: number;
  readonly columns: readonly WorkbookCell[];
  readonly origin: RecordOrigin;
  readonly frame: number | null;
  readonly engine: unknown;
  readonly mapping: string;
  readonly status: string;
  readonly safety: boolean;
  readonly workbookTag: string | null;
  readonly changedAt: string;
  readonly changedById: string | null;
  readonly changeReason: string | null;
}

export interface HistoryEntry extends RecordDto {
  readonly version: string;
  readonly versionStatus: string;
}

/** A safety row the engine won't run, whose gap nobody has acknowledged yet (E-21). */
export interface BlockingExemption {
  readonly recordId: string;
  readonly tab: string;
  readonly sourceRef: string;
  readonly reason: string;
}

export interface VersionChecks {
  readonly hash: string;
  readonly counts: VersionCounts;
  readonly blocking: readonly BlockingExemption[];
}

export interface CellInput {
  readonly col: number;
  readonly text: string;
}

export interface AddRecordInput {
  /** The new row goes straight after this one, in the same table. */
  readonly after: string;
  readonly cells: readonly CellInput[];
  readonly reason: string;
  readonly safety?: boolean | undefined;
}

export interface EditRecordInput {
  readonly cells?: readonly CellInput[] | undefined;
  /** Only `pending` and `unresolved` (exempt) until the engine columns exist (M2). */
  readonly mapping?: 'pending' | 'unresolved' | undefined;
  readonly safety?: boolean | undefined;
  readonly workbookTag?: string | null | undefined;
  readonly reason: string;
}

export const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');
export const iso = (d: Date | null): string | null => d?.toISOString() ?? null;

export type RecordRow = Prisma.RulesetRecordGetPayload<object>;
export type VersionRow = RulesetVersion & { basedOn?: { label: string } | null };

export function toSummary(v: VersionRow): VersionSummary {
  return {
    id: v.id,
    label: v.label,
    workbookVersion: v.workbookVersion,
    revision: v.revision,
    format: v.format,
    status: v.status,
    hash: v.hash,
    basedOn: v.basedOn?.label ?? null,
    notes: v.notes,
    createdAt: v.createdAt.toISOString(),
    submittedAt: iso(v.submittedAt),
    publishedAt: iso(v.publishedAt),
    retiredAt: iso(v.retiredAt),
  };
}

export function toDto(r: RecordRow): RecordDto {
  return {
    id: r.id,
    recordId: r.recordId,
    tab: r.tab,
    role: r.role,
    section: r.section,
    sourceRef: r.sourceRef,
    order: r.order,
    columns: r.columns as unknown as WorkbookCell[],
    origin: r.origin as unknown as RecordOrigin,
    frame: r.frame,
    engine: r.engine,
    mapping: r.mapping,
    status: r.status,
    safety: r.safety,
    workbookTag: r.workbookTag,
    changedAt: r.changedAt.toISOString(),
    changedById: r.changedById,
    changeReason: r.changeReason,
  };
}

/** A stored row as the package's record, for hashing and export. */
export function toRecord(r: RecordRow): RulesetRecord {
  return {
    tab: r.tab as TabKey,
    role: r.role,
    section: r.section,
    sourceRef: r.sourceRef,
    order: r.order,
    columns: r.columns as unknown as WorkbookCell[],
    origin: r.origin as unknown as RecordOrigin,
    frame: r.frame,
    engine: r.engine ?? null,
    mapping: r.mapping,
    status: r.status,
    safety: r.safety,
    workbookTag: r.workbookTag,
  };
}

export function countsOf(rows: readonly RecordRow[]): VersionCounts {
  const byTab: Record<string, number> = {};
  const byMapping: Record<MappingStatus, number> = {
    pending: 0,
    exact: 0,
    interpreted: 0,
    unresolved: 0,
  };
  let rules = 0;
  let safety = 0;
  let retired = 0;
  for (const r of rows) {
    byTab[r.tab] = (byTab[r.tab] ?? 0) + 1;
    if (r.status === 'retired') {
      retired += 1;
      continue;
    }
    if (r.role !== 'rule') continue;
    rules += 1;
    byMapping[r.mapping] += 1;
    if (r.safety) safety += 1;
  }
  return { records: rows.length, byTab, rules, byMapping, safety, retired };
}

/** Lays cells out under the table's own headings; a heading with no text still gets a cell. */
export function buildCells(header: readonly string[], cells: readonly CellInput[]): WorkbookCell[] {
  const byCol = new Map<number, string>();
  for (const c of cells) {
    if (byCol.has(c.col)) throw new BadInput(`Column ${String(c.col)} is given twice.`);
    byCol.set(c.col, c.text);
  }
  const width = Math.max(header.length, ...[...byCol.keys()].map((c) => c + 1));
  const out: WorkbookCell[] = [];
  for (let col = 0; col < width; col += 1) {
    const head = header[col] ?? '';
    const text = byCol.get(col) ?? '';
    if (head !== '' || text !== '') out.push({ header: head, text, col });
  }
  return out;
}

export function nextNoteRef(tab: string, rows: readonly { sourceRef: string }[]): string {
  const prefix = `${tab} · note `;
  let max = 0;
  for (const r of rows)
    if (r.sourceRef.startsWith(prefix))
      max = Math.max(max, Number(r.sourceRef.slice(prefix.length)) || 0);
  return `${prefix}${String(max + 1)}`;
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
