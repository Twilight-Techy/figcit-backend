import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, type RequestUser } from '../../common/guards/request-user.js';
import { Route } from '../../common/http/route.js';
import { ZodPipe } from '../../common/http/zod.pipe.js';
import { RuleGapsService, type DecisionDto, type GapDto } from './rule-gaps.service.js';
import {
  RulesetAuditService,
  type Actor,
  type AuditEventDto,
  type ChainCheck,
} from './ruleset-audit.service.js';
import {
  addRecordBody,
  auditQuery,
  decisionBody,
  draftBody,
  editRecordBody,
  gapBody,
  gapsQuery,
  gapUpdateBody,
  importBody,
  labelParam,
  reasonBody,
  tabParam,
} from './rulesets.schemas.js';
import { RulesetLifecycleService } from './ruleset-lifecycle.service.js';
import { RulesetRecordsService } from './ruleset-records.service.js';
import type { HistoryEntry, RecordDto, VersionDetail, VersionSummary } from './rulesets.dto.js';
import { RulesetsService } from './rulesets.service.js';

const any = z.unknown();
const list = z.object({ items: z.array(z.unknown()) });
// Staff who work on or review rules may read the rule set; only the clinical admin changes it
// (E-34). The editor / Product Owner / Clinical Safety approval split is TODO T-01.
const READ = ['clinical_admin', 'admin', 'safety_reviewer', 'content_editor'] as const;
const WRITE = ['clinical_admin'] as const;
const TAGS = ['Rule store (engine v2)'];

function actorOf(user: RequestUser): Actor {
  return { id: user.id, role: READ.find((r) => user.roles.includes(r)) ?? 'staff' };
}

/** Staff API for the engine v2 rule store (docs/engine-v2/DESIGN.md §3, §6, §10). */
@Controller('rulesets')
export class RulesetsController {
  constructor(
    private readonly rulesets: RulesetsService,
    private readonly records: RulesetRecordsService,
    private readonly lifecycle: RulesetLifecycleService,
    private readonly gaps: RuleGapsService,
    private readonly audit: RulesetAuditService,
  ) {}

  @Get()
  @Route({ summary: 'Rule set versions', tags: TAGS, access: 'staff', roles: READ, response: list })
  async list(): Promise<{ items: VersionSummary[] }> {
    return { items: await this.rulesets.list() };
  }

