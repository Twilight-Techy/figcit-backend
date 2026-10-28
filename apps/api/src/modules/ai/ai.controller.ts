import { Body, Controller, Post, Req } from '@nestjs/common';
import type { z } from 'zod';
import {
  MaybeUser,
  type AuthedRequest,
  type RequestUser,
} from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import { RulesService } from '../rules/rules.service.js';
import { SafetyService } from '../safety/safety.service.js';
import {
  parseNeedRequestSchema,
  parseNeedResponseSchema,
  suggestDriversRequestSchema,
  suggestDriversResponseSchema,
} from './ai.schemas.js';
import { AiService } from './ai.service.js';
import { parseNeed, suggestDrivers } from './ai.tasks.js';

/** The two AI helpers the check-in uses; also open to Browse mode (rate-limited, nothing stored). */
@Controller('ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly rules: RulesService,
    private readonly safety: SafetyService,
  ) {}

  private async blocked(
    user: RequestUser | undefined,
    region = 'GB',
  ): Promise<{ safety: true; crisisRoutes: never[] }> {
    await this.safety.record({ userId: user?.id ?? null, sourceModule: 'ai', trigger: 'phrase' });
    return { safety: true, crisisRoutes: [...(await this.safety.routes(region))] as never[] };
  }

  @Post('parse-need')
  @Route({
    summary: 'Read "in your own words" into needs and chips (S91)',
    tags: ['AI'],
    access: 'browse',
    body: parseNeedRequestSchema,
    response: parseNeedResponseSchema,
  })
  async parseNeed(
    @MaybeUser() user: RequestUser | undefined,
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(parseNeedRequestSchema)) body: z.infer<typeof parseNeedRequestSchema>,
  ): Promise<z.infer<typeof parseNeedResponseSchema>> {
    const { snapshot } = await this.rules.current();
    const res = await this.ai.json(
      parseNeed,
      { text: body.text, snapshot },
      { userId: user?.id, browseToken: req.browseToken },
    );
    if (res.blocked) return this.blocked(user);
    return { safety: false, ...res.data, source: res.source, limited: res.limited };
  }

  @Post('suggest-drivers')
  @Route({
    summary: 'Suggest what might make a task engaging (S92)',
    tags: ['AI'],
    access: 'browse',
    body: suggestDriversRequestSchema,
    response: suggestDriversResponseSchema,
  })
  async suggestDrivers(
    @MaybeUser() user: RequestUser | undefined,
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(suggestDriversRequestSchema))
    body: z.infer<typeof suggestDriversRequestSchema>,
  ): Promise<z.infer<typeof suggestDriversResponseSchema>> {
    const res = await this.ai.json(
      suggestDrivers,
      { title: body.title, kind: body.kind },
      { userId: user?.id, browseToken: req.browseToken },
    );
    if (res.blocked) return this.blocked(user);
    return { safety: false, ...res.data, source: res.source, limited: res.limited };
  }
}
