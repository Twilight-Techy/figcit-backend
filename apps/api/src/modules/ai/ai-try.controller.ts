import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import type { z } from 'zod';
import { AppError } from '../../common/errors/errors.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import { STAFF } from '../decisions/decisions.service.js';
import { RulesService } from '../rules/rules.service.js';
import {
  aiStatusSchema,
  tryParseNeedRequestSchema,
  tryParseNeedResponseSchema,
  trySuggestDriversRequestSchema,
  trySuggestDriversResponseSchema,
} from './ai.schemas.js';
import { AiService, type AiResult } from './ai.service.js';
import { parseNeed, suggestDrivers } from './ai.tasks.js';

const TAGS = ['AI'];

/**
 * The check-in's AI steps for the staff Simulator (E-61): parse-need and suggest-drivers as the
 * app gets them, without counting against a user's limit and without a safety event (nothing
 * here is a real user's words). With `real`, the model only: refused while it isn't ready.
 */
@Controller('ai')
export class AiTryController {
  constructor(
    private readonly ai: AiService,
    private readonly rules: RulesService,
  ) {}

  @Get('status')
  @Route({
    summary: 'Whether the AI can be reached now (staff)',
    tags: TAGS,
    access: 'staff',
    roles: STAFF,
    response: aiStatusSchema,
  })
  status(): z.infer<typeof aiStatusSchema> {
    return this.ai.status();
  }

  @Post('try/parse-need')
  @HttpCode(200)
  @Route({
    summary: 'Parse-need as the check-in runs it, for the Simulator (staff; nothing recorded)',
    tags: TAGS,
    access: 'staff',
    roles: STAFF,
    body: tryParseNeedRequestSchema,
    response: tryParseNeedResponseSchema,
  })
  async parseNeed(
    @Body(new ZodPipe(tryParseNeedRequestSchema)) body: z.infer<typeof tryParseNeedRequestSchema>,
  ): Promise<z.infer<typeof tryParseNeedResponseSchema>> {
    this.ready(body.real);
    const { snapshot } = await this.rules.current();
    return shown(await this.ai.json(parseNeed, { text: body.text, snapshot }, {}));
  }

  @Post('try/suggest-drivers')
  @HttpCode(200)
  @Route({
    summary:
      'Suggest-drivers as the task step runs it, for the Simulator (staff; nothing recorded)',
    tags: TAGS,
    access: 'staff',
    roles: STAFF,
    body: trySuggestDriversRequestSchema,
    response: trySuggestDriversResponseSchema,
  })
  async suggestDrivers(
    @Body(new ZodPipe(trySuggestDriversRequestSchema))
    body: z.infer<typeof trySuggestDriversRequestSchema>,
  ): Promise<z.infer<typeof trySuggestDriversResponseSchema>> {
    this.ready(body.real);
    return shown(await this.ai.decide(suggestDrivers, { title: body.title, kind: body.kind }, {}));
  }

  /** "The real AI" refuses while the model can't be reached, instead of falling back. */
  private ready(real: boolean): void {
    if (!real) return;
    const s = this.ai.status();
    if (!s.configured || s.circuitOpen)
      throw new AppError(
        503,
        'ai_not_ready',
        "The AI isn't ready",
        s.configured
          ? 'The model server kept failing; calls are paused for a minute.'
          : 'No model server is set up (AI_BASE_URL).',
      );
  }
}

function shown<O extends object>(
  res: AiResult<O>,
):
  | (O & { safety: false; source: 'ai' | 'fallback'; limited: boolean })
  | {
      safety: true;
      category: string | null;
    } {
  if (res.blocked) return { safety: true, category: res.match.category };
  return { safety: false, ...res.data, source: res.source, limited: res.limited };
}
