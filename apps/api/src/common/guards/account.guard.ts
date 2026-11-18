import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../db/prisma.service.js';
import { AccountRequired } from '../errors/errors.js';
import { REQUIRES_ACCOUNT } from '../guest/requires-account.js';
import type { AuthedRequest } from './request-user.js';

/**
 * Global guard, after AuthGuard: a route marked `@RequiresAccount()` refuses a guest space with 403
 * `account_required`. One indexed read of the user, only on those routes. Browse-mode requests have
 * no user and pass: they are not a guest space.
 */
@Injectable()
export class AccountGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const marked = this.reflector.getAllAndOverride<boolean | undefined>(REQUIRES_ACCOUNT, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!marked) return true;
    const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user) return true;
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { isGuest: true },
    });
    if (row?.isGuest) throw new AccountRequired();
    return true;
  }
}
