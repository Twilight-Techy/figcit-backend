import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import type { z } from 'zod';
import type { AuthedRequest } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import {
  appFeedbackSchema,
  feedbackItemSchema,
  feedbackListSchema,
  feedbackQuerySchema,
  sentSchema,
  statusSchema,
  websiteFeedbackSchema,
  type AppFeedbackInput,
  type FeedbackItem,
  type WebsiteFeedbackInput,
} from './app-feedback.schemas.js';
import { AppFeedbackService } from './app-feedback.service.js';

const TAGS = ['Feedback'];
const STRICT = { rateLimit: { max: 10, timeWindow: '1 minute' } };

/** Tester feedback: sent from the app or the website, read by staff (owner, 19 Nov 2026). */
@Controller()
export class AppFeedbackController {
  constructor(private readonly feedback: AppFeedbackService) {}

  @Post('app-feedback')
  @RouteConfig(STRICT)
  @Route({
    summary: 'Send feedback from the app: what broke, what was confusing, or an idea',
    tags: TAGS,
    access: 'browse',
    body: appFeedbackSchema,
    response: sentSchema,
    status: 201,
  })
  send(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(appFeedbackSchema)) body: AppFeedbackInput,
  ): Promise<z.infer<typeof sentSchema>> {
    return this.feedback.fromApp(req.user?.id ?? null, body);
  }

  @Post('app-feedback/website')
  @RouteConfig(STRICT)
  @Route({
    summary: "The website's tester feedback form, sent by the website's server with its key",
    tags: TAGS,
    access: 'public',
    body: websiteFeedbackSchema,
    response: sentSchema,
    status: 201,
  })
  website(
    @Headers('x-website-key') key: string | undefined,
    @Body(new ZodPipe(websiteFeedbackSchema)) body: WebsiteFeedbackInput,
  ): Promise<z.infer<typeof sentSchema>> {
    return this.feedback.fromWebsite(key, body);
  }

  @Get('admin/feedback')
  @Route({
    summary: 'All tester feedback, newest first (the latest 200)',
    tags: TAGS,
    access: 'staff',
    query: feedbackQuerySchema,
    response: feedbackListSchema,
  })
  async list(
    @Query(new ZodPipe(feedbackQuerySchema)) q: z.infer<typeof feedbackQuerySchema>,
  ): Promise<z.infer<typeof feedbackListSchema>> {
    return { items: await this.feedback.list(q.status) };
  }

  @Patch('admin/feedback/:id')
  @Route({
    summary: 'Mark feedback new, seen or done',
    tags: TAGS,
    access: 'staff',
    body: statusSchema,
    response: feedbackItemSchema,
  })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(statusSchema)) body: z.infer<typeof statusSchema>,
  ): Promise<FeedbackItem> {
    return this.feedback.setStatus(id, body.status);
  }
}
