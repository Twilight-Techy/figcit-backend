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
import { STAFF } from './decisions.service.js';
import { ScenariosService, type StaffActor } from './scenarios.service.js';
import {
  scenarioBodySchema,
  scenarioDeleteSchema,
  scenarioListSchema,
  scenarioRunBodySchema,
  scenarioRunResultSchema,
  scenarioSchema,
  type ScenarioBody,
  type ScenarioDto,
} from './simulator.schemas.js';

const TAGS = ['Engine v2'];
const actorOf = (user: RequestUser): StaffActor => ({
  id: user.id,
  role: STAFF.find((r) => user.roles.includes(r)) ?? 'staff',
});

/** The Simulator's saved scenarios (E-61), shared by the staff who use the Simulator. */
@Controller('rulesets/scenarios')
export class ScenariosController {
  constructor(private readonly scenarios: ScenariosService) {}

  @Get()
  @Route({
    summary: 'Saved Simulator scenarios, newest first, each with its last run',
    tags: TAGS,
    access: 'staff',
    roles: STAFF,
    response: scenarioListSchema,
  })
  async list(): Promise<z.infer<typeof scenarioListSchema>> {
    return { items: await this.scenarios.list() };
  }

  @Post()
  @Route({
    summary: 'Save a Simulator scenario (on the rules audit chain)',
    tags: TAGS,
    access: 'staff',
    roles: STAFF,
    body: scenarioBodySchema,
    response: scenarioSchema,
    status: 201,
  })
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(scenarioBodySchema)) body: ScenarioBody,
  ): Promise<ScenarioDto> {
    return this.scenarios.create(actorOf(user), body);
  }

  @Get(':id')
  @Route({
    summary: 'A scenario: its answers, what it runs, and its runs (version, who, the card)',
    tags: TAGS,
    access: 'staff',
    roles: STAFF,
    response: scenarioSchema,
  })
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<ScenarioDto> {
    return this.scenarios.get(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @Route({
    summary: 'Delete a scenario and its runs, with a reason (on the rules audit chain)',
    tags: TAGS,
    access: 'staff',
    roles: STAFF,
    body: scenarioDeleteSchema,
    status: 204,
  })
  async remove(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(scenarioDeleteSchema)) body: z.infer<typeof scenarioDeleteSchema>,
  ): Promise<void> {
    await this.scenarios.remove(actorOf(user), id, body.reason);
  }

  @Post(':id/run')
  @HttpCode(201)
  @Route({
    summary: 'Run a scenario on a version and keep the run',
    tags: TAGS,
    access: 'staff',
    roles: STAFF,
    body: scenarioRunBodySchema,
    response: scenarioRunResultSchema,
    status: 201,
  })
  run(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(scenarioRunBodySchema)) body: z.infer<typeof scenarioRunBodySchema>,
  ): Promise<z.infer<typeof scenarioRunResultSchema>> {
    return this.scenarios.run(actorOf(user), id, body.label);
  }
}
