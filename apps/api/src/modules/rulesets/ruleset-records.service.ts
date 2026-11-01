import { Injectable } from '@nestjs/common';
import {
  canonicalJson,
  initialSafety,
  referenceOf,
  rowIssues,
  type JsonValue,
  type RecordOrigin,
  type SheetFrames,
  type TabKey,
  type WorkbookCell,
} from '@figcit/engine-v2';
import { Prisma } from '@prisma/client';
import { PrismaService, type Tx } from '../../common/db/prisma.service.js';
import { BadInput, Conflict } from '../../common/errors/errors.js';
import { RulesetAuditService, type Actor } from './ruleset-audit.service.js';
import {
  buildCells,
  isUniqueViolation,
  nextNoteRef,
  toDto,
  type AddRecordInput,
  type CellInput,
  type EditRecordInput,
  type RecordDto,
  type RecordRow,
  type VersionRow,
} from './rulesets.dto.js';
import { catalogueFor, draftOr409, recordOr404 } from './rulesets.repository.js';

type Changes = Record<string, { before: JsonValue; after: JsonValue }>;

/** Equal as JSON values (key order ignored, as JSONB stores them). */
const sameJson = (a: unknown, b: unknown): boolean =>
  canonicalJson((a ?? null) as JsonValue) === canonicalJson((b ?? null) as JsonValue);

const plain = (cells: readonly WorkbookCell[]): JsonValue =>
  cells.map((c) => ({ col: c.col, text: c.text }));

/** The cells for a row of a table (under its headings), or for a note (one cell). */
function cellsFor(
  v: VersionRow,
  row: Pick<RecordRow, 'frame' | 'origin' | 'columns'>,
  input: readonly CellInput[],
): WorkbookCell[] {
  if (row.frame === null) {
    const col = (row.columns as unknown as WorkbookCell[])[0]?.col ?? input[0]?.col ?? 0;
    return [{ header: 'note', text: input[0]?.text ?? '', col }];
  }
  const { file } = row.origin as unknown as RecordOrigin;
  const header = (v.frames as unknown as SheetFrames)[file]?.[row.frame]?.header ?? [];
  return buildCells(header, input);
}

/** The reference a row's cells give it; notes keep theirs. */
function refFor(row: Pick<RecordRow, 'frame' | 'origin'>, cells: readonly WorkbookCell[]): string {
  if (row.frame === null) throw new Error('refFor: notes have no reference column');
  const { file } = row.origin as unknown as RecordOrigin;
  const ref = referenceOf(file, row.frame, cells);
  if (ref === null) throw new BadInput('The reference column of the row is empty.');
  return ref;
}

/** Fields an edit sets as they are; their old and new values go into the audit entry. */
const SCALAR_FIELDS = ['mapping', 'safety', 'workbookTag'] as const;

/** New cells (and the reference they give) for an edit; records what changed. */
function cellChanges(
  v: VersionRow,
  before: RecordRow,
  input: readonly CellInput[],
  data: Prisma.RulesetRecordUpdateInput,
  changes: Changes,
): WorkbookCell[] {
  const cells = cellsFor(v, before, input);
  const old = before.columns as unknown as WorkbookCell[];
  if (JSON.stringify(plain(cells)) !== JSON.stringify(plain(old))) {
    data.columns = cells as unknown as Prisma.InputJsonValue;
    changes['cells'] = { before: plain(old), after: plain(cells) };
  }
  const sourceRef = before.frame === null ? before.sourceRef : refFor(before, cells);
  if (sourceRef !== before.sourceRef) {
    data.sourceRef = sourceRef;
    changes['sourceRef'] = { before: before.sourceRef, after: sourceRef };
  }
  return cells;
}

/** Refuses a row the engine could not run as written, listing every problem (E-36). */
async function assertRowValid(
  tx: Tx,
  versionId: string,
  row: Pick<RecordRow, 'tab' | 'role' | 'frame' | 'mapping'> & {
    readonly engine: JsonValue | undefined;
    readonly columns: readonly WorkbookCell[];
  },
): Promise<void> {
  const { catalogue } = await catalogueFor(tx, versionId);
  const issues = rowIssues(row, catalogue);
  if (issues.length > 0)
    throw new BadInput('This row has problems; nothing was saved.', { issues });
}

/**
 * Single-row changes to a draft (DECISION_LOG E-12): add a row after an existing one, edit its
 * cells and control fields, retire or restore it. The database refuses changes to any version
 * that is not a draft, and a repeated reference among a table's live rows.
 */
