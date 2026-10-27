import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Unauthorized } from '../errors/errors.js';

export interface RequestUser {
  readonly id: string;
  readonly sessionId: string;
  readonly roles: readonly string[];
  readonly mfa: boolean;
}

export interface AuthedRequest extends FastifyRequest {
  user?: RequestUser;
  browseToken?: string;
}

/** The signed-in user. Throws if the route let an anonymous request through. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user) throw new Unauthorized();
    return user;
  },
);

/** The signed-in user, or undefined on public / Browse routes. */
export const MaybeUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | undefined =>
    ctx.switchToHttp().getRequest<AuthedRequest>().user,
);
