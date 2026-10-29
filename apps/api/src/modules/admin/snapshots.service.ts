import { Injectable } from '@nestjs/common';
import { evaluate, type Snapshot } from '@figcit/engine';
import {
  buildFixtures,
  buildSnapshot,
  canonicalJson,
  checkFixture,
  validateSnapshot,
  workbookFromTexts,
  WORKBOOK_VERSION,
} from '@figcit/rules-compiler';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/db/prisma.service.js';
import { AppError, BadInput, Forbidden, NotFound } from '../../common/errors/errors.js';
import type { RequestUser } from '../../common/guards/request-user.js';
import { AuditService } from '../audit/audit.service.js';
import { RulesService } from '../rules/rules.service.js';

export interface SnapshotSummary {
  readonly id: string;
  readonly version: string;
  readonly status: string;
  readonly touchesSafety: boolean;
  readonly fixtureReport: unknown;
  readonly diffSummary: unknown;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly reviewedAt: string | null;
  readonly safetySignedAt: string | null;
  readonly publishedAt: string | null;
}

const SUMMARY = {
  id: true,
  version: true,
  status: true,
  touchesSafety: true,
  fixtureReport: true,
  diffSummary: true,
  notes: true,
  createdAt: true,
  reviewedAt: true,
  safetySignedAt: true,
  publishedAt: true,
  createdById: true,
  reviewedById: true,
} satisfies Prisma.RuleSnapshotSelect;
type Row = Prisma.RuleSnapshotGetPayload<{ select: typeof SUMMARY }>;
const iso = (d: Date | null): string | null => d?.toISOString() ?? null;
const toDto = (r: Row): SnapshotSummary => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
  reviewedAt: iso(r.reviewedAt),
  safetySignedAt: iso(r.safetySignedAt),
  publishedAt: iso(r.publishedAt),
});

/** What changed between two snapshots, by section (canonical JSON: JSONB reorders keys); safety sections flag a clinical sign-off. */
export function diffSnapshots(
  prev: Snapshot | null,
  next: Snapshot,
): { changed: string[]; touchesSafety: boolean } {
  const keys = Object.keys(next) as (keyof Snapshot)[];
  const changed = prev
    ? keys.filter((k) => k !== 'version' && canonicalJson(prev[k]) !== canonicalJson(next[k]))
    : keys;
  const touchesSafety =
    changed.some((k) => k === 'safety' || k === 'crisisRoutes') ||
    (prev !== null && safetyTierChanged(prev, next));
  return { changed, touchesSafety };
}

const SAFETY_PATHWAYS = new Set(['regulate', 'connect']);
const COMMUNICATION_TOOLS = new Set(['comm_cards', 'adapt_communication']);

/** ENT-9: a Free/Advanced move in Regulate, Connect, communication cards or the safety floor. */
function safetyTierChanged(prev: Snapshot, next: Snapshot): boolean {
  const before = new Map(prev.tools.map((t) => [t.id, t]));
  return next.tools.some((t) => {
    const old = before.get(t.id);
    if (!old || (old.tier === t.tier && old.safetyFloor === t.safetyFloor)) return false;
    return (
      SAFETY_PATHWAYS.has(t.pathway) ||
      COMMUNICATION_TOOLS.has(t.id) ||
      t.safetyFloor ||
      old.safetyFloor
    );
  });
}

/** Runs every workbook scenario through the engine with the new snapshot. */
function fixtureReport(
  fixtures: ReturnType<typeof buildFixtures>,
  snapshot: Snapshot,
): { total: number; passed: number; failed: string[] } {
  const failed: string[] = [];
  for (const f of fixtures) {
    if (!checkFixture(f, evaluate(f.input, snapshot, f.signals))) failed.push(f.ref);
  }
  return {
    total: fixtures.length,
    passed: fixtures.length - failed.length,
    failed: failed.slice(0, 50),
  };
}

