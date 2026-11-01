import { Injectable } from '@nestjs/common';
import { Prisma, type RuleDecision, type RuleGap } from '@prisma/client';
import { PrismaService, type Tx } from '../../common/db/prisma.service.js';
import { BadInput, Conflict, NotFound } from '../../common/errors/errors.js';
import { RulesetAuditService, type Actor } from './ruleset-audit.service.js';

export const GAP_KINDS = [
  'unrepresentable',
  'contradiction',
  'undefined_term',
  'missing_number',
  'uncovered_input',
  'overlap',
  'input_value',
  'other',
] as const;
export type GapKind = (typeof GAP_KINDS)[number];

export interface GapInput {
  readonly title: string;
  readonly kind: GapKind;
  readonly detail: string;
  readonly recordIds: readonly string[];
  /** Standard input values that show the problem; stored as given (bounded at the boundary). */
  readonly exampleInput?: unknown;
  readonly whileExempt?: string | undefined;
  readonly recommendation?: string | undefined;
  readonly decides: 'founder' | 'clinical_safety' | 'owner';
  readonly docRef?: string | undefined;
}

export interface GapUpdate {
  readonly status?: 'open' | 'acknowledged' | 'resolved' | undefined;
  readonly resolution?: string | undefined;
  readonly whileExempt?: string | undefined;
  readonly recommendation?: string | undefined;
  readonly reason: string;
}

export interface GapDto {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly kind: string;
  readonly detail: string;
  readonly recordIds: readonly string[];
  readonly sourceRefs: readonly string[];
  readonly exampleInput: unknown;
  readonly whileExempt: string | null;
  readonly recommendation: string | null;
  readonly decides: string;
  readonly safety: boolean;
  readonly docRef: string | null;
  readonly status: string;
  readonly resolution: string | null;
  readonly acknowledgedAt: string | null;
  readonly resolvedAt: string | null;
  readonly createdAt: string;
}

export interface DecisionInput {
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  readonly source: string;
  readonly decidedBy: string;
  readonly decidedAt: string;
  readonly gapIds: readonly string[];
}

export interface DecisionDto extends Omit<DecisionInput, 'gapIds'> {
  readonly id: string;
  readonly gapIds: readonly string[];
}

const iso = (d: Date | null): string | null => d?.toISOString() ?? null;
export const gapCode = (n: number): string => `GAP-${String(n).padStart(4, '0')}`;
/** The title of the gap that records a broken fixed rule; one gap per rule (E-51). */
export const breakTitle = (rule: string): string => `Breaks a fixed rule: ${rule}`.slice(0, 200);

/** A row the import's mapping file marks `unresolved`, as stored in the new version. */
export interface UnresolvedRow {
  readonly recordId: string;
  /** "tab · reference", as gaps show it. */
  readonly ref: string;
  readonly reason: string;
  readonly decides: 'founder' | 'clinical_safety';
  readonly safety: boolean;
}

function toGap(g: RuleGap): GapDto {
  return {
    id: g.id,
    code: gapCode(g.number),
    title: g.title,
    kind: g.kind,
    detail: g.detail,
    recordIds: g.recordIds,
    sourceRefs: g.sourceRefs,
    exampleInput: g.exampleInput,
    whileExempt: g.whileExempt,
    recommendation: g.recommendation,
    decides: g.decides,
    safety: g.safety,
    docRef: g.docRef,
    status: g.status,
    resolution: g.resolution,
    acknowledgedAt: iso(g.acknowledgedAt),
    resolvedAt: iso(g.resolvedAt),
    createdAt: g.createdAt.toISOString(),
  };
}

function toDecision(d: RuleDecision): DecisionDto {
  return {
    id: d.id,
    code: d.code,
    title: d.title,
    detail: d.detail,
    source: d.source,
    decidedBy: d.decidedBy,
    decidedAt: d.decidedAt.toISOString().slice(0, 10),
    gapIds: d.gapIds,
  };
}

