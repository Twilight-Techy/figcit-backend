import { Body, Controller, Get, Post } from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import { consentStateSchema, consentUpdateSchema, type ConsentState } from './consent.schemas.js';
import { ConsentService } from './consent.service.js';

@Controller('me/consents')
export class ConsentController {
  constructor(private readonly consent: ConsentService) {}

  @Get()
  @Route({
    summary: 'Current consent per purpose',
    tags: ['Consent'],
    response: consentStateSchema,
  })
  state(@CurrentUser() user: RequestUser): Promise<ConsentState> {
    return this.consent.state(user.id);
  }

  @Post()
  @Route({
    summary: 'Record consent choices (append-only)',
    tags: ['Consent'],
    body: consentUpdateSchema,
    response: consentStateSchema,
    status: 201,
  })
  record(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(consentUpdateSchema)) body: z.infer<typeof consentUpdateSchema>,
  ): Promise<ConsentState> {
    return this.consent.record(user.id, body.choices, body.source);
  }
}
