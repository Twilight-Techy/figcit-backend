import { SetMetadata, applyDecorators } from '@nestjs/common';
import type { z } from 'zod';

/** Who may call a route. Default for every route is 'user' (signed in). */
export type Access = 'public' | 'user' | 'browse' | 'staff';

export interface RouteDoc {
  readonly summary: string;
  readonly tags?: readonly string[];
  readonly access?: Access;
  readonly roles?: readonly string[];
  readonly body?: z.ZodType;
  readonly query?: z.ZodType;
  readonly response?: z.ZodType;
  readonly status?: number;
  /** Routes that only exist as a contract for now (WORKFLOW §6). */
  readonly contractOnly?: boolean;
}

export const ROUTE_DOC = 'figcit:route-doc';
export const ACCESS = 'figcit:access';
export const ROLES = 'figcit:roles';

/** Documents a route for OpenAPI and sets its access rule in one place. */
export function Route(doc: RouteDoc): MethodDecorator {
  return applyDecorators(
    SetMetadata(ROUTE_DOC, doc),
    SetMetadata(ACCESS, doc.access ?? 'user'),
    SetMetadata(ROLES, doc.roles ?? []),
  );
}
