import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, UserRole } from '@prisma/client';
import { ENV, type Env } from '../../common/config/env.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { BadInput, NotConfigured, NotFound } from '../../common/errors/errors.js';
import { STAFF_ROLES } from '../../common/guards/auth.guard.js';
import type { RequestUser } from '../../common/guards/request-user.js';
import { layout, MailService } from '../../platform/mail/mail.service.js';
import { AuditService } from '../audit/audit.service.js';
import { UsersRepository } from '../users/users.repository.js';
import type { StaffMember } from './staff.schemas.js';

const STAFF: readonly string[] = STAFF_ROLES;
const isStaff = (roles: readonly string[]): boolean => roles.some((r) => STAFF.includes(r));
const select = {
  id: true,
  email: true,
  roles: true,
  status: true,
  lastActiveAt: true,
  createdAt: true,
  deletedAt: true,
  _count: { select: { mfaFactors: true } },
} as const;

type Row = {
  id: string;
  email: string | null;
  roles: string[];
  status: StaffMember['status'];
  lastActiveAt: Date | null;
  createdAt: Date;
  deletedAt: Date | null;
  _count: { mfaFactors: number };
};
const dto = (r: Row): StaffMember => ({
  id: r.id,
  email: r.email,
  roles: r.roles,
  status: r.status,
  mfa: r._count.mfaFactors > 0,
  lastActiveAt: r.lastActiveAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

/**
 * Staff accounts (E-63), by an admin only, never on their own account, all on the audit log:
 * - invite: an email gets staff roles (a new account if it has none) and is told to sign in to
 *   the staff app, where the usual sign-in link and the two-step set-up follow;
 * - roles: change them; remove: take every staff role away and end their staff sessions;
 * - suspend: the account can't sign in anywhere and every session ends; reinstate undoes it.
 * The last active admin can't be removed, suspended or lose the admin role.
 */
@Injectable()
export class StaffService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly users: UsersRepository,
    private readonly crypto: CryptoService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<StaffMember[]> {
    const rows = await this.prisma.user.findMany({
      where: { roles: { hasSome: [...STAFF_ROLES] }, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select,
      take: 200,
    });
    return rows.map(dto);
  }

  async invite(
    admin: RequestUser,
    body: { email: string; roles: readonly string[]; reason: string },
  ): Promise<StaffMember & { existing: boolean }> {
    const base = this.env.STAFF_APP_URL;
    if (!base) throw new NotConfigured('The staff app address (STAFF_APP_URL) is not set.');
    const found = await this.prisma.user.findUnique({ where: { email: body.email }, select });
    if (found && (found.status === 'deleted' || found.deletedAt))
      throw new BadInput('That account is closed; it cannot be made staff.');
    if (found && isStaff(found.roles))
      throw new BadInput('That person is already staff: change their roles instead.');
    const id =
      found?.id ??
      (
        await this.users.create({
          email: body.email,
          dataKeyEnc: this.crypto.newWrappedKey(),
          emailVerified: false,
        })
      ).id;
    const roles = [...new Set([...(found?.roles ?? ['customer']), ...body.roles])] as UserRole[];
    const row = await this.prisma.user.update({ where: { id }, data: { roles }, select });
    await this.audit.record({
      actorId: admin.id,
      actorRole: 'admin',
      action: 'staff.invite',
      targetType: 'user',
      targetId: id,
      reason: body.reason,
      meta: { roles: [...body.roles], existing: found !== null },
    });
    await this.mail.send({
      to: body.email,
      subject: 'You have been added to FigCit staff',
      ...layout(
        'You have been added to FigCit staff',
        [
          `Your roles: ${body.roles.join(', ')}.`,
          'Open the staff app and choose "Email me a sign-in link" with this address. The first time, you will set up a two-step sign-in with an authenticator app.',
          "If you weren't expecting this, you can ignore this email.",
        ],
        { label: 'Open the staff app', url: `${base}/sign-in/` },
      ),
    });
    return { ...dto(row), existing: found !== null };
  }

  async setRoles(
    admin: RequestUser,
    userId: string,
    roles: readonly string[],
  ): Promise<StaffMember> {
    const user = await this.staffMember(admin, userId);
    if (!roles.includes('admin')) await this.keepAnAdmin(user);
    const kept = user.roles.filter((r) => !STAFF.includes(r));
    const next = [...new Set([...kept, ...roles])] as UserRole[];
    const row = await this.prisma.user.update({
      where: { id: userId },
      data: { roles: next },
      select,
    });
    await this.audit.record({
      actorId: admin.id,
      actorRole: 'admin',
      action: 'staff.roles',
      targetType: 'user',
      targetId: userId,
      meta: { roles: [...roles] },
    });
    return dto(row);
  }

  /** No longer staff: every staff role goes, and their staff sessions end now. */
  async remove(admin: RequestUser, userId: string, reason: string): Promise<StaffMember> {
    const user = await this.staffMember(admin, userId);
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
    await this.log(admin, 'staff.remove', userId, reason, { roles: user.roles });
    return dto(row);
  }

  /** The account can't sign in anywhere and every session ends; the roles stay for reinstating. */
  async suspend(admin: RequestUser, userId: string, reason: string): Promise<StaffMember> {
    const user = await this.staffMember(admin, userId);
    if (user.status === 'suspended') throw new BadInput('That account is already suspended.');
    await this.keepAnAdmin(user);
    const [row] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { status: 'suspended' }, select }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'suspended' },
      }),
    ]);
    await this.log(admin, 'staff.suspend', userId, reason);
    return dto(row);
  }

  async reinstate(admin: RequestUser, userId: string, reason: string): Promise<StaffMember> {
    const user = await this.staffMember(admin, userId);
    if (user.status !== 'suspended') throw new BadInput('That account is not suspended.');
    const row = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'active' },
      select,
    });
    await this.log(admin, 'staff.reinstate', userId, reason);
    return dto(row);
  }

  /** A staff member other than the admin acting. */
  private async staffMember(admin: RequestUser, userId: string): Promise<Row> {
    if (userId === admin.id)
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
    admin: RequestUser,
    action: string,
    userId: string,
    reason: string,
    meta?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.audit.record({
      actorId: admin.id,
      actorRole: 'admin',
      action,
      targetType: 'user',
      targetId: userId,
      reason,
      ...(meta ? { meta } : {}),
    });
  }
}
