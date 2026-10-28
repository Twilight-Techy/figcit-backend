import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { CryptoService, type UserCipher } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { AppError, BadInput, NotFound } from '../../common/errors/errors.js';
import { DomainEvents } from '../../platform/events/domain-events.js';
import { decodeCursor, encodeCursor } from '../checkin/checkin.mapper.js';
import { SafetyService } from '../safety/safety.service.js';
import { TasksService } from '../tasks/tasks.service.js';
import type {
  dumpCreatedSchema,
  DumpCreate,
  DumpDto,
  DumpItemDto,
  itemUpdateSchema,
  movedSchema,
  toTaskSchema,
} from './dump.schemas.js';

export const ITEM_SELECT = {
  id: true,
  position: true,
  textEnc: true,
  bucket: true,
  suggestedBucket: true,
  movedTo: true,
  movedToId: true,
} satisfies Prisma.DumpItemSelect;
export const DUMP_SELECT = {
  id: true,
  source: true,
  createdAt: true,
  sortedAt: true,
  items: { where: { deletedAt: null }, orderBy: { position: 'asc' }, select: ITEM_SELECT },
} satisfies Prisma.DumpSelect;
type ItemRow = Prisma.DumpItemGetPayload<{ select: typeof ITEM_SELECT }>;
type DumpRow = Prisma.DumpGetPayload<{ select: typeof DUMP_SELECT }>;

const itemDto = (r: ItemRow, c: UserCipher): DumpItemDto => ({
  id: r.id,
  position: r.position,
  text: c.dec(r.textEnc),
  bucket: r.bucket,
  suggestedBucket: r.suggestedBucket,
  movedTo: r.movedTo,
  movedToId: r.movedToId,
});

function dumpDto(r: DumpRow, c: UserCipher): DumpDto {
  const items = r.items.map((i) => itemDto(i, c));
  const count = (b: string | null) => items.filter((i) => i.bucket === b).length;
  return {
    id: r.id,
    source: r.source,
    createdAt: r.createdAt.toISOString(),
    sortedAt: r.sortedAt?.toISOString() ?? null,
    items,
    counts: {
      ideas: count('ideas'),
      notes: count('notes'),
      worries: count('worries'),
      todo: count('todo'),
      unsorted: count(null),
    },
  };
}

/** Splits pasted or spoken text into items: one per line, or per sentence for one long line. */
export function splitItems(text: string): string[] {
  const lines = text
    .split(/\r?\n|^\s*[-*•]\s+/m)
    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean);
  const parts =
    lines.length === 1
      ? (lines[0] ?? '')
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : lines;
  return parts.map((p) => p.slice(0, 2000)).slice(0, 200);
}

