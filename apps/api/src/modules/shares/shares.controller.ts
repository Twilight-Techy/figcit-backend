import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type { z } from 'zod';
import { BadInput } from '../../common/errors/errors.js';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import {
  shareCreatedSchema,
  shareCreateSchema,
  shareListSchema,
  sharedViewSchema,
} from './shares.schemas.js';
import { SharesService } from './shares.service.js';
import { RequiresAccount } from '../../common/guest/requires-account.js';

@Controller()
export class SharesController {
  constructor(private readonly shares: SharesService) {}

  @Post('shares')
  @RequiresAccount()
  @Route({
    summary: 'Share a read-only report (S50)',
    tags: ['Progress'],
    body: shareCreateSchema,
    response: shareCreatedSchema,
    status: 201,
  })
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(shareCreateSchema)) body: z.infer<typeof shareCreateSchema>,
  ): Promise<z.infer<typeof shareCreatedSchema>> {
    return this.shares.create(user.id, body);
  }

  @Get('shares')
  @Route({ summary: 'Reports I have shared', tags: ['Progress'], response: shareListSchema })
  async list(@CurrentUser() user: RequestUser): Promise<z.infer<typeof shareListSchema>> {
    return { items: await this.shares.list(user.id) };
  }

  @Delete('shares/:id')
  @HttpCode(204)
  @Route({ summary: 'Turn a share link off', tags: ['Progress'], status: 204 })
  revoke(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.shares.revoke(user.id, id);
  }

  @Get('shared/:token')
  @Header('cache-control', 'no-store')
  @Header('x-robots-tag', 'noindex')
  @Route({
    summary: 'What a recipient sees (S51)',
    tags: ['Progress'],
    access: 'public',
    response: sharedViewSchema,
  })
  view(@Param('token') token: string): Promise<z.infer<typeof sharedViewSchema>> {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new BadInput('That link is not complete.');
    return this.shares.view(token);
  }
}
