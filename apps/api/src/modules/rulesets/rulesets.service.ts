import { Injectable } from '@nestjs/common';
import {
  applyMappings,
  canonicalJson,
  describeFormat,
  readWorkbook,
  RULESET_FORMAT,
  withAdditions,
  writeWorkbook,
  type AdditionsReport,
  type FormatDescription,
  type ImportReport,
  type MappingReport,
  type RulesetRecord,
  type SheetFrames,
} from '@figcit/engine-v2';
import { Prisma } from '@prisma/client';
import { PrismaService, type Tx } from '../../common/db/prisma.service.js';
import { BadInput, NotFound } from '../../common/errors/errors.js';
import { RuleGapsService, type UnresolvedRow } from './rule-gaps.service.js';
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
  catalogueFor,
  copyVersion,
  latestIds,
  nextRevision,
  refKey,
  rowsOf,
  versionOr404,
} from './rulesets.repository.js';

const LONG = { timeout: 60_000 } as const;

/** The new version's unresolved rows, with the mapping file's reason and who decides. */
async function unresolvedRows(
  tx: Tx,
  versionId: string,
  reported: MappingReport['unresolved'],
): Promise<UnresolvedRow[]> {
  if (reported.length === 0) return [];
  const rows = await tx.rulesetRecord.findMany({
    where: { versionId, mapping: 'unresolved' },
    select: { recordId: true, tab: true, sourceRef: true, safety: true },
  });
  return reported.flatMap((u) => {
    const row = rows.find((r) => r.tab === u.tab && r.sourceRef === u.ref);
    return row
      ? [
          {
            recordId: row.recordId,
            ref: `${u.tab} · ${u.ref}`,
            reason: u.reason,
            decides: u.decides,
            safety: row.safety,
          },
        ]
      : [];
  });
}

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
    private readonly gaps: RuleGapsService,
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
   * The rule format for this version (E-36): facts, effects, the catalogue's values and the JSON
   * Schema of engine columns, so the staff app builds its editor from data, not code.
   */
  async format(label: string): Promise<FormatDescription & { label: string }> {
    const v = await versionOr404(this.prisma, label);
    const { catalogue, issues } = await catalogueFor(this.prisma, v.id);
    return { label: v.label, ...describeFormat(catalogue, issues) };
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
  ): Promise<{ version: VersionSummary; report: ImportReport; additions: AdditionsReport }> {
    const read = readWorkbook(files);
    const { missingFiles, unknownFiles } = read.report;
    if (missingFiles.length > 0 || unknownFiles.length > 0)
      throw new BadInput('The upload must hold every workbook tab and nothing else.', {
        missingFiles,
        unknownFiles,
      });
    const sourceHash = sha256(canonicalJson(files));
    const added = withAdditions(read);
    // The reviewed mapping file gives each rule row its engine columns (M3).
    const mapped = applyMappings(added.records);
    const full = { ...added, records: mapped.records };
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
          frames: full.frames as unknown as Prisma.InputJsonValue,
          importReport: {
            ...read.report,
            additions: full.additions,
            mappings: mapped.report,
          } as unknown as Prisma.InputJsonValue,
          sourceHash,
          notes: notes ?? null,
          createdById: actor.id,
        },
        include: { basedOn: { select: { label: true } } },
      });
      const keptIds = await this.insertRecords(tx, actor, version.id, full.records, latest.ids);
      const unresolved = await unresolvedRows(tx, version.id, mapped.report.unresolved);
      const gapsOpened = await this.gaps.openForUnresolved(tx, actor, unresolved);
      await this.audit.append(tx, actor, {
        action: 'ruleset.import',
        versionId: version.id,
        detail: {
          label: version.label,
          sourceHash,
          records: full.records.length,
          seeded: full.additions.catalogue,
          keptIds,
          gapsOpened,
        },
      });
      return version;
    }, LONG);
    return { version: toSummary(created), report: read.report, additions: full.additions };
  }

  /** Inserts the imported rows; returns how many kept an earlier rule ID. */
  private async insertRecords(
    tx: Tx,
    actor: Actor,
    versionId: string,
    records: readonly RulesetRecord[],
    known: ReadonlyMap<string, string>,
  ): Promise<number> {
    let kept = 0;
    await tx.rulesetRecord.createMany({
      data: records.map((r) => {
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
          engine: r.engine === null ? Prisma.DbNull : r.engine,
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