@Injectable()
export class RulesetRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: RulesetAuditService,
  ) {}

  private async inTx<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(work);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new Conflict(
          'Another live row in this table already has that reference.',
          'duplicate_ref',
        );
      throw error;
    }
  }

  add(actor: Actor, label: string, input: AddRecordInput): Promise<RecordDto> {
    return this.inTx(async (tx) => {
      const v = await draftOr409(tx, label);
      const after = await recordOr404(tx, v.id, input.after);
      const cells = cellsFor(v, { ...after, columns: [] }, input.cells);
      if (cells.every((c) => c.text.trim() === '')) throw new BadInput('The new row has no text.');
      const sourceRef =
        after.frame === null
          ? nextNoteRef(
              after.tab,
              await tx.rulesetRecord.findMany({
                where: { versionId: v.id, tab: after.tab },
                select: { sourceRef: true },
              }),
            )
          : refFor(after, cells);
      const safety =
        (input.safety ?? false) ||
        initialSafety({
          tab: after.tab as TabKey,
          role: after.role,
          section: after.section,
          sourceRef,
        });
      await assertRowValid(tx, v.id, {
        ...after,
        mapping: 'pending',
        engine: null,
        columns: cells,
      });
      await tx.rulesetRecord.updateMany({
        where: { versionId: v.id, order: { gt: after.order } },
        data: { order: { increment: 1 } },
      });
      const { file } = after.origin as unknown as RecordOrigin;
      const created = await tx.rulesetRecord.create({
        data: {
          versionId: v.id,
          tab: after.tab,
          role: after.role,
          section: after.section,
          sourceRef,
          order: after.order + 1,
          columns: cells as unknown as Prisma.InputJsonValue,
          // Added in the dashboard: no sheet row yet; the export places it after `after`.
          origin: { file, sheetRow: 0, range: '' },
          frame: after.frame,
          safety,
          changedById: actor.id,
          changeReason: input.reason,
        },
      });
      await this.audit.append(tx, actor, {
        action: 'record.add',
        versionId: v.id,
        recordId: created.recordId,
        detail: {
          label,
          tab: created.tab,
          sourceRef,
          after: after.sourceRef,
          safety,
          reason: input.reason,
          cells: plain(cells),
        },
      });
      return toDto(created);
    });
  }

  edit(actor: Actor, label: string, recordId: string, input: EditRecordInput): Promise<RecordDto> {
    return this.inTx(async (tx) => {
      const v = await draftOr409(tx, label);
      const before = await recordOr404(tx, v.id, recordId);
      const { data, changes, after } = this.changesFor(v, before, input);
      if (Object.keys(changes).length === 0) throw new BadInput('Nothing to change.');
      await assertRowValid(tx, v.id, { ...before, ...after });
      const updated = await tx.rulesetRecord.update({
        where: { id: before.id },
        data: { ...data, changedById: actor.id, changedAt: new Date(), changeReason: input.reason },
      });
      await this.audit.append(tx, actor, {
        action: 'record.edit',
        versionId: v.id,
        recordId,
        detail: {
          label,
          tab: before.tab,
          sourceRef: updated.sourceRef,
          reason: input.reason,
          changes,
        },
      });
      return toDto(updated);
    });
  }

  /** What an edit changes, as the update and as the audit's before/after. */
  private changesFor(
    v: VersionRow,
    before: RecordRow,
    input: EditRecordInput,
  ): {
    data: Prisma.RulesetRecordUpdateInput;
    changes: Changes;
    after: {
      mapping: RecordRow['mapping'];
      engine: JsonValue | undefined;
      columns: WorkbookCell[];
    };
  } {
    const data: Prisma.RulesetRecordUpdateInput = {};
    const changes: Changes = {};
    const columns = input.cells
      ? cellChanges(v, before, input.cells, data, changes)
      : (before.columns as unknown as WorkbookCell[]);
    for (const key of SCALAR_FIELDS) {
      const next = input[key];
      if (next === undefined || next === before[key]) continue;
      Object.assign(data, { [key]: next });
      changes[key] = { before: before[key], after: next };
    }
    if (input.engine !== undefined && !sameJson(input.engine, before.engine)) {
      data.engine = input.engine === null ? Prisma.DbNull : input.engine;
      changes['engine'] = { before: before.engine ?? null, after: input.engine };
    }
    const engine = input.engine === undefined ? before.engine : input.engine;
    return {
      data,
      changes,
      after: { mapping: input.mapping ?? before.mapping, engine: engine, columns },
    };
  }

  setStatus(
    actor: Actor,
    label: string,
    recordId: string,
    status: 'active' | 'retired',
    reason: string,
  ): Promise<RecordDto> {
    return this.inTx(async (tx) => {
      const v = await draftOr409(tx, label);
      const before = await recordOr404(tx, v.id, recordId);
      if (before.status === status) throw new BadInput(`The row is already ${status}.`);
      const updated = await tx.rulesetRecord.update({
        where: { id: before.id },
        data: { status, changedById: actor.id, changedAt: new Date(), changeReason: reason },
      });
      await this.audit.append(tx, actor, {
        action: status === 'retired' ? 'record.retire' : 'record.restore',
        versionId: v.id,
        recordId,
        detail: {
          label,
          tab: before.tab,
          sourceRef: before.sourceRef,
          safety: before.safety,
          reason,
        },
      });
      return toDto(updated);
    });
  }
}