/** Dump: get it out of your head, then sort it (M05, S15–S17, Figma S101–S104). */
@Injectable()
export class DumpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly safety: SafetyService,
    private readonly tasks: TasksService,
    private readonly events: DomainEvents,
  ) {}

  async create(userId: string, input: DumpCreate): Promise<z.infer<typeof dumpCreatedSchema>> {
    const c = await this.crypto.forUser(userId);
    if (input.id) {
      const existing = await this.prisma.dump.findFirst({
        where: { id: input.id, userId },
        select: DUMP_SELECT,
      });
      if (existing) return { ...dumpDto(existing, c), safety: false, crisisRoutes: [] };
    }
    const items =
      input.items ?? splitItems(input.text ?? '').map((text) => ({ text, bucket: undefined }));
    const match = await this.safety.check(items.map((i) => i.text));
    const row = await this.prisma.dump.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        userId,
        source: input.source,
        transcriptionId: input.transcriptionId ?? null,
        origin: input.origin,
        items: {
          create: items.map((i, position) => ({
            userId,
            position,
            textEnc: c.enc(i.text),
            bucket: i.bucket ?? null,
          })),
        },
      },
      select: DUMP_SELECT,
    });
    if (match)
      await this.safety.record({
        userId,
        sourceModule: 'dump',
        trigger: 'phrase',
        ruleId: match.ruleId,
        category: match.category,
      });
    else this.events.emit('dump.created', { userId, dumpId: row.id });
    const region = match
      ? ((await this.prisma.user.findUnique({ where: { id: userId }, select: { region: true } }))
          ?.region ?? 'GB')
      : 'GB';
    return {
      ...dumpDto(row, c),
      safety: match !== null,
      crisisRoutes: match ? [...(await this.safety.routes(region))] : [],
    };
  }

  async get(userId: string, id: string): Promise<DumpDto> {
    const row = await this.prisma.dump.findFirst({
      where: { id, userId, deletedAt: null },
      select: DUMP_SELECT,
    });
    if (!row) throw new NotFound('dump');
    return dumpDto(row, await this.crypto.forUser(userId));
  }

  async list(
    userId: string,
    after: string | undefined,
    limit: number,
  ): Promise<{ items: DumpDto[]; next: string | null }> {
    const cur = after ? decodeCursor(after) : null;
    const rows = await this.prisma.dump.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(cur
          ? {
              OR: [
                { createdAt: { lt: cur.createdAt } },
                { createdAt: cur.createdAt, id: { lt: cur.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: DUMP_SELECT,
    });
    const c = await this.crypto.forUser(userId);
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map((r) => dumpDto(r, c)),
      next: rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async remove(userId: string, id: string): Promise<void> {
    const res = await this.prisma.dump.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (res.count === 0) throw new NotFound('dump');
  }

  async addItem(
    userId: string,
    dumpId: string,
    input: { text: string; bucket?: DumpItemDto['bucket'] | undefined },
  ): Promise<DumpItemDto> {
    const dump = await this.prisma.dump.findFirst({
      where: { id: dumpId, userId, deletedAt: null },
      select: { id: true, _count: { select: { items: true } } },
    });
    if (!dump) throw new NotFound('dump');
    if (dump._count.items >= 200)
      throw new BadInput('A dump holds up to 200 items. Start a new one.');
    const c = await this.crypto.forUser(userId);
    const row = await this.prisma.dumpItem.create({
      data: {
        dumpId,
        userId,
        position: dump._count.items,
        textEnc: c.enc(input.text),
        bucket: input.bucket ?? null,
      },
      select: ITEM_SELECT,
    });
    return itemDto(row, c);
  }

  private async item(userId: string, id: string): Promise<ItemRow & { dumpId: string }> {
    const row = await this.prisma.dumpItem.findFirst({
      where: { id, userId, deletedAt: null },
      select: { ...ITEM_SELECT, dumpId: true },
    });
    if (!row) throw new NotFound('dump item');
    return row;
  }

  async updateItem(
    userId: string,
    id: string,
    input: z.infer<typeof itemUpdateSchema>,
  ): Promise<DumpItemDto> {
    const before = await this.item(userId, id);
    const c = await this.crypto.forUser(userId);
    const row = await this.prisma.dumpItem.update({
      where: { id },
      data: {
        ...(input.text !== undefined ? { textEnc: c.enc(input.text) } : {}),
        ...(input.bucket !== undefined ? { bucket: input.bucket } : {}),
      },
      select: ITEM_SELECT,
    });
    await this.markSorted(before.dumpId);
    return itemDto(row, c);
  }

  private async markSorted(dumpId: string): Promise<void> {
    const unsorted = await this.prisma.dumpItem.count({
      where: { dumpId, bucket: null, deletedAt: null },
    });
    await this.prisma.dump.update({
      where: { id: dumpId },
      data: { sortedAt: unsorted === 0 ? new Date() : null },
    });
  }

  async removeItem(userId: string, id: string): Promise<void> {
    const item = await this.item(userId, id);
    await this.prisma.dumpItem.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.markSorted(item.dumpId);
  }

  async toTask(
    userId: string,
    id: string,
    input: z.infer<typeof toTaskSchema>,
  ): Promise<z.infer<typeof movedSchema>> {
    const item = await this.item(userId, id);
    if (item.bucket === 'worries')
      throw new AppError(
        409,
        'worry_not_task',
        'Worries stay worries',
        'A worry is not a job to do. You can reflect on it instead.',
      );
    if (item.movedTo === 'task' && item.movedToId)
      return { item: itemDto(item, await this.crypto.forUser(userId)), targetId: item.movedToId };
    const c = await this.crypto.forUser(userId);
    const text = c.dec(item.textEnc);
    const task = await this.tasks.create(userId, {
      title: (input.title ?? text).slice(0, 200),
      source: 'dump',
      puttingOff: false,
      drivers: [],
      steps: [],
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.dueAt ? { dueAt: input.dueAt } : {}),
    });
    await this.prisma.task.update({ where: { id: task.id }, data: { sourceDumpItemId: id } });
    return this.moved(userId, id, 'task', task.id);
  }

  async toDraft(userId: string, id: string): Promise<z.infer<typeof movedSchema>> {
    const item = await this.item(userId, id);
    const c = await this.crypto.forUser(userId);
    const draft = await this.prisma.draft.create({
      data: {
        userId,
        mode: 'draft',
        sourceType: 'dump_item',
        sourceId: id,
        versions: { create: { mode: 'draft', bodyEnc: c.enc(c.dec(item.textEnc)) } },
      },
      select: { id: true },
    });
    return this.moved(userId, id, 'draft', draft.id);
  }

  async moved(
    userId: string,
    id: string,
    to: 'task' | 'draft' | 'reflection',
    targetId: string,
  ): Promise<z.infer<typeof movedSchema>> {
    const row = await this.prisma.dumpItem.update({
      where: { id },
      data: { movedTo: to, movedToId: targetId },
      select: ITEM_SELECT,
    });
    return { item: itemDto(row, await this.crypto.forUser(userId)), targetId };
  }

  /** Plain text of one item, for the Reflect module's "reflect on this". */
  async itemText(userId: string, id: string): Promise<string> {
    const item = await this.item(userId, id);
    return (await this.crypto.forUser(userId)).dec(item.textEnc);
  }
}
