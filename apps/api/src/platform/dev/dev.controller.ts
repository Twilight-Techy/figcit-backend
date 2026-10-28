import { Controller, Get, Inject, Query } from '@nestjs/common';
import { z } from 'zod';
import { ENV, type Env } from '../../common/config/env.js';
import { NotFound } from '../../common/errors/errors.js';
import { Route } from '../../common/http/route.js';
import { MailService } from '../mail/mail.service.js';

const mailboxSchema = z.object({
  mail: z.array(
    z.object({ to: z.string(), subject: z.string(), text: z.string(), at: z.string() }),
  ),
});

/** Development and e2e only (DEV_MAILBOX=true): read the emails the API would have sent. */
@Controller('dev')
export class DevController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly mail: MailService,
  ) {}

  @Get('mailbox')
  @Route({
    summary: 'Dev mailbox (only when DEV_MAILBOX=true; never in production)',
    tags: ['Dev'],
    access: 'public',
    response: mailboxSchema,
  })
  mailbox(@Query('to') to?: string): z.infer<typeof mailboxSchema> {
    if (!this.env.DEV_MAILBOX || this.env.NODE_ENV === 'production') throw new NotFound('route');
    return {
      mail: this.mail
        .devMailbox(to)
        .map((m) => ({ to: m.to, subject: m.subject, text: m.text, at: m.at })),
    };
  }
}