/** Workbook → draft → review → safety sign-off (when needed) → publish (SYSTEM_DESIGN §5.4). */
@Injectable()
export class SnapshotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<SnapshotSummary[]> {
    return (
      await this.prisma.ruleSnapshot.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: SUMMARY,
      })
    ).map(toDto);
  }

  async upload(
    staff: RequestUser,
    files: Readonly<Record<string, string>>,
    notes: string | undefined,
  ): Promise<SnapshotSummary> {
    let tables;
    try {
      tables = workbookFromTexts(files);
    } catch (e) {
      throw new BadInput(e instanceof Error ? e.message : 'The workbook could not be read.');
    }
    const built = buildSnapshot(tables);
    const problems = validateSnapshot(built.snapshot, tables);
    if (problems.length)
      throw new AppError(422, 'invalid_workbook', 'The workbook has problems', {
        extra: { problems: problems.slice(0, 50) },
      });
    const version = `${WORKBOOK_VERSION}+${built.hash.slice(0, 8)}`;
    const existing = await this.prisma.ruleSnapshot.findUnique({
      where: { version },
      select: SUMMARY,
    });
    if (existing) return toDto(existing);
    const current = await this.rules
      .current()
      .then((c) => c.snapshot)
      .catch(() => null);
    const snapshot = { ...built.snapshot, version } as Snapshot;
    const diff = diffSnapshots(current, snapshot);
    const row = await this.prisma.ruleSnapshot.create({
      data: {
        version,
        hash: built.hash,
        json: snapshot as unknown as Prisma.InputJsonValue,
        status: 'draft',
        touchesSafety: diff.touchesSafety,
        notes: notes ?? null,
        createdById: staff.id,
        diffSummary: diff,
        fixtureReport: fixtureReport(buildFixtures(tables), snapshot),
      },
      select: SUMMARY,
    });
    await this.audit.record({
      actorId: staff.id,
      actorRole: staff.roles[0] ?? 'staff',
      action: 'snapshot.upload',
      targetType: 'rule_snapshot',
      targetId: row.id,
      meta: { version },
    });
    return toDto(row);
  }

  private async row(id: string): Promise<Row> {
    const r = await this.prisma.ruleSnapshot.findUnique({ where: { id }, select: SUMMARY });
    if (!r) throw new NotFound('snapshot');
    return r;
  }

  /** A second person reviews; the uploader can't approve their own snapshot (four eyes). */
  async review(staff: RequestUser, id: string): Promise<SnapshotSummary> {
    const r = await this.row(id);
    if (r.status !== 'draft') throw new BadInput(`This snapshot is ${r.status}.`);
    if (r.createdById === staff.id) throw new Forbidden('Someone else needs to review this.');
    const next = await this.prisma.ruleSnapshot.update({
      where: { id },
      data: {
        status: r.touchesSafety ? 'safety_review' : 'in_review',
        reviewedById: staff.id,
        reviewedAt: new Date(),
      },
      select: SUMMARY,
    });
    await this.audit.record({
      actorId: staff.id,
      actorRole: 'reviewer',
      action: 'snapshot.review',
      targetType: 'rule_snapshot',
      targetId: id,
    });
    return toDto(next);
  }

  async signOff(staff: RequestUser, id: string): Promise<SnapshotSummary> {
    if (!staff.roles.includes('safety_reviewer'))
      throw new Forbidden('A safety reviewer signs this off.');
    const r = await this.row(id);
    if (r.status !== 'safety_review')
      throw new BadInput('This snapshot is not waiting for safety sign-off.');
    const next = await this.prisma.ruleSnapshot.update({
      where: { id },
      data: { status: 'in_review', safetySignedById: staff.id, safetySignedAt: new Date() },
      select: SUMMARY,
    });
    await this.audit.record({
      actorId: staff.id,
      actorRole: 'safety_reviewer',
      action: 'snapshot.safety_sign_off',
      targetType: 'rule_snapshot',
      targetId: id,
    });
    return toDto(next);
  }

  /** Publishing an older snapshot is the rollback. */
  async publish(staff: RequestUser, id: string): Promise<SnapshotSummary> {
    const r = await this.row(id);
    const ready = r.status === 'in_review' || r.status === 'retired';
    if (!ready || !r.reviewedAt || (r.touchesSafety && !r.safetySignedAt))
      throw new BadInput('Review (and safety sign-off, if needed) comes first.');
    await this.prisma.$transaction([
      this.prisma.ruleSnapshot.updateMany({
        where: { status: 'published' },
        data: { status: 'retired', retiredAt: new Date() },
      }),
      this.prisma.ruleSnapshot.update({
        where: { id },
        data: { status: 'published', publishedAt: new Date(), retiredAt: null },
      }),
    ]);
    this.rules.invalidate();
    await this.audit.record({
      actorId: staff.id,
      actorRole: 'admin',
      action: 'snapshot.publish',
      targetType: 'rule_snapshot',
      targetId: id,
      meta: { version: r.version },
    });
    return toDto(await this.row(id));
  }
}
