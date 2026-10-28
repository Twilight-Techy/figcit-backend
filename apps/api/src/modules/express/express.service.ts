import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CryptoService, type UserCipher } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { NotEntitled, NotFound } from '../../common/errors/errors.js';
import { AiService, type TextEvent } from '../ai/ai.service.js';
import { draft, rewrite, script, simplify, structure } from '../ai/ai.tasks.js';
import { changes, type Changes } from '../ai/text.js';
import { EntitlementsService } from '../entitlements/entitlements.service.js';
import { SafetyService } from '../safety/safety.service.js';
import type {
  AssistRequest,
  AssistResult,
  DraftCreate,
  DraftDto,
  DraftUpdate,
} from './express.schemas.js';

const SELECT = {
  id: true,
  titleEnc: true,
  purposeEnc: true,
  audience: true,
  mode: true,
  sourceType: true,
  sourceId: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  clientUpdatedAt: true,
  versions: {
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      mode: true,
      bodyEnc: true,
      aiUsed: true,
      aiTask: true,
      changes: true,
      createdAt: true,
    },
  },
} satisfies Prisma.DraftSelect;
type Row = Prisma.DraftGetPayload<{ select: typeof SELECT }>;

const ADVANCED = new Set(['draft', 'structure', 'script']);
const TEXT_TASKS = { simplify, rewrite, draft } as const;

function toDto(r: Row, c: UserCipher): DraftDto {
  const latest = r.versions[0];
  return {
    id: r.id,
    title: c.decOpt(r.titleEnc),
    purpose: c.decOpt(r.purposeEnc),
    audience: r.audience,
    mode: r.mode,
    body: latest ? c.dec(latest.bodyEnc) : '',
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    archived: r.archivedAt !== null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    versions: r.versions.map((v) => ({
      id: v.id,
      mode: v.mode,
      aiUsed: v.aiUsed,
      aiTask: v.aiTask,
      changes: (v.changes as Changes | null) ?? null,
      createdAt: v.createdAt.toISOString(),
    })),
  };
}

