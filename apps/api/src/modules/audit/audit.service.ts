import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService, type Tx } from '../../common/db/prisma.service.js';

export interface AuditEntry {
  readonly actorId: string | null;
  readonly actorRole: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId?: string | null;
  readonly reason?: string | null;
  /** Codes only, never personal text. */
  readonly meta?: Prisma.InputJsonValue;
}

/** Append-only audit log of sensitive reads, shares, config changes and staff actions (NFR-10). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, tx?: Tx): Promise<void> {
    const db = tx ?? this.prisma;
    await db.auditEvent.create({
      data: {
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        reason: entry.reason ?? null,
        ...(entry.meta === undefined ? {} : { meta: entry.meta }),
      },
    });
  }

  async list(
    filter: { targetType?: string; actorId?: string; before?: Date },
    take = 50,
  ): Promise<
    readonly {
      id: string;
      actorId: string | null;
      actorRole: string;
      action: string;
      targetType: string;
      targetId: string | null;
      at: Date;
    }[]
  > {
    return this.prisma.auditEvent.findMany({
      where: {
        ...(filter.targetType ? { targetType: filter.targetType } : {}),
        ...(filter.actorId ? { actorId: filter.actorId } : {}),
        ...(filter.before ? { at: { lt: filter.before } } : {}),
      },
      orderBy: { at: 'desc' },
      take: Math.min(take, 100),
      select: {
        id: true,
        actorId: true,
        actorRole: true,
        action: true,
        targetType: true,
        targetId: true,
        at: true,
      },
    });
  }
}
