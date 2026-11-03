import { Injectable } from '@nestjs/common';
import type { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/db/prisma.service.js';
import { BadInput, NotConfigured, NotFound } from '../../common/errors/errors.js';
import { STAFF_ROLES } from '../../common/guards/auth.guard.js';
import type { RequestUser } from '../../common/guards/request-user.js';
import { AuditService } from '../audit/audit.service.js';
import { OwnerService } from './owner.service.js';
import {
  isStaff,
  staffDto,
  staffSelect as select,
  StaffAccountsService,
  type StaffRow as Row,
} from './staff-accounts.service.js';
import type { StaffMember } from './staff.schemas.js';

const STAFF: readonly string[] = STAFF_ROLES;
const staffRoles = (roles: readonly string[]): string[] => roles.filter((r) => STAFF.includes(r));

/**
 * Staff accounts (E-63, E-64), by an admin, never on their own account, all on the audit log:
 * invite, change roles, remove (every staff role goes, staff sessions end), suspend (no sign-in
 * anywhere, every session ends) and reinstate. Only the Owner gives or takes Admin and Clinical
 * admin, or acts on an admin; nobody acts on the Owner (OwnerService).
 */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly owner: OwnerService,
    private readonly accounts: StaffAccountsService,
  ) {}

  async list(): Promise<StaffMember[]> {
    const [rows, owner] = await Promise.all([
      this.prisma.user.findMany({
        where: { roles: { hasSome: [...STAFF_ROLES] }, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select,
        take: 200,
      }),
      this.owner.ownerId(),
    ]);
    return rows.map((r) => staffDto(r, owner));
  }

  async invite(
    actor: RequestUser,
    body: { email: string; roles: readonly string[]; reason: string },
  ): Promise<StaffMember & { existing: boolean }> {
    if (!this.accounts.canTell())
      throw new NotConfigured('The staff app address (STAFF_APP_URL) is not set.');
    const found = await this.accounts.find(body.email);
    if (found && isStaff(found.roles))
      throw new BadInput('That person is already staff: change their roles instead.');
    await this.owner.check(actor, null, { before: [], after: body.roles });
    const { row, existing } = await this.accounts.enlist(body.email, body.roles);
    await this.log(actor, 'staff.invite', row.id, body.reason, {
      roles: [...body.roles],
      existing,
    });
    return { ...staffDto(row, await this.owner.ownerId()), existing };
  }

  async setRoles(
    actor: RequestUser,
    userId: string,
    roles: readonly string[],
  ): Promise<StaffMember> {
    const user = await this.staffMember(actor, userId);
    await this.owner.check(actor, user, { before: staffRoles(user.roles), after: roles });
    if (!roles.includes('admin')) await this.keepAnAdmin(user);
    const kept = user.roles.filter((r) => !STAFF.includes(r));
    const next = [...new Set([...kept, ...roles])] as UserRole[];
    const row = await this.prisma.user.update({
      where: { id: userId },
      data: { roles: next },
      select,
    });
    await this.log(actor, 'staff.roles', userId, null, { roles: [...roles] });
    return staffDto(row, await this.owner.ownerId());
  }

  /** No longer staff: every staff role goes, and their staff sessions end now. */
  async remove(actor: RequestUser, userId: string, reason: string): Promise<StaffMember> {
    const user = await this.staffMember(actor, userId);
    await this.owner.check(actor, user, { before: staffRoles(user.roles), after: [] });
    await this.keepAnAdmin(user);
    const roles = user.roles.filter((r) => !STAFF.includes(r)) as UserRole[];
    const [row] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { roles: roles.length ? roles : ['customer'] },
        select,
      }),
      this.prisma.session.updateMany({
        where: { userId, isStaff: true, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'staff_removed' },
      }),
    ]);
    await this.log(actor, 'staff.remove', userId, reason, { roles: user.roles });
    return staffDto(row, await this.owner.ownerId());
  }

  /** The account can't sign in anywhere and every session ends; the roles stay for reinstating. */
  async suspend(actor: RequestUser, userId: string, reason: string): Promise<StaffMember> {
    const user = await this.staffMember(actor, userId);
    if (user.status === 'suspended') throw new BadInput('That account is already suspended.');
    await this.owner.check(actor, user, { before: [], after: [] });
    await this.keepAnAdmin(user);
    const [row] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { status: 'suspended' }, select }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'suspended' },
      }),
    ]);
    await this.log(actor, 'staff.suspend', userId, reason);
    return staffDto(row, await this.owner.ownerId());
  }

  async reinstate(actor: RequestUser, userId: string, reason: string): Promise<StaffMember> {
    const user = await this.staffMember(actor, userId);
    if (user.status !== 'suspended') throw new BadInput('That account is not suspended.');
    await this.owner.check(actor, user, { before: [], after: [] });
    const row = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'active' },
      select,
    });
    await this.log(actor, 'staff.reinstate', userId, reason);
    return staffDto(row, await this.owner.ownerId());
  }

  /** The Owner hands ownership to another active admin (E-64). */
  async handover(actor: RequestUser, userId: string, reason: string): Promise<StaffMember[]> {
    await this.owner.handover(actor, userId, reason);
    return this.list();
  }

  /** A staff member other than the one acting. */
  private async staffMember(actor: RequestUser, userId: string): Promise<Row> {
    if (userId === actor.id)
      throw new BadInput("You can't do this to your own staff account; ask another admin.");
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select,
    });
    if (!user || !isStaff(user.roles)) throw new NotFound('staff member');
    return user;
  }

  /** The last active admin stays an admin, so someone can always manage staff. */
  private async keepAnAdmin(user: Row): Promise<void> {
    if (!user.roles.includes('admin') || user.status !== 'active') return;
    const others = await this.prisma.user.count({
      where: { id: { not: user.id }, roles: { has: 'admin' }, status: 'active', deletedAt: null },
    });
    if (others === 0)
      throw new BadInput('This is the only active admin; make someone else admin first.');
  }

  private async log(
    actor: RequestUser,
    action: string,
    userId: string,
    reason: string | null,
    meta?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.id === (await this.owner.ownerId()) ? 'owner' : 'admin',
      action,
      targetType: 'user',
      targetId: userId,
      ...(reason ? { reason } : {}),
      ...(meta ? { meta } : {}),
    });
  }
}
