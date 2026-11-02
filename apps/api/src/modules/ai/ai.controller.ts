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
  mapFeelingRequestSchema,
  mapFeelingResponseSchema,
  parseNeedRequestSchema,
  parseNeedResponseSchema,
  suggestDriversRequestSchema,
  splitTasksRequestSchema,
  splitTasksResponseSchema,
  suggestDriversResponseSchema,
} from './ai.schemas.js';
import { AiService } from './ai.service.js';
import { mapFeeling, parseNeed, splitTasks, suggestDrivers } from './ai.tasks.js';

/** Tab 11: below this confidence the app asks instead of choosing. */
const CONFIDENT = 0.7;

/** The AI helpers the check-in uses; also open to Browse mode (rate-limited, nothing stored). */
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
    const res = await this.ai.decide(
      suggestDrivers,
      { title: body.title, kind: body.kind },
      { userId: user?.id, browseToken: req.browseToken },
    );
    if (res.blocked) return this.blocked(user);
    return { safety: false, ...res.data, source: res.source, limited: res.limited };
  }

  @Post('map-feeling')
  @Route({
    summary: 'Match "in my own words" to feeling chips, with confidence (Tab 11 layer 3)',
    tags: ['AI'],
    access: 'browse',
    body: mapFeelingRequestSchema,
    response: mapFeelingResponseSchema,
  })
  async mapFeeling(
    @MaybeUser() user: RequestUser | undefined,
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(mapFeelingRequestSchema)) body: z.infer<typeof mapFeelingRequestSchema>,
  ): Promise<z.infer<typeof mapFeelingResponseSchema>> {
    const { snapshot } = await this.rules.current();
    const res = await this.ai.decide(
      mapFeeling,
      { text: body.text, snapshot },
      { userId: user?.id, browseToken: req.browseToken },
    );
    if (res.blocked) return this.blocked(user);
    const labels = new Map(snapshot.emotions.map((e) => [e.code, e.label]));
    const matches = res.data.matches.map((m) => ({ ...m, label: labels.get(m.code) ?? m.code }));
    const selected = matches.filter((m) => m.confidence >= CONFIDENT).map((m) => m.code);
    const unsure = matches.filter((m) => m.confidence < CONFIDENT).slice(0, 2);
    return {
      safety: false,
      matches,
      selected,
      ask:
        selected.length === 0 && unsure.length
          ? { options: unsure.map((m) => ({ code: m.code, label: m.label })) }
          : null,
      source: res.source,
      limited: res.limited,
    };
  }

  @Post('split-tasks')
  @Route({
    summary: 'Split one sentence into separate tasks for the user to confirm (Tab 11 layer 6)',
    tags: ['AI'],
    access: 'browse',
    body: splitTasksRequestSchema,
    response: splitTasksResponseSchema,
  })
  async splitTasks(
    @MaybeUser() user: RequestUser | undefined,
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(splitTasksRequestSchema)) body: z.infer<typeof splitTasksRequestSchema>,
  ): Promise<z.infer<typeof splitTasksResponseSchema>> {
    const res = await this.ai.json(
      splitTasks,
      { text: body.text },
      { userId: user?.id, browseToken: req.browseToken },
    );
    if (res.blocked) return this.blocked(user);
    return { safety: false, tasks: res.data.tasks, source: res.source, limited: res.limited };
  }
}