/** The fields a gap update sets, with who and when for a change of status. */
function updateData(actor: Actor, from: string, input: GapUpdate): Prisma.RuleGapUpdateInput {
  const data: Prisma.RuleGapUpdateInput = {};
  if (input.whileExempt !== undefined) data.whileExempt = input.whileExempt;
  if (input.recommendation !== undefined) data.recommendation = input.recommendation;
  if (input.resolution !== undefined) data.resolution = input.resolution;
  if (input.status === undefined || input.status === from) return data;
  data.status = input.status;
  const now = new Date();
  if (input.status === 'acknowledged') {
    data.acknowledgedById = actor.id;
    data.acknowledgedAt = now;
  }
  if (input.status === 'resolved') {
    data.resolvedById = actor.id;
    data.resolvedAt = now;
  }
  return data;
}

/**
 * The gap and decision registers kept with the rule set (DESIGN §3.6, E-11). A gap names the rows
 * involved by their stable IDs, so it carries across versions; it is a safety gap when any of them
 * is a safety row, and then it must be acknowledged before a version exempting that row can be
 * published (E-21).
 */
@Injectable()
export class RuleGapsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: RulesetAuditService,
  ) {}

  async list(status: string | undefined): Promise<GapDto[]> {
    const rows = await this.prisma.ruleGap.findMany({
      where: status ? { status: status as RuleGap['status'] } : {},
      orderBy: { number: 'asc' },
      take: 500,
    });
    return rows.map(toGap);
  }

  /** The rows a gap names, as they are in their latest version. */
  private async describe(
    recordIds: readonly string[],
  ): Promise<{ refs: string[]; safety: boolean }> {
    const rows = await this.prisma.rulesetRecord.findMany({
      where: { recordId: { in: [...recordIds] } },
      orderBy: { version: { createdAt: 'desc' } },
      distinct: ['recordId'],
      select: { recordId: true, tab: true, sourceRef: true, safety: true },
    });
    const missing = recordIds.filter((id) => !rows.some((r) => r.recordId === id));
    if (missing.length > 0) throw new BadInput('Some rules in the gap do not exist.', { missing });
    return {
      refs: recordIds.map((id) => {
        const r = rows.find((row) => row.recordId === id);
        return r ? `${r.tab} · ${r.sourceRef}` : id;
      }),
      safety: rows.some((r) => r.safety),
    };
  }

  async create(actor: Actor, input: GapInput): Promise<GapDto> {
    const { refs, safety } = await this.describe(input.recordIds);
    return this.prisma.$transaction(async (tx) => {
      const gap = await tx.ruleGap.create({
        data: {
          title: input.title,
          kind: input.kind,
          detail: input.detail,
          recordIds: [...input.recordIds],
          sourceRefs: refs,
          ...(input.exampleInput === undefined
            ? {}
            : { exampleInput: input.exampleInput as Prisma.InputJsonValue }),
          whileExempt: input.whileExempt ?? null,
          recommendation: input.recommendation ?? null,
          decides: input.decides,
          safety,
          docRef: input.docRef ?? null,
          createdById: actor.id,
        },
      });
      await this.audit.append(tx, actor, {
        action: 'gap.create',
        gapId: gap.id,
        detail: { code: gapCode(gap.number), title: gap.title, kind: gap.kind, refs, safety },
      });
      return toGap(gap);
    });
  }

  /**
   * Opens a gap for each unresolved row of an import (E-11, E-50): the engine skips the row, and
   * the gap says why and who decides. A row that already has an unresolved-row gap still open
   * gets no second one, so re-imports don't pile up gaps. Runs in the import's transaction.
   * Returns the new gaps' codes.
   */
  async openForUnresolved(tx: Tx, actor: Actor, rows: readonly UnresolvedRow[]): Promise<string[]> {
    if (rows.length === 0) return [];
    const open = await tx.ruleGap.findMany({
      where: {
        kind: 'unrepresentable',
        status: { not: 'resolved' },
        recordIds: { hasSome: rows.map((r) => r.recordId) },
      },
      select: { recordIds: true },
    });
    const covered = new Set(open.flatMap((g) => g.recordIds));
    const codes: string[] = [];
    for (const r of rows.filter((row) => !covered.has(row.recordId))) {
      const gap = await tx.ruleGap.create({
        data: {
          title: `${r.ref}: can't run yet`.slice(0, 200),
          kind: 'unrepresentable',
          detail: r.reason,
          recordIds: [r.recordId],
          sourceRefs: [r.ref],
          decides: r.decides,
          safety: r.safety,
          docRef: 'DECISION_LOG E-50',
          createdById: actor.id,
        },
      });
      const code = gapCode(gap.number);
      await this.audit.append(tx, actor, {
        action: 'gap.create',
        gapId: gap.id,
        detail: { code, title: gap.title, kind: gap.kind, refs: [r.ref], safety: r.safety },
      });
      codes.push(code);
    }
    return codes;
  }

  /**
   * Records each fixed rule a submitted version breaks as a gap (DESIGN §5: "the break is recorded
   * as a gap"), naming the rows responsible where the engine can tell. A check that already has a
   * gap still open gets no second one. Runs in the submit transaction. Returns the new codes.
   */
  async openForChecks(
    tx: Tx,
    actor: Actor,
    broken: readonly {
      check: string;
      rule: string;
      recordIds: readonly string[];
      safety: boolean;
    }[],
  ): Promise<string[]> {
    const codes: string[] = [];
    for (const b of broken) {
      const title = breakTitle(b.rule);
      const open = await tx.ruleGap.findFirst({
        where: { title, status: { not: 'resolved' } },
        select: { id: true },
      });
      if (open) continue;
      const gap = await tx.ruleGap.create({
        data: {
          title,
          kind: 'contradiction',
          detail: `The engine broke "${b.rule}" on the publish sweep (check ${b.check}). The version can't be published until the rules are changed.`,
          recordIds: [...b.recordIds],
          sourceRefs: [],
          decides: b.safety ? 'clinical_safety' : 'founder',
          safety: b.safety,
          docRef: 'DESIGN §5, DECISION_LOG E-51',
          createdById: actor.id,
        },
      });
      const code = gapCode(gap.number);
      await this.audit.append(tx, actor, {
        action: 'gap.create',
        gapId: gap.id,
        detail: { code, title, kind: gap.kind, refs: [], safety: b.safety },
      });
      codes.push(code);
    }
    return codes;
  }

  async update(actor: Actor, id: string, input: GapUpdate): Promise<GapDto> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.ruleGap.findUnique({ where: { id } });
      if (!before) throw new NotFound('gap');
      if (input.status === 'resolved' && !(input.resolution ?? before.resolution))
        throw new BadInput('Say how the gap was resolved.');
      if (before.status === 'resolved' && input.status !== undefined && input.status !== 'resolved')
        throw new Conflict(
          'A resolved gap stays resolved; record a new gap instead.',
          'gap_resolved',
        );
      const data = updateData(actor, before.status, input);
      if (Object.keys(data).length === 0) throw new BadInput('Nothing to change.');
      const gap = await tx.ruleGap.update({ where: { id }, data });
      await this.audit.append(tx, actor, {
        action: 'gap.update',
        gapId: id,
        detail: {
          code: gapCode(gap.number),
          from: before.status,
          to: gap.status,
          reason: input.reason,
          fields: Object.keys(data),
        },
      });
      return toGap(gap);
    });
  }

  async decisions(): Promise<DecisionDto[]> {
    const rows = await this.prisma.ruleDecision.findMany({ orderBy: { decidedAt: 'asc' } });
    return rows.map(toDecision);
  }

  async addDecision(actor: Actor, input: DecisionInput): Promise<DecisionDto> {
    const found = await this.prisma.ruleGap.count({ where: { id: { in: [...input.gapIds] } } });
    if (found !== new Set(input.gapIds).size)
      throw new BadInput('Some gaps in the decision do not exist.');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const decision = await tx.ruleDecision.create({
          data: { ...input, gapIds: [...input.gapIds], decidedAt: new Date(input.decidedAt) },
        });
        await this.audit.append(tx, actor, {
          action: 'decision.create',
          detail: { code: decision.code, title: decision.title, gaps: input.gapIds.length },
        });
        return toDecision(decision);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new Conflict('A decision with that code is already recorded.', 'duplicate_decision');
      throw error;
    }
  }
}
