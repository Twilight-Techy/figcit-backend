import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACCESS, ROLES, type Access } from '../http/route.js';
import { PrismaService } from '../db/prisma.service.js';
import { Forbidden, Unauthorized } from '../errors/errors.js';
import type { AuthedRequest } from './request-user.js';
import { AccessTokens } from './tokens.js';

export const STAFF_ROLES = [
  'admin',
  'safety_reviewer',
  'content_editor',
  'institution_supporter',
  // Changes engine v2 rules (DECISION_LOG E-34); no other staff powers.
  'clinical_admin',
] as const;

/**
 * Global guard. Every route needs a signed-in user unless its `@Route` says otherwise:
 * - 'public': anyone; a valid token is still attached if sent.
 * - 'browse': a signed-in user or a Browse-mode device token (`X-Browse-Token`).
 * - 'staff': a staff role (SYSTEM_DESIGN §9.1). The session and
 *   the roles are read as they are now, not as the token says: a staff member removed or
 *   suspended loses staff access at once, not when the token expires (E-63).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: AccessTokens,
    private readonly prisma: PrismaService,
  ) {}

  private async attach(request: AuthedRequest): Promise<void> {
    const header = request.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const claims = bearer ? await this.tokens.verify(bearer) : null;
    // A guest space's token is checked against its session and its date on every request (one
    // indexed read, only for guests): linking an email signs every other session out, and a space
    // past its date stops working at once, not when the 15 minute token runs out.
    if (claims && (!claims.guest || (await this.guestStillValid(claims))))
      request.user = {
        id: claims.sub,
        sessionId: claims.sid,
        roles: claims.roles,
        mfa: claims.mfa,
      };
    const browse = request.headers['x-browse-token'];
    if (typeof browse === 'string' && browse.length >= 20) request.browseToken = browse;
  }

  private async guestStillValid(claims: { sub: string; sid: string }): Promise<boolean> {
    const now = new Date();
    const session = await this.prisma.session.findFirst({
      where: { id: claims.sid, userId: claims.sub, revokedAt: null, expiresAt: { gt: now } },
      select: {
        user: { select: { isGuest: true, guestExpiresAt: true, status: true, deletedAt: true } },
      },
    });
    const user = session?.user;
    if (!user || user.status !== 'active' || user.deletedAt) return false;
    return !user.isGuest || (user.guestExpiresAt ?? new Date(0)) > now;
  }

  private async checkStaff(request: AuthedRequest, roles: readonly string[]): Promise<void> {
    const user = request.user;
    if (!user) throw new Unauthorized();
    // One indexed read per staff request: staff are few, and access must end when it is taken.
    const session = await this.prisma.session.findFirst({
      where: {
        id: user.sessionId,
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { user: { select: { roles: true, status: true, deletedAt: true } } },
    });
    if (!session || session.user.status !== 'active' || session.user.deletedAt)
      throw new Unauthorized('Your staff session has ended. Sign in again.');
    request.user = { ...user, roles: session.user.roles };
    const allowed: readonly string[] = roles.length > 0 ? roles : STAFF_ROLES;
    if (!session.user.roles.some((r) => allowed.includes(r))) throw new Forbidden();
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const access = this.reflector.getAllAndOverride<Access | undefined>(ACCESS, targets) ?? 'user';
    const roles =
      this.reflector.getAllAndOverride<readonly string[] | undefined>(ROLES, targets) ?? [];
    const request = ctx.switchToHttp().getRequest<AuthedRequest>();
    await this.attach(request);
    if (access === 'public') return true;
    if (access === 'browse') {
      if (request.user || request.browseToken) return true;
      throw new Unauthorized('Open FigCit in Browse mode or sign in.');
    }
    if (access === 'staff') await this.checkStaff(request, roles);
    if (!request.user) throw new Unauthorized();
    return true;
  }
}
