import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { RunResult } from '@figcit/engine-v2';
import type { z } from 'zod';
import { CurrentUser, MaybeUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import { labelParam } from '../rulesets/rulesets.schemas.js';
import {
  decideBodySchema,
  decisionRecordSchema,
  decisionSchema,
  exploreBodySchema,
  exploreResultSchema,
  replayResultSchema,
  simulateBodySchema,
  simulateResultSchema,
  type DecideBody,
  type DecisionDto,
  type DecisionRecordDto,
} from './decisions.schemas.js';
import { DecisionsService, STAFF } from './decisions.service.js';

const TAGS = ['Engine v2'];

/**
 * Engine v2 recommendations (M5, DESIGN §10, E-52). The route is `/v1/decisions`: `v1` is the API
 * version, and a decision is the record of one card the engine made (E-27).
 */
@Controller('decisions')
export class DecisionsController {
  constructor(private readonly decisions: DecisionsService) {}

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

  @Post(':id/replay')
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
  constructor(private readonly decisions: DecisionsService) {}

  @Post(':label/simulate')
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
    return this.decisions.simulate(label, body.input, body.trace);
  }

  @Post(':label/explore')
  @Route({
    summary:
      'Run many inputs (or the publish sweep) through a version: cards by light and primary, and the fixed-rule checks',
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
    return this.decisions.explore(label, body.inputs);
  }
}
