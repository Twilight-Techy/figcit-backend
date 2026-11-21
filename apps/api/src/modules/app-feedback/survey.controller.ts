import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import {
  publicTestimonialsSchema,
  surveyAnswersSchema,
  surveyResponseSchema,
  surveyStateSchema,
  surveySummarySchema,
  testimonialStatusSchema,
  type SurveyAnswers,
  type SurveyResponse,
  type SurveyState,
  type SurveySummary,
} from './survey.schemas.js';
import { SurveyService } from './survey.service.js';

const TAGS = ['Feedback'];

/** The tester survey (owner, 21 Nov 2026): answered in the app, read by staff. */
@Controller()
export class SurveyController {
  constructor(private readonly survey: SurveyService) {}

  @Get('me/survey')
  @Route({
    summary: 'Whether this person has answered the tester survey, and whether to ask now',
    tags: TAGS,
    response: surveyStateSchema,
  })
  state(@CurrentUser() me: RequestUser): Promise<SurveyState> {
    return this.survey.state(me.id);
  }

  @Put('me/survey')
  @Route({
    summary: 'Answer the tester survey (answering again replaces the earlier answers)',
    tags: TAGS,
    body: surveyAnswersSchema,
    response: surveyStateSchema,
  })
  answer(
    @CurrentUser() me: RequestUser,
    @Body(new ZodPipe(surveyAnswersSchema)) body: SurveyAnswers,
  ): Promise<SurveyState> {
    return this.survey.answer(me.id, body);
  }

  @Post('me/survey/later')
  @HttpCode(200)
  @Route({
    summary: '"Not now": ask again in a few days, at most twice',
    tags: TAGS,
    response: surveyStateSchema,
  })
  later(@CurrentUser() me: RequestUser): Promise<SurveyState> {
    return this.survey.later(me.id);
  }

  @Get('admin/survey')
  @Route({
    summary: 'Tester survey results: averages, counts and the latest answers',
    tags: TAGS,
    access: 'staff',
    response: surveySummarySchema,
  })
  summary(): Promise<SurveySummary> {
    return this.survey.summary();
  }

  @Patch('admin/survey/:id/testimonial')
  @Route({
    summary: 'Approve or hide the words someone offered as a testimonial',
    tags: TAGS,
    access: 'staff',
    body: testimonialStatusSchema,
    response: surveyResponseSchema,
  })
  setTestimonial(
    @CurrentUser() actor: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(testimonialStatusSchema)) body: z.infer<typeof testimonialStatusSchema>,
  ): Promise<SurveyResponse> {
    return this.survey.setTestimonial(actor, id, body.status);
  }

  @Get('testimonials')
  @Route({
    summary: 'Approved testimonials that people agreed to show, for the website',
    tags: TAGS,
    access: 'public',
    response: publicTestimonialsSchema,
  })
  published(): Promise<z.infer<typeof publicTestimonialsSchema>> {
    return this.survey.published();
  }
}
