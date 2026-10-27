import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import { RecommendationActionsService } from './actions.service.js';
import {
  actionRequestSchema,
  actionResultSchema,
  adaptRequestSchema,
  cardSchema,
  whySchema,
  type CardDto,
} from './recommendation.schemas.js';
import { RecommendationService } from './recommendation.service.js';

@Controller('recommendations')
export class RecommendationController {
  constructor(
    private readonly recs: RecommendationService,
    private readonly actions: RecommendationActionsService,
  ) {}

  @Get(':id')
  @Route({ summary: 'A recommendation card', tags: ['Recommendations'], response: cardSchema })
  get(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<CardDto> {
    return this.recs.card(user.id, id);
  }

  @Post(':id/actions')
  @Route({
    summary: 'Start, try another, not now, get support (S30–S34)',
    tags: ['Recommendations'],
    body: actionRequestSchema,
    response: actionResultSchema,
  })
  act(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(actionRequestSchema)) body: z.infer<typeof actionRequestSchema>,
  ): Promise<z.infer<typeof actionResultSchema>> {
    return this.actions.act(user.id, id, body);
  }

  @Post(':id/adapt')
  @Route({
    summary: 'Adapt the suggestion and re-run (S40)',
    tags: ['Recommendations'],
    body: adaptRequestSchema,
    response: cardSchema,
    status: 201,
  })
  adapt(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(adaptRequestSchema)) body: z.infer<typeof adaptRequestSchema>,
  ): Promise<CardDto> {
    return this.actions.adapt(user.id, id, body);
  }

  @Get(':id/why')
  @Route({ summary: 'Why this suggestion (S35)', tags: ['Recommendations'], response: whySchema })
  why(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<z.infer<typeof whySchema>> {
    return this.actions.why(user.id, id);
  }
}
