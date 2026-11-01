import { Injectable } from '@nestjs/common';
import {
  catalogueOf,
  compile,
  inputOptionsOf,
  publishChecks,
  PUBLISH_CHECKS,
  type PublishCheckReport,
  INPUTS,
  rowIssues,
  rulesetDocument,
  type JsonValue,
  type SheetFrames,
  type WorkbookCell,
} from '@figcit/engine-v2';
import { Prisma, type RulesetVersion } from '@prisma/client';
import { PrismaService, type Tx } from '../../common/db/prisma.service.js';
import { AppError, BadInput, Conflict } from '../../common/errors/errors.js';
import { breakTitle, RuleGapsService } from './rule-gaps.service.js';
import { RulesetAuditService, type Actor } from './ruleset-audit.service.js';
import {
  countsOf,
  sha256,
  toRecord,
  type BlockingExemption,
  type InvalidRow,
  type RecordRow,
  type VersionChecks,
  type VersionDetail,
} from './rulesets.dto.js';
import {
  assertNoOpenVersion,
  copyVersion,
  draftOr409,
  rowsOf,
  versionOr404,
} from './rulesets.repository.js';
import { RulesetsService } from './rulesets.service.js';

const OPEN: readonly string[] = ['draft', 'in_review'];

/** Exempt safety rows whose gap nobody has acknowledged (DECISION_LOG E-21). */
async function blockingExemptions(
  tx: Tx,
  rows: readonly RecordRow[],
): Promise<BlockingExemption[]> {
  const exempt = rows.filter(
    (r) => r.status === 'active' && r.role === 'rule' && r.safety && r.mapping === 'unresolved',
  );
  if (exempt.length === 0) return [];
  const gaps = await tx.ruleGap.findMany({
    where: { recordIds: { hasSome: exempt.map((r) => r.recordId) } },
    select: { recordIds: true, status: true },
  });
  const blocking: BlockingExemption[] = [];
  for (const r of exempt) {
    const own = gaps.filter((g) => g.recordIds.includes(r.recordId));
    if (own.some((g) => g.status !== 'open')) continue;
    blocking.push({
      recordId: r.recordId,
      tab: r.tab,
      sourceRef: r.sourceRef,
      reason:
        own.length === 0 ? 'Exempt safety row with no gap recorded' : 'Gap not acknowledged yet',
    });
  }
  return blocking;
}

/** Live rows the engine could not run as written, against the version's own catalogue (E-36). */
function invalidRows(rows: readonly RecordRow[]): {
  invalid: InvalidRow[];
  catalogueIssues: VersionChecks['catalogueIssues'];
} {
  const live = rows
    .filter((r) => r.status === 'active')
    .map((r) => ({
      ...r,
      columns: r.columns as unknown as WorkbookCell[],
      engine: r.engine,
    }));
  const { catalogue, issues: catalogueIssues } = catalogueOf(live);
  // The check-in options must all point at catalogue values, and every question needs options (E-40).
  const { options, issues: optionIssues } = inputOptionsOf(live, catalogue);
  const empty = INPUTS.filter((input) => options[input].length === 0).map((input) => ({
    path: `/input_mappings/${input}`,
    message: `the check-in question "${input}" has no options`,
  }));
  const invalid: InvalidRow[] = [];
  for (const r of live) {
    if (r.tab === 'catalogue') continue; // reported once, in catalogueIssues
    const found = rowIssues(r, catalogue);
    if (found.length > 0)
      invalid.push({ recordId: r.recordId, tab: r.tab, sourceRef: r.sourceRef, issues: found });
  }
  return { invalid, catalogueIssues: [...catalogueIssues, ...optionIssues, ...empty] };
}

const LONG = { timeout: 60_000 } as const;
/** Fixed rules about safety: a break is Clinical Safety's to decide. */
const SAFETY_CHECKS: readonly string[] = ['red_support', 'support_visible', 'hopeless_override'];

/** The engine on the publish sweep (M4, DESIGN §5): the version's live rows, as stored. */
function behaviourOf(rows: readonly RecordRow[]): PublishCheckReport {
  const live = rows.filter((r) => r.status === 'active');
  const { catalogue } = catalogueOf(
    live.map((r) => ({ ...r, columns: r.columns as unknown as WorkbookCell[] })),
  );
  const engine = compile(
    live.map((r) => ({
      id: r.recordId,
      tab: r.tab,
      sourceRef: r.sourceRef,
      order: r.order,
      status: r.status,
      mapping: r.mapping,
      engine: r.engine,
    })),
    catalogue,
  );
  return publishChecks(engine);
}

