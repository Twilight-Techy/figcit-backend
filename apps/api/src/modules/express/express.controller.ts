import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import {
  assistRequestSchema,
  assistResultSchema,
  draftCreateSchema,
  draftListQuerySchema,
  draftListSchema,
  draftSchema,
  draftUpdateSchema,
  type AssistRequest,
  type DraftCreate,
  type DraftDto,
  type DraftUpdate,
} from './express.schemas.js';
import { ExpressService } from './express.service.js';

@Controller('drafts')
export class ExpressController {
  constructor(private readonly express: ExpressService) {}

  @Get()
  @Route({
    summary: 'My drafts',
    tags: ['Express'],
    query: draftListQuerySchema,
    response: draftListSchema,
  })
  async list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(draftListQuerySchema)) q: z.infer<typeof draftListQuerySchema>,
  ): Promise<z.infer<typeof draftListSchema>> {
    return { items: await this.express.list(user.id, q.archived) };
  }

  @Post()
  @Route({
    summary: 'Start a draft (S18)',
    tags: ['Express'],
    body: draftCreateSchema,
    response: draftSchema,
    status: 201,
  })
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(draftCreateSchema)) body: DraftCreate,
  ): Promise<DraftDto> {
    return this.express.create(user.id, body);
  }

  @Get(':id')
  @Route({ summary: 'A draft with its versions', tags: ['Express'], response: draftSchema })
  get(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<DraftDto> {
    return this.express.get(user.id, id);
  }

  @Patch(':id')
  @Route({
    summary: 'Edit, archive or restore a draft',
    tags: ['Express'],
    body: draftUpdateSchema,
    response: draftSchema,
  })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(draftUpdateSchema)) body: DraftUpdate,
  ): Promise<DraftDto> {
    return this.express.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Route({ summary: 'Delete a draft', tags: ['Express'], status: 204 })
  remove(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.express.remove(user.id, id);
  }

  /**
   * Simplify, rewrite, draft, structure or script. With `Accept: text/event-stream`, text modes
   * stream `delta` events and end with one `done` event carrying the saved result.
   */
  @Post(':id/assist')
  @Route({
    summary: 'Help me say this (S19, Figma S115)',
    tags: ['Express'],
    body: assistRequestSchema,
    response: assistResultSchema,
    status: 201,
  })
  async assist(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(assistRequestSchema)) body: AssistRequest,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const wantsStream =
      (req.headers.accept ?? '').includes('text/event-stream') &&
      (body.mode === 'simplify' || body.mode === 'rewrite' || body.mode === 'draft');
    if (!wantsStream) {
      await reply.status(201).send(await this.express.assist(user.id, id, body));
      return;
    }
    const prep = await this.express.prepare(user.id, id, body);
    if (prep.blocked) {
      await reply.status(201).send(prep.blocked);
      return;
    }
    reply.hijack();
    const headers = {
      ...reply.getHeaders(),
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    };
    reply.raw.writeHead(200, headers as Record<string, string>);
    const send = (event: string, data: unknown): void => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    try {
      for await (const ev of this.express.streamAssist(
        user.id,
        id,
        { ...body, mode: body.mode as 'simplify' | 'rewrite' | 'draft' },
        prep.text,
        prep.purpose,
      )) {
        if (ev.type === 'delta') send('delta', { text: ev.text });
        else if (ev.type === 'saved') send('done', ev.result);
      }
    } catch {
      send('error', { title: 'Something went wrong', detail: 'Your text is unchanged.' });
    }
    reply.raw.end();
  }
}
