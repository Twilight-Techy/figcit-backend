import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser, MaybeUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import { cardSchema } from '../recommendation/recommendation.schemas.js';
import {
  checkInInputSchema,
  checkInListSchema,
  checkInResultSchema,
  cursorQuerySchema,
  type CheckInInput,
} from './checkin.schemas.js';
import { CheckInInputService } from './checkin-input.service.js';
import { CheckInService } from './checkin.service.js';

const checkInGetSchema = checkInResultSchema.extend({ card: cardSchema.nullable() });

@Controller('check-ins')
export class CheckInController {
  constructor(
    private readonly checkIns: CheckInService,
    private readonly input: CheckInInputService,
  ) {}

  @Post()
  @Route({
    summary:
      'Check in and get a recommendation card (S01–S30); Browse mode runs it without storing',
    tags: ['Check-in'],
    access: 'browse',
    body: checkInInputSchema,
    response: checkInResultSchema,
    status: 201,
  })
  create(
    @MaybeUser() user: RequestUser | undefined,
    @Body(new ZodPipe(checkInInputSchema)) body: CheckInInput,
  ): Promise<z.infer<typeof checkInResultSchema>> {
    return user ? this.checkIns.create(user.id, body) : this.input.browse(body);
  }

  @Get()
  @Route({
    summary: 'Check-in history, newest first',
    tags: ['Check-in'],
    query: cursorQuerySchema,
    response: checkInListSchema,
  })
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(cursorQuerySchema)) q: z.infer<typeof cursorQuerySchema>,
  ): Promise<z.infer<typeof checkInListSchema>> {
    return this.checkIns.list(user.id, q.after, q.limit);
  }

  @Get(':id')
  @Route({
    summary: 'One check-in and its latest card',
    tags: ['Check-in'],
    response: checkInGetSchema,
  })
  get(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<z.infer<typeof checkInGetSchema>> {
    return this.checkIns.get(user.id, id);
  }
}
