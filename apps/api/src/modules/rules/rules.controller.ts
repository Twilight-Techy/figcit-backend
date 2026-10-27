import { Controller, Get, Header, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { Route } from '../../common/http/route.js';
import { RulesService } from './rules.service.js';

@Controller('rules')
export class RulesController {
  constructor(private readonly rules: RulesService) {}

  /** Public: holds no user data. ETag + 304 so devices only download a new version (rules §6). */
  @Get('snapshot')
  @Header('cache-control', 'public, max-age=60, stale-while-revalidate=600')
  @Route({
    summary: 'The published rule snapshot for the on-device engine',
    tags: ['Rules'],
    access: 'public',
    response: z.record(z.string(), z.unknown()),
  })
  async snapshot(@Req() req: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    const { snapshot, hash } = await this.rules.current();
    const etag = `"${hash}"`;
    void reply.header('etag', etag);
    if (req.headers['if-none-match'] === etag) {
      void reply.status(304).send();
      return;
    }
    void reply.header('content-type', 'application/json').send(snapshot);
  }
}
