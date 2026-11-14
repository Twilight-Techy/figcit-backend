import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { ENV, type Env } from '../../common/config/env.js';
import { PrismaService, type Tx } from '../../common/db/prisma.service.js';
import { BadInput, Forbidden, NotFound } from '../../common/errors/errors.js';
import type { RequestUser } from '../../common/guards/request-user.js';
import { StaffAccountsService, type StaffRow } from './staff-accounts.service.js';

/** The roles only the Owner gives or takes (E-64; T-01 for Clinical admin). */
export const OWNER_ROLES: readonly string[] = ['admin', 'clinical_admin'];
const NO_OWNER =
  'No Owner is set: set OWNER_EMAIL on the server, or run the staff:owner command (E-64).';

/**
 * Makes an account the Owner, and an admin (the Owner always is), with the audit entry. The one
 * place the Owner changes: the bootstrap, the handover and the recovery command all use it.
 */
export async function setOwner(
  db: Tx | PrismaClient,
  userId: string,
  entry: { actorId: string | null; actorRole: string; action: string; reason: string },
): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { roles: true } });
  if (!user.roles.includes('admin'))
    await db.user.update({ where: { id: userId }, data: { roles: [...user.roles, 'admin'] } });
  await db.staffOwner.upsert({
    where: { id: 1 },
    create: { id: 1, userId },
    update: { userId, since: new Date() },
  });
  await db.auditEvent.create({
    data: { ...entry, targetType: 'user', targetId: userId, meta: {} },
  });
}

/**
 * The staff app's one Owner (E-64): only the Owner gives or takes Admin and Clinical admin,
 * suspends, removes or reinstates an admin, and hands ownership on. Nobody else acts on the
 * Owner's account. The first Owner comes from OWNER_EMAIL, only while there is none.
 */
@Injectable()
export class OwnerService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Owner');

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly accounts: StaffAccountsService,
  ) {}

  async ownerId(): Promise<string | null> {
    return (await this.prisma.staffOwner.findUnique({ where: { id: 1 } }))?.userId ?? null;
  }

  /**
   * May `actor` make this change to `target`? `before` and `after` are the target's staff roles.
   * Throws when only the Owner may, or when the target is the Owner.
   */
  async check(
    actor: RequestUser,
    target: StaffRow | null,
    change: { before: readonly string[]; after: readonly string[] },
  ): Promise<void> {
    const owner = await this.ownerId();
    if (target && target.id === owner)
      throw new Forbidden("The Owner's account is changed only by the Owner, by handing over.");
    if (actor.id === owner) return;
    const sensitive = OWNER_ROLES.some(
      (r) => change.before.includes(r) !== change.after.includes(r),
    );
    if (sensitive)
      throw new Forbidden(
        owner ? 'Only the Owner gives or takes Admin and Clinical admin.' : NO_OWNER,
      );
    if (target?.roles.includes('admin'))
      throw new Forbidden(
        owner ? 'Only the Owner suspends, removes or reinstates an admin.' : NO_OWNER,
      );
  }

  /** The Owner hands ownership to an active admin. */
  async handover(actor: RequestUser, userId: string, reason: string): Promise<void> {
    if (actor.id !== (await this.ownerId())) throw new Forbidden('Only the Owner hands over.');
    if (userId === actor.id) throw new BadInput('You are the Owner already.');
    const to = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, status: 'active', roles: { has: 'admin' } },
      select: { id: true },
    });
    if (!to) throw new NotFound('active admin');
    await this.prisma.$transaction((tx) =>
      setOwner(tx, userId, {
        actorId: actor.id,
        actorRole: 'owner',
        action: 'staff.owner.handover',
        reason,
      }),
    );
  }

  /** The first Owner, from OWNER_EMAIL, only while there is none. */
  async onApplicationBootstrap(): Promise<void> {
    const email = this.env.OWNER_EMAIL?.trim().toLowerCase();
    if (!email) return;
    const owner = await this.prisma.staffOwner.findUnique({
      where: { id: 1 },
      select: { user: { select: { email: true } } },
    });
    if (owner) {
      if (owner.user.email !== email)
        this.logger.warn('OWNER_EMAIL differs from the Owner; it is only used while there is none');
      return;
    }
    const { row } = await this.accounts.enlist(email, ['admin']);
    // An upsert of the one row: two instances starting at once set the same Owner.
    await setOwner(this.prisma, row.id, {
      actorId: null,
      actorRole: 'system',
      action: 'staff.owner.bootstrap',
      reason: 'OWNER_EMAIL, while no Owner was set',
    });
    this.logger.log(`${email} is the Owner (from OWNER_EMAIL)`);
  }
}
