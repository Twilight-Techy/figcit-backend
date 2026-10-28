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
  Query,
} from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import {
  dumpCreatedSchema,
  dumpCreateSchema,
  dumpItemSchema,
  dumpListQuerySchema,
  dumpListSchema,
  dumpSchema,
  itemAddSchema,
  itemUpdateSchema,
  movedSchema,
  toTaskSchema,
  type DumpCreate,
  type DumpDto,
  type DumpItemDto,
} from './dump.schemas.js';
import { DumpService } from './dump.service.js';

@Controller()
export class DumpController {
  constructor(private readonly dumps: DumpService) {}

  @Post('dumps')
  @Route({
    summary: 'Save a dump (S15)',
    tags: ['Dump'],
    body: dumpCreateSchema,
    response: dumpCreatedSchema,
    status: 201,
  })
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(dumpCreateSchema)) body: DumpCreate,
  ): Promise<z.infer<typeof dumpCreatedSchema>> {
    return this.dumps.create(user.id, body);
  }

  @Get('dumps')
  @Route({
    summary: 'My dumps, newest first',
    tags: ['Dump'],
    query: dumpListQuerySchema,
    response: dumpListSchema,
  })
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(dumpListQuerySchema)) q: z.infer<typeof dumpListQuerySchema>,
  ): Promise<z.infer<typeof dumpListSchema>> {
    return this.dumps.list(user.id, q.after, q.limit);
  }

  @Get('dumps/:id')
  @Route({ summary: 'One dump with its items (S16)', tags: ['Dump'], response: dumpSchema })
  get(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<DumpDto> {
    return this.dumps.get(user.id, id);
  }

  @Delete('dumps/:id')
  @HttpCode(204)
  @Route({ summary: 'Delete a dump', tags: ['Dump'], status: 204 })
  remove(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.dumps.remove(user.id, id);
  }

  @Post('dumps/:id/items')
  @Route({
    summary: 'Add an item to a dump',
    tags: ['Dump'],
    body: itemAddSchema,
    response: dumpItemSchema,
    status: 201,
  })
  addItem(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(itemAddSchema)) body: z.infer<typeof itemAddSchema>,
  ): Promise<DumpItemDto> {
    return this.dumps.addItem(user.id, id, body);
  }

  @Patch('dump-items/:id')
  @Route({
    summary: 'Edit or sort an item (S17)',
    tags: ['Dump'],
    body: itemUpdateSchema,
    response: dumpItemSchema,
  })
  updateItem(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(itemUpdateSchema)) body: z.infer<typeof itemUpdateSchema>,
  ): Promise<DumpItemDto> {
    return this.dumps.updateItem(user.id, id, body);
  }

  @Delete('dump-items/:id')
  @HttpCode(204)
  @Route({ summary: 'Remove an item', tags: ['Dump'], status: 204 })
  removeItem(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.dumps.removeItem(user.id, id);
  }

  @Post('dump-items/:id/to-task')
  @Route({
    summary: 'Turn a to-do into a task (never a worry; S103)',
    tags: ['Dump'],
    body: toTaskSchema,
    response: movedSchema,
    status: 201,
  })
  toTask(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(toTaskSchema)) body: z.infer<typeof toTaskSchema>,
  ): Promise<z.infer<typeof movedSchema>> {
    return this.dumps.toTask(user.id, id, body);
  }

  @Post('dump-items/:id/to-draft')
  @Route({
    summary: 'Start a message from an item (Express)',
    tags: ['Dump'],
    response: movedSchema,
    status: 201,
  })
  toDraft(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<z.infer<typeof movedSchema>> {
    return this.dumps.toDraft(user.id, id);
  }
}
