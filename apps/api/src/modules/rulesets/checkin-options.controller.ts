import { Controller, Get, Header, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../common/errors/errors.js';
import { Route } from '../../common/http/route.js';
import { checkInOptionsSchema } from './checkin-options.schemas.js';
import { CheckInOptionsService } from './checkin-options.service.js';

/** What the check-in screens offer (E-40). Public: it holds no user data, and Browse needs it. */
@Controller('check-in')
export class CheckInOptionsController {
  constructor(private readonly options: CheckInOptionsService) {}

  @Get('options')
  @Header('cache-control', 'public, max-age=60, stale-while-revalidate=600')
  @Route({
    summary: 'The check-in options from the published rule set',
    tags: ['Check-in'],
    access: 'public',
    response: checkInOptionsSchema,
  })
  async get(@Req() req: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    const current = await this.options.current();
    if (!current)
      throw new AppError(
        503,
        'no_ruleset',
        'FigCit is getting ready',
        'No rule set is published yet.',
      );
    const etag = `"${current.dto.hash}"`;
    void reply.header('etag', etag);
    if (req.headers['if-none-match'] === etag) {
      void reply.status(304).send();
      return;
    }
    void reply.header('content-type', 'application/json').send(current.dto);
  }
}