  @Post('import')
  @Route({
    summary: 'Import the workbook tabs (CSV per tab) as a new draft version',
    tags: TAGS,
    access: 'staff',
    roles: WRITE,
    body: importBody,
    response: any,
    status: 201,
  })
  importWorkbook(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(importBody)) body: z.infer<typeof importBody>,
  ): Promise<unknown> {
    return this.rulesets.importWorkbook(
      actorOf(user),
      body.files,
      body.workbookVersion,
      body.notes,
    );
  }

  @Post('drafts')
  @Route({
    summary: 'Start a draft from a version (default: the published one)',
    tags: TAGS,
    access: 'staff',
    roles: WRITE,
    body: draftBody,
    response: any,
    status: 201,
    example: { body: { from: '3.3-r1', notes: 'Fix EX-1 wording' } },
  })
  draft(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(draftBody)) body: z.infer<typeof draftBody>,
  ): Promise<VersionSummary> {
    return this.rulesets.createDraft(actorOf(user), body.from, body.notes);
  }

  // ---- registers and audit (before `:label` so they are not read as labels) ----

  @Get('gaps')
  @Route({
    summary: 'Gap register',
    tags: TAGS,
    access: 'staff',
    roles: READ,
    query: gapsQuery,
    response: list,
  })
  async listGaps(
    @Query(new ZodPipe(gapsQuery)) q: z.infer<typeof gapsQuery>,
  ): Promise<{ items: GapDto[] }> {
    return { items: await this.gaps.list(q.status) };
  }

  @Post('gaps')
  @Route({
    summary: 'Record a gap',
    tags: TAGS,
    access: 'staff',
    roles: WRITE,
    body: gapBody,
    response: any,
    status: 201,
  })
  createGap(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(gapBody)) body: z.infer<typeof gapBody>,
  ): Promise<GapDto> {
    return this.gaps.create(actorOf(user), body);
  }

  @Patch('gaps/:id')
  @Route({
    summary: 'Acknowledge, resolve or update a gap',
    tags: TAGS,
    access: 'staff',
    roles: WRITE,
    body: gapUpdateBody,
    response: any,
  })
  updateGap(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(gapUpdateBody)) body: z.infer<typeof gapUpdateBody>,
  ): Promise<GapDto> {
    return this.gaps.update(actorOf(user), id, body);
  }

  @Get('decisions')
  @Route({ summary: 'Decision register', tags: TAGS, access: 'staff', roles: READ, response: list })
  async listDecisions(): Promise<{ items: DecisionDto[] }> {
    return { items: await this.gaps.decisions() };
  }

  @Post('decisions')
  @Route({
    summary: 'Record a decision that fills gaps',
    tags: TAGS,
    access: 'staff',
    roles: WRITE,
    body: decisionBody,
    response: any,
    status: 201,
  })
  addDecision(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(decisionBody)) body: z.infer<typeof decisionBody>,
  ): Promise<DecisionDto> {
    return this.gaps.addDecision(actorOf(user), body);
  }

  @Get('audit')
  @Route({
    summary: 'Rule store audit log, newest first',
    tags: TAGS,
    access: 'staff',
    roles: READ,
    query: auditQuery,
    response: list,
  })
  async auditLog(
    @Query(new ZodPipe(auditQuery)) q: z.infer<typeof auditQuery>,
  ): Promise<{ items: AuditEventDto[] }> {
    return {
      items: await this.audit.list({
        ...(q.versionId ? { versionId: q.versionId } : {}),
        ...(q.recordId ? { recordId: q.recordId } : {}),
        ...(q.before ? { before: BigInt(q.before) } : {}),
        take: q.limit,
      }),
    };
  }

  @Get('audit/verify')
  @Route({
    summary: 'Check the audit log hash chain',
    tags: TAGS,
    access: 'staff',
    roles: READ,
    response: any,
  })
  verifyAudit(): Promise<ChainCheck> {
    return this.audit.verify();
  }

  @Get('records/:recordId/history')
  @Route({
    summary: 'One rule across every version',
    tags: TAGS,
    access: 'staff',
    roles: READ,
    response: list,
  })
  async history(
    @Param('recordId', ParseUUIDPipe) recordId: string,
  ): Promise<{ items: HistoryEntry[] }> {
    return { items: await this.rulesets.history(recordId) };
  }

  // ---- one version ----

  @Get(':label')
  @Route({
    summary: 'A version with its counts and checks',
    tags: TAGS,
    access: 'staff',
    roles: READ,
    response: any,
  })
  get(@Param('label', new ZodPipe(labelParam)) label: string): Promise<VersionDetail> {
    return this.rulesets.get(label);
  }

  @Get(':label/tabs/:tab')
  @Route({
    summary: 'The rows of one tab, in workbook order',
    tags: TAGS,
    access: 'staff',
    roles: READ,
    response: list,
  })
  async tab(
    @Param('label', new ZodPipe(labelParam)) label: string,
    @Param('tab', new ZodPipe(tabParam)) tab: string,
  ): Promise<{ items: RecordDto[] }> {
    return { items: await this.rulesets.tab(label, tab) };
  }

  @Get(':label/export')
  @Route({
    summary: 'The version written back into the workbook tabs (CSV per tab)',
    tags: TAGS,
    access: 'staff',
    roles: READ,
    response: any,
  })
  export(@Param('label', new ZodPipe(labelParam)) label: string): Promise<unknown> {
    return this.rulesets.export(label);
  }

  @Post(':label/records')
  @Route({
    summary: 'Add a row to a draft, after an existing row of the same table',
    tags: TAGS,
    access: 'staff',
    roles: WRITE,
    body: addRecordBody,
    response: any,
    status: 201,
  })
  addRecord(
    @CurrentUser() user: RequestUser,
    @Param('label', new ZodPipe(labelParam)) label: string,
    @Body(new ZodPipe(addRecordBody)) body: z.infer<typeof addRecordBody>,
  ): Promise<RecordDto> {
    return this.records.add(actorOf(user), label, body);
  }

  @Patch(':label/records/:recordId')
  @Route({
    summary: 'Edit a row of a draft',
    tags: TAGS,
    access: 'staff',
    roles: WRITE,
    body: editRecordBody,
    response: any,
    example: {
      body: { mapping: 'unresolved', workbookTag: 'v3.3', reason: 'Exempt until IG-20 is agreed' },
    },
  })
  editRecord(
    @CurrentUser() user: RequestUser,
    @Param('label', new ZodPipe(labelParam)) label: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Body(new ZodPipe(editRecordBody)) body: z.infer<typeof editRecordBody>,
  ): Promise<RecordDto> {
    return this.records.edit(actorOf(user), label, recordId, body);
  }

  @Post(':label/records/:recordId/retire')
  @Route({
    summary: 'Retire a row of a draft',
    tags: TAGS,
    access: 'staff',
    roles: WRITE,
    body: reasonBody,
    response: any,
    status: 201,
  })
  retire(
    @CurrentUser() user: RequestUser,
    @Param('label', new ZodPipe(labelParam)) label: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Body(new ZodPipe(reasonBody)) body: z.infer<typeof reasonBody>,
  ): Promise<RecordDto> {
    return this.records.setStatus(actorOf(user), label, recordId, 'retired', body.reason);
  }

  @Post(':label/records/:recordId/restore')
  @Route({
    summary: 'Bring a retired row back in a draft',
    tags: TAGS,
    access: 'staff',
    roles: WRITE,
    body: reasonBody,
    response: any,
    status: 201,
  })
  restore(
    @CurrentUser() user: RequestUser,
    @Param('label', new ZodPipe(labelParam)) label: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Body(new ZodPipe(reasonBody)) body: z.infer<typeof reasonBody>,
  ): Promise<RecordDto> {
    return this.records.setStatus(actorOf(user), label, recordId, 'active', body.reason);
  }

  @Post(':label/submit')
  @Route({
    summary: 'Freeze a draft for review (hash and checks)',
    tags: TAGS,
    access: 'staff',
    roles: WRITE,
    response: any,
    status: 201,
  })
  submit(
    @CurrentUser() user: RequestUser,
    @Param('label', new ZodPipe(labelParam)) label: string,
  ): Promise<VersionDetail> {
    return this.lifecycle.submit(actorOf(user), label);
  }

  @Post(':label/reopen')
  @Route({
    summary: 'Send a version in review back to draft',
    tags: TAGS,
    access: 'staff',
    roles: WRITE,
    response: any,
    status: 201,
  })
  reopen(
    @CurrentUser() user: RequestUser,
    @Param('label', new ZodPipe(labelParam)) label: string,
  ): Promise<VersionDetail> {
    return this.lifecycle.reopen(actorOf(user), label);
  }

  @Post(':label/publish')
  @Route({
    summary: 'Publish a version in review',
    tags: TAGS,
    access: 'staff',
    roles: WRITE,
    response: any,
    status: 201,
  })
  publish(
    @CurrentUser() user: RequestUser,
    @Param('label', new ZodPipe(labelParam)) label: string,
  ): Promise<VersionDetail> {
    return this.lifecycle.publish(actorOf(user), label);
  }

  @Post(':label/rollback')
  @Route({
    summary: 'Publish a copy of an earlier version',
    tags: TAGS,
    access: 'staff',
    roles: WRITE,
    body: reasonBody,
    response: any,
    status: 201,
  })
  rollback(
    @CurrentUser() user: RequestUser,
    @Param('label', new ZodPipe(labelParam)) label: string,
    @Body(new ZodPipe(reasonBody)) body: z.infer<typeof reasonBody>,
  ): Promise<VersionDetail> {
    return this.lifecycle.rollback(actorOf(user), label, body.reason);
  }

  @Post(':label/discard')
  @Route({
    summary: 'Discard a draft or a version in review',
    tags: TAGS,
    access: 'staff',
    roles: WRITE,
    body: reasonBody,
    response: any,
    status: 201,
  })
  discard(
    @CurrentUser() user: RequestUser,
    @Param('label', new ZodPipe(labelParam)) label: string,
    @Body(new ZodPipe(reasonBody)) body: z.infer<typeof reasonBody>,
  ): Promise<VersionDetail> {
    return this.lifecycle.discard(actorOf(user), label, body.reason);
  }
}
