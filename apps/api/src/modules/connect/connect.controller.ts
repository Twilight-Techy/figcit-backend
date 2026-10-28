import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import {
  composedSchema,
  composeSchema,
  connectHomeSchema,
  groupInputSchema,
  groupSchema,
} from './connect.schemas.js';
import { ConnectService } from './connect.service.js';

@Controller('connect')
export class ConnectController {
  constructor(private readonly connect: ConnectService) {}

  @Get()
  @Route({
    summary: 'Trusted people, starters and groups (S23)',
    tags: ['Connect'],
    response: connectHomeSchema,
  })
  home(@CurrentUser() user: RequestUser): Promise<z.infer<typeof connectHomeSchema>> {
    return this.connect.home(user.id);
  }

  @Post('compose')
  @Route({
    summary: 'Get a message ready to send from your own apps (S118)',
    tags: ['Connect'],
    body: composeSchema,
    response: composedSchema,
    status: 201,
  })
  compose(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(composeSchema)) body: z.infer<typeof composeSchema>,
  ): Promise<z.infer<typeof composedSchema>> {
    return this.connect.compose(user.id, body);
  }

  @Delete('starters/:id')
  @HttpCode(204)
  @Route({ summary: 'Remove a saved starter', tags: ['Connect'], status: 204 })
  removeStarter(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.connect.removeStarter(user.id, id);
  }

  @Post('groups')
  @Route({
    summary: 'Add a group you belong to (MD-3: never suggested)',
    tags: ['Connect'],
    body: groupInputSchema,
    response: groupSchema,
    status: 201,
  })
  addGroup(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(groupInputSchema)) body: z.infer<typeof groupInputSchema>,
  ): Promise<z.infer<typeof groupSchema>> {
    return this.connect.addGroup(user.id, body);
  }

  @Delete('groups/:id')
  @HttpCode(204)
  @Route({ summary: 'Remove a group', tags: ['Connect'], status: 204 })
  removeGroup(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.connect.removeGroup(user.id, id);
  }
}
