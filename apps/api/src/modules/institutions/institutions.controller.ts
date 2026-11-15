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
} from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import { type DashboardDto, InstitutionsService } from './institutions.service.js';

const joinSchema = z.object({ code: z.string().trim().min(4).max(16) }).strict();
const joinedSchema = z.object({ tenantId: z.uuid(), name: z.string() });
const mineSchema = z.object({
  tenant: z.object({ id: z.uuid(), name: z.string(), kind: z.string() }).nullable(),
  role: z.string().nullable(),
  sharing: z.boolean(),
});
const weekSchema = z.object({
  weekStart: z.iso.date(),
  metric: z.string(),
  dimension: z.string(),
  value: z.number().nullable(),
  suppressed: z.boolean(),
});
const dashboardSchema = z.object({
  tenant: z.object({ name: z.string(), anonymityFloor: z.number().int() }),
  members: z.number().int(),
  seats: z.object({ used: z.number().int(), purchased: z.number().int().nullable() }),
  sharing: z.number().nullable(),
  weeks: z.array(weekSchema),
  invoices: z.array(
    z.object({
      number: z.string(),
      periodStart: z.iso.date(),
      periodEnd: z.iso.date(),
      seats: z.number().int(),
      amountMinor: z.number().int(),
      vatMinor: z.number().int(),
      totalMinor: z.number().int(),
      currency: z.string(),
      status: z.enum(['sent', 'paid']),
      issuedAt: z.iso.datetime().nullable(),
      dueAt: z.iso.date().nullable(),
      paidAt: z.iso.datetime().nullable(),
    }),
  ),
});
const outreachSchema = z
  .object({
    message: z.string().trim().min(1).max(1000),
    preferred: z.enum(['email', 'phone', 'in_person']).default('email'),
  })
  .strict();
const handleSchema = z.object({ status: z.enum(['acknowledged', 'closed']) }).strict();
const inviteSchema = z
  .object({
    maxUses: z.number().int().min(1).max(10_000).optional(),
    days: z.number().int().min(1).max(365).default(30),
  })
  .strict();

@Controller()
export class InstitutionsController {
  constructor(private readonly institutions: InstitutionsService) {}

  @Post('institutions/join')
  @Route({
    summary: 'Join with an institution code (S80)',
    tags: ['Institutions'],
    body: joinSchema,
    response: joinedSchema,
    status: 201,
  })
  join(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(joinSchema)) body: z.infer<typeof joinSchema>,
  ): Promise<z.infer<typeof joinedSchema>> {
    return this.institutions.join(user.id, body.code);
  }

  @Get('me/institution')
  @Route({
    summary: 'My institution link and what it can see',
    tags: ['Institutions'],
    response: mineSchema,
  })
  mine(@CurrentUser() user: RequestUser): Promise<z.infer<typeof mineSchema>> {
    return this.institutions.mine(user.id);
  }

  @Delete('me/institution')
  @HttpCode(204)
  @Route({ summary: 'Leave my institution', tags: ['Institutions'], status: 204 })
  leave(@CurrentUser() user: RequestUser): Promise<void> {
    return this.institutions.leave(user.id);
  }

  @Post('me/institution/outreach')
  @Route({
    summary: 'Ask my institution for support (S82)',
    tags: ['Institutions'],
    body: outreachSchema,
    response: z.object({ id: z.uuid() }),
    status: 201,
  })
  outreach(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(outreachSchema)) body: z.infer<typeof outreachSchema>,
  ): Promise<{ id: string }> {
    return this.institutions.outreach(user.id, body.message, body.preferred);
  }

  @Get('institutions/:id/dashboard')
  @Route({
    summary: 'Seats, group trends above the anonymity floor, and invoices (S84)',
    tags: ['Institutions'],
    response: dashboardSchema,
  })
  dashboard(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DashboardDto> {
    return this.institutions.dashboard(user.id, id);
  }

  @Get('institutions/:id/outreach')
  @Route({
    summary: 'Support requests (S86)',
    tags: ['Institutions'],
    response: z.object({ items: z.array(z.unknown()) }),
  })
  async outreachList(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ items: unknown[] }> {
    return { items: await this.institutions.outreachList(user.id, id) };
  }

  @Patch('institutions/:id/outreach/:requestId')
  @HttpCode(204)
  @Route({
    summary: 'Acknowledge or close a request',
    tags: ['Institutions'],
    body: handleSchema,
    status: 204,
  })
  handle(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body(new ZodPipe(handleSchema)) body: z.infer<typeof handleSchema>,
  ): Promise<void> {
    return this.institutions.handleOutreach(user.id, id, requestId, body.status);
  }

  @Post('institutions/:id/invite-codes')
  @Route({
    summary: 'Make an invite code',
    tags: ['Institutions'],
    body: inviteSchema,
    response: z.object({ code: z.string(), expiresAt: z.iso.datetime() }),
    status: 201,
  })
  invite(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(inviteSchema)) body: z.infer<typeof inviteSchema>,
  ): Promise<{ code: string; expiresAt: string }> {
    return this.institutions.inviteCode(user.id, id, body.maxUses, body.days);
  }
}
