import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import {
  MaybeUser,
  type AuthedRequest,
  type RequestUser,
} from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import { AnalyticsService } from './analytics.service.js';

const code = z.string().regex(/^[a-z0-9_.:-]{1,48}$/);
const eventsSchema = z
  .object({
    /** Browse mode only: the device-level analytics choice. */
    consent: z.boolean().default(false),
    events: z
      .array(
        z
          .object({
            name: z.string().regex(/^[a-z][a-z0-9_.]{2,63}$/),
            props: z
              .record(
                z.string().regex(/^[a-z][a-zA-Z0-9_]{0,31}$/),
                z.union([code, z.number(), z.boolean()]),
              )
              .optional(),
            at: z.iso.datetime().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();
const resultSchema = z.object({ accepted: z.number().int(), dropped: z.number().int() });

@Controller('events')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post()
  @HttpCode(202)
  @Route({
    summary: 'Product events (codes only; dropped without consent)',
    tags: ['Analytics'],
    access: 'browse',
    body: eventsSchema,
    response: resultSchema,
    status: 202,
  })
  ingest(
    @MaybeUser() user: RequestUser | undefined,
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(eventsSchema)) body: z.infer<typeof eventsSchema>,
  ): Promise<z.infer<typeof resultSchema>> {
    return this.analytics.ingest(
      { userId: user?.id, browseToken: req.browseToken, deviceConsent: body.consent },
      body.events,
    );
  }
}