/** Express: say it your way. Drafts, versions and the assist modes (M07, S18–S19, Figma S111–S116). Never sends. */
@Injectable()
export class ExpressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly ai: AiService,
    private readonly safety: SafetyService,
    private readonly entitlements: EntitlementsService,
  ) {}

  private async row(userId: string, id: string): Promise<Row> {
    const row = await this.prisma.draft.findFirst({
      where: { id, userId, deletedAt: null },
      select: SELECT,
    });
    if (!row) throw new NotFound('draft');
    return row;
  }

  async get(userId: string, id: string): Promise<DraftDto> {
    return toDto(await this.row(userId, id), await this.crypto.forUser(userId));
  }

  async list(userId: string, archived: boolean): Promise<Omit<DraftDto, 'versions'>[]> {
    const rows = await this.prisma.draft.findMany({
      where: { userId, deletedAt: null, archivedAt: archived ? { not: null } : null },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: { ...SELECT, versions: { ...SELECT.versions, take: 1 } },
    });
    const c = await this.crypto.forUser(userId);
    return rows.map((r) => {
      const { versions: _v, ...rest } = toDto(r, c);
      return rest;
    });
  }

  async create(userId: string, input: DraftCreate): Promise<DraftDto> {
    if (input.id) {
      const existing = await this.prisma.draft.findFirst({
        where: { id: input.id, userId },
        select: { id: true },
      });
      if (existing) return this.get(userId, existing.id);
    }
    const c = await this.crypto.forUser(userId);
    const row = await this.prisma.draft.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        userId,
        titleEnc: c.encOpt(input.title),
        purposeEnc: c.encOpt(input.purpose),
        audience: input.audience ?? null,
        mode: input.mode,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        versions: { create: { mode: input.mode, bodyEnc: c.enc(input.body) } },
      },
      select: SELECT,
    });
    return toDto(row, c);
  }

  async update(userId: string, id: string, input: DraftUpdate): Promise<DraftDto> {
    const before = await this.row(userId, id);
    const c = await this.crypto.forUser(userId);
    const clientAt = input.clientUpdatedAt ? new Date(input.clientUpdatedAt) : new Date();
    if (before.clientUpdatedAt > clientAt) return toDto(before, c);
    const latest = before.versions[0];
    const bodyChanged =
      input.body !== undefined && (!latest || c.dec(latest.bodyEnc) !== input.body);
    await this.prisma.draft.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { titleEnc: c.encOpt(input.title) } : {}),
        ...(input.purpose !== undefined ? { purposeEnc: c.encOpt(input.purpose) } : {}),
        ...(input.audience !== undefined ? { audience: input.audience } : {}),
        ...(input.mode !== undefined ? { mode: input.mode } : {}),
        ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
        clientUpdatedAt: clientAt,
        ...(bodyChanged && input.body !== undefined
          ? {
              versions: { create: { mode: input.mode ?? before.mode, bodyEnc: c.enc(input.body) } },
            }
          : {}),
      },
    });
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const res = await this.prisma.draft.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (res.count === 0) throw new NotFound('draft');
  }

  /** Checks access and safety and works out the text to assist with. Null text means safety blocked. */
  async prepare(
    userId: string,
    id: string,
    req: AssistRequest,
  ): Promise<{ text: string; purpose: string | undefined; blocked: AssistResult | null }> {
    if (ADVANCED.has(req.mode) && (await this.entitlements.tierFor(userId)) !== 'plus')
      throw new NotEntitled(`${req.mode[0]?.toUpperCase() ?? ''}${req.mode.slice(1)}`);
    const row = await this.row(userId, id);
    const c = await this.crypto.forUser(userId);
    const latest = row.versions[0];
    const text = req.text ?? (latest ? c.dec(latest.bodyEnc) : '');
    const purpose = c.decOpt(row.purposeEnc) ?? undefined;
    const match = await this.safety.check([text, purpose]);
    if (!match) return { text, purpose, blocked: null };
    await this.safety.record({
      userId,
      sourceModule: 'express',
      trigger: 'phrase',
      ruleId: match.ruleId,
      category: match.category,
    });
    const region =
      (await this.prisma.user.findUnique({ where: { id: userId }, select: { region: true } }))
        ?.region ?? 'GB';
    return {
      text,
      purpose,
      blocked: { safety: true, crisisRoutes: [...(await this.safety.routes(region))] },
    };
  }

  private async saveVersion(
    userId: string,
    id: string,
    mode: AssistRequest['mode'],
    body: string,
    aiUsed: boolean,
    diff: Changes | null,
  ): Promise<string> {
    const c = await this.crypto.forUser(userId);
    const v = await this.prisma.draftVersion.create({
      data: {
        draftId: id,
        mode,
        bodyEnc: c.enc(body),
        aiUsed,
        aiTask: mode,
        ...(diff ? { changes: diff as unknown as Prisma.InputJsonValue } : {}),
      },
      select: { id: true },
    });
    await this.prisma.draft.update({ where: { id }, data: { mode, clientUpdatedAt: new Date() } });
    return v.id;
  }

  /** Streams simplify / rewrite / draft. The last event carries the saved version. */
  async *streamAssist(
    userId: string,
    id: string,
    req: AssistRequest & { mode: 'simplify' | 'rewrite' | 'draft' },
    text: string,
    purpose: string | undefined,
  ): AsyncGenerator<TextEvent | { type: 'saved'; result: AssistResult }> {
    const task = TEXT_TASKS[req.mode];
    for await (const ev of this.ai.stream(
      task,
      { text, level: req.level, purpose },
      { userId, allowance: 'assist' },
    )) {
      if (ev.type === 'delta') {
        yield ev;
        continue;
      }
      const diff = req.mode === 'draft' ? null : changes(text, ev.text);
      const versionId = await this.saveVersion(
        userId,
        id,
        req.mode,
        ev.text,
        ev.source === 'ai',
        diff,
      );
      yield {
        type: 'saved',
        result: {
          safety: false,
          mode: req.mode,
          text: ev.text,
          changes: diff,
          source: ev.source,
          replaced: ev.replaced,
          limited: ev.limited,
          versionId,
        },
      };
    }
  }

  async assist(userId: string, id: string, req: AssistRequest): Promise<AssistResult> {
    const { text, purpose, blocked } = await this.prepare(userId, id, req);
    if (blocked) return blocked;
    if (req.mode === 'structure' || req.mode === 'script')
      return this.structured(userId, id, req.mode, text, purpose, req.level);
    let saved: AssistResult | null = null;
    for await (const ev of this.streamAssist(userId, id, { ...req, mode: req.mode }, text, purpose))
      if (ev.type === 'saved') saved = ev.result;
    if (!saved) throw new Error('assist produced no result');
    return saved;
  }

  private async structured(
    userId: string,
    id: string,
    mode: 'structure' | 'script',
    text: string,
    purpose: string | undefined,
    level: AssistRequest['level'],
  ): Promise<AssistResult> {
    const input = { text, level, purpose };
    const caller = { userId, allowance: 'assist' as const };
    if (mode === 'structure') {
      const res = await this.ai.json(structure, input, caller);
      if (res.blocked) throw new Error('screened earlier');
      const body = res.data.sections.map((s) => s.text).join('\n\n');
      const versionId = await this.saveVersion(userId, id, mode, body, res.source === 'ai', null);
      return {
        safety: false,
        mode,
        text: body,
        sections: res.data.sections,
        changes: null,
        source: res.source,
        replaced: false,
        limited: res.limited,
        versionId,
      };
    }
    const res = await this.ai.json(script, input, caller);
    if (res.blocked) throw new Error('screened earlier');
    const body = res.data.lines.map((l) => l.text).join('\n');
    const versionId = await this.saveVersion(userId, id, mode, body, res.source === 'ai', null);
    return {
      safety: false,
      mode,
      text: body,
      lines: res.data.lines,
      changes: null,
      source: res.source,
      replaced: false,
      limited: res.limited,
      versionId,
    };
  }
}
