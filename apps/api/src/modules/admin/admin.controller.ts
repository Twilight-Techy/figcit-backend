import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import { AdminService } from './admin.service.js';
import { SnapshotsService, type SnapshotSummary } from './snapshots.service.js';

const any = z.unknown();
const list = z.object({ items: z.array(z.unknown()) });
const uploadSchema = z
  .object({
    files: z.record(z.string().max(80), z.string().max(2_000_000)),
    notes: z.string().max(500).optional(),
  })
  .strict();
const decisionsQuery = z
  .object({
    light: z.enum(['green', 'yellow', 'amber', 'red', 'blue']).optional(),
    pattern: z.string().max(4).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();
const daysQuery = z.object({ days: z.coerce.number().int().min(1).max(90).default(14) }).strict();
const contentQuery = z.object({ kind: z.string().max(24).optional() }).strict();
const contentSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9_.]{3,120}$/),
    kind: z.enum([
      'copy',
      'tool_script',
      'reflect_prompt',
      'practice',
      'starter',
      'adaptation',
      'comm_card',
      'help_route',
      'card_wording',
      'pattern_template',
      'ai_prompt',
    ]),
    body: z.unknown(),
    touchesSafety: z.boolean().default(false),
  })
  .strict();
const auditQuery = z.object({ before: z.iso.datetime().optional() }).strict();

/** Staff console API. Every route needs a staff role and a two-step sign-in (rules §7). */
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly snapshots: SnapshotsService,
  ) {}

  @Get('snapshots')
  @Route({ summary: 'Rule snapshots', tags: ['Admin'], access: 'staff', response: list })
  async listSnapshots(): Promise<{ items: SnapshotSummary[] }> {
    return { items: await this.snapshots.list() };
  }

  @Post('snapshots')
  @Route({
    summary: 'Upload the workbook tabs (CSV) as a draft snapshot',
    tags: ['Admin'],
    access: 'staff',
    roles: ['admin', 'content_editor'],
    body: uploadSchema,
    response: any,
    status: 201,
  })
  upload(
    @CurrentUser() staff: RequestUser,
    @Body(new ZodPipe(uploadSchema)) body: z.infer<typeof uploadSchema>,
  ): Promise<SnapshotSummary> {
    return this.snapshots.upload(staff, body.files, body.notes);
  }

  @Post('snapshots/:id/review')
  @Route({
    summary: 'Approve a draft snapshot (not your own)',
    tags: ['Admin'],
    access: 'staff',
    roles: ['admin', 'content_editor', 'safety_reviewer'],
    response: any,
    status: 201,
  })
  review(
    @CurrentUser() staff: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SnapshotSummary> {
    return this.snapshots.review(staff, id);
  }

  @Post('snapshots/:id/safety-sign-off')
  @Route({
    summary: 'Clinical safety sign-off',
    tags: ['Admin'],
    access: 'staff',
    roles: ['safety_reviewer'],
    response: any,
    status: 201,
  })
  signOff(
    @CurrentUser() staff: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SnapshotSummary> {
    return this.snapshots.signOff(staff, id);
  }

  @Post('snapshots/:id/publish')
  @Route({
    summary: 'Publish (or roll back to) a snapshot',
    tags: ['Admin'],
    access: 'staff',
    roles: ['admin'],
    response: any,
    status: 201,
  })
  publish(
    @CurrentUser() staff: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SnapshotSummary> {
    return this.snapshots.publish(staff, id);
  }

  @Get('decisions')
  @Route({
    summary: 'Decision log',
    tags: ['Admin'],
    access: 'staff',
    query: decisionsQuery,
    response: list,
  })
  async decisions(
    @Query(new ZodPipe(decisionsQuery)) q: z.infer<typeof decisionsQuery>,
  ): Promise<{ items: unknown[] }> {
    return { items: await this.admin.decisions(q) };
  }

  @Get('decisions/:id')
  @Route({
    summary: 'One decision with its trace',
    tags: ['Admin'],
    access: 'staff',
    response: any,
  })
  decision(
    @CurrentUser() staff: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.admin.decision(staff, id);
  }

  @Get('safety-events')
  @Route({
    summary: 'Safety events (no text, no names)',
    tags: ['Admin'],
    access: 'staff',
    roles: ['admin', 'safety_reviewer'],
    query: daysQuery,
    response: any,
  })
  safety(@Query(new ZodPipe(daysQuery)) q: z.infer<typeof daysQuery>): Promise<unknown> {
    return this.admin.safetyEvents(q.days);
  }

  @Get('metrics')
  @Route({ summary: 'Service metrics', tags: ['Admin'], access: 'staff', response: any })
  metrics(): Promise<unknown> {
    return this.admin.metrics();
  }

  @Get('content')
  @Route({
    summary: 'Content items',
    tags: ['Admin'],
    access: 'staff',
    query: contentQuery,
    response: list,
  })
  async content(
    @Query(new ZodPipe(contentQuery)) q: z.infer<typeof contentQuery>,
  ): Promise<{ items: unknown[] }> {
    return { items: await this.admin.contentItems(q.kind) };
  }

  @Post('content')
  @Route({
    summary: 'Draft a new version of a content item',
    tags: ['Admin'],
    access: 'staff',
    roles: ['admin', 'content_editor'],
    body: contentSchema,
    response: any,
    status: 201,
  })
  draft(
    @CurrentUser() staff: RequestUser,
    @Body(new ZodPipe(contentSchema)) body: z.infer<typeof contentSchema>,
  ): Promise<unknown> {
    return this.admin.draftContent(staff, body);
  }

  @Post('content/:id/publish')
  @Route({
    summary: 'Publish a content item',
    tags: ['Admin'],
    access: 'staff',
    roles: ['admin', 'content_editor', 'safety_reviewer'],
    response: any,
    status: 201,
  })
  publishContent(
    @CurrentUser() staff: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.admin.publishContent(staff, id);
  }

  @Get('audit')
  @Route({
    summary: 'Audit log',
    tags: ['Admin'],
    access: 'staff',
    roles: ['admin'],
    query: auditQuery,
    response: list,
  })
  async auditLog(
    @Query(new ZodPipe(auditQuery)) q: z.infer<typeof auditQuery>,
  ): Promise<{ items: unknown[] }> {
    return { items: await this.admin.auditLog(q.before) };
  }
}
