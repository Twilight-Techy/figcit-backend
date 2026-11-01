import { Prisma, type RulesetVersion } from '@prisma/client';
import type { Tx } from '../../common/db/prisma.service.js';
import { Conflict, NotFound } from '../../common/errors/errors.js';
import type { RecordRow, VersionRow } from './rulesets.dto.js';
import type { Actor } from './ruleset-audit.service.js';

// Data access shared by the rule store services. Every function takes the transaction (or the
// client) it runs in, so callers keep each change and its audit entry atomic.

const WITH_BASE = { basedOn: { select: { label: true } } } as const;

export async function versionOr404(tx: Tx, label: string): Promise<VersionRow> {
  const v = await tx.rulesetVersion.findUnique({ where: { label }, include: WITH_BASE });
  if (!v) throw new NotFound('rule set version');
  return v;
}

export async function draftOr409(tx: Tx, label: string): Promise<VersionRow> {
  const v = await versionOr404(tx, label);
  if (v.status !== 'draft')
    throw new Conflict(
      `Version ${label} is ${v.status}; only a draft can change.`,
      'ruleset_not_draft',
    );
  return v;
}

export function rowsOf(tx: Tx, versionId: string): Promise<RecordRow[]> {
  return tx.rulesetRecord.findMany({ where: { versionId }, orderBy: { order: 'asc' } });
}

export async function recordOr404(tx: Tx, versionId: string, recordId: string): Promise<RecordRow> {
  const r = await tx.rulesetRecord.findUnique({
    where: { versionId_recordId: { versionId, recordId } },
  });
  if (!r) throw new NotFound('rule in this version');
  return r;
}

export async function nextRevision(tx: Tx, workbookVersion: string): Promise<number> {
  const last = await tx.rulesetVersion.findFirst({
    where: { workbookVersion },
    orderBy: { revision: 'desc' },
    select: { revision: true },
  });
  return (last?.revision ?? 0) + 1;
}

/** One draft or version in review at a time (also a unique index). */
export async function assertNoOpenVersion(tx: Tx): Promise<void> {
  const open = await tx.rulesetVersion.findFirst({
    where: { status: { in: ['draft', 'in_review'] } },
    select: { label: true, status: true },
  });
  if (open)
    throw new Conflict(
      `Version ${open.label} is still ${open.status === 'draft' ? 'a draft' : 'in review'}. Publish or discard it first.`,
      'ruleset_open',
    );
}

/** Stable rule IDs of the latest version, keyed by tab, section and reference. */
export async function latestIds(tx: Tx): Promise<{ id: string | null; ids: Map<string, string> }> {
  const latest = await tx.rulesetVersion.findFirst({
    where: { status: { not: 'discarded' } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  const ids = new Map<string, string>();
  if (!latest) return { id: null, ids };
  const rows = await tx.rulesetRecord.findMany({
    where: { versionId: latest.id },
    select: { tab: true, section: true, sourceRef: true, recordId: true },
  });
  for (const r of rows) ids.set(refKey(r), r.recordId);
  return { id: latest.id, ids };
}

export const refKey = (r: { tab: string; section: string | null; sourceRef: string }): string =>
  `${r.tab}|${r.section ?? ''}|${r.sourceRef}`;

/** A new draft holding a copy of every row of `base`, with the same rule IDs. */
export async function copyVersion(
  tx: Tx,
  actor: Actor,
  base: RulesetVersion,
  notes: string | null,
): Promise<VersionRow> {
  const revision = await nextRevision(tx, base.workbookVersion);
  const version = await tx.rulesetVersion.create({
    data: {
      label: `${base.workbookVersion}-r${String(revision)}`,
      workbookVersion: base.workbookVersion,
      revision,
      format: base.format,
      basedOnId: base.id,
      frames: base.frames as Prisma.InputJsonValue,
      notes,
      createdById: actor.id,
    },
    include: WITH_BASE,
  });
  const rows = await rowsOf(tx, base.id);
  await tx.rulesetRecord.createMany({
    data: rows.map((r) => ({
      versionId: version.id,
      recordId: r.recordId,
      tab: r.tab,
      role: r.role,
      section: r.section,
      sourceRef: r.sourceRef,
      order: r.order,
      columns: r.columns as Prisma.InputJsonValue,
      origin: r.origin as Prisma.InputJsonValue,
      frame: r.frame,
      engine: r.engine === null ? Prisma.DbNull : (r.engine as Prisma.InputJsonValue),
      mapping: r.mapping,
      status: r.status,
      safety: r.safety,
      workbookTag: r.workbookTag,
      changedById: r.changedById,
      changedAt: r.changedAt,
      changeReason: r.changeReason,
    })),
  });
  return version;
}
