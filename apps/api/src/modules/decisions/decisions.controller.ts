import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type { RunResult } from '@figcit/engine-v2';
import type { z } from 'zod';
import { CurrentUser, MaybeUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import { cardSchema, type CardDto } from '../recommendation/recommendation.schemas.js';
import { labelParam } from '../rulesets/rulesets.schemas.js';
import { CardBridgeService } from './card-bridge.service.js';
import {
  anotherBodySchema,
  compareBodySchema,
  compareResultSchema,
  decisionListQuerySchema,
  decisionListSchema,
  type CompareResult,
  type DecisionList,
  decideBodySchema,
  decisionRecordSchema,
  decisionSchema,
  exploreBodySchema,
  exploreResultSchema,
  impactBodySchema,
  impactResultSchema,
  type ImpactResult,
  replayResultSchema,
  simulateBodySchema,
  simulateResultSchema,
  type DecideBody,
  type DecisionDto,
  type DecisionRecordDto,
} from './decisions.schemas.js';
import { DecisionsService, STAFF } from './decisions.service.js';
import { EngineToolsService } from './engine-tools.service.js';

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
  constructor(private readonly tools: EngineToolsService) {}

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
  @HttpCode(200)
  @Route({
    summary: 'The impact of a version: the same inputs against another version, and what changes',
    tags: TAGS,
    access: 'staff',
    roles: STAFF,
    body: compareBodySchema,
    response: compareResultSchema,
  })
  compare(
    @Param('label', new ZodPipe(labelParam)) label: string,
    @Body(new ZodPipe(compareBodySchema)) body: z.infer<typeof compareBodySchema>,
  ): Promise<CompareResult> {
    return this.tools.compare(label, body);
  }

  @Post(':label/explore')
  @HttpCode(200)
  @Route({
    summary:
      'Run a set of inputs through a version: cards by light and primary, the outcome map, fixed-rule checks, rules never fired, and the inputs matching a query',
    tags: TAGS,
    access: 'staff',
    roles: STAFF,
    body: exploreBodySchema,
    response: exploreResultSchema,
  })
  explore(
    @Param('label', new ZodPipe(labelParam)) label: string,
    @Body(new ZodPipe(exploreBodySchema)) body: z.infer<typeof exploreBodySchema>,
  ): Promise<z.infer<typeof exploreResultSchema>> {
    return this.tools.explore(label, body);
  }

  @Post(':label/impact')
  @HttpCode(200)
  @Route({
    summary: 'What one rule affects: the cards that change when its row is taken out',
    tags: TAGS,
    access: 'staff',
    roles: STAFF,
    body: impactBodySchema,
    response: impactResultSchema,
  })
  impact(
    @Param('label', new ZodPipe(labelParam)) label: string,
    @Body(new ZodPipe(impactBodySchema)) body: z.infer<typeof impactBodySchema>,
  ): Promise<ImpactResult> {
    return this.tools.impact(label, body);
  }
}
