import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../../common/config/env.js';
import { randomToken, sha256 } from '../../common/crypto/envelope.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { Unauthorized } from '../../common/errors/errors.js';
import { AccessTokens } from '../../common/guards/tokens.js';
import { STAFF_ROLES } from '../../common/guards/auth.guard.js';

/** The browser's refresh cookie. */
export const REFRESH_COOKIE = 'figcit_rt';

export interface IssuedSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly sessionId: string;
  readonly userId: string;
  readonly roles: readonly string[];
  readonly mfaRequired: boolean;
  /** A guest space: its refresh token cannot outlive guestExpiresAt. */
  readonly isGuest: boolean;
  /** When the session ends; for a guest, never later than the space itself. */
  readonly expiresAt: Date;
}

const isStaff = (roles: readonly string[]): boolean =>
  roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r));

/**
 * Sessions and rotating refresh tokens (SYSTEM_DESIGN §9.1). Every refresh issues a new token;
 * presenting a used one revokes the whole session (reuse detection).
 */
@Injectable()
export class SessionsService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly tokens: AccessTokens,
  ) {}

  private refreshExpiry(staff: boolean, guestExpiresAt: Date | null = null): Date {
    const ms = staff
      ? this.env.STAFF_SESSION_HOURS * 3_600_000
      : this.env.REFRESH_TTL_DAYS * 86_400_000;
    const at = new Date(Date.now() + ms);
    // A guest space ends at guestExpiresAt, whatever the session would otherwise last.
    return guestExpiresAt && guestExpiresAt < at ? guestExpiresAt : at;
  }

  async issue(
    userId: string,
    deviceLabel: string | undefined,
    mfaVerified = false,
  ): Promise<IssuedSession> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { roles: true, isGuest: true, guestExpiresAt: true },
    });
    if (user.isGuest && (user.guestExpiresAt ?? new Date(0)) <= new Date())
      throw new Unauthorized('This guest space has ended.');
    const staff = isStaff(user.roles);
    const expiresAt = this.refreshExpiry(staff, user.isGuest ? user.guestExpiresAt : null);
    const refreshToken = randomToken();
    const session = await this.prisma.session.create({
      data: {
        userId,
        deviceLabel: deviceLabel?.slice(0, 80) ?? null,
        isStaff: staff,
        mfaVerifiedAt: mfaVerified ? new Date() : null,
        expiresAt,
        refreshTokens: { create: { tokenHash: sha256(refreshToken), expiresAt } },
      },
      select: { id: true },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } });
    return this.tokensFor(session.id, userId, user.roles, {
      refreshToken: refreshToken,
      mfa: mfaVerified,
      guest: user.isGuest,
      expiresAt,
    });
  }

  private async tokensFor(
    sessionId: string,
    userId: string,
    roles: readonly string[],
    {
      refreshToken,
      mfa,
      guest,
      expiresAt,
    }: { refreshToken: string; mfa: boolean; guest: boolean; expiresAt: Date },
  ): Promise<IssuedSession> {
    const accessToken = await this.tokens.sign({
      sub: userId,
      sid: sessionId,
      roles,
      mfa,
      guest,
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: this.env.ACCESS_TTL_SECONDS,
      sessionId,
      userId,
      roles,
      mfaRequired: isStaff(roles) && !mfa,
      isGuest: guest,
      expiresAt,
    };
  }

  async rotate(refreshToken: string): Promise<IssuedSession> {
    const hash = sha256(refreshToken);
    const found = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      select: {
        id: true,
        usedAt: true,
        expiresAt: true,
        session: {
          select: {
            id: true,
            userId: true,
            revokedAt: true,
            expiresAt: true,
            mfaVerifiedAt: true,
            user: {
              select: {
                roles: true,
                status: true,
                deletedAt: true,
                isGuest: true,
                guestExpiresAt: true,
              },
            },
          },
        },
      },
    });
    if (
      !found ||
      found.session.revokedAt ||
      found.expiresAt < new Date() ||
      found.session.user.status !== 'active' ||
      found.session.user.deletedAt ||
      // A guest space that has ended cannot be refreshed, whatever the token says.
      (found.session.user.isGuest &&
        (found.session.user.guestExpiresAt ?? new Date(0)) <= new Date())
    ) {
      throw new Unauthorized();
    }
    if (found.usedAt) {
      // Reuse: someone has an old token. End the whole session.
      await this.revoke(found.session.id, 'refresh_reuse');
      throw new Unauthorized('For your safety we signed you out. Please sign in again.');
    }
    const next = randomToken();
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({ where: { id: found.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.create({
        data: {
          sessionId: found.session.id,
          tokenHash: sha256(next),
          expiresAt: found.session.expiresAt,
        },
      }),
      this.prisma.session.update({
        where: { id: found.session.id },
        data: { lastUsedAt: new Date() },
      }),
    ]);
    return this.tokensFor(found.session.id, found.session.userId, found.session.user.roles, {
      refreshToken: next,
      mfa: found.session.mfaVerifiedAt !== null,
      guest: found.session.user.isGuest,
      expiresAt: found.session.expiresAt,
    });
  }

  async markMfa(sessionId: string, userId: string): Promise<IssuedSession> {
    const session = await this.prisma.session.update({
      where: { id: sessionId },
      data: { mfaVerifiedAt: new Date() },
      select: { user: { select: { roles: true } } },
    });
    const refreshToken = randomToken();
    const expiresAt = this.refreshExpiry(true);
    await this.prisma.refreshToken.updateMany({
      where: { sessionId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await this.prisma.refreshToken.create({
      data: { sessionId, tokenHash: sha256(refreshToken), expiresAt },
    });
    return this.tokensFor(sessionId, userId, session.user.roles, {
      refreshToken: refreshToken,
      mfa: true,
      guest: false,
      expiresAt,
    });
  }

  async revoke(sessionId: string, reason: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  async revokeAll(userId: string, reason: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  async list(
    userId: string,
  ): Promise<
    readonly { id: string; deviceLabel: string | null; createdAt: Date; lastUsedAt: Date }[]
  > {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
      take: 20,
      select: { id: true, deviceLabel: true, createdAt: true, lastUsedAt: true },
    });
  }
}
