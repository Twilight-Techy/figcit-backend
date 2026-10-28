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
import { PatternsService } from './patterns.service.js';
import {
  gateQuerySchema,
  gateSchema,
  listQuerySchema,
  listSchema,
  monthlySchema,
  monthQuerySchema,
  patternsSchema,
  reflectionCreatedSchema,
  reflectionCreateSchema,
  reflectionSchema,
  reflectionUpdateSchema,
  variantsSchema,
  type Gate,
  type ReflectionCreate,
  type ReflectionDto,
} from './reflect.schemas.js';
import { ReflectService } from './reflect.service.js';

@Controller()
export class ReflectController {
  constructor(
    private readonly reflect: ReflectService,
    private readonly patterns: PatternsService,
  ) {}

  @Get('reflect/variants')
  @Route({ summary: 'Reflection prompt sets', tags: ['Reflect'], response: variantsSchema })
  async variants(@CurrentUser() user: RequestUser): Promise<z.infer<typeof variantsSchema>> {
    return {
      items: (await this.reflect.variantsFor(user.id)).map((v) => ({
        ...v,
        prompts: v.prompts.map((p) => ({ ...p, chips: [...p.chips] })),
      })),
    };
  }

  @Get('reflect/gate')
  @Route({
    summary: 'Should Reflect be offered now? (RF-1, RF-2; S156, S157)',
    tags: ['Reflect'],
    query: gateQuerySchema,
    response: gateSchema,
  })
  gate(
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(gateQuerySchema)) q: z.infer<typeof gateQuerySchema>,
  ): Promise<Gate> {
    return this.reflect.gate(user.id, q);
  }

  @Post('reflections')
  @Route({
    summary: 'Save a reflection, a journal entry or a win (S42, S134)',
    tags: ['Reflect'],
    body: reflectionCreateSchema,
    response: reflectionCreatedSchema,
    status: 201,
  })
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(reflectionCreateSchema)) body: ReflectionCreate,
  ): Promise<z.infer<typeof reflectionCreatedSchema>> {
    return this.reflect.create(user.id, body);
  }

  @Get('reflections')
  @Route({
    summary: 'Reflection history (S136)',
    tags: ['Reflect'],
    query: listQuerySchema,
    response: listSchema,
  })
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(listQuerySchema)) q: z.infer<typeof listQuerySchema>,
  ): Promise<z.infer<typeof listSchema>> {
    return this.reflect.list(user.id, q);
  }

  @Get('reflections/:id')
  @Route({ summary: 'One reflection', tags: ['Reflect'], response: reflectionSchema })
  get(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReflectionDto> {
    return this.reflect.get(user.id, id);
  }

  @Patch('reflections/:id')
  @Route({
    summary: 'Keep, save for later or change the takeaway',
    tags: ['Reflect'],
    body: reflectionUpdateSchema,
    response: reflectionSchema,
  })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(reflectionUpdateSchema)) body: z.infer<typeof reflectionUpdateSchema>,
  ): Promise<ReflectionDto> {
    return this.reflect.update(user.id, id, body);
  }

  @Delete('reflections/:id')
  @HttpCode(204)
  @Route({ summary: 'Delete a reflection (RF-4)', tags: ['Reflect'], status: 204 })
  remove(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.reflect.remove(user.id, id);
  }

  @Get('patterns')
  @Route({
    summary: 'My patterns: what helps, pattern cards, saved takeaways (S43)',
    tags: ['Reflect'],
    response: patternsSchema,
  })
  myPatterns(@CurrentUser() user: RequestUser): Promise<z.infer<typeof patternsSchema>> {
    return this.patterns.patterns(user.id);
  }

  @Get('patterns/monthly')
  @Route({
    summary: 'A month at a glance (Advanced; S137)',
    tags: ['Reflect'],
    query: monthQuerySchema,
    response: monthlySchema,
  })
  monthly(
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(monthQuerySchema)) q: z.infer<typeof monthQuerySchema>,
  ): Promise<z.infer<typeof monthlySchema>> {
    return this.patterns.monthly(user.id, q.month);
  }
}
