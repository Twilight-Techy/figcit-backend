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
  Put,
  Query,
} from '@nestjs/common';
import type { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import {
  breakDownRequestSchema,
  breakDownResponseSchema,
  orderedSchema,
  stepsPutSchema,
  taskCreateSchema,
  taskListQuerySchema,
  taskListSchema,
  taskSchema,
  taskUpdateSchema,
  type TaskCreate,
  type TaskDto,
  type TaskUpdate,
} from './tasks.schemas.js';
import { TasksService } from './tasks.service.js';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @Route({
    summary: 'My tasks',
    tags: ['Tasks'],
    query: taskListQuerySchema,
    response: taskListSchema,
  })
  async list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(taskListQuerySchema)) q: z.infer<typeof taskListQuerySchema>,
  ): Promise<z.infer<typeof taskListSchema>> {
    return { items: await this.tasks.list(user.id, q) };
  }

  @Get('ordered')
  @Route({
    summary: 'Open tasks in the order that fits right now, with why (S20)',
    tags: ['Tasks'],
    response: orderedSchema,
  })
  ordered(@CurrentUser() user: RequestUser): Promise<z.infer<typeof orderedSchema>> {
    return this.tasks.ordered(user.id);
  }

  @Post()
  @Route({
    summary: 'Add a task',
    tags: ['Tasks'],
    body: taskCreateSchema,
    response: taskSchema,
    status: 201,
  })
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(taskCreateSchema)) body: TaskCreate,
  ): Promise<TaskDto> {
    return this.tasks.create(user.id, body);
  }

  @Get(':id')
  @Route({ summary: 'One task with its steps', tags: ['Tasks'], response: taskSchema })
  get(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<TaskDto> {
    return this.tasks.get(user.id, id);
  }

  @Patch(':id')
  @Route({
    summary: 'Change, finish, snooze or plan a task',
    tags: ['Tasks'],
    body: taskUpdateSchema,
    response: taskSchema,
  })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(taskUpdateSchema)) body: TaskUpdate,
  ): Promise<TaskDto> {
    return this.tasks.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Route({ summary: 'Delete a task', tags: ['Tasks'], status: 204 })
  remove(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.tasks.remove(user.id, id);
  }

  @Put(':id/steps')
  @Route({
    summary: 'Replace the steps (edit, reorder, tick off; S127)',
    tags: ['Tasks'],
    body: stepsPutSchema,
    response: taskSchema,
  })
  steps(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(stepsPutSchema)) body: z.infer<typeof stepsPutSchema>,
  ): Promise<TaskDto> {
    return this.tasks.putSteps(user.id, id, body);
  }

  @Post(':id/break-down')
  @Route({
    summary: 'Break a task into steps within its timeline cap (S21)',
    tags: ['Tasks'],
    body: breakDownRequestSchema,
    response: breakDownResponseSchema,
    status: 201,
  })
  breakDown(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(breakDownRequestSchema)) body: z.infer<typeof breakDownRequestSchema>,
  ): Promise<z.infer<typeof breakDownResponseSchema>> {
    return this.tasks.breakDown(user.id, id, body);
  }
}
