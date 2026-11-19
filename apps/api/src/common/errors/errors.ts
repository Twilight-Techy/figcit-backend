// Typed application errors rendered as RFC 9457 problem details with plain, non-blaming titles
// (ENGINEERING_RULES §11).

export class AppError extends Error {
  readonly detail: string | undefined;
  readonly extra: Readonly<Record<string, unknown>> | undefined;

  constructor(
    readonly status: number,
    readonly code: string,
    readonly title: string,
    more:
      | string
      | { readonly detail?: string; readonly extra?: Readonly<Record<string, unknown>> } = {},
  ) {
    const opts = typeof more === 'string' ? { detail: more } : more;
    super(opts.detail ?? title);
    this.detail = opts.detail;
    this.extra = opts.extra;
  }
}

export class NotFound extends AppError {
  constructor(what: string) {
    super(404, 'not_found', "We couldn't find that", `No ${what} with that id.`);
  }
}

export class Forbidden extends AppError {
  constructor(detail = "You don't have access to this.") {
    super(403, 'forbidden', 'This is not available to you', detail);
  }
}

export class Unauthorized extends AppError {
  constructor(detail = 'Please sign in again.') {
    super(401, 'unauthorized', 'You need to sign in', detail);
  }
}

export class Conflict extends AppError {
  constructor(detail: string, code = 'conflict') {
    super(409, code, 'That clashes with something already saved', detail);
  }
}

export class BadInput extends AppError {
  constructor(detail: string, extra?: Readonly<Record<string, unknown>>) {
    super(400, 'invalid_input', 'Something in the request needs another look', {
      detail,
      ...(extra ? { extra } : {}),
    });
  }
}

/** The calm sentence every 429 carries, so no one ever reads a technical message. */
export const WAIT_A_FEW_MINUTES = 'Please wait a few minutes and try again.';

export class TooMany extends AppError {
  /** Seconds to wait, sent as the Retry-After header. */
  readonly retryAfter: number | undefined;

  constructor(detail = WAIT_A_FEW_MINUTES, retryAfter?: number) {
    super(429, 'rate_limited', 'Too many tries for now', detail);
    this.retryAfter = retryAfter;
  }
}

export class NotEntitled extends AppError {
  /** `plans` is who has it: Prime and Premium by default; a Premium-only feature says so. */
  constructor(feature: string, plans = 'Prime and Premium') {
    super(402, 'not_entitled', 'This is an Advanced tool', `${feature} is part of ${plans}.`);
  }
}

/** A guest space asked for something that needs an account (docs/GUEST_SPACE.md). */
export class AccountRequired extends AppError {
  constructor(detail = 'Create an account to use this.') {
    super(403, 'account_required', 'This needs an account', detail);
  }
}

/** A guest space is full: what it may keep is limited, an account's is not. */
export class GuestLimit extends AppError {
  constructor(detail: string) {
    super(403, 'guest_limit', 'This guest space is full', detail);
  }
}

/** The error codes of the problem details the app handles, for the OpenAPI file. */
export const PROBLEM_CODES: Readonly<Record<string, string>> = {
  invalid_input: 'Something in the request needs another look (400).',
  unauthorized: 'Sign in again (401).',
  not_entitled: 'The feature is part of a paid plan (402).',
  forbidden: 'The account may not do this (403).',
  account_required: 'A guest space cannot do this: create an account first (403).',
  guest_limit: 'The guest space is full: what a guest may keep is limited (403).',
  not_found: 'There is nothing with that id (404).',
  conflict: 'That clashes with something already saved (409).',
  account_exists: 'There is already an account for that email (409).',
  email_has_account: 'The email already belongs to an account: sign in instead (409).',
  rate_limited: 'Too many tries for now (429).',
};

export class NotConfigured extends AppError {
  constructor(feature: string) {
    super(
      501,
      'not_configured',
      'This is not switched on yet',
      `${feature} isn't configured on this server.`,
    );
  }
}

export class Gone extends AppError {
  constructor(detail: string) {
    super(410, 'gone', 'This link has expired', detail);
  }
}
