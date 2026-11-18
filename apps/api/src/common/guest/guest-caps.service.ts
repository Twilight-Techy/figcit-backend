import { Injectable } from '@nestjs/common';
import { PrismaService, type Tx } from '../db/prisma.service.js';
import { GuestLimit } from '../errors/errors.js';
import { GUEST_MAX_DUMP_ITEMS, GUEST_MAX_DUMPS, GUEST_MAX_OPEN_TASKS } from './constants.js';

export type CapKind = 'task' | 'dump' | 'item';

const LIMITS: Readonly<Record<CapKind, { max: number; words: string }>> = {
  task: {
    max: GUEST_MAX_OPEN_TASKS,
    words: `A guest space keeps up to ${String(GUEST_MAX_OPEN_TASKS)} open tasks. Finish one, or create an account to keep more.`,
  },
  dump: {
    max: GUEST_MAX_DUMPS,
    words: `A guest space keeps up to ${String(GUEST_MAX_DUMPS)} dumps. Delete one, or create an account to keep more.`,
  },
  item: {
    max: GUEST_MAX_DUMP_ITEMS,
    words: `A guest space keeps up to ${String(GUEST_MAX_DUMP_ITEMS)} items in a dump. Start a new dump, or create an account to keep more.`,
  },
};

/**
 * What a guest space may keep (docs/GUEST_SPACE.md): 20 open tasks, 50 dumps, 50 items in a dump.
 * An account has no such limit, so none of this runs for one. Every place that makes (or reopens) a
 * task, a dump or a dump item goes through `withRoom` or, inside a transaction it already has,
 * `claim`: the count and the insert happen under a per-user lock, so parallel requests cannot
 * all see room and all insert.
 */
async function isGuest(db: PrismaService | Tx, userId: string): Promise<boolean> {
  const row = await db.user.findUnique({ where: { id: userId }, select: { isGuest: true } });
  return row?.isGuest === true;
}

async function count(db: Tx, userId: string, kind: CapKind, dumpId?: string): Promise<number> {
  if (kind === 'task') return db.task.count({ where: { userId, status: 'open', deletedAt: null } });
  if (kind === 'dump') return db.dump.count({ where: { userId, deletedAt: null } });
  return db.dumpItem.count({ where: { userId, dumpId: dumpId ?? '', deletedAt: null } });
}

/**
 * Inside a transaction: for a guest, takes this user's lock for `kind`, counts, and refuses at the
 * cap with 403 guest_limit. The lock lasts until the transaction ends, so the insert that follows
 * is counted by the next caller. Does nothing for an account.
 */
export async function claimGuestRoom(
  tx: Tx,
  userId: string,
  kind: CapKind,
  dumpId?: string,
): Promise<void> {
  if (!(await isGuest(tx, userId))) return;
  const key = `guest:${kind}:${userId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  if ((await count(tx, userId, kind, dumpId)) >= LIMITS[kind].max)
    throw new GuestLimit(LIMITS[kind].words);
}

/**
 * What a guest space may keep (docs/GUEST_SPACE.md): 20 open tasks, 50 dumps, 50 items in a dump.
 * An account has no such limit, so none of this runs for one. Every place that makes (or reopens) a
 * task, a dump or a dump item goes through `withRoom` or, inside a transaction it already has,
 * `claimGuestRoom`: the count and the insert happen under a per-user lock, so parallel requests
 * cannot all see room and all insert.
 */
@Injectable()
export class GuestCaps {
  constructor(private readonly prisma: PrismaService) {}

  /** Runs `make` where there is room: in its own locked transaction for a guest, plain for an account. */
  async withRoom<T>(
    userId: string,
    kind: CapKind,
    make: (db: PrismaService | Tx) => Promise<T>,
    dumpId?: string,
  ): Promise<T> {
    if (!(await isGuest(this.prisma, userId))) return make(this.prisma);
    return this.prisma.$transaction(async (tx) => {
      await claimGuestRoom(tx, userId, kind, dumpId);
      return make(tx);
    });
  }

  /** A dump made with this many items: over the cap it is refused, not cut short. */
  async assertItems(userId: string, items: number): Promise<void> {
    if (items > GUEST_MAX_DUMP_ITEMS && (await isGuest(this.prisma, userId)))
      throw new GuestLimit(LIMITS.item.words);
  }
}
