import type { FastifyRequest } from 'fastify';
import type { Env } from '../config/env.js';
import type { AccessTokens } from '../guards/tokens.js';

// Rate limits (docs/GUEST_SPACE.md, "Abuse limits"). The rule: a limit is only there to keep bots and
// abuse off, and must never make things hard for an ordinary person, so none of them is keyed on an
// address when the request is signed in (many people share one address), and the numbers are far
// above what a person does.

type Numbers = Pick<
  Env,
  | 'RATE_LIMIT_ADDRESS_PER_MINUTE'
  | 'RATE_LIMIT_AUTH_ATTEMPT_PER_MINUTE'
  | 'RATE_LIMIT_AUTH_REQUEST_PER_MINUTE'
  | 'RATE_LIMIT_BROWSE_PER_MINUTE'
  | 'RATE_LIMIT_USER_PER_MINUTE'
>;

let numbers: Numbers = {
  RATE_LIMIT_ADDRESS_PER_MINUTE: 3000,
  RATE_LIMIT_AUTH_ATTEMPT_PER_MINUTE: 120,
  RATE_LIMIT_AUTH_REQUEST_PER_MINUTE: 60,
  RATE_LIMIT_BROWSE_PER_MINUTE: 300,
  RATE_LIMIT_USER_PER_MINUTE: 300,
};

/** Takes the numbers from the environment; the routes read them when a request comes in. */
export function setRateLimits(env: Numbers): void {
  numbers = env;
}

/** A route's own limit, for @RouteConfig: the number is read per request, so it follows the setting. */
export const routeLimit = (
  which:
    | 'RATE_LIMIT_AUTH_ATTEMPT_PER_MINUTE'
    | 'RATE_LIMIT_AUTH_REQUEST_PER_MINUTE'
    | 'RATE_LIMIT_BROWSE_PER_MINUTE',
): { rateLimit: { max: () => number; timeWindow: string } } => ({
  rateLimit: { max: () => numbers[which], timeWindow: '1 minute' },
});

/** What a request is counted as: the signed-in user (a token we issued), else the address. */
export function limitKeyFor(tokens: AccessTokens) {
  return async (req: FastifyRequest): Promise<string> => {
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    // Only a token that verifies counts as a user: a made-up one is just another anonymous request.
    const claims = bearer ? await tokens.verify(bearer) : null;
    return claims ? `user:${claims.sub}` : `ip:${req.ip}`;
  };
}

/** The global limit: per user when signed in, per address otherwise. */
export const globalMax = (_req: FastifyRequest, key: string): number =>
  key.startsWith('user:')
    ? numbers.RATE_LIMIT_USER_PER_MINUTE
    : numbers.RATE_LIMIT_ADDRESS_PER_MINUTE;
