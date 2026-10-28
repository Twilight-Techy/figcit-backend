import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import {
  syncPullQuerySchema,
  syncPullSchema,
  syncPushResultSchema,
  syncPushSchema,
} from './sync.schemas.js';
import { SyncService } from './sync.service.js';

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('push')
  @HttpCode(200)
  @Route({
    summary: 'Apply a batch of offline changes',
    tags: ['Sync'],
    body: syncPushSchema,
    response: syncPushResultSchema,
  })
  async push(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(syncPushSchema)) body: z.infer<typeof syncPushSchema>,
  ): Promise<z.infer<typeof syncPushResultSchema>> {
    return { results: await this.sync.push(user.id, body.operations) };
  }

  @Get('pull')
  @Route({
    summary: 'What changed since a cursor',
    tags: ['Sync'],
    query: syncPullQuerySchema,
    response: syncPullSchema,
  })
  pull(
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(syncPullQuerySchema)) q: z.infer<typeof syncPullQuerySchema>,
  ): Promise<z.infer<typeof syncPullSchema>> {
    return this.sync.pull(user.id, new Date(q.since));
  }
}

/** Browse mode → account: the device's saved data comes along as one batch (S06). */
@Controller('me')
export class UpgradeController {
  constructor(private readonly sync: SyncService) {}

  @Post('upgrade-from-browse')
  @HttpCode(200)
  @Route({
    summary: 'Bring Browse-mode data into my new account',
    tags: ['Sync'],
    body: syncPushSchema,
    response: syncPushResultSchema,
  })
  async upgrade(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(syncPushSchema)) body: z.infer<typeof syncPushSchema>,
  ): Promise<z.infer<typeof syncPushResultSchema>> {
    return { results: await this.sync.push(user.id, body.operations) };
  }
}
