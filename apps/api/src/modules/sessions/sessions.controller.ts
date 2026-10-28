import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import {
  feedbackInputSchema,
  sessionListQuerySchema,
  sessionListSchema,
  sessionSchema,
  sessionStartSchema,
  sessionUpdateSchema,
  type SessionDto,
  type SessionStart,
  type SessionUpdate,
} from './sessions.schemas.js';
import { SessionsService } from './sessions.service.js';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  @Route({
    summary: 'Start a tool session in any pathway',
    tags: ['Sessions'],
    body: sessionStartSchema,
    response: sessionSchema,
    status: 201,
  })
  start(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(sessionStartSchema)) body: SessionStart,
  ): Promise<SessionDto> {
    return this.sessions.start(user.id, body);
  }

  @Get()
  @Route({
    summary: 'Session history, newest first',
    tags: ['Sessions'],
    query: sessionListQuerySchema,
    response: sessionListSchema,
  })
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(sessionListQuerySchema)) q: z.infer<typeof sessionListQuerySchema>,
  ): Promise<z.infer<typeof sessionListSchema>> {
    return this.sessions.list(user.id, q);
  }

  @Get(':id')
  @Route({ summary: 'One session', tags: ['Sessions'], response: sessionSchema })
  get(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SessionDto> {
    return this.sessions.get(user.id, id);
  }

  @Patch(':id')
  @Route({
    summary: 'Pause, resume, finish or stop a session',
    tags: ['Sessions'],
    body: sessionUpdateSchema,
    response: sessionSchema,
  })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(sessionUpdateSchema)) body: SessionUpdate,
  ): Promise<SessionDto> {
    return this.sessions.update(user.id, id, body);
  }

  @Post(':id/feedback')
  @Route({
    summary: 'Did it help? (S36)',
    tags: ['Sessions'],
    body: feedbackInputSchema,
    response: sessionSchema,
    status: 201,
  })
  feedback(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(feedbackInputSchema)) body: z.infer<typeof feedbackInputSchema>,
  ): Promise<SessionDto> {
    return this.sessions.feedback(user.id, id, body);
  }
}
