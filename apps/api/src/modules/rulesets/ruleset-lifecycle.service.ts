import { Injectable } from '@nestjs/common';
import { rulesetDocument, type JsonValue, type SheetFrames } from '@figcit/engine-v2';
import { Prisma, type RulesetVersion } from '@prisma/client';
import { PrismaService, type Tx } from '../../common/db/prisma.service.js';
import { AppError, BadInput, Conflict } from '../../common/errors/errors.js';
import { RulesetAuditService, type Actor } from './ruleset-audit.service.js';
import {
  countsOf,
  sha256,
  toRecord,
  type BlockingExemption,
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
    return { hash, counts: countsOf(rows), blocking: await blockingExemptions(tx, rows) };
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
      await this.audit.append(tx, actor, {
        action: 'ruleset.submit',
        versionId: v.id,
        detail: { label, hash: checks.hash, blocking: checks.blocking.length },
      });
    });
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
    });
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
    if (checks.blocking.length > 0)
      throw new AppError(409, 'safety_exemptions_open', 'Some safety rules still need sign-off', {
        detail: `${String(checks.blocking.length)} exempt safety row(s) need an acknowledged gap before this version can be published.`,
        extra: { blocking: checks.blocking },
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
    const copy = await this.prisma.$transaction(
      async (tx) => {
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
      },
      { timeout: 60_000 },
    );
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
