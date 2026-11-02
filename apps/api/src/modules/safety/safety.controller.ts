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
import { z } from 'zod';
import { CurrentUser, MaybeUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import {
  contactInputSchema,
  contactListSchema,
  contactSchema,
  contactUpdateSchema,
  routesQuerySchema,
  routesSchema,
  safetyEventInputSchema,
  screenInputSchema,
  screenResultSchema,
  supportPlanInputSchema,
  supportPlanSchema,
  type ContactDto,
  type ContactInput,
  type ContactUpdate,
  type SupportPlanDto,
  type SupportPlanInput,
} from './safety.schemas.js';
import { SafetyService } from './safety.service.js';
import { SupportService } from './support.service.js';

const okSchema = z.object({ ok: z.literal(true) });

@Controller()
export class SafetyController {
  constructor(
    private readonly safety: SafetyService,
    private readonly support: SupportService,
  ) {}

  @Post('safety/events')
  @HttpCode(202)
  @Route({
    summary: 'Log that Help was opened or a route chosen (no text is stored)',
    tags: ['Safety'],
    access: 'browse',
    body: safetyEventInputSchema,
    response: okSchema,
    status: 202,
  })
  async event(
    @MaybeUser() user: RequestUser | undefined,
    @Body(new ZodPipe(safetyEventInputSchema)) body: z.infer<typeof safetyEventInputSchema>,
  ): Promise<{ ok: true }> {
    await this.safety.record({ userId: user?.id ?? null, ...body });
    return { ok: true };
  }

  @Post('safety/screen')
  @HttpCode(200)
  @Route({
    summary:
      "Browse: screen text kept on the phone with the server's phrase rules; the text is not stored (E-59)",
    tags: ['Safety'],
    access: 'browse',
    body: screenInputSchema,
    response: screenResultSchema,
  })
  async screen(
    @MaybeUser() user: RequestUser | undefined,
    @Body(new ZodPipe(screenInputSchema)) body: z.infer<typeof screenInputSchema>,
  ): Promise<z.infer<typeof screenResultSchema>> {
    const match = await this.safety.check(body.texts);
    if (!match) return { safety: false, category: null };
    await this.safety.record({
      userId: user?.id ?? null,
      sourceModule: body.sourceModule,
      trigger: 'phrase',
      ruleId: match.ruleId,
      category: match.category,
    });
    return { safety: true, category: match.category };
  }

  @Get('safety/routes')
  @Route({
    summary: 'Crisis routes for a region (works signed out)',
    tags: ['Safety'],
    access: 'public',
    query: routesQuerySchema,
    response: routesSchema,
  })
  async routes(
    @Query(new ZodPipe(routesQuerySchema)) q: z.infer<typeof routesQuerySchema>,
  ): Promise<z.infer<typeof routesSchema>> {
    const region = q.region?.toUpperCase() ?? 'GB';
    return { region, routes: [...(await this.safety.routes(region))] };
  }

  @Get('me/support-plan')
  @Route({ summary: 'My support plan', tags: ['Safety'], response: supportPlanSchema })
  plan(@CurrentUser() user: RequestUser): Promise<SupportPlanDto> {
    return this.support.plan(user.id);
  }

  @Put('me/support-plan')
  @Route({
    summary: 'Save my support plan',
    tags: ['Safety'],
    body: supportPlanInputSchema,
    response: supportPlanSchema,
  })
  savePlan(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(supportPlanInputSchema)) body: SupportPlanInput,
  ): Promise<SupportPlanDto> {
    return this.support.savePlan(user.id, body);
  }

  @Get('me/trusted-contacts')
  @Route({ summary: 'My trusted people', tags: ['Safety'], response: contactListSchema })
  async contacts(@CurrentUser() user: RequestUser): Promise<z.infer<typeof contactListSchema>> {
    return { items: await this.support.contacts(user.id) };
  }

  @Post('me/trusted-contacts')
  @Route({
    summary: 'Add a trusted person',
    tags: ['Safety'],
    body: contactInputSchema,
    response: contactSchema,
    status: 201,
  })
  add(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(contactInputSchema)) body: ContactInput,
  ): Promise<ContactDto> {
    return this.support.addContact(user.id, body);
  }

  @Patch('me/trusted-contacts/:id')
  @Route({
    summary: 'Change a trusted person',
    tags: ['Safety'],
    body: contactUpdateSchema,
    response: contactSchema,
  })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(contactUpdateSchema)) body: ContactUpdate,
  ): Promise<ContactDto> {
    return this.support.updateContact(user.id, id, body);
  }

  @Delete('me/trusted-contacts/:id')
  @HttpCode(204)
  @Route({ summary: 'Remove a trusted person', tags: ['Safety'], status: 204 })
  remove(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.support.removeContact(user.id, id);
  }
}
