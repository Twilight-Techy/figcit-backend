import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import {
  practiceCreateSchema,
  practiceListSchema,
  practiceSchema,
  practiceUpdateSchema,
  type PracticeCreate,
  type PracticeDto,
  type PracticeUpdate,
} from './practices.schemas.js';
import { PracticesService } from './practices.service.js';

@Controller('practices')
export class PracticesController {
  constructor(private readonly practices: PracticesService) {}

  @Get()
  @Route({ summary: 'My practices (S46)', tags: ['Practices'], response: practiceListSchema })
  async list(@CurrentUser() user: RequestUser): Promise<z.infer<typeof practiceListSchema>> {
    return { items: await this.practices.list(user.id) };
  }

  @Post()
  @Route({
    summary: 'Add a practice',
    tags: ['Practices'],
    body: practiceCreateSchema,
    response: practiceSchema,
    status: 201,
  })
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(practiceCreateSchema)) body: PracticeCreate,
  ): Promise<PracticeDto> {
    return this.practices.create(user.id, body);
  }

  @Get(':id')
  @Route({ summary: 'One practice', tags: ['Practices'], response: practiceSchema })
  get(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PracticeDto> {
    return this.practices.get(user.id, id);
  }

  @Patch(':id')
  @Route({
    summary: 'Change a practice',
    tags: ['Practices'],
    body: practiceUpdateSchema,
    response: practiceSchema,
  })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(practiceUpdateSchema)) body: PracticeUpdate,
  ): Promise<PracticeDto> {
    return this.practices.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Route({ summary: 'Delete a practice', tags: ['Practices'], status: 204 })
  remove(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.practices.remove(user.id, id);
  }
}
