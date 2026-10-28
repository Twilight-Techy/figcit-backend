import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CryptoService, type UserCipher } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { BadInput, NotFound } from '../../common/errors/errors.js';
import { nextOccurrence, parseRule } from '../../common/time/rrule.js';
import type { PracticeCreate, PracticeDto, PracticeUpdate } from './practices.schemas.js';

const MAX = 50;
type Row = Prisma.PracticeGetPayload<object>;

function toDto(r: Row, c: UserCipher, tz: string, now: Date): PracticeDto {
  const rule = parseRule(r.scheduleRule);
  return {
    id: r.id,
    type: r.type,
    name: c.dec(r.nameEnc),
    content: c.decOpt(r.contentEnc),
    link: c.decOpt(r.linkEnc),
    audioFileId: r.audioFileId,
    scheduleRule: r.scheduleRule,
    nextAt: rule ? nextOccurrence(rule, now, tz).toISOString() : null,
    reminderStyle: r.reminderStyle,
    minutes: r.minutes,
    helpsWhenStruggling: r.helpsWhenStruggling,
    makesMeWorse: r.makesMeWorse,
    isTransitionRitual: r.isTransitionRitual,
    position: r.position,
  };
}

function updateData(input: PracticeUpdate, c: UserCipher): Prisma.PracticeUncheckedUpdateInput {
  const plain = {
    type: input.type,
    audioFileId: input.audioFileId,
    scheduleRule: input.scheduleRule,
    reminderStyle: input.reminderStyle,
    minutes: input.minutes,
    helpsWhenStruggling: input.helpsWhenStruggling,
    makesMeWorse: input.makesMeWorse,
    isTransitionRitual: input.isTransitionRitual,
    position: input.position,
  };
  return {
    ...Object.fromEntries(Object.entries(plain).filter(([, v]) => v !== undefined)),
    ...(input.name !== undefined ? { nameEnc: c.enc(input.name) } : {}),
    ...(input.content !== undefined ? { contentEnc: c.encOpt(input.content) } : {}),
    ...(input.link !== undefined ? { linkEnc: c.encOpt(input.link) } : {}),
  };
}

/** My practices: rituals, prayers and recitations. Always free (ENT-4); never chosen from profile data (MD-3). */
@Injectable()
export class PracticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  private async ctx(userId: string): Promise<{ c: UserCipher; tz: string; now: Date }> {
    const [c, user] = await Promise.all([
      this.crypto.forUser(userId),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } }),
    ]);
    return { c, tz: user.timezone, now: new Date() };
  }

  async list(userId: string): Promise<PracticeDto[]> {
    const { c, tz, now } = await this.ctx(userId);
    const rows = await this.prisma.practice.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => toDto(r, c, tz, now));
  }

  async get(userId: string, id: string): Promise<PracticeDto> {
    const { c, tz, now } = await this.ctx(userId);
    const row = await this.prisma.practice.findFirst({ where: { id, userId, deletedAt: null } });
    if (!row) throw new NotFound('practice');
    return toDto(row, c, tz, now);
  }

  private async assertFile(userId: string, fileId: string | null | undefined): Promise<void> {
    if (fileId && (await this.prisma.storedFile.count({ where: { id: fileId, userId } })) === 0)
      throw new NotFound('audio file');
  }

  async create(userId: string, input: PracticeCreate): Promise<PracticeDto> {
    if (input.id && (await this.prisma.practice.count({ where: { id: input.id, userId } })))
      return this.get(userId, input.id);
    const { c, tz, now } = await this.ctx(userId);
    const count = await this.prisma.practice.count({ where: { userId, deletedAt: null } });
    if (count >= MAX) throw new BadInput(`You can keep up to ${String(MAX)} practices.`);
    await this.assertFile(userId, input.audioFileId);
    const row = await this.prisma.practice.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        userId,
        type: input.type,
        nameEnc: c.enc(input.name),
        contentEnc: c.encOpt(input.content),
        linkEnc: c.encOpt(input.link),
        audioFileId: input.audioFileId ?? null,
        scheduleRule: input.scheduleRule ?? null,
        reminderStyle: input.reminderStyle,
        minutes: input.minutes ?? null,
        helpsWhenStruggling: input.helpsWhenStruggling,
        makesMeWorse: input.makesMeWorse,
        isTransitionRitual: input.isTransitionRitual,
        position: count,
      },
    });
    return toDto(row, c, tz, now);
  }

  async update(userId: string, id: string, input: PracticeUpdate): Promise<PracticeDto> {
    const existing = await this.prisma.practice.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new NotFound('practice');
    const { c, tz, now } = await this.ctx(userId);
    const clientAt = input.clientUpdatedAt ? new Date(input.clientUpdatedAt) : now;
    if (existing.clientUpdatedAt > clientAt) return toDto(existing, c, tz, now);
    await this.assertFile(userId, input.audioFileId);
    const row = await this.prisma.practice.update({
      where: { id },
      data: { ...updateData(input, c), clientUpdatedAt: clientAt },
    });
    return toDto(row, c, tz, now);
  }

  async remove(userId: string, id: string): Promise<void> {
    const res = await this.prisma.practice.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (res.count === 0) throw new NotFound('practice');
  }
}
