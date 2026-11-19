import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError, TooMany, WAIT_A_FEW_MINUTES } from './errors.js';

interface Problem {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  instance?: string;
  [extra: string]: unknown;
}

const problem = (
  code: string,
  title: string,
  status: number,
  more: Record<string, unknown> = {},
): Problem => ({
  type: `https://figcit.co.uk/problems/${code}`,
  title,
  status,
  code,
  ...more,
});

function httpProblem(status: number): Problem {
  if (status === 404) return problem('not_found', "We couldn't find that", 404);
  if (status === 429)
    return problem('rate_limited', 'Too many tries for now', 429, { detail: WAIT_A_FEW_MINUTES });
  if (status === 413) return problem('too_large', 'That is too big to send', 413);
  return problem('http_error', 'That request could not be completed', status);
}

function statusOf(error: unknown): number {
  if (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number'
  )
    return error.statusCode;
  return 500;
}

function fromException(error: unknown): Problem {
  if (error instanceof AppError)
    return problem(error.code, error.title, error.status, {
      ...(error.detail ? { detail: error.detail } : {}),
      ...(error.extra ?? {}),
    });
  if (error instanceof ZodError) {
    const issues = error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return problem('invalid_input', 'Something in the request needs another look', 400, {
      // The first few, with the field each is about, so a client can show them without the list.
      detail: issues
        .slice(0, 3)
        .map((i) => (i.path ? `${i.path}: ${i.message}` : i.message))
        .join(' '),
      issues,
    });
  }
  if (error instanceof HttpException) return httpProblem(error.getStatus());
  const status = statusOf(error);
  if (status < 500) return httpProblem(status);
  return problem('internal', 'Something went wrong on our side', 500, {
    detail: "It's not you. Please try again in a moment.",
  });
}

@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger('Problem');

  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const reply = http.getResponse<FastifyReply>();
    const request = http.getRequest<FastifyRequest>();
    const problem = fromException(error);
    if (problem.status >= 500)
      this.logger.error(
        {
          err:
            error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : error,
          url: request.url,
        },
        'unhandled error',
      );
    if (error instanceof TooMany && error.retryAfter !== undefined)
      void reply.header('retry-after', String(Math.max(1, Math.ceil(error.retryAfter))));
    void reply
      .status(problem.status)
      .header('content-type', 'application/problem+json')
      .header('cache-control', 'no-store')
      .send({ ...problem, instance: request.url.split('?')[0] });
  }
}