/** Each broken check once, with every row the engine named for it. */
function brokenChecks(report: PublishCheckReport) {
  return PUBLISH_CHECKS.filter((c) => (report.counts[c.id] ?? 0) > 0).map((c) => ({
    check: c.id,
    rule: c.rule,
    recordIds: [
      ...new Set(report.violations.filter((v) => v.check === c.id).flatMap((v) => v.rows)),
    ],
    safety: SAFETY_CHECKS.includes(c.id),
  }));
}

/**
 * Broken fixed rules whose gap nobody has acknowledged. Like an exempt safety row (E-21), a break
 * the decider has acknowledged (a deliberate, signed-off exemption) doesn't block (E-51).
 */
async function unacknowledgedBreaks(tx: Tx, report: PublishCheckReport): Promise<string[]> {
  const broken = brokenChecks(report);
  if (broken.length === 0) return [];
  const acknowledged = await tx.ruleGap.findMany({
    where: { title: { in: broken.map((b) => breakTitle(b.rule)) }, status: 'acknowledged' },
    select: { title: true },
  });
  return broken
    .filter((b) => !acknowledged.some((g) => g.title === breakTitle(b.rule)))
    .map((b) => b.check);
}

/**
 * Moves versions through draft → in review → published → retired (DESIGN §3.5). Submitting
 * freezes the hash of the canonical document; publishing re-checks it and refuses while an exempt
 * safety row has no acknowledged gap (E-21). Rolling back publishes a copy of an older version,
 * whose hash must equal the original's. The one-role simplification (E-20) is TODO T-01.
 */
