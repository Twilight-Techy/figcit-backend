import { Injectable } from '@nestjs/common';
import {
  canonicalJson,
  fromDraft,
  readWorkbook,
  RULESET_FORMAT,
  writeWorkbook,
  type ImportReport,
  type ReadResult,
  type SheetFrames,
} from '@figcit/engine-v2';
import type { Prisma } from '@prisma/client';
import { PrismaService, type Tx } from '../../common/db/prisma.service.js';
import { BadInput, NotFound } from '../../common/errors/errors.js';
import { RulesetAuditService, type Actor } from './ruleset-audit.service.js';
import {
  countsOf,
  sha256,
  toDto,
  toRecord,
  toSummary,
  type HistoryEntry,
  type RecordDto,
  type VersionDetail,
  type VersionRow,
  type VersionSummary,
} from './rulesets.dto.js';
import {
  assertNoOpenVersion,
  copyVersion,
  latestIds,
  nextRevision,
  refKey,
  rowsOf,
  versionOr404,
} from './rulesets.repository.js';

const LONG = { timeout: 60_000 } as const;

/**
 * The engine v2 rule store (docs/engine-v2/DESIGN.md §3, §6): reads versions, imports the
 * workbook into a draft word for word, starts drafts from a version, and exports a version back
 * into the workbook's sheets. Edits are in RulesetRecordsService, the version lifecycle in
 * RulesetLifecycleService. Every change goes into the hash-chained rule store audit log.
 */
@Injectable()
export class RulesetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: RulesetAuditService,
  ) {}

  async list(): Promise<VersionSummary[]> {
    const rows = await this.prisma.rulesetVersion.findMany({
      orderBy: { createdAt: 'desc' },
      include: { basedOn: { select: { label: true } } },
      take: 200,
    });
    return rows.map(toSummary);
  }

  async get(label: string): Promise<VersionDetail> {
    const v = await versionOr404(this.prisma, label);
    const rows = await rowsOf(this.prisma, v.id);
    return {
      ...toSummary(v),
      counts: countsOf(rows),
      checks: v.checks,
      importReport: v.importReport,
      sourceHash: v.sourceHash,
    };
  }

  async tab(label: string, tab: string): Promise<RecordDto[]> {
    const v = await versionOr404(this.prisma, label);
    const rows = await this.prisma.rulesetRecord.findMany({
      where: { versionId: v.id, tab },
      orderBy: { order: 'asc' },
    });
    return rows.map(toDto);
  }

  /** One rule across every version it appears in, oldest first. */
  async history(recordId: string): Promise<HistoryEntry[]> {
    const rows = await this.prisma.rulesetRecord.findMany({
      where: { recordId },
      include: { version: { select: { label: true, status: true, createdAt: true } } },
      orderBy: { version: { createdAt: 'asc' } },
    });
    if (rows.length === 0) throw new NotFound('rule');
    return rows.map((r) => ({
      ...toDto(r),
      version: r.version.label,
      versionStatus: r.version.status,
    }));
  }

  /** The version's live rows written back into the workbook's sheets (CSV per tab). */
  async export(
    label: string,
  ): Promise<{ label: string; hash: string | null; files: Record<string, string> }> {
    const v = await versionOr404(this.prisma, label);
    const rows = await rowsOf(this.prisma, v.id);
    const live = rows.filter((r) => r.status === 'active').map(toRecord);
    return {
      label: v.label,
      hash: v.hash,
      files: writeWorkbook(live, v.frames as unknown as SheetFrames),
    };
  }

  /**
   * Reads the workbook tabs (CSV per file) into a new draft. A row keeps the database ID it had in
   * the latest version when its tab, section and reference match, so its history carries on.
   */
  async importWorkbook(
    actor: Actor,
    files: Readonly<Record<string, string>>,
    workbookVersion: string,
    notes: string | undefined,
  ): Promise<{ version: VersionSummary; report: ImportReport }> {
    const read = readWorkbook(files);
    const { missingFiles, unknownFiles } = read.report;
    if (missingFiles.length > 0 || unknownFiles.length > 0)
      throw new BadInput('The upload must hold every workbook tab and nothing else.', {
        missingFiles,
        unknownFiles,
      });
    const sourceHash = sha256(canonicalJson(files));
    const created = await this.prisma.$transaction(async (tx) => {
      await assertNoOpenVersion(tx);
      const latest = await latestIds(tx);
      const revision = await nextRevision(tx, workbookVersion);
      const version = await tx.rulesetVersion.create({
        data: {
          label: `${workbookVersion}-r${String(revision)}`,
          workbookVersion,
          revision,
          format: RULESET_FORMAT,
          basedOnId: latest.id,
          frames: read.frames as unknown as Prisma.InputJsonValue,
          importReport: read.report as unknown as Prisma.InputJsonValue,
          sourceHash,
          notes: notes ?? null,
          createdById: actor.id,
        },
        include: { basedOn: { select: { label: true } } },
      });
      const keptIds = await this.insertRead(tx, actor, version.id, read, latest.ids);
      await this.audit.append(tx, actor, {
        action: 'ruleset.import',
        versionId: version.id,
        detail: { label: version.label, sourceHash, records: read.records.length, keptIds },
      });
      return version;
    }, LONG);
    return { version: toSummary(created), report: read.report };
  }

  /** Inserts what the reader found; returns how many rows kept an earlier rule ID. */
  private async insertRead(
    tx: Tx,
    actor: Actor,
    versionId: string,
    read: ReadResult,
    known: ReadonlyMap<string, string>,
  ): Promise<number> {
    let kept = 0;
    await tx.rulesetRecord.createMany({
      data: read.records.map((draft) => {
        const r = fromDraft(draft);
        const recordId = known.get(refKey(r));
        if (recordId) kept += 1;
        return {
          versionId,
          ...(recordId ? { recordId } : {}),
          tab: r.tab,
          role: r.role,
          section: r.section,
          sourceRef: r.sourceRef,
          order: r.order,
          columns: r.columns as unknown as Prisma.InputJsonValue,
          origin: r.origin as unknown as Prisma.InputJsonValue,
          frame: r.frame,
          mapping: r.mapping,
          status: r.status,
          safety: r.safety,
          changedById: actor.id,
          changeReason: 'Imported from the workbook',
        };
      }),
    });
    return kept;
  }

  /** A new draft copied from a version (by default the published one), keeping every rule's ID. */
  async createDraft(
    actor: Actor,
    from: string | undefined,
    notes: string | undefined,
  ): Promise<VersionSummary> {
    const created: VersionRow = await this.prisma.$transaction(async (tx) => {
      await assertNoOpenVersion(tx);
      const base = from
        ? await versionOr404(tx, from)
        : await tx.rulesetVersion.findFirst({ where: { status: 'published' } });
      if (!base) throw new NotFound('published rule set version');
      if (base.status === 'discarded') throw new BadInput('A discarded version cannot be copied.');
      const version = await copyVersion(tx, actor, base, notes ?? null);
      await this.audit.append(tx, actor, {
        action: 'ruleset.draft',
        versionId: version.id,
        detail: { label: version.label, from: base.label },
      });
      return version;
    }, LONG);
    return toSummary(created);
  }
}
