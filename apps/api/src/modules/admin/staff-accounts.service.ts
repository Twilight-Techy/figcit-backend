import { Inject, Injectable, Logger } from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import { ENV, type Env } from '../../common/config/env.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { BadInput } from '../../common/errors/errors.js';
import { STAFF_ROLES } from '../../common/guards/auth.guard.js';
import { layout, MailService } from '../../platform/mail/mail.service.js';
import { UsersRepository } from '../users/users.repository.js';
import type { StaffMember } from './staff.schemas.js';

const STAFF: readonly string[] = STAFF_ROLES;
export const isStaff = (roles: readonly string[]): boolean => roles.some((r) => STAFF.includes(r));

export const staffSelect = {
  id: true,
  email: true,
  roles: true,
  status: true,
  lastActiveAt: true,
  createdAt: true,
  deletedAt: true,
  _count: { select: { mfaFactors: true } },
} as const;

export type StaffRow = {
  id: string;
  email: string | null;
  roles: string[];
  status: StaffMember['status'];
  lastActiveAt: Date | null;
  createdAt: Date;
  deletedAt: Date | null;
  _count: { mfaFactors: number };
};

export const staffDto = (r: StaffRow, ownerId: string | null): StaffMember => ({
  id: r.id,
  email: r.email,
  roles: r.roles,
  status: r.status,
  owner: r.id === ownerId,
  mfa: r._count.mfaFactors > 0,
  lastActiveAt: r.lastActiveAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

/**
 * Making an email staff (E-63, E-64): the account gets the roles (a new account if the email has
 * none) and an email telling them to sign in to the staff app. No sign-in link travels in it: the
 * usual 10-minute link and the two-step set-up follow in the staff app.
 */
@Injectable()
export class StaffAccountsService {
  private readonly logger = new Logger('Staff');

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly users: UsersRepository,
    private readonly crypto: CryptoService,
    private readonly mail: MailService,
  ) {}

  /** Whether the invite email can say where the staff app is. */
  canTell(): boolean {
    return this.env.STAFF_APP_URL !== undefined;
  }

  /** The account of an email, if any (closed accounts can't be made staff). */
  async find(email: string): Promise<StaffRow | null> {
    const found = await this.prisma.user.findUnique({ where: { email }, select: staffSelect });
    if (found && (found.status === 'deleted' || found.deletedAt))
      throw new BadInput('That account is closed; it cannot be made staff.');
    return found;
  }

  async enlist(
    email: string,
    roles: readonly string[],
  ): Promise<{ row: StaffRow; existing: boolean }> {
    const found = await this.find(email);
    const id =
      found?.id ??
      (
        await this.users.create({
          email,
          dataKeyEnc: this.crypto.newWrappedKey(),
          emailVerified: false,
        })
      ).id;
    const next = [...new Set([...(found?.roles ?? ['customer']), ...roles])] as UserRole[];
    const row = await this.prisma.user.update({
      where: { id },
      data: { roles: next },
      select: staffSelect,
    });
    await this.tell(email, roles);
    return { row, existing: found !== null };
  }

  private async tell(email: string, roles: readonly string[]): Promise<void> {
    const base = this.env.STAFF_APP_URL;
    if (!base) {
      this.logger.warn(`${email} was made staff; STAFF_APP_URL is not set, so no email was sent`);
      return;
    }
    await this.mail.send({
      to: email,
      subject: 'You have been added to FigCit staff',
      ...layout(
        'You have been added to FigCit staff',
        [
          `Your roles: ${roles.join(', ')}.`,
          'Open the staff app and choose "Email me a sign-in link" with this address. The first time, you will set up a two-step sign-in with an authenticator app.',
          "If you weren't expecting this, you can ignore this email.",
        ],
        { label: 'Open the staff app', url: `${base}/sign-in/` },
      ),
    });
  }
}