@Injectable()
export class RulesetLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: RulesetAuditService,
    private readonly rulesets: RulesetsService,
    private readonly gaps: RuleGapsService,
  ) {}

  private async checksFor(tx: Tx, v: RulesetVersion): Promise<VersionChecks> {
    const rows = await rowsOf(tx, v.id);
    const hash = sha256(
      rulesetDocument({
        workbookVersion: v.workbookVersion,
        frames: v.frames as unknown as SheetFrames,
        records: rows.map(toRecord),
      }),
    );
    return {
      hash,
      counts: countsOf(rows),
      blocking: await blockingExemptions(tx, rows),
      ...invalidRows(rows),
      behaviour: behaviourOf(rows),
    };
  }

  async submit(actor: Actor, label: string): Promise<VersionDetail> {
    await this.prisma.$transaction(async (tx) => {
      const v = await draftOr409(tx, label);
      const checks = await this.checksFor(tx, v);
      await tx.rulesetVersion.update({
        where: { id: v.id },
        data: {
          status: 'in_review',
          hash: checks.hash,
          checks: checks as unknown as Prisma.InputJsonValue,
          submittedById: actor.id,
          submittedAt: new Date(),
        },
      });
      const gapsOpened = await this.gaps.openForChecks(tx, actor, brokenChecks(checks.behaviour));
      await this.audit.append(tx, actor, {
        action: 'ruleset.submit',
        versionId: v.id,
        detail: {
          label,
          hash: checks.hash,
          blocking: checks.blocking.length,
          broken: checks.behaviour.violations.length,
          gapsOpened,
        },
      });
    }, LONG);
    return this.rulesets.get(label);
  }

  async reopen(actor: Actor, label: string): Promise<VersionDetail> {
    await this.prisma.$transaction(async (tx) => {
      const v = await versionOr404(tx, label);
      if (v.status !== 'in_review')
        throw new Conflict(
          `Version ${label} is ${v.status}, not in review.`,
          'ruleset_not_in_review',
        );
      await tx.rulesetVersion.update({
        where: { id: v.id },
        data: {
          status: 'draft',
          hash: null,
          checks: Prisma.DbNull,
          submittedById: null,
          submittedAt: null,
        },
      });
      await this.audit.append(tx, actor, {
        action: 'ruleset.reopen',
        versionId: v.id,
        detail: { label },
      });
    });
    return this.rulesets.get(label);
  }

  /** Publishes a version in review; the previous published version is retired. */
  async publish(actor: Actor, label: string): Promise<VersionDetail> {
    await this.prisma.$transaction(async (tx) => {
      const v = await versionOr404(tx, label);
      if (v.status !== 'in_review')
        throw new Conflict(
          `Version ${label} is ${v.status}; submit it for review first.`,
          'ruleset_not_in_review',
        );
      await this.publishChecked(tx, actor, v, 'ruleset.publish');
    }, LONG);
    return this.rulesets.get(label);
  }

  private async publishChecked(
    tx: Tx,
    actor: Actor,
    v: RulesetVersion,
    action: string,
    extra: Record<string, JsonValue> = {},
  ): Promise<void> {
    const checks = await this.checksFor(tx, v);
    if (checks.hash !== v.hash)
      throw new Conflict(
        'The version changed after it was submitted. Reopen and submit it again.',
        'ruleset_hash_mismatch',
      );
    if (checks.invalid.length > 0 || checks.catalogueIssues.length > 0)
      throw new AppError(409, 'ruleset_invalid', 'Some rules cannot run as written', {
        detail: `${String(checks.invalid.length)} row(s) and ${String(checks.catalogueIssues.length)} catalogue problem(s) must be fixed before this version can be published.`,
        extra: { invalid: checks.invalid, catalogueIssues: checks.catalogueIssues },
      });
    if (checks.blocking.length > 0)
      throw new AppError(409, 'safety_exemptions_open', 'Some safety rules still need sign-off', {
        detail: `${String(checks.blocking.length)} exempt safety row(s) need an acknowledged gap before this version can be published.`,
        extra: { blocking: checks.blocking },
      });
    const unsafe = await unacknowledgedBreaks(tx, checks.behaviour);
    if (unsafe.length > 0)
      throw new AppError(409, 'ruleset_unsafe', 'The rules break a fixed rule of the workbook', {
        detail: `On the publish sweep the engine broke ${String(unsafe.length)} fixed rule(s). Each is recorded as a gap; change the rules, or have the decider acknowledge the gap.`,
        extra: {
          broken: unsafe,
          counts: checks.behaviour.counts,
          violations: checks.behaviour.violations,
        },
      });
    const now = new Date();
    const previous = await tx.rulesetVersion.findFirst({
      where: { status: 'published' },
      select: { id: true, label: true },
    });
    if (previous)
      await tx.rulesetVersion.update({
        where: { id: previous.id },
        data: { status: 'retired', retiredAt: now },
      });
    await tx.rulesetVersion.update({
      where: { id: v.id },
      data: {
        status: 'published',
        checks: checks as unknown as Prisma.InputJsonValue,
        publishedById: actor.id,
        publishedAt: now,
      },
    });
    await this.audit.append(tx, actor, {
      action,
      versionId: v.id,
      detail: { label: v.label, hash: checks.hash, retired: previous?.label ?? null, ...extra },
    });
  }

  /**
   * Rolls back to an earlier published version: a copy of it becomes the new published version
   * (new label, same hash), so the record of what was live when stays linear.
   */
  async rollback(actor: Actor, label: string, reason: string): Promise<VersionDetail> {
    const target = await versionOr404(this.prisma, label);
    if (target.status !== 'retired' || target.publishedAt === null)
      throw new BadInput(
        'Only a version that was published and has since been retired can be rolled back to.',
      );
    const copy = await this.prisma.$transaction(async (tx) => {
      await assertNoOpenVersion(tx);
      const version = await copyVersion(
        tx,
        actor,
        target,
        `Rollback to ${label}: ${reason}`.slice(0, 500),
      );
      const checks = await this.checksFor(tx, version);
      if (checks.hash !== target.hash)
        throw new Conflict(
          'The copy does not match the version it was taken from.',
          'ruleset_hash_mismatch',
        );
      const submitted = await tx.rulesetVersion.update({
        where: { id: version.id },
        data: {
          status: 'in_review',
          hash: checks.hash,
          submittedById: actor.id,
          submittedAt: new Date(),
        },
      });
      await this.publishChecked(tx, actor, submitted, 'ruleset.rollback', { to: label, reason });
      return submitted;
    }, LONG);
    return this.rulesets.get(copy.label);
  }

  async discard(actor: Actor, label: string, reason: string): Promise<VersionDetail> {
    await this.prisma.$transaction(async (tx) => {
      const v = await versionOr404(tx, label);
      if (!OPEN.includes(v.status))
        throw new Conflict(
          `Version ${label} is ${v.status}; only a draft or a version in review can be discarded.`,
          'ruleset_not_open',
        );
      await tx.rulesetVersion.update({ where: { id: v.id }, data: { status: 'discarded' } });
      await this.audit.append(tx, actor, {
        action: 'ruleset.discard',
        versionId: v.id,
        detail: { label, reason },
      });
    });
    return this.rulesets.get(label);
  }
}
