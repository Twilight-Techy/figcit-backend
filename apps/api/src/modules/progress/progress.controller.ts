import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import {
  helpedSchema,
  progressSchema,
  rangeQuerySchema,
  type ProgressDto,
} from './progress.schemas.js';
import { NotEntitled } from '../../common/errors/errors.js';
import { EntitlementsService } from '../entitlements/entitlements.service.js';
import { ProgressService } from './progress.service.js';

const didItHelpSchema = z.object({ items: z.array(helpedSchema) });

@Controller('progress')
export class ProgressController {
  constructor(
    private readonly progress: ProgressService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /** 30 days are free; longer history is Advanced (SYSTEM_DESIGN §4.2 ProgressModule). */
  private async allow(userId: string, range: number): Promise<void> {
    if (range > 30 && (await this.entitlements.tierFor(userId)) !== 'plus')
      throw new NotEntitled('Progress beyond 30 days');
  }

  @Get()
  @Route({
    summary: 'Progress over 7, 30 or 90 days (S47)',
    tags: ['Progress'],
    query: rangeQuerySchema,
    response: progressSchema,
  })
  async get(
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(rangeQuerySchema)) q: z.infer<typeof rangeQuerySchema>,
  ): Promise<ProgressDto> {
    await this.allow(user.id, q.range);
    return this.progress.progress(user.id, q.range);
  }

  @Get('did-it-help')
  @Route({
    summary: 'What helped, per tool (S49)',
    tags: ['Progress'],
    query: rangeQuerySchema,
    response: didItHelpSchema,
  })
  async didItHelp(
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(rangeQuerySchema)) q: z.infer<typeof rangeQuerySchema>,
  ): Promise<z.infer<typeof didItHelpSchema>> {
    await this.allow(user.id, q.range);
    return {
      items: await this.progress.didItHelp(user.id, new Date(Date.now() - q.range * 86_400_000)),
    };
  }
}
