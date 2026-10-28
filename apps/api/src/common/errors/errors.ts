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

export class TooMany extends AppError {
  constructor(detail = 'Please wait a moment and try again.') {
    super(429, 'rate_limited', 'Too many tries for now', detail);
  }
}

export class NotEntitled extends AppError {
  constructor(feature: string) {
    super(402, 'not_entitled', 'This is an Advanced tool', `${feature} is part of NUCCESS Plus.`);
  }
}

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
