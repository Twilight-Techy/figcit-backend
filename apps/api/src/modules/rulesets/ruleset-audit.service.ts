import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { canonicalJson, type JsonValue } from '@figcit/engine-v2';
import type { Prisma } from '@prisma/client';
import { PrismaService, type Tx } from '../../common/db/prisma.service.js';

/** Who did something to the rule store. */
export interface Actor {
  /** Null for the system (the seed). */
  readonly id: string | null;
  readonly role: string;
}

export interface RulesetAuditEntry {
  readonly action: string;
  readonly versionId?: string | null;
  readonly recordId?: string | null;
  readonly gapId?: string | null;
  /** Codes and rule text only; never personal data. */
  readonly detail: JsonValue;
}

export interface AuditEventDto {
  readonly seq: string;
  readonly at: string;
  readonly actorId: string | null;
  readonly actorRole: string;
  readonly action: string;
  readonly versionId: string | null;
  readonly recordId: string | null;
  readonly gapId: string | null;
  readonly detail: unknown;
  readonly hash: string;
}

export interface ChainCheck {
  readonly ok: boolean;
  readonly checked: number;
  /** The first entry whose hash or link doesn't match, if any. */
  readonly brokenAt: string | null;
}

const GENESIS = '0'.repeat(64);
// pg_advisory_xact_lock key for appending to the chain ("rulesets" as an int).
const CHAIN_LOCK = 0x72756c65;
const BATCH = 500;

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

interface ChainRow {
  readonly at: Date;
  readonly actorId: string | null;
  readonly actorRole: string;
  readonly action: string;
  readonly versionId: string | null;
  readonly recordId: string | null;
  readonly gapId: string | null;
  readonly detail: unknown;
}

/** The text an entry's hash covers: everything but its sequence number and its own hash. */
function entryText(row: ChainRow): string {
  return canonicalJson({
    at: row.at.toISOString(),
    actorId: row.actorId,
    actorRole: row.actorRole,
    action: row.action,
    versionId: row.versionId,
    recordId: row.recordId,
    gapId: row.gapId,
    detail: row.detail as JsonValue,
  });
}

/**
 * Append-only, hash-chained log of every rule store action (engine-v2 DESIGN §7): each entry's
 * hash covers the previous hash, so a changed or removed entry breaks the chain. The table also
 * rejects UPDATE and DELETE (migration trigger).
 */
@Injectable()
export class RulesetAuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Appends inside the caller's transaction, so the log and the change commit together. */
  async append(tx: Tx, actor: Actor, entry: RulesetAuditEntry): Promise<void> {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${CHAIN_LOCK}::bigint)::text`;
    const last = await tx.rulesetAuditEvent.findFirst({
      orderBy: { seq: 'desc' },
      select: { hash: true },
    });
    const prevHash = last?.hash ?? GENESIS;
    const row: ChainRow = {
      at: new Date(),
      actorId: actor.id,
      actorRole: actor.role,
      action: entry.action,
      versionId: entry.versionId ?? null,
      recordId: entry.recordId ?? null,
      gapId: entry.gapId ?? null,
      detail: entry.detail,
    };
    await tx.rulesetAuditEvent.create({
      data: {
        ...row,
        detail: entry.detail as Prisma.InputJsonValue,
        prevHash,
        hash: sha256(prevHash + entryText(row)),
      },
    });
  }

  async list(filter: {
    versionId?: string;
    recordId?: string;
    before?: bigint;
    take: number;
  }): Promise<AuditEventDto[]> {
    const rows = await this.prisma.rulesetAuditEvent.findMany({
      where: {
        ...(filter.versionId ? { versionId: filter.versionId } : {}),
        ...(filter.recordId ? { recordId: filter.recordId } : {}),
        ...(filter.before === undefined ? {} : { seq: { lt: filter.before } }),
      },
      orderBy: { seq: 'desc' },
      take: Math.min(filter.take, 200),
    });
    return rows.map((r) => ({
      seq: r.seq.toString(),
      at: r.at.toISOString(),
      actorId: r.actorId,
      actorRole: r.actorRole,
      action: r.action,
      versionId: r.versionId,
      recordId: r.recordId,
      gapId: r.gapId,
      detail: r.detail,
      hash: r.hash,
    }));
  }

  /** Re-computes the whole chain, oldest first. O(n) in the log, read in batches. */
  async verify(): Promise<ChainCheck> {
    let prev = GENESIS;
    let checked = 0;
    let after: bigint | undefined;
    for (;;) {
      const rows = await this.prisma.rulesetAuditEvent.findMany({
        where: after === undefined ? {} : { seq: { gt: after } },
        orderBy: { seq: 'asc' },
        take: BATCH,
      });
      for (const row of rows) {
        if (row.prevHash !== prev || row.hash !== sha256(prev + entryText(row)))
          return { ok: false, checked, brokenAt: row.seq.toString() };
        prev = row.hash;
        checked += 1;
      }
      if (rows.length < BATCH) return { ok: true, checked, brokenAt: null };
      after = rows[rows.length - 1]?.seq;
    }
  }
}
