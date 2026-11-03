import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type { RunResult } from '@figcit/engine-v2';
import type { z } from 'zod';
import { CurrentUser, MaybeUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import { cardSchema, type CardDto } from '../recommendation/recommendation.schemas.js';
import { checkInOptionsSchema } from '../rulesets/checkin-options.schemas.js';
import type { CheckInOptionsDto } from '../rulesets/checkin-options.service.js';
import { labelParam } from '../rulesets/rulesets.schemas.js';
import { CardBridgeService } from './card-bridge.service.js';
import { CheckInSimulatorService } from './checkin-simulator.service.js';
import {
  anotherBodySchema,
  compareBodySchema,
  decisionListQuerySchema,
  decisionListSchema,
  type DecisionList,
  decideBodySchema,
  decisionRecordSchema,
  decisionSchema,
  exploreBodySchema,
  explorationSchema,
  impactBodySchema,
  type ExplorationDto,
  replayResultSchema,
  simulateBodySchema,
  simulateResultSchema,
  type DecideBody,
  type DecisionDto,
  type DecisionRecordDto,
} from './decisions.schemas.js';
import { DecisionsService, STAFF } from './decisions.service.js';
import { EngineToolsService } from './engine-tools.service.js';
import { ExplorationsService } from './explorations.service.js';
import {
  simulateCheckInBodySchema,
  simulateCheckInResultSchema,
  type SimulateCheckInBody,
  type SimulateCheckInResult,
} from './simulator.schemas.js';

const TAGS = ['Engine v2'];

/**
 * Engine v2 recommendations (M5, DESIGN §10, E-52). The route is `/v1/decisions`: `v1` is the API
 * version, and a decision is the record of one card the engine made (E-27).
 */
@Controller('decisions')
export class DecisionsController {
  constructor(
    private readonly decisions: DecisionsService,
    private readonly bridge: CardBridgeService,
  ) {}

  @Post()
  @Route({
    summary: 'Run the engine v2 on a check-in and record the decision; Browse mode works too',
    tags: TAGS,
    access: 'browse',
    body: decideBodySchema,
    response: decisionSchema,
    status: 201,
  })
  decide(
    @MaybeUser() user: RequestUser | undefined,
    @Body(new ZodPipe(decideBodySchema)) body: DecideBody,
  ): Promise<z.infer<typeof decisionSchema>> {
    return this.decisions.decide(body, user?.id);
  }

  @Get()
  @Route({
    summary: 'Decision records, newest first (staff): filter by light, mode or support screen',
    tags: TAGS,
    access: 'staff',
    roles: STAFF,
    query: decisionListQuerySchema,
    response: decisionListSchema,
  })
  list(
    @Query(new ZodPipe(decisionListQuerySchema)) q: z.infer<typeof decisionListQuerySchema>,
  ): Promise<DecisionList> {
    return this.decisions.list(q);
  }

  @Get(':id')
  @Route({
    summary: 'One decision: its card for the user it was made for; input and trace for staff',
    tags: TAGS,
    response: decisionSchema.or(decisionRecordSchema),
  })
  get(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<DecisionDto | DecisionRecordDto> {
    return this.decisions.get(id, user);
  }

  @Post(':id/another')
  @Route({
    summary: 'Browse: the card again, without the pathway just declined ("try another", Adapt)',
    tags: TAGS,
    access: 'browse',
    body: anotherBodySchema,
    response: cardSchema,
    status: 201,
  })
  another(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(anotherBodySchema)) body: z.infer<typeof anotherBodySchema>,
  ): Promise<CardDto> {
    return this.bridge.browseAnother(id, body.declinedToolId ?? null);
  }

  @Post(':id/replay')
  @HttpCode(200)
  @Route({
    summary: 'Re-run a decision on its own rule set and engine version and compare',
    tags: TAGS,
    access: 'staff',
    roles: STAFF,
    response: replayResultSchema,
  })
  replay(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<z.infer<typeof replayResultSchema>> {
    return this.decisions.replay(id);
  }
}

/** The staff Simulator and explorer on any version, drafts included (E-18, DESIGN §8). */
@Controller('rulesets')
export class EngineToolsController {
  constructor(
    private readonly tools: EngineToolsService,
    private readonly explorations: ExplorationsService,
    private readonly simulator: CheckInSimulatorService,
  ) {}

  @Get(':label/check-in-options')
  @Route({
    summary: "A version's check-in options, drafts included (the staff Simulator's sections)",
    tags: TAGS,
    access: 'staff',
    roles: STAFF,
    response: checkInOptionsSchema,
  })
  async checkInOptions(
    @Param('label', new ZodPipe(labelParam)) label: string,
  ): Promise<CheckInOptionsDto> {
    return (await this.simulator.optionsOf(label)).dto;
  }

  @Post(':label/simulate-check-in')
  @HttpCode(200)
  @Route({
    summary:
      'Run a check-in, as the app sends it, through a version: what each answer gives, what the server adds, the engine run and the card as the app gets it; nothing is stored',
    tags: TAGS,
    access: 'staff',
    roles: STAFF,
    body: simulateCheckInBodySchema,
    response: simulateCheckInResultSchema,
  })
  simulateCheckIn(
    @Param('label', new ZodPipe(labelParam)) label: string,
    @Body(new ZodPipe(simulateCheckInBodySchema)) body: SimulateCheckInBody,
  ): Promise<SimulateCheckInResult> {
    return this.simulator.simulate(label, body);
  }

  @Post(':label/simulate')
  @HttpCode(200)
  @Route({
    summary: 'Run one input through a version, stage by stage; nothing is stored',
    tags: TAGS,
    access: 'staff',
    roles: STAFF,
    body: simulateBodySchema,
    response: simulateResultSchema,
  })
  simulate(
    @Param('label', new ZodPipe(labelParam)) label: string,
    @Body(new ZodPipe(simulateBodySchema)) body: z.infer<typeof simulateBodySchema>,
  ): Promise<RunResult> {
    return this.tools.simulate(label, body.input, body.trace);
  }

  @Post(':label/compare')
  @HttpCode(202)
  @Route({
    summary:
      'Queue the impact of a version: the same inputs against another version, and what changes (poll the exploration)',
    tags: TAGS,
    access: 'staff',
    roles: STAFF,
    body: compareBodySchema,
    response: explorationSchema,
    status: 202,
  })
  compare(
    @CurrentUser() user: RequestUser,
    @Param('label', new ZodPipe(labelParam)) label: string,
    @Body(new ZodPipe(compareBodySchema)) body: z.infer<typeof compareBodySchema>,
  ): Promise<ExplorationDto> {
    return this.explorations.queue('compare', label, body, user.id);
  }

  @Post(':label/explore')
  @HttpCode(202)
  @Route({
    summary:
      'Queue a set of inputs through a version: cards by light and primary, the outcome map, fixed-rule checks, rules never fired, and the inputs matching a query (poll the exploration)',
    tags: TAGS,
    access: 'staff',
    roles: STAFF,
    body: exploreBodySchema,
    response: explorationSchema,
    status: 202,
  })
  explore(
    @CurrentUser() user: RequestUser,
    @Param('label', new ZodPipe(labelParam)) label: string,
    @Body(new ZodPipe(exploreBodySchema)) body: z.infer<typeof exploreBodySchema>,
  ): Promise<ExplorationDto> {
    return this.explorations.queue('explore', label, body, user.id);
  }

  @Post(':label/impact')
  @HttpCode(202)
  @Route({
    summary:
      'Queue what one rule affects: the cards that change when its row is taken out (poll the exploration)',
    tags: TAGS,
    access: 'staff',
    roles: STAFF,
    body: impactBodySchema,
    response: explorationSchema,
    status: 202,
  })
  impact(
    @CurrentUser() user: RequestUser,
    @Param('label', new ZodPipe(labelParam)) label: string,
    @Body(new ZodPipe(impactBodySchema)) body: z.infer<typeof impactBodySchema>,
  ): Promise<ExplorationDto> {
    return this.explorations.queue('impact', label, body, user.id);
  }

  @Get('explorations/:id')
  @Route({
    summary: 'An explorer run: its status, and its result once the worker has run it',
    tags: TAGS,
    access: 'staff',
    roles: STAFF,
    response: explorationSchema,
  })
  exploration(@Param('id', ParseUUIDPipe) id: string): Promise<ExplorationDto> {
    return this.explorations.get(id);
  }
}
